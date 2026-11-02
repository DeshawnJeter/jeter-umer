import {toolStateFor} from '../apps/server/src/providers/tool-policy.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {loadProfile,instructionBundle} from '../apps/server/src/runners/instructions.js';import {buildRequest} from './fixtures/legacy-provider.js';import {providerConfig} from './fixtures/legacy-provider.js';import {DEFAULT_SCENARIOS,DEFAULT_SOURCE} from '../shared/code-game.js';
test('coding requests keep full prompt, criteria, role rules and skills while removing irrelevant template payload',async()=>{
  const brief={title:'Tower',genre:'custom',difficulty:'beginner',prompt:'Build towers with J to defend a crystal. Enable calm pad music.'},criteria=['Build three fixed towers.','Defeat six enemies to win.','Lose when crystal health reaches zero.'];
  const profile=await loadProfile('coding'),config=providerConfig({GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'SYNTHETIC_CODING_CONTEXT'}).publicConfig;
  for(const stage of ['worker','checker']){
    const bundle=await instructionBundle('coding',stage,profile,brief),request={...bundle,brief,task:{id:'0:coding',role:'coding',generation:0,ownership:['generated/rules.js']},context:{plan:{title:'Tower',acceptance:criteria},decisions:{},memory:{projectId:'project',generation:0,dependencies:[{role:'planner',hash:'checked-plan'},{role:'ui',hash:'checked-ui',artifact:{theme:'forest',backgroundColor:'#001122',playerColor:'#ffeeaa'}}]}},limits:profile[stage],...(stage==='worker'?{tools:{inspect_components(){}}}:{artifact:{source:DEFAULT_SOURCE,scenarios:DEFAULT_SCENARIOS}})};
    const prepared=buildRequest(config,'coding',stage,request),data=JSON.parse(prepared.body.input[0].content[0].text);
    assert.equal(data.brief.prompt,brief.prompt);assert.deepEqual(data.context.plan.acceptance,criteria);assert.equal(data.context.memory.dependencies.planner,'checked-plan');assert.equal(data.context.presentation.theme,'forest');assert.equal(data.hudReference,undefined);assert.equal(data.capabilityProfile,undefined);
    assert.ok(prepared.body.instructions.includes(bundle.focusedCode.roleInstructions));for(const skill of bundle.focusedCode.skills)assert.ok(prepared.body.instructions.includes(skill.instructions));assert.ok(prepared.serialized.length<=16000);
    if(stage==='worker'){assert.ok(prepared.body.instructions.includes('compact but complete implementation'));assert.ok(prepared.body.instructions.includes('repeat counts'));assert.equal(prepared.body.tool_choice,'auto');assert.equal(buildRequest(config,'coding','worker',{...request,findings:['Repair a concrete defect']}).body.tool_choice,'auto');}
  }
});

test('coding output headroom is separately configurable and included in reservation without raising total budgets',()=>{
 const env={GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'SYNTHETIC_OUTPUT_TEST'},config=providerConfig(env).publicConfig;
 assert.equal(config.maxOutputTokens,2048);assert.equal(config.maxCodingOutputTokens,6144);assert.equal(config.maxTotalTokens,64000);assert.equal(config.maxCalls,24);
 const req={brief:{genre:'custom'},context:{},instructions:'fixture'};
 const worker=buildRequest(config,'coding','worker',req),checker=buildRequest(config,'coding','checker',req);
 assert.equal(worker.body.max_output_tokens,6144);assert.equal(checker.body.max_output_tokens,2048);
 assert.equal(worker.reservation,Buffer.byteLength(worker.serialized)+6144+512);
 assert.equal(providerConfig({...env,OPENAI_MAX_OUTPUT_TOKENS:'1024'}).publicConfig.maxCodingOutputTokens,1024);
 assert.equal(providerConfig({...env,OPENAI_CODING_MAX_OUTPUT_TOKENS:'4096'}).publicConfig.maxCodingOutputTokens,4096);
 assert.throws(()=>providerConfig({...env,OPENAI_CODING_MAX_OUTPUT_TOKENS:'9000'}));
});

test('UI checker retains prompt, complete plan, HUD and decisions without duplicate planner memory',()=>{
 const config=providerConfig({GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'SYNTHETIC_UI_CONTEXT'}).publicConfig;
 const brief={genre:'custom',prompt:'Tower defense with health and coins'},plan={title:'Tower',acceptance:['Show coins and health']},decisions={choice:'forest'};
 const body=buildRequest(config,'ui','checker',{instructions:'fixture',brief,context:{plan,decisions,memory:{dependencies:[{role:'planner',hash:'plan-hash',artifact:plan,history:'duplicated history'}]}},artifact:{title:'Tower'}}).body;
 const data=JSON.parse(body.input[0].content[0].text);assert.deepEqual(data.context.plan,plan);assert.equal(data.brief.prompt,brief.prompt);assert.deepEqual(data.context.decisions,decisions);assert.ok(data.hudReference);assert.equal(data.context.memory.dependencies.planner,'plan-hash');assert.equal(data.artifactReference,undefined);
});

test('large repairs omit optional tool schemas rather than cutting source or instructions',()=>{
 const config=providerConfig({GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'SYNTHETIC_REPAIR_CONTEXT'}).publicConfig;
 const request={brief:{genre:'custom',prompt:'Preserve all requirements'},instructions:'Complete instructions',context:{previousSource:'x'.repeat(6000)},tools:{inspect_components(){},read_source(){},search_source(){},apply_source_patch(){},run_rule_checks(){}},findings:['Repair the start contract']};
 const first=buildRequest(config,'coding','worker',request);assert.ok(first.body.tools);
 const focused=buildRequest(config,'coding','worker',{...request,limits:{maxContextChars:first.contextChars-100}});
 assert.equal(focused.body.tools,undefined);assert.equal(JSON.parse(focused.body.input[0].content[0].text).context.previousSource,request.context.previousSource);assert.ok(focused.body.instructions.includes(request.instructions));
});

test('model instructions include an executable lifecycle reference and expanded replay arithmetic',async()=>{
 const profile=await loadProfile('coding'),bundle=await instructionBundle('coding','worker',profile,{genre:'custom'});
 assert.match(bundle.instructions,/Start button calls game.start\(\) with NO arguments/);assert.match(bundle.instructions,/phase='playing'/);assert.match(bundle.instructions,/247 idle frames is 250/);assert.match(bundle.instructions,/Restart creates a NEW instance/);
});

test('harness counts derived instruction metadata once without hiding distinct requirements',async()=>{
 const {assertRequestFits}=await import('../apps/server/src/runners/instructions.js'),profile=await loadProfile('coding'),bundle=await instructionBundle('coding','worker',profile,{genre:'custom'});
 const request={...bundle,brief:{prompt:'p'.repeat(2000)},context:{previousSource:'x'.repeat(6000)}};
 assert.ok(JSON.stringify(request).length>16000);assert.ok(assertRequestFits(request,16000)<=16000);
 assert.throws(()=>assertRequestFits({...request,focusedCode:{roleInstructions:'UNIQUE REQUIREMENT '.repeat(1000),skills:[]}},16000),/Context exceeds/);
});

test('scenarios-only requests lock source and use structured replays without editing tools',async()=>{
 const profile=await loadProfile('coding'),bundle=await instructionBundle('coding','worker',profile,{genre:'custom'}),config=providerConfig({GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'SYNTHETIC_REPLAY_SCOPE'}).publicConfig;
 const request={...bundle,brief:{genre:'custom',prompt:'Full approved requirements'},context:{sourceReference:{hash:'locked'}},replayRepair:{scope:'scenarios-only',sourceHash:'locked'},tools:{apply_source_patch(){}}};
 const body=buildRequest(config,'coding','worker',request).body;assert.equal(body.tools,undefined);assert.equal(body.max_output_tokens,2048);assert.deepEqual(body.text.format.schema.properties.artifact.anyOf[0].properties.source.enum,['']);assert.ok(body.instructions.includes('scenarios-only repair'));
});
test('verified tool checks request a compact final artifact without further tools',async()=>{
 const profile=await loadProfile('coding'),bundle=await instructionBundle('coding','worker',profile,{genre:'custom'}),config=providerConfig({GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'SYNTHETIC_TOOL_FINAL'}).publicConfig;
 const prepared=buildRequest(config,'coding','worker',{...bundle,brief:{genre:'custom',prompt:'Preserve the current game'},context:{previousSource:DEFAULT_SOURCE},toolState:{...toolStateFor({context:{previousSource:DEFAULT_SOURCE}}),stopReason:'checks_passed',counts:{reads:4,edits:0,tests:1}},tools:{read_source(){},apply_source_patch(){}}});
 assert.equal(prepared.body.tools,undefined);assert.equal(prepared.body.tool_choice,undefined);assert.deepEqual(prepared.body.text.format.schema.properties.artifact.anyOf[0].properties.source.enum,['']);assert.equal(prepared.body.max_output_tokens,config.maxOutputTokens);assert.match(prepared.body.instructions,/Submit the structured artifact now/);
});

test('oversized full-source repairs use bounded source windows and focused patches',async()=>{
 const profile=await loadProfile('coding'),bundle=await instructionBundle('coding','worker',profile,{genre:'custom'}),config=providerConfig({GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'SYNTHETIC_FOCUSED_SOURCE'}).publicConfig;
 const source=DEFAULT_SOURCE+'/*'+'x'.repeat(5000)+'*/',request={...bundle,brief:{genre:'custom',prompt:'Required game mechanics. '.repeat(65)},context:{previousSource:source},limits:{maxContextChars:12000},findings:['Initialize arrays before inspect.'],tools:{read_source(){},search_source(){},apply_source_patch(){},inspect_components(){},run_rule_checks(){}}};
 const prepared=buildRequest(config,'coding','worker',request),data=JSON.parse(prepared.body.input[0].content[0].text);assert.ok(prepared.contextChars<=12000);assert.ok(Buffer.byteLength(prepared.serialized)<=config.maxRequestBytes);assert.ok(data.context.sourceReference);assert.equal(data.context.previousSource,undefined);assert.ok(prepared.body.tools.some(tool=>tool.name==='read_source'));assert.equal(prepared.body.max_output_tokens,2048);assert.deepEqual(prepared.body.text.format.schema.properties.artifact.anyOf[0].properties.source.enum,['']);assert.ok(prepared.body.instructions.includes(bundle.focusedCode.roleInstructions));
});
