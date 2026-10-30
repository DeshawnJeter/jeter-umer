import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Projects} from '../apps/server/src/storage/projects.js';
import {ensureMemory} from '../apps/server/src/memory/project.js';
test('projects persist across runs, serialize concurrent updates, and isolate histories',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'game-projects-'));try{
 const store=new Projects(dir),a=await store.create('A'),b=await store.create('B');
 await Promise.all(Array.from({length:8},(_,i)=>store.record({id:'run-'+i,projectId:a.id,brief:{title:'A'},createdAt:String(i),status:'paused',generation:0,memory:{decisions:[],specification:null}})));
 const restored=new Projects(dir),project=await restored.get(a.id);assert.equal(project.runs.length,8);assert.equal((await restored.get(b.id)).runs.length,0);
 assert.equal(restored.context(project).projectId,a.id);assert.throws(()=>store.file('../secret'),/Invalid/);
 const run={id:'legacy',projectId:a.id,memory:{version:1,projectId:'legacy'}};assert.equal(ensureMemory(run).projectId,a.id);
 }finally{await rm(dir,{recursive:true,force:true});}
});
