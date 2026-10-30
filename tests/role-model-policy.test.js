import test from 'node:test';import assert from 'node:assert/strict';
import {providerConfig} from '../apps/server/src/providers/config.js';
import {selectModel,ROLE_MODELS} from '../apps/server/src/providers/model-policy.js';
import {buildRequest} from '../apps/server/src/providers/model-client.js';
import {anthropicRequest} from '../apps/server/src/providers/anthropic.js';
import {ROLES} from '../shared/contracts/index.js';
import {browserEnvironment} from '../apps/server/src/validation/browser-environment.js';
const env={GAME_BUILDER_PROVIDER:'anthropic',ANTHROPIC_API_KEY:'SYNTHETIC_NOT_VALID'};
test('Claude role mix reserves Sonnet for implementation and independent system reviews',()=>{
 const c=providerConfig(env).publicConfig;assert.deepEqual(Object.keys(ROLE_MODELS).sort(),[...ROLES].sort());
 for(const role of ROLES)for(const stage of ['worker','checker'])assert.match(c.models[role][stage],/^claude-/);
 assert.equal(c.models.coding.worker,'claude-sonnet-5-5');assert.equal(c.models.gameplay.worker,'claude-haiku-5-5');assert.equal(c.models.gameplay.checker,'claude-sonnet-5-5');assert.equal(c.models.audio.worker,'claude-haiku-5-5');assert.equal(c.models.audio.checker,'claude-haiku-5-5');assert.equal(c.models.story.checker,'claude-haiku-5-5');
 assert.equal(selectModel(c,'coding','worker',{attempt:2,findings:['broken']}).model,'claude-sonnet-5-5');assert.equal(selectModel(c,'coding','worker',{attempt:3,findings:['broken']}).model,'claude-opus-5-5');assert.equal(selectModel(c,'coding','worker',{attempt:3,findings:[]}).model,'claude-sonnet-5-5');assert.equal(selectModel(c,'coding','checker',{attempt:3,findings:['broken']}).model,'claude-sonnet-5-5');
 const override=providerConfig({...env,ANTHROPIC_WORKER_MODEL:'claude-sonnet-5-5'}).publicConfig;assert.equal(override.models.audio.worker,'claude-sonnet-5-5');assert.equal(override.escalation.enabled,false);
 assert.equal(providerConfig({...env,ANTHROPIC_ENABLE_ESCALATION:'false'}).publicConfig.escalation.enabled,false);
 assert.throws(()=>providerConfig({GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'SYNTHETIC'}),/retired/);
});
test('native effort policy lowers bounded tasks and keeps coding reasoning and token counting aligned',()=>{
 const c=providerConfig(env).publicConfig;
 for(const [role,effort]of [['coding','medium'],['planner','medium'],['audio','low'],['story','low'],['integration','medium']]){
 const r={instructions:'Follow task',brief:{title:'Game',prompt:'Custom game',genre:'custom',difficulty:'beginner'},context:{},task:{role}};
 const body=buildRequest(c,role,'worker',r).body,wire=anthropicRequest(body);assert.equal(wire.output_config.effort,effort);assert.equal(wire.reasoning,undefined);
 }
 assert.equal(selectModel(c,'coding','worker',{attempt:3,findings:['failed']}).effort,'high');
});
test('browser process environment strips both current and historical provider secrets',()=>{
 const clean=browserEnvironment({ANTHROPIC_API_KEY:'canary',anthropic_workspace:'canary',OPENAI_API_KEY:'old-canary',AWS_SECRET:'canary',GITHUB_TOKEN:'canary',PATH:'normal path',TEMP:'normal temporary path'});
 assert.deepEqual(clean,{PATH:'normal path',TEMP:'normal temporary path'});
});
