import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Manager} from '../apps/server/src/orchestrator/manager.js';import {Store} from '../apps/server/src/storage/store.js';import {createRuntime} from '../apps/server/src/providers/runtime.js';
test('new project runs reuse known human story decisions with original provenance and keep explicit brief settings',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cross-run-decisions-'));try{
 const manager=new Manager(new Store(root),{runtime:createRuntime({env:{}}),browserMode:'off'});manager.launch=()=>{};const project=await manager.projects.create('Memory');await manager.projects.update(project.id,p=>p.decisions.push({key:'story.direction',answer:'Use Moonbrook',source:'human-answer',questionId:'story-q',runId:'original',affectedRoles:['story']},{key:'brief.difficulty',answer:'experienced',source:'human-answer',questionId:'difficulty-q',runId:'original',affectedRoles:['planner']}));
 const run=await manager.create({projectId:project.id,title:'Next',prompt:'Continue',difficulty:'beginner',askStory:true});assert.equal(run.decisions['story.direction'],'Use Moonbrook');assert.equal(run.decisions['brief.difficulty'],undefined);assert.equal(run.brief.difficulty,'beginner');assert.equal(run.memory.decisions[0].originRunId,'original');assert.equal((await manager.projects.get(project.id)).decisions.length,2);
 const handlers=await manager.runtime.route('story',{}),proposal=await handlers.worker({brief:run.brief,context:{decisions:run.decisions,plan:{title:'Next'}}});assert.ok(proposal.artifact);assert.equal(proposal.question,undefined);
 }finally{await rm(root,{recursive:true,force:true});}
});
