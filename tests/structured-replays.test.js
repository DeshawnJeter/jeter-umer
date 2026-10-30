import test from 'node:test';import assert from 'node:assert/strict';
import {providerResponseSchema,decodeProviderOutput,responseSchema} from '../apps/server/src/providers/schemas.js';import {codeScenarios} from '../shared/code-game.js';
const proposal=()=>({kind:'artifact',artifact:{source:'fixture',scenarios:[{name:'win',expect:'won',steps:[{dt:0.1,actions:['attack'],repeat:3},{dt:0.1,actions:[],repeat:247}]},{name:'loss',expect:'lost',steps:[{dt:0.1,actions:[],repeat:250}]}]},question:null,summary:'Structured replays'});
test('structured replays normalize to executable internal input without parsing nested model JSON',()=>{
 const schema=providerResponseSchema('coding','worker');assert.equal(schema.properties.artifact.anyOf[0].properties.scenarios.type,'array');assert.equal(responseSchema('coding','worker').properties.artifact.anyOf[0].properties.scenarios.type,'string');
 const decoded=decodeProviderOutput('coding','worker',proposal()),cases=codeScenarios(decoded.artifact.scenarios);assert.deepEqual(cases[0].steps[0],{dt:0.1,input:{attack:true},repeat:3});assert.deepEqual(cases[0].steps[1].input,{});
});
test('wire rejects malformed replay types, unknown actions, out-of-range dt and repeats',()=>{
 for(const alter of [p=>p.artifact.scenarios='malformed JSON',p=>p.artifact.scenarios[0].steps[0].actions=['j'],p=>p.artifact.scenarios[0].steps[0].dt=1,p=>p.artifact.scenarios[0].steps[0].repeat=301]){const p=proposal();alter(p);assert.throws(()=>decodeProviderOutput('coding','worker',p));}
});
test('canonicalization preserves excessive total frames as a domain defect, never clips them',()=>{
 const p=proposal();p.artifact.scenarios[0].steps[1].repeat=300;const decoded=decodeProviderOutput('coding','worker',p);assert.throws(()=>codeScenarios(decoded.artifact.scenarios),/303 steps/);
});
