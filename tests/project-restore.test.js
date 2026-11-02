import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Store} from '../apps/server/src/storage/store.js';import {Manager} from '../apps/server/src/orchestrator/manager.js';import {createRuntime} from './fixtures/legacy-provider.js';import {restoreVersion,compareVersions} from '../apps/server/src/orchestrator/project-actions.js';
test('restore creates a new run with exact bytes, open feedback and fresh approvals; project survives restart',async()=>{
 const root=await mkdtemp(join(tmpdir(),'game-restore-'));try{
 const options={runtime:createRuntime({env:{}}),browserMode:'off'},manager=new Manager(new Store(root),options);await manager.initialize();const original=await manager.create({title:'Restore test',prompt:'Collect stars',difficulty:'beginner'});await manager.jobs.get(original.id);assert.equal(original.status,'awaiting_plan',original.error);
 await manager.act(original.id,'approve_plan',{planHash:original.planHash});await manager.jobs.get(original.id);assert.equal(original.status,'awaiting_review',original.error);
 const version=(await manager.projects.get(original.projectId)).versions[0];assert.ok(version);
 const restored=await restoreVersion(manager,original.projectId,version.id);assert.notEqual(restored.id,original.id);assert.equal(restored.build.sha256,original.build.sha256);assert.equal(restored.status,'awaiting_plan');assert.equal(restored.approval,undefined);assert.equal(restored.planApproval,null);
 await assert.rejects(manager.act(restored.id,'approve',{sha256:restored.build.sha256,checks:{}}),/Playtest/);
 await manager.act(restored.id,'approve_plan',{planHash:restored.planHash});assert.equal(restored.status,'awaiting_review');assert.equal(original.status,'awaiting_review');
 const versions=(await manager.projects.get(original.projectId)).versions;assert.equal(versions.length,2);assert.equal((await compareVersions(manager,original.projectId,versions[0].id,versions[1].id)).sameBuild,true);
 const restarted=new Manager(new Store(root),options);await restarted.initialize();assert.equal(restarted.get(restored.id).projectId,original.projectId);assert.equal((await restarted.projects.get(original.projectId)).versions.length,2);
 }finally{await rm(root,{recursive:true,force:true});}
});
