import {fingerprint} from '../runners/instructions.js';
import {ROLES,clone} from '../../../../shared/contracts/index.js';
const validRole=role=>{if(!ROLES.includes(role))throw Error('Unknown memory role');};
export function ensureMemory(run){
  run.memory??={version:1,projectId:run.id,revision:0,specification:null,decisions:[],artifacts:{},workspaces:{},handoffs:[],tests:[],invalidations:[]};
  if(run.memory.version!==1||run.memory.projectId!==run.id)throw Error('Invalid project memory');
  return run.memory;
}
export function approveSpecification(run){const m=ensureMemory(run);m.specification={generation:run.generation,planHash:run.planHash,brief:clone(run.brief),plan:clone(run.results.planner.artifact),source:'human-plan-approval'};m.revision++;}
export function recordDecision(run,key,answer,question){const m=ensureMemory(run);m.decisions.push({key,answer,questionId:question.id,generation:run.generation,affectedRoles:clone(question.affectedRoles),source:'human-answer',at:new Date().toISOString()});m.revision++;}
export function checkpointMemory(run,role,event){validRole(role);const m=ensureMemory(run);m.workspaces[role]={generation:run.generation,stage:event.stage,attempt:event.attempt,nextAction:event.stage==='accepted'?'Use accepted artifact':event.stage==='checking'?'Await independent checker':'Continue current task; verify dependencies before resuming',auditDirectory:`workspaces/generation-${run.generation}/${role}`};}
export function acceptMemory(run,role,result,dependencies=[]){
  validRole(role);const m=ensureMemory(run),parents={};
  for(const dependency of dependencies){validRole(dependency);const parent=m.artifacts[dependency];if(!parent||parent.stale)throw Error('Missing current memory dependency: '+dependency);parents[dependency]=parent.hash;}
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
  for(const parent of dependencies){validRole(parent);const entry=m.artifacts[parent];if(!entry||entry.stale||fingerprint(run.results[parent]?.artifact)!==entry.hash)throw Error('Stale memory dependency: '+parent);records.push({role:parent,hash:entry.hash,artifact:clone(entry.artifact),auditDirectory:entry.auditDirectory});}
  const result={projectId:run.id,revision:m.revision,generation:run.generation,specificationHash:m.specification?.planHash||null,decisions:m.decisions.filter(d=>d.affectedRoles.includes(role)||d.affectedRoles.includes('planner')).map(d=>({key:d.key,answer:d.answer,source:d.source})),dependencies:records,checkpoint:m.workspaces[role]?.generation===run.generation?clone(m.workspaces[role]):null};
  if(JSON.stringify(result).length>7000)throw Error('Focused memory exceeds context budget; split the task instead of truncating requirements');
  return result;
}
export function recordTests(run,kind,evidence){const m=ensureMemory(run);m.tests.push({kind,generation:run.generation,revision:m.revision,artifactHashes:Object.fromEntries(Object.entries(m.artifacts).filter(([,v])=>!v.stale).map(([role,v])=>[role,v.hash])),evidence:clone(evidence),stale:false});}
