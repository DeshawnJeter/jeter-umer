import test from 'node:test';import assert from 'node:assert/strict';import {repairFeedback} from '../apps/server/src/orchestrator/feedback-repair.js';
test('repair refuses duplicate active jobs and never resolves feedback on an agent claim',async()=>{
 const issue={id:'f',status:'open',title:'Guard stuck',expected:'Chase',actual:'Still',steps:'Approach',repairs:[{runId:'r',baseVersionId:'v'}]},project={feedback:[issue]};
 const manager={projects:{get:async()=>project,update:async(_,change)=>change(project)},runs:new Map([['r',{status:'running'}]])};await assert.rejects(repairFeedback(manager,'p',{versionId:'v',feedbackIds:['f']}),/active repair/);
 manager.runs.get('r').status='failed';await assert.rejects(repairFeedback(manager,'p',{versionId:'v',feedbackIds:['f']}),/same repair failed/);assert.equal(issue.status,'open');
});
