import {fingerprint} from '../runners/instructions.js';
import {ROLES,clone} from '../../../../shared/contracts/index.js';
const validRole=role=>{if(!ROLES.includes(role))throw Error('Unknown memory role');};
const independentlyAccepted=result=>result?.status==='accepted'&&result.report?.verdict==='pass'&&Array.isArray(result.report.findings)&&result.report.findings.length===0&&Array.isArray(result.report.evidence)&&result.report.evidence.length>0&&result.report.evidence.every(value=>typeof value==='string'&&value.trim());
// Verify the payload that will actually be handed off, its checked result and
// every ancestor. A stored hash alone does not prove any of these are current.
export function assertCurrentMemory(run,role,visiting=new Set()){
  validRole(role);
  const entry=ensureMemory(run).artifacts[role],result=run.results?.[role];
  if(visiting.has(role)||!entry||entry.stale||!independentlyAccepted(result)||fingerprint(result.artifact)!==entry.hash||fingerprint(entry.artifact)!==entry.hash)throw Error('Stale memory dependency: '+role);
  visiting.add(role);
  try{
    for(const [parent,hash]of Object.entries(entry.dependencies))if(assertCurrentMemory(run,parent,visiting).hash!==hash)throw Error('Stale memory dependency: '+role);
  }finally{visiting.delete(role);}
  return entry;
}
export function ensureMemory(run){
  run.memory??={version:1,projectId:run.projectId||run.id,revision:0,specification:null,decisions:(run.answers||[]).map(answer=>({key:answer.question.key,answer:answer.answer,questionId:answer.question.id,generation:answer.question.generation||0,affectedRoles:clone(answer.question.affectedRoles),source:'human-answer',at:answer.at})),artifacts:{},workspaces:{},handoffs:[],tests:[],invalidations:[]};
  if(run.projectId&&run.memory.projectId===run.id)run.memory.projectId=run.projectId;
  if(run.memory.version!==1||run.memory.projectId!==(run.projectId||run.id))throw Error('Invalid project memory');
  return run.memory;
}
export function approveSpecification(run){const m=ensureMemory(run);m.specification={generation:run.generation,planHash:run.planHash,brief:clone(run.brief),plan:clone(run.results.planner.artifact),source:'human-plan-approval'};m.revision++;}
export function recordDecision(run,key,answer,question){const m=ensureMemory(run);m.decisions.push({key,answer,questionId:question.id,generation:run.generation,affectedRoles:clone(question.affectedRoles),source:'human-answer',at:new Date().toISOString()});m.revision++;}
export function checkpointMemory(run,role,event){validRole(role);const m=ensureMemory(run);m.workspaces[role]={generation:run.generation,stage:event.stage,attempt:event.attempt,ownership:clone(run.tasks?.[role]?.ownership||[`game/config/${role}.json`]),nextAction:event.stage==='accepted'?'Use accepted artifact':event.stage==='checking'?'Await independent checker':'Continue current task; verify dependencies before resuming',auditDirectory:`workspaces/generation-${run.generation}/${role}`};}
export function acceptMemory(run,role,result,dependencies=[]){
  if(!independentlyAccepted(result))throw Error('Only independently accepted contributions enter project memory');
  validRole(role);const m=ensureMemory(run),parents={};
  for(const dependency of dependencies){const parent=assertCurrentMemory(run,dependency);parents[dependency]=parent.hash;}
  const entry={role,generation:run.generation,revision:++m.revision,hash:fingerprint(result.artifact),dependencies:parents,artifact:clone(result.artifact),summary:(result.summary||`Checked ${role} contribution`).slice(0,500),source:'accepted-worker-and-checker',stale:false,evidence:clone(result.report.evidence),auditDirectory:`workspaces/generation-${run.generation}/${role}`};
  m.artifacts[role]=entry;
  m.handoffs.push({role,generation:run.generation,revision:entry.revision,artifactHash:entry.hash,dependencies:parents,summary:entry.summary,auditDirectory:entry.auditDirectory});
}
export function invalidateMemory(run,roles,reason='Requirements or dependency changed'){
  const m=ensureMemory(run),affected=new Set(roles);let changed=true;
  while(changed){changed=false;for(const [role,entry]of Object.entries(m.artifacts))if(!affected.has(role)&&Object.keys(entry.dependencies).some(parent=>affected.has(parent))){affected.add(role);changed=true;}}
  for(const role of affected){if(m.artifacts[role])m.artifacts[role].stale=true;if(m.workspaces[role])m.workspaces[role].stage='stale';}
  for(const record of m.tests)record.stale=true;
  m.invalidations.push({revision:++m.revision,generation:run.generation,roles:[...affected],reason});
  if(affected.has('planner'))m.specification=null;
  return [...affected];
}
export function readMemory(run,role,dependencies=[]){
  validRole(role);const m=ensureMemory(run),records=[];
  for(const parent of dependencies){const entry=assertCurrentMemory(run,parent);const artifact=parent==='planner'?{planReference:{hash:entry.hash,field:'context.plan'}}:parent==='coding'&&role!=='coding'?{sourceReference:{hash:entry.hash,path:'generated/rules.js',auditDirectory:entry.auditDirectory},interface:'createGame(api): start/update/inspect',summary:entry.summary}:clone(entry.artifact);records.push({role:parent,hash:entry.hash,artifact,auditDirectory:entry.auditDirectory});}
  const result={projectId:run.projectId||run.id,revision:m.revision,generation:run.generation,specificationHash:m.specification?.planHash||null,decisions:m.decisions.filter(d=>d.affectedRoles.includes(role)||d.affectedRoles.includes('planner')).map(d=>({key:d.key,answer:d.answer,source:d.source})),dependencies:records,checkpoint:m.workspaces[role]?.generation===run.generation?clone(m.workspaces[role]):null,previousHandoff:clone(m.handoffs.findLast(item=>item.role===role)||null),references:{handoffs:m.handoffs.length,tests:m.tests.length}};
  if(JSON.stringify(result).length>7000)throw Error('Focused memory exceeds context budget; split the task instead of truncating requirements');
  return result;
}
export function recordTests(run,kind,evidence){const m=ensureMemory(run);m.tests.push({kind,generation:run.generation,revision:m.revision,artifactHashes:Object.fromEntries(Object.entries(m.artifacts).filter(([,v])=>!v.stale).map(([role,v])=>[role,v.hash])),evidence:clone(evidence),stale:false});}
