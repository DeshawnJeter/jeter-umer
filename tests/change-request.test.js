import test from 'node:test';import assert from 'node:assert/strict';import {validateChange,requestChange} from '../apps/server/src/orchestrator/change-request.js';
test('changes carry the exact base source and preservation requirements without approving a new build',async()=>{
 const snapshot={brief:{prompt:'Defend the base',genre:'custom',title:'Game'},results:{coding:{artifact:{source:'original source'}}}};let received;
 const manager={versions:{get:async(project,id)=>{assert.equal(project,'p');assert.equal(id,'v');return snapshot;}},create:async(brief,options)=>{received={brief,options};return received;}};
 await requestChange(manager,'p',{versionId:'v',request:'Add armor',preserve:['Tower costs remain 2 coins']});assert.equal(received.options.initialSource,'original source');assert.equal(received.options.parentVersionId,'v');assert.match(received.brief.prompt,/Tower costs remain 2 coins/);assert.equal(received.options.changeRequest.status,'proposed');assert.equal(received.options.approval,undefined);
 assert.throws(()=>validateChange({request:'x',preserve:['x'.repeat(181)]}),/preserve/);
});
