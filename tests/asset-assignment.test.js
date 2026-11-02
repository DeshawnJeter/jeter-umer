import test from 'node:test';import assert from 'node:assert/strict';import {validateBindings} from '../apps/server/src/integration/asset-bindings.js';import {check} from '../apps/server/src/specialists/jobs.js';import {extensionDefaults} from '../shared/specialists.js';
test('human and agent asset choices cannot reference foreign or wrong-kind files',async()=>{
 const project={assets:[{id:'image',kind:'image'},{id:'sound',kind:'audio'}]};assert.deepEqual(validateBindings(project,{background:'image',music:'sound'}),{background:'image',music:'sound'});assert.throws(()=>validateBindings(project,{music:'image'}),/right kind/);assert.throws(()=>validateBindings(project,{background:'../secret'}),/right kind/);
 const artifact={...extensionDefaults('art'),backgroundAsset:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'};const review=await check('art',{artifact,context:{projectAssets:[]},brief:{genre:'collector'}});assert.equal(review.verdict,'fail');
});
