import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedToolNames,toolBudget,recordToolResult,toolStateFor} from '../apps/server/src/providers/tool-policy.js';
import {createAnthropicClient} from '../apps/server/src/providers/anthropic.js';
import {providerConfig} from '../apps/server/src/providers/config.js';
import {createRuntime} from '../apps/server/src/providers/runtime.js';
import {Manager} from '../apps/server/src/orchestrator/manager.js';
import {Store} from '../apps/server/src/storage/store.js';
import {emptyUsage} from '../apps/server/src/providers/usage.js';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {buildRequest} from '../apps/server/src/providers/model-client.js';
import {DEFAULT_SOURCE,DEFAULT_SCENARIOS} from '../shared/code-game.js';
const tools={read_source(){},search_source(){},inspect_components(){},apply_source_patch(){},run_rule_checks(){}};
const call=(name,args={})=>({name,arguments:JSON.stringify(args)});
const repair=()=>({context:{previousSource:DEFAULT_SOURCE},findings:['Fix a verified failure'],tools});
const advance=(r,c,result,beforeSource='',afterSource='')=>({...r,toolState:recordToolResult(r,c,result,{beforeSource,afterSource}).state});
const patch=call('apply_source_patch',{path:'generated/rules.js',find:'a',replacement:'b'});
const suite=JSON.stringify([{name:'win',steps:[]},{name:'loss',steps:[]}]);
const check=call('run_rule_checks',{scenarios:suite});

test('trusted task context selects 4, 6 or conditional 8 actions without changing global budgets',()=>{
 assert.equal(toolBudget({tools}).actionLimit,6);
 assert.equal(toolBudget({tools,context:{previousSource:DEFAULT_SOURCE}}).actionLimit,4);
 assert.equal(toolBudget({tools,context:{previousSource:DEFAULT_SOURCE,changeRequest:{request:'New mechanic'}}}).actionLimit,6);
 assert.deepEqual([toolBudget(repair()).actionLimit,toolBudget(repair()).maxActions],[6,8]);
 const c=providerConfig({GAME_BUILDER_PROVIDER:'anthropic',ANTHROPIC_API_KEY:'SYNTHETIC'}).publicConfig;
 assert.equal(c.maxCalls,24);assert.equal(c.maxTotalTokens,128000);assert.equal(c.maxResponseRepairs,2);
});

test('four reads preserve the edit and validation allowance and reads cannot earn an extension',()=>{
 let r=repair();for(let i=0;i<4;i++)r=advance(r,call('read_source'),{source:'same'});
 assert.deepEqual(toolBudget(r).used,{reads:4,edits:0,tests:0});assert.equal(toolBudget(r).extended,false);
 assert.ok(!allowedToolNames(r).includes('read_source'));assert.ok(allowedToolNames(r).includes('apply_source_patch'));assert.ok(allowedToolNames(r).includes('run_rule_checks'));
});

test('early tests cannot consume the final validation reservation',()=>{
 let r={context:{previousSource:DEFAULT_SOURCE},tools};
 r=advance(r,check,{passed:false,tests:[{name:'bad',passed:false}]});
 r=advance(r,patch,{verdict:'pass'},'A','B');r=advance(r,patch,{verdict:'pass'},'B','C');
 assert.ok(!allowedToolNames(r).includes('apply_source_patch'));assert.ok(allowedToolNames(r).includes('run_rule_checks'));
});

test('repair extension requires current verified source progress, preserves a test slot and stops at eight',()=>{
 let r=repair();for(let i=0;i<7;i++)r=advance(r,patch,{verdict:'pass'},'source'+i,'source'+(i+1));
 assert.equal(toolBudget(r).extended,true);assert.equal(toolBudget(r).actionLimit,8);assert.ok(!allowedToolNames(r).includes('apply_source_patch'));assert.ok(allowedToolNames(r).includes('run_rule_checks'));
 r=advance(r,check,{passed:true,tests:[{name:'fixture',passed:true}]});assert.equal(toolBudget(r).stopReason,'checks_passed');assert.deepEqual(allowedToolNames(r),[]);
});

test('no-op or cyclic patches and stale earlier progress cannot buy extra actions',()=>{
 let r=repair();r=advance(r,patch,{verdict:'pass'},'A','B');
 for(let i=0;i<4;i++)r=advance(r,patch,{verdict:'pass'},i%2?'A':'B',i%2?'B':'A');
 assert.equal(r.toolState.progress,1);assert.equal(toolBudget(r).extended,false);
 r=advance(r,check,{passed:false,tests:[{name:'bad',passed:false,error:'still broken'}]});
 assert.equal(toolBudget(r).stopReason,'action_limit');assert.deepEqual(allowedToolNames(r),[]);
});

test('only comparable test improvements count and repeated failures stop across source edits',()=>{
 let r=repair();r=advance(r,check,{passed:false,tests:[{name:'one',passed:false},{name:'two',passed:false}]});
 r=advance(r,check,{passed:false,tests:[{name:'one',passed:false},{name:'two',passed:true}]});assert.equal(r.toolState.progress,1);
 r=advance(r,patch,{verdict:'pass'},'A','B');
 r=advance(r,check,{passed:false,tests:[{name:'one',passed:false}]});assert.equal(toolBudget(r).stopReason,'repeated_failure');
 let other=repair();other=advance(other,check,{passed:false,tests:[{name:'one',passed:false},{name:'two',passed:false}]});
 other=advance(other,call('run_rule_checks',{scenarios:'[]'}),{passed:false,tests:[{name:'one',passed:false}]});assert.equal(other.toolState.progress,0);
 let partial=repair();partial=advance(partial,check,{passed:false,tests:[{name:'one',passed:false},{name:'two',passed:false}]});
 partial=advance(partial,check,{passed:false,tests:[{name:'Start without input',passed:false}]});assert.equal(partial.toolState.progress,0,'Aborting before the same tests run must not count as improvement');
});

test('empty or self-contradictory execution evidence is never a checked-source shortcut',()=>{
 for(const report of [{passed:true},{passed:true,tests:[]},{passed:true,tests:[{passed:false}]}]){
  const r=advance(repair(),check,report);assert.notEqual(toolBudget(r).stopReason,'checks_passed');
 }
});

test('native continuation permits four reads, a patch and testing, then finalizes the checked file',async()=>{
 let source=DEFAULT_SOURCE,calls=0;const audits=[];
 const c=providerConfig({GAME_BUILDER_PROVIDER:'anthropic',ANTHROPIC_API_KEY:'SYNTHETIC'}).publicConfig;
  const store=new Store(await mkdtemp(join(tmpdir(),'adaptive-tools-'))),manager=new Manager(store,{runtime:createRuntime({env:{GAME_BUILDER_PROVIDER:'anthropic',ANTHROPIC_API_KEY:'SYNTHETIC'}})});
  const run={id:randomUUID(),status:'running',mode:'anthropic',generation:0,createdAt:new Date().toISOString(),events:[],providerConfig:c,providerUsage:emptyUsage()},hooks=manager.providerHooks(run,'coding');
 const client=createAnthropicClient('SYNTHETIC',c,{fetchImpl:async(_,options)=>{
  const body=JSON.parse(options.body);calls++;
  const native=(name,input)=>new Response(JSON.stringify({type:'message',role:'assistant',stop_reason:'tool_use',content:[{type:'tool_use',id:'tool_'+calls,name,input}],usage:{input_tokens:100,output_tokens:50}}));
  if(calls<=4)return native('read_source',{path:'generated/rules.js',startLine:calls,maxLines:1});
  if(calls===5){assert.ok(!body.tools.some(t=>t.name==='read_source'));return native('apply_source_patch',{path:'generated/rules.js',find:'createGame(api)',replacement:'createGame(api) '});}
  if(calls===6)return native('run_rule_checks',{scenarios:DEFAULT_SCENARIOS});
  assert.equal(body.tools,undefined);assert.deepEqual(body.output_config.format.schema.properties.artifact.anyOf[0].properties.source.enum,['']);
  const scenarios=JSON.parse(DEFAULT_SCENARIOS).map(s=>({name:s.name,expect:s.expect,steps:s.steps.map(step=>({dt:step.dt,actions:Object.keys(step.input).filter(k=>step.input[k]),repeat:step.repeat||1}))}));
  return new Response(JSON.stringify({type:'message',role:'assistant',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({kind:'artifact',artifact:{source:'',scenarios},question:null,summary:'Submit checked source'})}],usage:{input_tokens:100,output_tokens:50}}));
 }});
 const request={instructions:'Preserve the working game.',brief:{genre:'custom',difficulty:'beginner',prompt:'Preserve the game'},task:{role:'coding'},context:{previousSource:source},tools:{read_source:async()=>source,apply_source_patch:async a=>{source=source.replace(a.find,a.replacement);return {verdict:'pass'};},run_rule_checks:async()=>({passed:true,tests:[{name:'fixture',passed:true}]})}};
  const out=await client.generate('coding','worker',request,{...hooks,onAttempt:async a=>{audits.push(a);await hooks.onAttempt(a);}});assert.equal(out.artifact.source,'');assert.equal(calls,7);
 const last=audits.filter(a=>a.toolUse).at(-1).toolUse;assert.deepEqual(last.used,{reads:4,edits:1,tests:1});assert.equal(last.stopReason,'checks_passed');
  const saved=await store.load(run.id);assert.equal(saved.providerUsage.calls,7);assert.equal(saved.roleToolUsage.coding.reads,4);assert.equal(saved.roleToolUsage.coding.edits,1);assert.equal(saved.roleToolUsage.coding.tests,1);assert.equal(saved.roleToolUsage.coding.policy.stopReason,'checks_passed');assert.ok(!JSON.stringify(saved).includes('SYNTHETIC'));
});

test('exhaustion without a checked file still permits a complete candidate, never forces empty source',()=>{
 const config=providerConfig({GAME_BUILDER_PROVIDER:'anthropic',ANTHROPIC_API_KEY:'SYNTHETIC'}).publicConfig;
 const state={...toolStateFor({}),counts:{reads:0,edits:5,tests:1}};
 const p=buildRequest(config,'coding','worker',{instructions:'Keep requirements',brief:{genre:'custom'},context:{},tools,toolState:state});
 assert.equal(p.body.tools,undefined);assert.equal(p.body.text.format.schema.properties.artifact.anyOf[0].properties.source.enum,undefined);assert.equal(p.body.max_output_tokens,config.maxCodingOutputTokens);
});
