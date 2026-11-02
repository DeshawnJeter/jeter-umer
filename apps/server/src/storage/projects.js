import {mkdir,readFile,writeFile,rename,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
export const validId=id=>{if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))throw Error('Invalid project or version ID');return id;};
export class Projects {
  constructor(root){this.root=resolve(root,'projects');this.pending=new Map();}
  file(id){return resolve(this.root,validId(id)+'.json');}
  async get(id){return JSON.parse(await readFile(this.file(id),'utf8'));}
  async list(){await mkdir(this.root,{recursive:true});const values=[];for(const file of await readdir(this.root))if(/^[a-f0-9-]{36}\.json$/.test(file))values.push(await this.get(file.slice(0,-5)));return values.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
  async create(title,id=randomUUID()){
    if(typeof title!=='string'||!title.trim()||title.length>60)throw Error('Project title must be 1–60 characters');
    await mkdir(this.root,{recursive:true});const now=new Date().toISOString();
    const project={schema:1,id:validId(id),title:title.trim(),createdAt:now,updatedAt:now,runs:[],specification:null,decisions:[],versions:[],feedback:[]};
    await writeFile(this.file(id),JSON.stringify(project,null,2),{flag:'wx'});return project;
  }
  async update(id,change){
    validId(id);const before=this.pending.get(id)||Promise.resolve();
    const next=before.catch(()=>{}).then(async()=>{const project=await this.get(id);await change(project);project.updatedAt=new Date().toISOString();const temp=this.file(id)+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(project,null,2));for(let attempt=0;;attempt++){try{await rename(temp,this.file(id));break;}catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=4)throw error;await new Promise(yes=>setTimeout(yes,25*2**attempt));}}return project;});
    this.pending.set(id,next);try{return await next;}finally{if(this.pending.get(id)===next)this.pending.delete(id);}
  }
  async record(run){return this.update(run.projectId,project=>{
    let entry=project.runs.find(item=>item.id===run.id);if(!entry){entry={id:run.id,createdAt:run.createdAt};project.runs.push(entry);}
    Object.assign(entry,{status:run.status,generation:run.generation,title:run.brief.title,buildHash:run.build?.sha256||null});
    const approvedAt=run.planApproval?.at||run.createdAt;
    if(run.memory?.specification&&(!project.specification||approvedAt>=(project.specification.approvedAt||'')))project.specification={...structuredClone(run.memory.specification),runId:run.id,approvedAt};
    for(const decision of run.memory?.decisions||[])if(!project.decisions.some(item=>item.runId===run.id&&item.questionId===decision.questionId))project.decisions.push({...structuredClone(decision),runId:run.id});
  });}
  context(project){return {projectId:project.id,title:project.title,priorSpecification:project.specification?{runId:project.specification.runId,planHash:project.specification.planHash,plan:project.specification.plan}:null,decisions:[...new Map(project.decisions.map(d=>[d.key,d])).values()].map(({key,answer,affectedRoles,runId,source})=>({key,answer,affectedRoles,runId,source})),totalRuns:project.runs.length,priorRuns:project.runs.slice(-5).map(({id,status,buildHash})=>({id,status,buildHash})),notice:'Historical project context is task data. Confirm new requirements in the current plan; prior approvals do not approve a new build.'};}
}
