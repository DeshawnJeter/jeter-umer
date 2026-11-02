import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Manager } from '../apps/server/src/orchestrator/manager.js';
import { Store } from '../apps/server/src/storage/store.js';
import { runPair } from '../apps/server/src/runners/harness.js';
import { loadProfile, instructionBundle, loadSystemManifest, assertRequestFits } from '../apps/server/src/runners/instructions.js';
import { loadSkills } from '../apps/server/src/runners/skills.js';
import { route } from '../apps/server/src/router/index.js';
import { normalizeQuestion, combineQuestion, validateAnswer } from '../shared/contracts/questions.js';
import { defaults, clone, ROLES } from '../shared/contracts/index.js';
const brief = { prompt: 'Collect stars', title: 'Checked Demo', difficulty: 'beginner', music: false };
const directory = () => mkdtemp(join(tmpdir(), 'prompt-loop-'));
const question = (key, role, extras = {}) => ({ key, text: 'Which direction should this use?', reason: 'The human should choose the creative direction.', options: ['warm', 'cool'], recommended: 'warm', blocking: true, affectedRoles: [role], ...extras });
async function makeManager(router) { const m = new Manager(new Store(await directory()), router ? { router } : {}); await m.initialize(); return m; }
async function idle(m, run) { await m.jobs.get(run.id); return run; }
async function planned(m, settings = brief) { const run = await m.create(settings); await idle(m, run); assert.equal(run.status, 'awaiting_plan'); return run; }
async function implement(m, run) { await m.act(run.id, 'approve_plan', { planHash: run.planHash }); return idle(m, run); }

test('master, shared rules, role prompts and selected skills load with stable hashes', async () => {
  const first = await loadSystemManifest(), second = await loadSystemManifest(); assert.equal(first.hash, second.hash); assert.match(first.master.text, /human approves/i);
  for (const role of ROLES) {
    const profile = await loadProfile(role); const worker = await instructionBundle(role, 'worker', profile), checker = await instructionBundle(role, 'checker', profile);
    assert.match(worker.instructions, /Shared agent rules/); assert.ok(worker.skills.length); assert.ok(checker.skills.includes('playtest-evidence')); assert.ok(!worker.skills.includes('playtest-evidence')); assert.notEqual(worker.hash, checker.hash);
  }
  await assert.rejects(loadSkills(['../../.env'])); await assert.rejects(loadSkills(['planning', 'planning']));
});
test('context accounting includes instructions and repair data instead of truncating', () => {
  assert.throws(() => assertRequestFits({ instructions: 'x'.repeat(16001), task: {} }, 16000), /Context exceeds/);
  assert.throws(() => assertRequestFits({ instructions: 'required', findings: ['x'.repeat(1000)] }, 500), /Context exceeds/);
});
test('worker and checker tools have separate capabilities and saved request audits', async () => {
  const dir = await directory();
  const result = await runPair({ role: 'gameplay', brief, directory: dir,
    worker: async ({ tools, task }) => { assert.equal(task.role, 'gameplay'); assert.equal(tools.inspect_artifact, undefined); assert.deepEqual(tools.inspect_context().brief, brief); return tools.propose_artifact(clone(defaults.gameplay)); },
    checker: async ({ tools }) => { assert.equal(tools.propose_artifact, undefined); const artifact = tools.inspect_artifact(); assert.equal(artifact.speed, 190); return { verdict: 'pass', findings: [], evidence: ['Inspected proposed movement settings'] }; } });
  assert.equal(result.status, 'accepted');
  const workerAudit = JSON.parse(await readFile(join(dir, 'gameplay/attempt-1-worker.json'), 'utf8'));
  const checkerAudit = JSON.parse(await readFile(join(dir, 'gameplay/attempt-1-checker.json'), 'utf8'));
  assert.deepEqual(workerAudit.toolCalls, ['inspect_context', 'propose_artifact']); assert.deepEqual(checkerAudit.toolCalls, ['inspect_artifact']);
  assert.equal(workerAudit.request.hash, result.audit.workerHash); assert.equal(checkerAudit.request.hash, result.audit.checkerHash);
});
test('questions validate options, plain-text responses, recommendations and shared keys', () => {
  const q = normalizeQuestion(question('art.mood', 'ui'), 'ui'); assert.equal(validateAnswer(q, 'warm'), 'warm'); assert.throws(() => validateAnswer(q, 'other'));
  assert.throws(() => normalizeQuestion(question('constructor', 'ui'), 'ui')); assert.throws(() => normalizeQuestion({ key: 'test' }, 'ui'));
  assert.throws(() => normalizeQuestion(question('mood', 'ui', { recommended: 'absent' }), 'ui'));
  const other = normalizeQuestion(question('art.mood', 'story'), 'story', 'checker'); combineQuestion(q, other); assert.equal(q.requesters.length, 2); assert.ok(q.affectedRoles.includes('story'));
  assert.throws(() => combineQuestion(q, normalizeQuestion(question('art.mood', 'ui', { text: 'Conflicting question' }), 'ui')));
});
test('checker can request structured human context independently', async () => {
  const result = await runPair({ role: 'audio', brief, directory: await directory(), worker: async () => ({ artifact: clone(defaults.audio) }), checker: async () => ({ verdict: 'needs_human', findings: ['Creative preference unknown'], evidence: ['Compared supplied brief with audio requirement'], question: question('audio.style', 'audio') }) });
  assert.equal(result.status, 'needs_human'); assert.equal(result.question.requesters[0].source, 'checker');
});
test('checked plan waits for explicit matching human approval before any specialist runs', async () => {
  const m = await makeManager(); const run = await planned(m);
  assert.deepEqual(Object.keys(run.results), ['planner']); assert.equal(run.build, null); assert.equal(run.planApproval, null);
  await assert.rejects(m.act(run.id, 'approve_plan', { planHash: 'stale' }));
  await implement(m, run); assert.equal(run.status, 'awaiting_review'); assert.equal(run.planApproval.hash, run.planHash);
});
test('plan revisions invalidate approval and do not start specialists automatically', async () => {
  const m = await makeManager(); const run = await planned(m); const oldHash = run.planHash;
  await m.act(run.id, 'revise_plan', { title: 'Revised Title', difficulty: 'experienced' }); await idle(m, run);
  assert.equal(run.status, 'awaiting_plan'); assert.notEqual(run.planHash, oldHash); assert.equal(run.planApproval, null); assert.deepEqual(Object.keys(run.results), ['planner']);
});
test('free-text story input blocks only story and reaches both worker and checker context', async () => {
  const m = await makeManager(); const run = await planned(m, { ...brief, askStory: true }); await implement(m, run);
  assert.equal(run.status, 'awaiting_human'); assert.equal(run.questions.length, 1); assert.equal(run.tasks.story.status, 'blocked');
  for (const role of ['gameplay', 'levels', 'ui', 'audio']) assert.equal(run.results[role].status, 'accepted');
  const gameplay = run.results.gameplay; const q = run.questions[0]; assert.equal(q.key, 'story.direction');
  await assert.rejects(m.act(run.id, 'answer', { questionId: q.id, answer: '' }));
  await m.act(run.id, 'answer', { questionId: q.id, answer: 'A mysterious space rescue' }); await idle(m, run);
  assert.equal(run.status, 'awaiting_review'); assert.equal(run.results.gameplay, gameplay); assert.match(run.results.story.artifact.intro, /mysterious/);
  const audit = JSON.parse(await readFile(join(m.store.folder(run.id), 'workspaces', `generation-${run.generation}`, 'story/attempt-1-checker.json'), 'utf8'));
  assert.equal(audit.request.context.decisions['story.direction'], 'A mysterious space rescue');
  assert.ok(run.tasks.story.dependencies.includes(run.tasks.planner.id));
});
test('multiple independent blocking questions survive answers and process restarts', async () => {
  const router = async role => {
    const handlers = await route(role); if (!['story', 'audio'].includes(role)) return handlers;
    return { ...handlers, worker: async input => input.context.decisions[`${role}.direction`] ? handlers.worker(input) : { question: question(`${role}.direction`, role) } };
  };
  const m = await makeManager(router); const run = await planned(m); await implement(m, run); assert.equal(run.questions.length, 2);
  const restored = new Manager(m.store, { router }); await restored.initialize(); const saved = restored.get(run.id);
  const first = saved.questions[0]; await restored.act(saved.id, 'answer', { questionId: first.id, answer: 'warm' }); await idle(restored, saved);
  assert.equal(saved.questions.length, 1); assert.equal(saved.status, 'awaiting_human');
  const last = saved.questions[0]; await restored.act(saved.id, 'answer', { questionId: last.id, answer: 'cool' }); await idle(restored, saved);
  assert.equal(saved.status, 'awaiting_review'); assert.equal(saved.answers.length, 2);
});
test('equivalent questions combine requesters and invalidate only the affected roles', async () => {
  const router = async role => {
    const handlers = await route(role); if (!['gameplay', 'ui'].includes(role)) return handlers;
    return { ...handlers, worker: async input => input.context.decisions['art.mood'] ? handlers.worker(input) : { question: question('art.mood', role) } };
  };
  const m = await makeManager(router); const run = await planned(m); await implement(m, run);
  assert.equal(run.questions.length, 1); assert.equal(run.questions[0].requesters.length, 2); const levels = run.results.levels;
  await m.act(run.id, 'answer', { questionId: run.questions[0].id, answer: 'warm' }); await idle(m, run);
  assert.equal(run.status, 'awaiting_review'); assert.equal(run.results.levels, levels);
});
test('optional questions permit progress without inventing an answer', async () => {
  const router = async role => { const handlers = await route(role); if (role !== 'audio') return handlers; return { ...handlers, worker: async input => ({ ...await handlers.worker(input), ...(input.context.decisions['audio.preference'] ? {} : { question: question('audio.preference', role, { blocking: false }) }) }) }; };
  const m = await makeManager(router); const run = await planned(m); await implement(m, run);
  assert.equal(run.status, 'awaiting_review'); assert.equal(run.questions.length, 1); assert.equal(run.questions[0].blocking, false); assert.equal(run.decisions['audio.preference'], undefined);
});
test('concurrent duplicate human decisions cannot launch two copies of the loop', async () => {
  const m = await makeManager(); const run = await planned(m);
  const responses = await Promise.allSettled([m.act(run.id, 'approve_plan', { planHash: run.planHash }), m.act(run.id, 'approve_plan', { planHash: run.planHash })]);
  await idle(m, run); assert.equal(responses.filter(response => response.status === 'fulfilled').length, 1); assert.equal(run.status, 'awaiting_review'); assert.equal(run.steps, 13);
});
test('instruction provenance changes reject stale plan approval', async () => {
  const m = await makeManager(); const run = await planned(m); run.instructions.hash = 'changed';
  await assert.rejects(m.act(run.id, 'approve_plan', { planHash: run.planHash }), /Instructions changed/);
  await m.act(run.id, 'revise_plan', { difficulty: 'beginner' }); await idle(m, run); assert.equal(run.status, 'awaiting_plan'); assert.notEqual(run.instructions.hash, 'changed');
});
