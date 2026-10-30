import {requestChange} from './change-request.js';
export function repairFeedback(manager,projectId,data){
 manager.projectRepairJobs??=new Map();const before=manager.projectRepairJobs.get(projectId)||Promise.resolve();const next=before.catch(()=>{}).then(()=>applyRepair(manager,projectId,data));manager.projectRepairJobs.set(projectId,next);return next.finally(()=>{if(manager.projectRepairJobs.get(projectId)===next)manager.projectRepairJobs.delete(projectId);});
}
async function applyRepair(manager,projectId,data){
 const project=await manager.projects.get(projectId);
 if(!Array.isArray(data.feedbackIds)||!data.feedbackIds.length||data.feedbackIds.length>5)throw Error('Select one to five unresolved issues');
 const issues=data.feedbackIds.map(id=>{const issue=project.feedback.find(item=>item.id===id&&item.status==='open');if(!issue)throw Error('Choose open feedback from this project');return issue;});
 for(const issue of issues)for(const attempt of issue.repairs||[]){const run=manager.runs.get(attempt.runId);if(run&&!['complete','cancelled','failed','stopped'].includes(run.status))throw Error('This feedback already has an active repair');if(attempt.baseVersionId===data.versionId&&run?.status==='failed')throw Error('The same repair failed on this base version. Review its findings or choose a newer version before retrying.');}
 const request=issues.map(issue=>`${issue.title}. Expected: ${issue.expected}. Actual: ${issue.actual}. Reproduce: ${issue.steps}`).join('\n');if(request.length>600)throw Error('Repair feedback is too long; select fewer issues');
 const run=await requestChange(manager,projectId,{versionId:data.versionId,request,preserve:data.preserve||[]});
 await manager.projects.update(projectId,p=>{for(const issue of issues){const item=p.feedback.find(item=>item.id===issue.id);item.repairs??=[];item.repairs.push({runId:run.id,baseVersionId:data.versionId,at:new Date().toISOString()});}});
 return run;
}
