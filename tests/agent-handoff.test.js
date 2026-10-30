import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {GAME_TYPES} from '../shared/game-types.js';
import {activeRoles,dependenciesFor} from '../shared/specialists.js';
import {clone,defaults} from '../shared/contracts/index.js';
import {makeTask} from '../shared/contracts/tasks.js';
import {route} from '../apps/server/src/router/index.js';
import {runPair} from '../apps/server/src/runners/harness.js';
import {createRuntime} from './fixtures/legacy-provider.js';
import {acceptMemory,readMemory} from '../apps/server/src/memory/project.js';
import {Manager} from '../apps/server/src/orchestrator/manager.js';
import {Store} from '../apps/server/src/storage/store.js';

const temporary=()=>mkdtemp(join(tmpdir(),'agent-handoff-'));
const accepted=artifact=>({status:'accepted',artifact,report:{verdict:'pass',findings:[],evidence:['Synthetic independently checked fixture']}});

// Exercise real request serialization, strict model decoding, deterministic
// checkers and the harness, without spending API credits or trusting a model.
for(const genre of Object.keys(GAME_TYPES))test(`${genre}: every active model pair receives exact checked handoffs`,async()=>{
  const directory=await temporary(),calls=[];
  const runtime=createRuntime({env:{GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'SYNTHETIC_HANDOFF_TEST'},fetchImpl:async(_,options)=>{
    const body=JSON.parse(options.body),[role,stage]=body.text.format.name.split('_');
    const data=JSON.parse(body.input[0].content[0].text);calls.push({role,stage});
    let value;
    if(stage==='worker'){
      const proposal=await (await route(role)).worker(data);
      if(role==='coding')proposal.artifact.scenarios=JSON.parse(proposal.artifact.scenarios).map(c=>({name:c.name,expect:c.expect,steps:c.steps.map(step=>({dt:step.dt,actions:Object.entries(step.input).filter(([,value])=>value).map(([key])=>key),repeat:step.repeat??1}))}));
      value={kind:'artifact',artifact:proposal.artifact,question:null,summary:'Synthetic model transport fixture'};
    }else value={review:{verdict:'pass',findings:[],evidence:['Synthetic static comparison'],question:null}};
    return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}],usage:{input_tokens:100,output_tokens:50,total_tokens:150}}));
  }});
  const run={id:`fixture-${genre}`,generation:0,results:{}};
  const brief={title:'Handoff Audit',prompt:'A small original adventure',genre,difficulty:'beginner',theme:'forest',music:true,musicStyle:'lofi',musicInstrument:'organ'};
  const pending=new Set(activeRoles(genre));
  while(pending.size){
    const ready=[...pending].filter(role=>dependenciesFor(role,genre).every(parent=>run.results[parent]));
    assert.ok(ready.length,'Dependency graph must progress');
    for(const role of ready){
      const dependencies=dependenciesFor(role,genre),memory=readMemory(run,role,dependencies);
      assert.deepEqual(memory.dependencies.map(entry=>entry.role),dependencies);
      for(const entry of memory.dependencies)if(entry.role==='planner'){assert.equal(entry.artifact.planReference.hash,run.memory.artifacts.planner.hash);assert.equal(entry.artifact.planReference.field,'context.plan');}else if(entry.role==='coding'&&role!=='coding'){assert.equal(entry.artifact.sourceReference.hash,run.memory.artifacts.coding.hash);assert.equal(entry.artifact.sourceReference.path,'generated/rules.js');}else assert.deepEqual(entry.artifact,run.results[entry.role].artifact);
      const result=await runPair({role,brief,task:makeTask(role),context:{memory,decisions:{},...(role==='planner'?{}:{plan:run.results.planner.artifact})},directory,...await runtime.route(role,{})});
      assert.equal(result.status,'accepted',role);
      assert.deepEqual(result.report.reviewSources,['openai','deterministic']);
      run.results[role]=result;acceptMemory(run,role,result,dependencies);pending.delete(role);
    }
  }
  assert.equal(calls.length,activeRoles(genre).length*2);
  assert.equal(run.memory.handoffs.length,activeRoles(genre).length);
});

test('each role rejects malformed artifacts before calling its checker',async()=>{
  for(const role of activeRoles('rpg').concat('enemies')){
    let checkerCalls=0;
    await assert.rejects(runPair({role,brief:{difficulty:'beginner'},directory:await temporary(),worker:async()=>({artifact:{untrustedCode:'execute()'}}),checker:async()=>{checkerCalls++;return {verdict:'pass',findings:[],evidence:['Forged pass']};}}),/exhausted/);
    assert.equal(checkerCalls,0,role);
  }
});

test('each independent checker can block its worker and exhaust only the bounded repair attempts',async()=>{
  for(const role of activeRoles('rpg').concat('enemies')){
    let checkerCalls=0,acceptedEvents=0;
    await assert.rejects(runPair({role,brief:{difficulty:'beginner'},directory:await temporary(),worker:async()=>({artifact:clone(defaults[role])}),checker:async()=>{checkerCalls++;return {verdict:'fail',findings:['Injected independent rejection'],evidence:['Synthetic fault injection']};},onEvent:async event=>{if(event.stage==='accepted')acceptedEvents++;}}),/exhausted.*Injected independent rejection/);
    assert.equal(checkerCalls,3,role);assert.equal(acceptedEvents,0,role);
  }
});

test('handoff refuses memory payload drift even when the saved result still matches the original hash',()=>{
  const run={id:'drift',generation:0,results:{planner:accepted(clone(defaults.planner))}};
  acceptMemory(run,'planner',run.results.planner);
  run.memory.artifacts.planner.artifact.title='Unchecked replacement';
  assert.throws(()=>readMemory(run,'gameplay',['planner']),/Stale memory dependency/);
});

test('handoff refuses a contribution whose independent acceptance was revoked',()=>{
  const run={id:'revoked',generation:0,results:{planner:accepted(clone(defaults.planner))}};
  acceptMemory(run,'planner',run.results.planner);
  run.results.planner.report.verdict='fail';
  assert.throws(()=>readMemory(run,'gameplay',['planner']),/Stale memory dependency/);
});

test('handoff checks ancestors and rejects cyclic dependency records',()=>{
  const run={id:'ancestors',generation:0,results:{}};
  for(const [role,parents]of [['planner',[]],['gameplay',['planner']]]){
    run.results[role]=accepted(clone(defaults[role]));acceptMemory(run,role,run.results[role],parents);
  }
  run.results.planner.artifact.title='Unchecked ancestor';
  assert.throws(()=>readMemory(run,'levels',['gameplay']),/Stale memory dependency: planner/);
  run.results.planner.artifact=clone(run.memory.artifacts.planner.artifact);
  run.memory.artifacts.planner.dependencies.gameplay=run.memory.artifacts.gameplay.hash;
  assert.throws(()=>readMemory(run,'levels',['gameplay']),/Stale memory dependency/);
});

test('restart cannot reuse cached work after a saved handoff payload changed',async()=>{
  const store=new Store(await temporary()),manager=new Manager(store,{browserMode:'off',runtime:createRuntime({env:{}})});
  const run=await manager.create({title:'Saved handoff',prompt:'Collect stars',difficulty:'beginner'});
  await manager.jobs.get(run.id);
  run.memory.artifacts.planner.artifact.title='Unchecked saved payload';
  run.status='paused';await manager.save(run);
  let routed=0;
  const restored=new Manager(store,{browserMode:'off',runtime:createRuntime({env:{}}),router:async role=>{routed++;return route(role);}});
  await restored.initialize();await restored.act(run.id,'resume');await restored.jobs.get(run.id);
  const saved=restored.get(run.id);
  assert.equal(saved.status,'failed');assert.match(saved.error,/Stale memory dependency: planner/);
  assert.equal(routed,0,'Corrupt cached handoffs must stop before any agent request');
});

test('dependency payload changes during a worker cannot be accepted as a fresh handoff',async()=>{
  const manager=new Manager(new Store(await temporary()),{browserMode:'off',runtime:createRuntime({env:{}})});
  const run=await manager.create({title:'In flight',prompt:'Collect stars',difficulty:'beginner'});
  await manager.jobs.get(run.id);run.status='running';
  let started,release;
  const ready=new Promise(resolve=>{started=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  manager.router=async()=>({worker:async()=>{started();await gate;return {artifact:clone(defaults.gameplay)};},checker:async()=>({verdict:'pass',findings:[],evidence:['Synthetic static check']})});
  const job=manager.execute(run,'gameplay');await ready;
  run.results.planner.artifact.title='Changed while worker was running';
  release();await job;
  assert.equal(run.results.gameplay,undefined);
  assert.equal(run.memory.workspaces.gameplay.stage,'stale');
});
