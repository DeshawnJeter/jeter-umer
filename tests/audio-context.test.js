import test from 'node:test';import assert from 'node:assert/strict';
import {loadProfile,instructionBundle} from '../apps/server/src/runners/instructions.js';
import {buildRequest} from '../apps/server/src/providers/openai.js';import {providerConfig} from '../apps/server/src/providers/config.js';import {defaults,clone} from '../shared/contracts/index.js';
test('audio review retains full source and music decisions without repeated gameplay acceptance or HUD data',async()=>{
  const brief={title:'Forest towers',genre:'custom',prompt:'Defend a crystal. Enable calm pad music.',music:true,musicStyle:'calm',musicInstrument:'pad',difficulty:'beginner'},plan={...clone(defaults.planner),title:brief.title,acceptance:Array(6).fill('Build towers and defeat enemies. '.repeat(5))};
  const request={...await instructionBundle('audio','checker',await loadProfile('audio'),brief),brief,artifact:clone(defaults.audio),context:{plan,decisions:{'audio.tempo':'Use a relaxed tempo'},memory:{dependencies:[{role:'planner',hash:'checked-plan'}]}},limits:{maxContextChars:16000}};
  const config=providerConfig({GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'SYNTHETIC_AUDIO_CONTEXT'}).publicConfig,prepared=buildRequest(config,'audio','checker',request),data=JSON.parse(prepared.body.input[0].content[0].text);
  assert.equal(data.brief.prompt,brief.prompt);assert.equal(data.brief.musicInstrument,'pad');assert.equal(data.context.decisions['audio.tempo'],'Use a relaxed tempo');assert.equal(data.context.plan.checkedPlanHash,'checked-plan');assert.equal(data.context.plan.acceptance,undefined);assert.equal(data.hudReference,undefined);assert.equal(data.artifactReference,undefined);assert.ok(prepared.serialized.length<=16000);
});
