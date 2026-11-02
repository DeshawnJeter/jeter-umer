import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {runPair} from '../apps/server/src/runners/harness.js';import {defaults,clone} from '../shared/contracts/index.js';
import {Manager} from '../apps/server/src/orchestrator/manager.js';import {Store} from '../apps/server/src/storage/store.js';import {createRuntime} from './fixtures/legacy-provider.js';import {route} from '../apps/server/src/router/index.js';
const pass={verdict:'pass',findings:[],evidence:['Independent current-context check']};
async function fixture(){let calls=0;const options={role:'gameplay',brief:{title:'Resume',prompt:'A game',difficulty:'beginner'},context:{plan:clone(defaults.planner),decisions:{},memory:{projectId:'one',generation:0,revision:1,dependencies:[{role:'planner',hash:'original'}],checkpoint:null}},execution:{provider:'openai',models:{worker:'fixture',checker:'fixture'}},directory:await mkdtemp(join(tmpdir(),'proposal-resume-')),worker:async()=>{calls++;return {artifact:clone(defaults.gameplay)};}};await assert.rejects(runPair({...options,checker:async()=>{throw Error('Interrupted before checker response');}}),/Interrupted/);return {options,calls:()=>calls};}
test('an interrupted model proposal is reused but still requires a fresh independent checker',async()=>{
  const {options,calls}=await fixture();options.context.memory.revision=2;options.context.memory.checkpoint={stage:'checking'};let checked=0;
  const result=await runPair({...options,checker:async request=>{checked++;assert.deepEqual(request.artifact,defaults.gameplay);return pass;}});
  assert.equal(result.status,'accepted');assert.equal(calls(),1);assert.equal(checked,1);
});
test('changed requirements or dependency hashes prevent reuse of an unfinished proposal',async()=>{
  for(const change of [o=>{o.brief.prompt='A changed game';},o=>{o.context.memory.dependencies[0].hash='changed';},o=>{o.context.decisions.style='new human decision';}]){
    const {options,calls}=await fixture();change(options);await runPair({...options,checker:async()=>pass});assert.equal(calls(),2);
  }
});
test('retry keeps accepted work and cumulative steps; stopped budget runs cannot retry',async()=>{
  let interrupted=false;
  const manager=new Manager(new Store(await mkdtemp(join(tmpdir(),'retry-accepted-'))),{runtime:createRuntime({env:{}}),browserMode:'off',router:async role=>{const handlers=await route(role);if(role==='audio')return {...handlers,checker:async request=>{if(!interrupted){interrupted=true;throw Error('Interrupted audio review');}return handlers.checker(request);}};return handlers;}});
  const run=await manager.create({title:'Retry',prompt:'Collect stars',difficulty:'beginner'});await manager.jobs.get(run.id);await manager.act(run.id,'approve_plan',{planHash:run.planHash});await manager.jobs.get(run.id);
  assert.equal(run.status,'failed');const planner=run.results.planner,steps=run.steps,generation=run.generation;
  await manager.act(run.id,'retry');await manager.jobs.get(run.id);assert.equal(run.status,'awaiting_review',run.error);assert.equal(run.results.planner,planner);assert.equal(run.generation,generation);assert.ok(run.steps>steps);assert.equal(run.error,undefined);
  run.status='stopped';await assert.rejects(manager.act(run.id,'retry'),/Only interrupted/);
});
