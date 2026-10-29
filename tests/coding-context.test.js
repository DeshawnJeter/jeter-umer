import test from 'node:test';import assert from 'node:assert/strict';
import {loadProfile,instructionBundle} from '../apps/server/src/runners/instructions.js';import {buildRequest} from '../apps/server/src/providers/openai.js';import {providerConfig} from '../apps/server/src/providers/config.js';import {DEFAULT_SCENARIOS,DEFAULT_SOURCE} from '../shared/code-game.js';
test('coding requests keep full prompt, criteria, role rules and skills while removing irrelevant template payload',async()=>{
  const brief={title:'Tower',genre:'custom',difficulty:'beginner',prompt:'Build towers with J to defend a crystal. Enable calm pad music.'},criteria=['Build three fixed towers.','Defeat six enemies to win.','Lose when crystal health reaches zero.'];
  const profile=await loadProfile('coding'),config=providerConfig({GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'SYNTHETIC_CODING_CONTEXT'}).publicConfig;
  for(const stage of ['worker','checker']){
    const bundle=await instructionBundle('coding',stage,profile,brief),request={...bundle,brief,task:{id:'0:coding',role:'coding',generation:0,ownership:['generated/rules.js']},context:{plan:{title:'Tower',acceptance:criteria},decisions:{},memory:{projectId:'project',generation:0,dependencies:[{role:'planner',hash:'checked-plan'},{role:'ui',hash:'checked-ui',artifact:{theme:'forest',backgroundColor:'#001122',playerColor:'#ffeeaa'}}]}},limits:profile[stage],...(stage==='worker'?{tools:{inspect_components(){}}}:{artifact:{source:DEFAULT_SOURCE,scenarios:DEFAULT_SCENARIOS}})};
    const prepared=buildRequest(config,'coding',stage,request),data=JSON.parse(prepared.body.input[0].content[0].text);
    assert.equal(data.brief.prompt,brief.prompt);assert.deepEqual(data.context.plan.acceptance,criteria);assert.equal(data.context.memory.dependencies.planner,'checked-plan');assert.equal(data.context.presentation.theme,'forest');assert.equal(data.hudReference,undefined);assert.equal(data.capabilityProfile,undefined);
    assert.ok(prepared.body.instructions.includes(bundle.focusedCode.roleInstructions));for(const skill of bundle.focusedCode.skills)assert.ok(prepared.body.instructions.includes(skill.instructions));assert.ok(prepared.serialized.length<=16000);
    if(stage==='worker'){assert.equal(prepared.body.tool_choice,'none');assert.equal(buildRequest(config,'coding','worker',{...request,findings:['Repair a concrete defect']}).body.tool_choice,'auto');}
  }
});
