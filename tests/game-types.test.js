import {activeRoles,CORE_ROLES,EXTENSION_SPECS} from '../shared/specialists.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GAME_TYPES, referenceLevel, roundOutcome, genreOf } from '../shared/game-types.js';
import { validateBrief, defaults, clone } from '../shared/contracts/index.js';
import { inspectLevel } from '../agents/levels/checker.js';
import { Manager } from '../apps/server/src/orchestrator/manager.js';
import { Store } from '../apps/server/src/storage/store.js';
import { hashBuild } from '../apps/server/src/integration/build.js';
import { createRuntime } from './fixtures/legacy-provider.js';

test('game type selection defaults old briefs and rejects unknown/prototype names', () => {
  assert.equal(validateBrief({ prompt: 'Explore' }).genre, 'collector');
  for (const genre of ['constructor', '__proto__', '../../file', 'arbitrary-code', '']) assert.throws(() => genreOf(genre));
});
test('all genre references are reachable under their specific movement model', () => {
  for (const genre of Object.keys(GAME_TYPES)) assert.deepEqual(inspectLevel(referenceLevel(genre), genre).findings, [], genre);
  const unreachable = referenceLevel('platformer'); unreachable.stars[0] = { x: 1, y: 1 };
  assert.ok(inspectLevel(unreachable, 'platformer').findings.length);
  const gap = referenceLevel('platformer'); gap.walls = gap.walls.filter(p => p.x !== 5 || p.y !== 9);
  assert.ok(inspectLevel(gap, 'platformer').findings.some(f => f.includes('floor')));
});
test('genre outcomes distinguish optional stars, survival timeout, damage and collection', () => {
  const state = { remaining: 30, score: 0, required: 3, atExit: true, health: 3 };
  assert.equal(roundOutcome({ ...state, genre: 'maze' }), 'won');
  assert.equal(roundOutcome({ ...state, genre: 'collector' }), 'playing');
  assert.equal(roundOutcome({ ...state, genre: 'platformer', score: 3 }), 'won');
  assert.equal(roundOutcome({ ...state, genre: 'survival' }), 'playing');
  assert.equal(roundOutcome({ ...state, genre: 'survival', remaining: 0 }), 'won');
  assert.equal(roundOutcome({ ...state, genre: 'survival', remaining: 0, health: 0 }), 'lost');
  assert.equal(roundOutcome({ ...state, genre: 'maze', remaining: 0 }), 'lost');
});
test('every genre traverses all six checked roles and delivers rules with a hashed build', async () => {
  for (const genre of Object.keys(GAME_TYPES)) {
    const root = await mkdtemp(join(tmpdir(), 'genre-loop-'));
    const manager = new Manager(new Store(root), { runtime: createRuntime({ env: {} }) });
    await manager.initialize(); const run = await manager.create({ title: `${genre} test`, prompt: 'An adventure', genre, difficulty: 'beginner', music: false });
    await manager.jobs.get(run.id); assert.equal(run.status, 'awaiting_plan');
    await manager.act(run.id, 'approve_plan', { planHash: run.planHash }); await manager.jobs.get(run.id);
    assert.equal(run.status, 'awaiting_review', run.error); assert.equal(Object.keys(run.results).length, activeRoles(run.brief.genre).length);
    const folder = join(root, run.id, 'builds', '0');
    const config = JSON.parse(await readFile(join(folder, 'config.json'), 'utf8')); assert.equal(config.genre, genre);
    assert.match(await readFile(join(folder, 'rules.js'), 'utf8'), /roundOutcome/);
    if (!['collector','maze','platformer','survival'].includes(genre)) {
      const runtime = await readFile(join(folder, 'genres', `${genre}.js`), 'utf8');
      assert.match(runtime, /createMode/, 'A registered game style must ship its playable runtime');
      for (const name of ['advanced.js','advanced-games.js','extra-game-types.js','turn-combat.js','genres/side-combat.js','genres/rpg-core.js']) assert.ok((await readFile(join(folder,name))).length, name);
    }
    const before = await hashBuild(folder); await writeFile(join(folder, 'additional-asset.txt'), 'Changed asset');
    assert.notEqual(await hashBuild(folder), before, 'Additional delivered assets must invalidate approval');
  }
});
test('changing game type invalidates accepted work and human approval', async () => {
  const root = await mkdtemp(join(tmpdir(), 'genre-revision-'));
  const manager = new Manager(new Store(root), { runtime: createRuntime({ env: {} }) }); await manager.initialize();
  const run = await manager.create({ title: 'Switch', prompt: 'Explore', difficulty: 'beginner', genre: 'collector' }); await manager.jobs.get(run.id);
  const oldHash = run.planHash; await manager.act(run.id, 'revise_plan', { genre: 'survival' }); await manager.jobs.get(run.id);
  assert.equal(run.brief.genre, 'survival'); assert.notEqual(run.planHash, oldHash); assert.equal(run.planApproval, null);
  await assert.rejects(manager.act(run.id, 'approve_plan', { planHash: oldHash }));
});
