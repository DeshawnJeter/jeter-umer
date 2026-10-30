import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Projects} from '../apps/server/src/storage/projects.js';import {Versions} from '../apps/server/src/storage/versions.js';import {hashBuild} from '../apps/server/src/integration/build.js';
test('versions preserve exact bytes, reject drift and keep approval specific to a version',async()=>{
 const root=await mkdtemp(join(tmpdir(),'game-version-'));try{const projects=new Projects(root),project=await projects.create('Game'),versions=new Versions(root,projects),build=join(root,'build');await mkdir(build);await writeFile(join(build,'index.html'),'original');
 const run={id:'run',projectId:project.id,generation:0,brief:{title:'Game'},build:{sha256:await hashBuild(build)},instructions:{hash:'instructions'},results:{},memory:{},validation:{passed:true}};
 await versions.capture(run,build);await versions.capture(run,build);let current=await projects.get(project.id);assert.equal(current.versions.length,1);const id=current.versions[0].id;
 assert.equal((await versions.get(project.id,id)).buildHash,run.build.sha256);
 run.approval={sha256:run.build.sha256,source:'human-attestation'};await versions.approve(run);
 run.generation++;await versions.capture(run,build);current=await projects.get(project.id);assert.equal(current.versions[1].approval,null);assert.equal(current.versions[1].parentVersionId,id);
 await writeFile(join(versions.folder(project.id,id),'build','index.html'),'tampered');await assert.rejects(versions.get(project.id,id),/changed/);
 }finally{await rm(root,{recursive:true,force:true});}
});
