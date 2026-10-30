import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {providerConfig} from '../apps/server/src/providers/config.js';
import {createRuntime} from '../apps/server/src/providers/runtime.js';
import {anthropicSchema,anthropicRequest,anthropicResponse,createAnthropicClient,ANTHROPIC_ENDPOINT} from '../apps/server/src/providers/anthropic.js';
import {buildRequest} from '../apps/server/src/providers/model-client.js';
import {providerResponseSchema} from '../apps/server/src/providers/schemas.js';
import {buildBudget,estimateBuild} from '../apps/server/src/providers/build-budget.js';
import {Manager} from '../apps/server/src/orchestrator/manager.js';
import {Store} from '../apps/server/src/storage/store.js';
import {defaults,ROLES} from '../shared/contracts/index.js';
import {loadProfile,instructionBundle} from '../apps/server/src/runners/instructions.js';
import {makeTask} from '../shared/contracts/tasks.js';

const key='SYNTHETIC_ANTHROPIC_CREDENTIAL',env={GAME_BUILDER_PROVIDER:'anthropic',ANTHROPIC_API_KEY:key};
const brief={title:'Claude Fixture',prompt:'Collect every star, then reach the portal.',genre:'collector',difficulty:'beginner',music:false};
const config=()=>providerConfig(env).publicConfig;
async function request(role='planner',stage='worker'){
  return {...await instructionBundle(role,stage,await loadProfile(role)),brief,context:{decisions:{}},task:makeTask(role),findings:[]};
}
const proposal={kind:'artifact',artifact:{...defaults.planner,title:brief.title,difficulty:'beginner'},question:null,summary:'A bounded checked plan.'};
const report={review:{verdict:'pass',findings:[],evidence:['Compared the supplied plan with the brief.'],question:null}};
function result(value,extra={}){return {type:'message',role:'assistant',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(value)}],usage:{input_tokens:100,output_tokens:50},...extra};}
const response=(value,extra)=>new Response(JSON.stringify(result(value,extra)));

test('Anthropic credentials and overrides are provider-specific and never public',()=>{
  assert.throws(()=>providerConfig({GAME_BUILDER_PROVIDER:'anthropic',OPENAI_API_KEY:key}),/ANTHROPIC_API_KEY/);
  const c=providerConfig({...env,OPENAI_MODEL:'wrong-provider',ANTHROPIC_UI_CHECKER_MODEL:'claude-haiku-5-5'});
  assert.equal(c.mode,'anthropic');assert.equal(c.publicConfig.models.ui.checker,'claude-haiku-5-5');assert.equal(c.publicConfig.models.coding.worker,'claude-sonnet-5-5');
  assert.equal(c.publicConfig.escalation.enabled,true);assert.ok(!JSON.stringify(c.publicConfig).includes(key));
  assert.equal(c.publicConfig.maxTotalTokens,128000);
  assert.equal(buildBudget(c.publicConfig,{maxCalls:8}).maxCalls,8);assert.ok(estimateBuild(c.publicConfig,brief).estimatedDollars>0); const unknown=structuredClone(c.publicConfig);unknown.models.ui.checker='unpriced-claude';assert.equal(estimateBuild(unknown,brief).estimatedDollars,null);
  assert.ok(estimateBuild(config(),brief).estimatedDollars>0);
  assert.throws(()=>buildBudget(c.publicConfig,{maxCalls:41}),/server limit/);
});

test('all role schemas adapt vendor constraints without mutating authoritative local schemas',()=>{
  const forbidden=new Set(['minimum','maximum','multipleOf','minLength','maxLength','maxItems','uniqueItems','pattern']);
  function inspect(s){if(!s||typeof s!=='object')return;for(const [k,v]of Object.entries(s)){assert.ok(!forbidden.has(k));if(k==='minItems')assert.ok(v<=1);if(k==='properties')Object.values(v).forEach(inspect);else inspect(v);}}
  for(const role of ROLES)for(const stage of ['worker','checker']){const original=providerResponseSchema(role,stage),copy=structuredClone(original);inspect(anthropicSchema(original));assert.deepEqual(original,copy);}
  const s=anthropicSchema({type:'string',minLength:1,maxLength:400});assert.match(s.description,/400/);
});

test('wire uses native system, JSON outputs and native tool-result continuation',async()=>{
  const req=await request('coding');req.tools={read_source:async()=>''};req.toolHistory=[{type:'function_call',call_id:'toolu_1',name:'read_source',arguments:'{"path":"generated/rules.js","startLine":1,"maxLines":2}'},{type:'function_call_output',call_id:'toolu_1',output:'{"source":"owned"}'}];
  const wire=anthropicRequest(buildRequest(config(),'coding','worker',req).body);
  assert.equal(wire.output_config.format.type,'json_schema');assert.equal(wire.store,undefined);assert.equal(wire.reasoning,undefined);
  assert.equal(wire.messages[1].content[0].type,'tool_use');assert.equal(wire.messages[2].content[0].type,'tool_result');assert.equal(wire.messages[2].content[0].tool_use_id,'toolu_1');
  assert.equal(wire.tools[0].strict,true);assert.ok(wire.tools[0].input_schema);
});

test('Claude workers/checkers make distinct bounded requests with actual usage and provider identity',async()=>{
  const calls=[],runtime=createRuntime({env,fetchImpl:async(url,options)=>{
    assert.equal(url,ANTHROPIC_ENDPOINT);assert.equal(options.headers['x-api-key'],key);assert.equal(options.headers.Authorization,undefined);assert.equal(options.redirect,'error');
    const b=JSON.parse(options.body);calls.push(b);return response(b.output_config.format.schema.properties.review?report:proposal);
  }});
  const manager=new Manager(new Store(await mkdtemp(join(tmpdir(),'anthropic-pair-'))),{runtime});await manager.initialize();
  const run=await manager.create(brief);await manager.jobs.get(run.id);
  assert.equal(run.status,'awaiting_plan');assert.equal(run.mode,'anthropic');assert.equal(run.providerUsage.calls,2);assert.equal(run.providerUsage.totalTokens,300);
  assert.deepEqual(run.results.planner.report.reviewSources,['anthropic','deterministic']);assert.equal(run.results.planner.audit.execution.provider,'anthropic');
  assert.equal(calls.length,2);assert.equal(run.planApproval,null);assert.ok(!JSON.stringify(run).includes(key));
  const different=new Manager(manager.store,{runtime:{mode:'historical-openai',publicConfig:{mode:'historical-openai'}}});
  assert.throws(()=>different.assertRuntime(run),/Providers never switch silently/);
});

test('native cached tokens, refusals and incomplete responses retain usage and fail closed',async()=>{
  const counted=anthropicResponse(result(proposal,{usage:{input_tokens:10,cache_creation_input_tokens:20,cache_read_input_tokens:30,output_tokens:5}}));
  assert.deepEqual(counted.usage,{input_tokens:60,output_tokens:5,total_tokens:65});
  for(const stop of ['refusal','max_tokens','pause_turn']){
    let calls=0,usage;
    const client=createAnthropicClient(key,config(),{fetchImpl:async()=>{calls++;return response(proposal,{stop_reason:stop});}});
    await assert.rejects(client.generate('planner','worker',await request(),{finish:u=>usage=u}),stop==='refusal'?/refused/:/incomplete/);
    assert.equal(calls,1);assert.equal(usage.totalTokens,150);
  }
});

test('token counting uses native endpoint and HTTP errors never leak response bodies or retry',async()=>{
  const calls=[];let reservation;
  const client=createAnthropicClient(key,config(),{countInputTokens:true,fetchImpl:async(url,options)=>{
    calls.push(url);const body=JSON.parse(options.body);
    if(url.endsWith('/count_tokens')){assert.ok(body.messages);assert.equal(body.max_tokens,undefined);assert.ok(body.output_config.format.schema);return new Response('{"input_tokens":321}');}
    return response(proposal);
  }});
  await client.generate('planner','worker',await request(),{reserve:tokens=>reservation=tokens});assert.deepEqual(calls,[ANTHROPIC_ENDPOINT+'/count_tokens',ANTHROPIC_ENDPOINT]);assert.equal(reservation,321+2048+512);
  let requests=0;const failing=createAnthropicClient(key,config(),{fetchImpl:async()=>{requests++;return new Response(key,{status:401});}});
  await assert.rejects(failing.generate('planner','worker',await request()),error=>error.message.includes('Anthropic request failed (HTTP 401)')&&!error.message.includes(key));assert.equal(requests,1);
});

test('native coding tools execute only owned operations and return their linked result',async()=>{
  const req=await request('coding');req.brief={...brief,genre:'custom'};let reads=0,calls=0;
  req.tools={read_source:async path=>{assert.equal(path,'generated/rules.js');reads++;return 'owned';}};
  req.findings=['Read the owned source before proposing this isolated fixture.'];
  const artifact={source:'fixture',scenarios:[{name:'win',expect:'won',steps:[{dt:0.1,actions:['attack'],repeat:3}]},{name:'loss',expect:'lost',steps:[{dt:0.1,actions:[],repeat:100}]}]};
  const client=createAnthropicClient(key,config(),{fetchImpl:async(_,options)=>{
    const body=JSON.parse(options.body);calls++;
    if(calls===1)return response(null,{stop_reason:'tool_use',content:[{type:'tool_use',id:'toolu_owned',name:'read_source',input:{path:'generated/rules.js',startLine:1,maxLines:2}}]});
    const last=body.messages.at(-1).content[0];assert.equal(last.type,'tool_result');assert.equal(last.tool_use_id,'toolu_owned');assert.equal(JSON.parse(last.content).source,'owned');
    return response({kind:'artifact',artifact,question:null,summary:'Synthetic rules and replays.'});
  }});
  const output=await client.generate('coding','worker',req);assert.equal(output.artifact.source,'fixture');assert.equal(calls,2);assert.equal(reads,2); // Tool read and refreshed owned context.
  for(const malicious of [{name:'read_source',input:{path:'../../.env/local.env',startLine:1,maxLines:2}},{name:'shell',input:{command:'print credentials'}}]){
    let executed=false;const blocked=createAnthropicClient(key,config(),{fetchImpl:async()=>response(null,{stop_reason:'tool_use',content:[{type:'tool_use',id:'toolu_bad',...malicious}]})});
    await assert.rejects(blocked.generate('coding','worker',{...req,tools:{read_source:async()=>{executed=true;}}}),/Invalid coding tool arguments|Unrecognized or invalid coding tool/);assert.equal(executed,false);
  }
});
