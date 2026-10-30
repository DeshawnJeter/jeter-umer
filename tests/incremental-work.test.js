import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Manager} from '../apps/server/src/orchestrator/manager.js';import {Store} from '../apps/server/src/storage/store.js';import {createRuntime} from '../apps/server/src/providers/runtime.js';
test('audio-only revision preserves checked gameplay and renews human approval before affected work',async()=>{
  const manager=new Manager(new Store(await mkdtemp(join(tmpdir(),'incremental-'))),{runtime:createRuntime({env:{}}),browserMode:'off'});
  const run=await manager.create({title:'Incremental',prompt:'Collect stars',difficulty:'beginner'});await manager.jobs.get(run.id);await manager.act(run.id,'approve_plan',{planHash:run.planHash});await manager.jobs.get(run.id);
  assert.equal(run.status,'awaiting_review',run.error);const before=run.memory.handoffs.length,gameplay=run.memory.artifacts.gameplay;
  await manager.act(run.id,'revise',{music:true,musicStyle:'lofi'});await manager.jobs.get(run.id);
  assert.equal(run.status,'awaiting_plan');assert.equal(run.planApproval,null);assert.equal(run.memory.artifacts.gameplay.hash,gameplay.hash);assert.equal(run.memory.artifacts.gameplay.stale,false);assert.equal(run.results.audio,undefined);
  await manager.act(run.id,'approve_plan',{planHash:run.planHash});await manager.jobs.get(run.id);
  assert.equal(run.status,'awaiting_review',run.error);
  assert.deepEqual(run.memory.handoffs.slice(before).map(h=>h.role),['audio','implementation','integration','qa']);assert.equal(run.results.audio.artifact.music,true);
});
