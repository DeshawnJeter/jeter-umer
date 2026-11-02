import {randomUUID} from 'node:crypto';
import {ROLES} from '../../../../shared/contracts/index.js';
const text=(value,max,required=false)=>{if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error('Invalid feedback text');return value.trim();};
export async function addFeedback(projects,projectId,data){
 return projects.update(projectId,project=>{
  if(!project.versions.some(v=>v.id===data.versionId))throw Error('Choose a version in this project');
  if(!Array.isArray(data.roles)||!data.roles.length||data.roles.some(role=>!ROLES.includes(role)))throw Error('Choose valid affected agents');
  if(project.feedback.filter(item=>item.status==='open').length>=20)throw Error('Review existing open feedback before adding more');
  project.feedback.push({id:randomUUID(),versionId:data.versionId,title:text(data.title,120,true),expected:text(data.expected||'',300),actual:text(data.actual||'',300),steps:text(data.steps||'',500),roles:[...new Set(data.roles)],status:'open',createdAt:new Date().toISOString(),history:[]});
 });
}
export async function updateFeedback(projects,projectId,id,data){
 return projects.update(projectId,project=>{
  const item=project.feedback.find(item=>item.id===id);if(!item)throw Error('Feedback not found');
  if(!['open','resolved','deferred'].includes(data.status))throw Error('Invalid feedback status');
  const note=text(data.note||'',500,true);
  if(data.status==='resolved'&&!project.versions.some(v=>v.id===data.verifiedVersionId))throw Error('Identify the version you verified');
  item.history.push({from:item.status,to:data.status,note,verifiedVersionId:data.verifiedVersionId||null,source:'human-review',at:new Date().toISOString()});item.status=data.status;
 });
}
export function feedbackFor(project,role){return project.feedback.filter(item=>item.status==='open'&&(item.roles.includes(role)||role==='planner'||role==='qa')).map(({id,versionId,title,expected,actual,steps,roles})=>({id,versionId,title,expected,actual,steps,roles}));}
