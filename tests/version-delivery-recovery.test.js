import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,rm,rename} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Projects} from '../apps/server/src/storage/projects.js';import {Versions} from '../apps/server/src/storage/versions.js';import {hashBuild} from '../apps/server/src/integration/build.js';
import {Manager} from '../apps/server/src/orchestrator/manager.js';import {Store} from '../apps/server/src/storage/store.js';import {createRuntime} from '../apps/server/src/providers/runtime.js';
test('temporary Windows version-directory locks retry without recopying or duplicating a version',async()=>{
 const root=await mkdtemp(join(tmpdir(),'version-lock-'));try{
 const projects=new Projects(root),project=await projects.create('Locks'),build=join(root,'build');await mkdir(build);await writeFile(join(build,'index.html'),'game');let attempts=0;
 const versions=new Versions(root,projects,{renameDirectory:async(from,to)=>{if(++attempts<=2)throw Object.assign(Error('Temporary lock'),{code:'EPERM'});return rename(from,to);},pause:async()=>{}});
 const run={id:'run',projectId:project.id,generation:0,brief:{title:'Locks'},instructions:{hash:'i'},build:{sha256:await hashBuild(build)}};await versions.capture(run,build);assert.equal(attempts,3);await versions.capture(run,build);assert.equal((await projects.get(project.id)).versions.length,1);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('exhausted repairs require a new plan generation and do not erase prior evidence or reset the budget',async()=>{
 const root=await mkdtemp(join(tmpdir(),'exhausted-repair-'));try{
 const manager=new Manager(new Store(root),{runtime:createRuntime({env:{}}),browserMode:'off'});manager.launch=()=>{};const run=await manager.create({title:'Bounded',prompt:'Collect stars',difficulty:'beginner'});run.status='failed';run.error='planner exhausted its repair attempts: Incomplete criteria';run.steps=7;
 const evidence=join(manager.store.folder(run.id),'workspaces','generation-0','planner');await mkdir(evidence,{recursive:true});await writeFile(join(evidence,'attempt-3-checker.json'),'original rejected evidence');
 await assert.rejects(manager.act(run.id,'retry'),/new plan/);await manager.act(run.id,'revise_plan',{});assert.equal(run.generation,1);assert.equal(run.steps,7);assert.equal(await (await import('node:fs/promises')).readFile(join(evidence,'attempt-3-checker.json'),'utf8'),'original rejected evidence');assert.equal(run.planApproval,null);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('a failed version save can finish delivery without rerunning agents; tampered bytes cannot retry',async()=>{
 const root=await mkdtemp(join(tmpdir(),'delivery-recovery-'));try{
 let routes=0;const demo=createRuntime({env:{}}),runtime={...demo,route:async(...args)=>{routes++;return demo.route(...args);}};
 const manager=new Manager(new Store(root),{runtime,browserMode:'on',browserRunner:async({buildHash})=>({passed:true,buildHash,browserTested:false})});await manager.initialize();const capture=manager.versions.capture.bind(manager.versions);manager.versions.capture=async()=>{throw Object.assign(Error('Injected directory lock'),{code:'EPERM'});};
 const run=await manager.create({title:'Recovery',prompt:'Collect stars',difficulty:'beginner'});await manager.jobs.get(run.id);await manager.act(run.id,'approve_plan',{planHash:run.planHash});await manager.jobs.get(run.id);assert.equal(run.status,'failed');assert.ok(run.build);const calls=routes;manager.versions.capture=capture;
 await manager.act(run.id,'retry_delivery');assert.equal(run.status,'awaiting_review');assert.equal(routes,calls);assert.equal((await manager.projects.get(run.projectId)).versions.length,1);assert.equal(run.approval,undefined);
 run.status='failed';await writeFile(join(manager.store.folder(run.id),'builds','0','config.json'),'tampered');await assert.rejects(manager.act(run.id,'retry_delivery'),/bytes/);assert.equal(routes,calls);
 }finally{await rm(root,{recursive:true,force:true});}
});
