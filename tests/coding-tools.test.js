import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createRuntime} from '../apps/server/src/providers/runtime.js';
import {runPair} from '../apps/server/src/runners/harness.js';
import {DEFAULT_SOURCE,DEFAULT_SCENARIOS} from '../shared/code-game.js';
import {activeRoles} from '../shared/specialists.js';
const env={GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'SYNTHETIC_CODING_TOOL_TEST'};
const response=output=>new Response(JSON.stringify({status:'completed',output,usage:{input_tokens:100,output_tokens:50,total_tokens:150}}));
const call=(name,args,id='call_1')=>({type:'function_call',name,arguments:JSON.stringify(args),call_id:id});
test('model coding tools inspect and patch owned source, then submit without repeating its source text',async()=>{
  let workers=0,usage=0;const bodies=[],directory=await mkdtemp(join(tmpdir(),'coding-tools-'));
  const runtime=createRuntime({env,fetchImpl:async(_,options)=>{
    const body=JSON.parse(options.body);bodies.push(body);
    if(body.text.format.name==='coding_worker'){
      assert.ok(body.tools.some(tool=>tool.name==='apply_source_patch'&&tool.strict));assert.equal(body.parallel_tool_calls,false);
      if(workers++===0)return response([call('inspect_components',{})]);
      if(workers===2){assert.ok(body.input.some(item=>item.type==='function_call_output'));return response([call('apply_source_patch',{path:'generated/rules.js',find:'',replacement:DEFAULT_SOURCE},'call_2')]);}
      return response([{type:'message',content:[{type:'output_text',text:JSON.stringify({kind:'artifact',artifact:{source:'',scenarios:DEFAULT_SCENARIOS},question:null,summary:'Implemented owned source through a focused tool patch'})}]}]);
    }
    return response([{type:'message',content:[{type:'output_text',text:JSON.stringify({review:{verdict:'pass',findings:[],evidence:['Synthetic independent static comparison'],question:null}})}]}]);
  }});
  const handlers=await runtime.route('coding',{finish:async tokens=>{usage+=tokens.totalTokens;}});
  const result=await runPair({role:'coding',brief:{title:'Tool fixture',prompt:'A custom rules fixture',genre:'custom',difficulty:'beginner'},context:{previousSource:'// Existing work can request focused tools.'},directory,...handlers});
  assert.equal(result.artifact.source,DEFAULT_SOURCE);assert.equal(await readFile(join(directory,'coding/generated/rules.js'),'utf8'),DEFAULT_SOURCE);assert.equal(usage,600);assert.equal(bodies.length,4);
  for(const body of bodies){assert.equal(body.store,false);assert.equal(body.truncation,'disabled');}
});
test('tool selection cannot access host files or escape role/round limits',async()=>{
  for(const tool of [call('read_file',{path:'.env'}),call('read_source',{path:'../../.env'})]){
    let invoked=false;const runtime=createRuntime({env,fetchImpl:async()=>response([tool])}),handlers=await runtime.route('coding',{});
    await assert.rejects(handlers.worker({brief:{genre:'custom'},context:{},instructions:'Test',tools:{read_source:()=>{invoked=true;}}}),/coding tool/);assert.equal(invoked,false);
  }
  let calls=0;const runtime=createRuntime({env,fetchImpl:async()=>{calls++;return response([call('inspect_components',{})]);}}),handlers=await runtime.route('coding',{});
  await assert.rejects(handlers.worker({brief:{genre:'custom'},context:{},instructions:'Test',tools:{inspect_components:()=>({version:1})}}),/round limit/);assert.equal(calls,5);
});
test('custom games activate five model roles and leave unused template jobs to the framework',()=>{
  assert.deepEqual(activeRoles('custom'),['planner','ui','story','audio','coding']);
  assert.equal(activeRoles('campaign').length*2,18);
});

test('syntax-rejected proposals become the actual repair draft and survive an exact patch repair',async()=>{
 let workers=0,checkerCalls=0;const directory=await mkdtemp(join(tmpdir(),'coding-draft-handoff-')),broken='export function createGame(api){';
 const runtime=createRuntime({env,fetchImpl:async(_,options)=>{
  const body=JSON.parse(options.body),data=JSON.parse(body.input[0].content[0].text);
  if(body.text.format.name==='coding_worker'){
   workers++;
   if(workers===1)return response([{type:'message',content:[{type:'output_text',text:JSON.stringify({kind:'artifact',artifact:{source:broken,scenarios:DEFAULT_SCENARIOS},question:null,summary:'Invalid draft fixture'})}]}]);
   assert.equal(data.context.previousSource,broken);
   if(workers===2)return response([call('apply_source_patch',{path:'generated/rules.js',find:broken,replacement:DEFAULT_SOURCE})]);
   return response([{type:'message',content:[{type:'output_text',text:JSON.stringify({kind:'artifact',artifact:{source:'',scenarios:DEFAULT_SCENARIOS},question:null,summary:'Repaired draft fixture'})}]}]);
  }
  checkerCalls++;return response([{type:'message',content:[{type:'output_text',text:JSON.stringify({review:{verdict:'pass',findings:[],evidence:['Independent fixture review of repaired source'],question:null}})}]}]);
 }});
 const handlers=await runtime.route('coding',{}),result=await runPair({role:'coding',brief:{title:'Repair fixture',genre:'custom',difficulty:'beginner',prompt:'Fixture'},directory,...handlers});
 assert.equal(result.status,'accepted');assert.equal(result.artifact.source,DEFAULT_SOURCE);assert.equal(checkerCalls,1);assert.equal(workers,3);
});

test('interrupted repairs resume from checked findings without regenerating rejected work',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'coding-resume-')),broken='export function createGame(api){';let firstCalls=0,resumedCalls=0;
 const options={role:'coding',brief:{title:'Resume',genre:'custom',difficulty:'beginner',prompt:'Fixture'},execution:{provider:'openai'},directory,checker:async()=>({verdict:'pass',findings:[],evidence:['Independent fixture review']})};
 await assert.rejects(runPair({...options,worker:async()=>{if(++firstCalls===2)throw Error('fixture interruption');return {artifact:{source:broken,scenarios:DEFAULT_SCENARIOS},summary:'Broken fixture'};}}),/fixture interruption/);
 const result=await runPair({...options,worker:async request=>{resumedCalls++;assert.equal(request.attempt,2);assert.equal(request.context.previousSource,broken);assert.ok(request.findings[0]);return {artifact:{source:DEFAULT_SOURCE,scenarios:DEFAULT_SCENARIOS},summary:'Repaired fixture'};}});
 assert.equal(result.status,'accepted');assert.equal(firstCalls,2);assert.equal(resumedCalls,1);
});
