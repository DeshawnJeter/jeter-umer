import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Manager } from '../apps/server/src/orchestrator/manager.js';
import { Store } from '../apps/server/src/storage/store.js';
import { createRuntime } from '../apps/server/src/providers/runtime.js';
import { responseSchema } from '../apps/server/src/providers/schemas.js';
import { MUSIC_STYLES, MUSIC_INSTRUMENTS } from '../shared/music.js';
test('changing music style/instrument requires fresh plan approval and exports the checked choice',async()=>{
  const root=await mkdtemp(join(tmpdir(),'instrument-loop-')),manager=new Manager(new Store(root),{runtime:createRuntime({env:{}})});
  const run=await manager.create({prompt:'Explore',title:'Mystic Bells',difficulty:'beginner',music:true});await manager.jobs.get(run.id);const oldHash=run.planHash;
  await manager.act(run.id,'revise_plan',{musicStyle:'mysterious',musicInstrument:'bell'});await manager.jobs.get(run.id);
  assert.notEqual(run.planHash,oldHash);await assert.rejects(manager.act(run.id,'approve_plan',{planHash:oldHash}));
  await manager.act(run.id,'approve_plan',{planHash:run.planHash});await manager.jobs.get(run.id);assert.equal(run.status,'awaiting_review',run.error);
  const score=JSON.parse(await readFile(join(root,run.id,'builds',String(run.generation),'music-score.json'),'utf8'));
  assert.equal(score.instrument,'bell');assert.equal(score.style,'mysterious');assert.equal(score.drums,false);
});
test('model score schemas expose the same safe choices as the runtime catalog',()=>{
  const schema=responseSchema('audio','worker').properties.artifact.anyOf[0].properties.score;
  assert.deepEqual(schema.properties.style.enum,Object.keys(MUSIC_STYLES));assert.deepEqual(schema.properties.instrument.enum,Object.keys(MUSIC_INSTRUMENTS));
  assert.ok(schema.required.includes('instrument'));assert.equal(schema.additionalProperties,false);
});
