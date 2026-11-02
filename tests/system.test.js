import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaults, clone, ROLES, validateArtifact, validateBrief } from '../shared/contracts/index.js';
import { assertTransition } from '../shared/policies/index.js';
import { route } from '../apps/server/src/router/index.js';
import { runPair } from '../apps/server/src/runners/harness.js';
import { Store } from '../apps/server/src/storage/store.js';
import { Manager } from '../apps/server/src/orchestrator/manager.js';
import { inspectLevel } from '../agents/levels/checker.js';
import { validateGame, HUMAN_CHECKS } from '../apps/server/src/validation/index.js';

const brief = { prompt: 'Collect stars in space', title: 'Test Game', difficulty: 'beginner', music: false };
const temp = () => mkdtemp(join(tmpdir(), 'game-builder-test-'));
async function manager() { const instance = new Manager(new Store(await temp())); await instance.initialize(); return instance; }
async function settle(m, id) {
  const job = m.jobs.get(id); if (job) await job; const run = m.get(id);
  // Simulate explicit human plan approval in these baseline integration tests.
  if (run.status === 'awaiting_plan') { await m.act(id, 'approve_plan', { planHash: run.planHash }); await m.jobs.get(id); }
  return run;
}

test('contracts reject malformed game data and unsupported difficulty', () => {
  for (const role of ROLES) assert.deepEqual(validateArtifact(role, defaults[role]), []);
  assert.ok(validateArtifact('gameplay', { speed: Infinity, timeLimit: 1 }).length);
  assert.ok(validateArtifact('levels', { spawn: {}, exit: {}, stars: [], walls: [] }).length);
  assert.throws(() => validateBrief({ prompt: '' })); assert.throws(() => validateBrief({ ...brief, difficulty: 'impossible' }));
  assert.throws(() => assertTransition('running', 'complete')); assert.throws(() => assertTransition('complete', 'running'));
});
test('router rejects unknown agents', async () => { await assert.rejects(route('../secrets')); });
test('each specialist has an independent checker and accepted artifact', async () => {
  const directory = await temp();
  for (const role of ROLES) {
    const result = await runPair({ role, brief, context: { plan: { ...clone(defaults.planner), title: brief.title } }, ...await route(role), directory });
    assert.equal(result.status, 'accepted', role); assert.equal(result.report.verdict, 'pass');
    assert.deepEqual(JSON.parse(await readFile(join(directory, role, 'accepted.json'), 'utf8')), result.artifact);
  }
});
test('level checker rejects blocked and overlapping objectives', () => {
  const level = clone(defaults.levels); level.walls = [{ x: 0, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 2 }];
  assert.ok(inspectLevel(level).findings.some(message => message.includes('reachable')));
  level.exit = clone(level.spawn); assert.ok(inspectLevel(level).findings.some(message => message.includes('distinct')));
});
test('checker failure feeds repairs back and stops after the retry limit', async () => {
  let attempts = 0;
  await assert.rejects(runPair({ role: 'gameplay', brief, directory: await temp(), worker: async ({ findings }) => { attempts++; if (attempts > 1) assert.ok(findings.length); return { artifact: clone(defaults.gameplay) }; }, checker: async () => ({ verdict: 'fail', findings: ['Broken behavior'], evidence: ['Independent observation'] }) }), /exhausted/);
  assert.equal(attempts, 3);
});
test('checker changes cannot mutate a submitted artifact', async () => {
  const result = await runPair({ role: 'gameplay', brief, directory: await temp(), worker: async () => ({ artifact: clone(defaults.gameplay) }), checker: async ({ artifact }) => { artifact.speed = 999; return { verdict: 'pass', findings: [], evidence: ['Inspected copy'] }; } });
  assert.equal(result.artifact.speed, defaults.gameplay.speed);
});
test('oversized context fails instead of silently dropping requirements', async () => {
  await assert.rejects(runPair({ role: 'gameplay', brief, context: { data: 'x'.repeat(17000) }, directory: await temp() }), /Context exceeds/);
});
test('whole-game validation rejects cross-agent inconsistency', () => {
  const config = clone(defaults); config.ui.title = 'Wrong title'; assert.equal(validateGame(config).passed, false);
});
test('human context resumes the loop and exact-build approval is required', async () => {
  const m = await manager(); const run = await m.create({ ...brief, difficulty: '' }); await settle(m, run.id);
  assert.equal(run.status, 'awaiting_human'); assert.equal(run.build, null);
  await m.act(run.id, 'answer', { questionId: run.questions[0].id, answer: 'beginner' }); await settle(m, run.id);
  assert.equal(run.status, 'awaiting_review'); assert.equal(Object.keys(run.results).length, 6);
  assert.equal(run.validation.passed, true); assert.equal(run.answers.length, 1);
  await assert.rejects(m.act(run.id, 'approve', { sha256: run.build.sha256, checks: {} }), /Playtest/);
  const checks = Object.fromEntries(HUMAN_CHECKS.map(key => [key, true]));
  await assert.rejects(m.act(run.id, 'approve', { sha256: 'stale-build', checks }), /Playtest/);
  await m.act(run.id, 'approve', { sha256: run.build.sha256, checks }); assert.equal(run.status, 'complete');
  assert.equal(run.approval.source, 'human-attestation'); await assert.rejects(m.act(run.id, 'revise', { difficulty: 'experienced' }));
});
test('modified delivery bytes invalidate approval', async () => {
  const m = await manager(); const run = await m.create(brief); await settle(m, run.id);
  await writeFile(join(m.store.folder(run.id), 'builds', '0', 'game.js'), '// changed');
  await assert.rejects(m.act(run.id, 'approve', { sha256: run.build.sha256, checks: Object.fromEntries(HUMAN_CHECKS.map(k => [k, true])) }), /Build changed/);
});
test('revision invalidates the previous build and the global step budget stops endless work', async () => {
  const m = await manager(); const run = await m.create(brief); await settle(m, run.id); const original = run.build.sha256;
  await m.act(run.id, 'revise', { difficulty: 'experienced', music: true });
  assert.equal(run.build, null); await settle(m, run.id);
  assert.equal(run.status, 'awaiting_review'); assert.notEqual(run.build.sha256, original);
  run.steps = 40; await m.save(run);
  await m.act(run.id, 'revise', { difficulty: 'beginner', music: false }); await settle(m, run.id);
  assert.equal(run.status, 'stopped'); assert.ok(run.steps <= 40); assert.notEqual(run.build?.sha256, original);
});
test('cancel is terminal and saved interrupted runs recover as paused', async () => {
  const m = await manager(); const run = await m.create({ ...brief, difficulty: '' }); await settle(m, run.id);
  await m.act(run.id, 'cancel'); assert.equal(run.status, 'cancelled'); await assert.rejects(m.act(run.id, 'answer', { answer: 'beginner' }));
  const m2 = await manager(); const run2 = await m2.create(brief); await settle(m2, run2.id);
  run2.status = 'running'; await m2.save(run2); const recovered = new Manager(m2.store); await recovered.initialize();
  assert.equal(recovered.get(run2.id).status, 'paused');
});
