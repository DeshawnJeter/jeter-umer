import test from 'node:test';import assert from 'node:assert/strict';
import {providerConfig} from '../apps/server/src/providers/config.js';import {selectModel} from '../apps/server/src/providers/model-policy.js';import {buildRequest} from '../apps/server/src/providers/openai.js';
const env={GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'synthetic-not-valid'};
test('role mix preserves overrides, uses bounded late escalation and compatible Responses options',()=>{
 const config=providerConfig(env).publicConfig;assert.equal(config.models.coding.worker,'gpt-6.1-sol');assert.equal(config.models.ui.worker,'gpt-6.1-terra');assert.equal(config.models.audio.worker,'gpt-6-luna');
 assert.equal(selectModel(config,'coding','worker',{attempt:2,findings:['broken']}).model,'gpt-6.1-sol');assert.equal(selectModel(config,'coding','worker',{attempt:3,findings:['broken']}).model,'gpt-6-astra');assert.equal(selectModel(config,'coding','checker',{attempt:3,findings:['broken']}).model,'gpt-6.1-sol');
 const override=providerConfig({...env,OPENAI_WORKER_MODEL:'gpt-4.1'}).publicConfig;assert.equal(selectModel(override,'coding','worker',{attempt:3,findings:['broken']}).model,'gpt-4.1');assert.equal(selectModel(override,'coding','worker',{}).reasoning,undefined);
 const request={instructions:'Follow task',brief:{title:'Game',prompt:'Collect stars',genre:'collector',difficulty:'beginner'},context:{},artifact:{speed:190,timeLimit:60},task:{role:'gameplay'}};
 const {body}=buildRequest(config,'gameplay','checker',request);assert.deepEqual(body.reasoning,{effort:'low'});assert.equal(body.temperature,undefined);assert.equal(body.truncation,'disabled');assert.equal(body.text.format.strict,true);
});
