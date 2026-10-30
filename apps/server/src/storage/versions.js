import {mkdir,cp,writeFile,readFile,rename,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {validId} from './projects.js';
import {hashBuild} from '../integration/build.js';
export class Versions {
 constructor(root,projects,{renameDirectory=rename,pause=ms=>new Promise(yes=>setTimeout(yes,ms))}={}){this.root=resolve(root,'project-versions');this.projects=projects;this.renameDirectory=renameDirectory;this.pause=pause;}
 folder(projectId,versionId){return resolve(this.root,validId(projectId),validId(versionId));}
 async get(projectId,versionId){const project=await this.projects.get(projectId);if(!project.versions.some(v=>v.id===versionId))throw Error('Version does not belong to project');const folder=this.folder(projectId,versionId);const snapshot=JSON.parse(await readFile(resolve(folder,'snapshot.json'),'utf8'));if(await hashBuild(resolve(folder,'build'))!==snapshot.buildHash)throw Error('Stored version content changed');return snapshot;}
 async capture(run,source){
  if(!run.build)throw Error('No version to save');
  return this.projects.update(run.projectId,async project=>{
   const existing=project.versions.find(v=>v.runId===run.id&&v.generation===run.generation);if(existing){if(existing.buildHash!==run.build.sha256)throw Error('Historical version cannot be overwritten');return;}
   if(await hashBuild(source)!==run.build.sha256)throw Error('Build changed before version capture');
   const id=randomUUID(),folder=this.folder(run.projectId,id),temporary=folder+'.tmp';await mkdir(temporary,{recursive:true});
   try{await cp(source,resolve(temporary,'build'),{recursive:true});if(await hashBuild(resolve(temporary,'build'))!==run.build.sha256)throw Error('Build changed during version capture');
    const snapshot={schema:1,id,projectId:run.projectId,runId:run.id,generation:run.generation,buildHash:run.build.sha256,parentVersionId:run.parentVersionId||project.versions.at(-1)?.id||null,createdAt:new Date().toISOString(),brief:run.brief,results:run.results,memory:run.memory,instructionsHash:run.instructions.hash,validation:run.validation,browserChecks:run.browserChecks};
    await writeFile(resolve(temporary,'snapshot.json'),JSON.stringify(snapshot,null,2));
    for(let attempt=0;;attempt++){try{await this.renameDirectory(temporary,folder);break;}catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=7)throw error;await this.pause(25*2**attempt);}}
    project.versions.push({id,runId:run.id,generation:run.generation,buildHash:snapshot.buildHash,parentVersionId:snapshot.parentVersionId,createdAt:snapshot.createdAt,label:'',approval:null});
   }catch(error){await rm(temporary,{recursive:true,force:true}).catch(()=>{});throw error;}
  });
 }
 async approve(run){await this.projects.update(run.projectId,project=>{const version=project.versions.find(v=>v.runId===run.id&&v.generation===run.generation&&v.buildHash===run.approval?.sha256);if(!version)throw Error('Capture this exact version before approval');version.approval=structuredClone(run.approval);});}
}
