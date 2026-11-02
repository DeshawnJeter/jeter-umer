import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Projects} from '../apps/server/src/storage/projects.js';import {addFeedback,updateFeedback,feedbackFor} from '../apps/server/src/memory/feedback.js';
test('feedback survives restart, stays open across runs and resolves only against a project version',async()=>{
 const root=await mkdtemp(join(tmpdir(),'game-feedback-'));try{let store=new Projects(root);const project=await store.create('Game');await store.update(project.id,p=>p.versions.push({id:'version-a'}));
 await addFeedback(store,project.id,{versionId:'version-a',title:'Guards ignore the player',roles:['coding'],expected:'Chase after detection',actual:'Stay still'});
 store=new Projects(root);let p=await store.get(project.id);const item=p.feedback[0];assert.equal(feedbackFor(p,'coding').length,1);assert.equal(feedbackFor(p,'audio').length,0);
 await assert.rejects(updateFeedback(store,p.id,item.id,{status:'resolved',note:'Fixed',verifiedVersionId:'foreign'}),/verified/);
 await updateFeedback(store,p.id,item.id,{status:'resolved',note:'Played and verified',verifiedVersionId:'version-a'});p=await store.get(p.id);assert.equal(feedbackFor(p,'coding').length,0);assert.equal(p.feedback[0].history[0].source,'human-review');
 await assert.rejects(addFeedback(store,p.id,{versionId:'foreign',title:'x',roles:['coding']}),/version/);
 }finally{await rm(root,{recursive:true,force:true});}
});
