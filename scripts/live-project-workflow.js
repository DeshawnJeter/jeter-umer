import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Store} from '../apps/server/src/storage/store.js';
import {Manager} from '../apps/server/src/orchestrator/manager.js';
import {createRuntime} from '../apps/server/src/providers/runtime.js';
import {addFeedback} from '../apps/server/src/memory/feedback.js';
import {requestChange} from '../apps/server/src/orchestrator/change-request.js';
import {restoreVersion} from '../apps/server/src/orchestrator/project-actions.js';
import {hashBuild} from '../apps/server/src/integration/build.js';
import {runCodeChecks} from '../apps/server/src/validation/code-checks.js';
import {runPair} from '../apps/server/src/runners/harness.js';
import {readMemory} from '../apps/server/src/memory/project.js';
import {dependenciesFor} from '../shared/specialists.js';

export async function liveProjectWorkflow({folder,key,resume=false,freshSecond=false,maxCalls,maxDollars}){
 const report=resume?JSON.parse(await readFile(resolve(folder,'workflow.json'),'utf8')):{startedAt:new Date().toISOString(),passed:false,simulatedHumanPlanReview:true,humanPlaytestApproved:false,calls:[],checks:[],runs:[],estimatedReservedDollars:0,measuredDollars:0,maxEstimatedDollars:2.5,maxCalls:40};
 if(resume){report.previousAttempts??=[];report.previousAttempts.push({finishedAt:report.finishedAt,error:report.error||null});delete report.error;report.passed=false;}
 if(maxCalls!==undefined){if(!Number.isInteger(maxCalls)||maxCalls<1||maxCalls>60)throw Error('Validation call ceiling must be 1–60');report.previousCallCeiling=report.maxCalls;report.maxCalls=maxCalls;}
 if(maxDollars!==undefined){if(!Number.isFinite(maxDollars)||maxDollars<=0||maxDollars>2.5)throw Error('Validation cost ceiling must be positive and at most $2.50');report.maxEstimatedDollars=maxDollars;}
 const rates={'gpt-6.1-sol':[2,10],'gpt-6.1-terra':[1,5],'gpt-6-luna':[0.1,0.5],'gpt-6-astra':[10,50]};
 let committed=report.calls.reduce((sum,c)=>sum+(c.measuredDollars??c.reservedDollars),0),writes=Promise.resolve();
 const persist=()=>{const json=JSON.stringify(report,null,2);writes=writes.catch(()=>{}).then(()=>writeFile(resolve(folder,'workflow.json'),json));return writes;};
 const fetchImpl=async(url,options)=>{
  if(url==='https://api.openai.com/v1/responses/input_tokens'){report.tokenCountRequests=(report.tokenCountRequests||0)+1;return fetch(url,options);}
  if(url!=='https://api.openai.com/v1/responses')throw Error('Unexpected live endpoint');
  const body=JSON.parse(options.body),rate=rates[body.model];if(!rate)throw Error('Unpriced model blocked by validation budget');
  const reserve=((Buffer.byteLength(options.body)+512)*rate[0]+body.max_output_tokens*rate[1])/1e6;
  if(report.calls.length>=report.maxCalls||committed+reserve>report.maxEstimatedDollars)throw Error('Live validation budget reached');
  committed+=reserve;const data=JSON.parse(body.input[0].content[0].text);
  const call={model:body.model,roleStage:body.text.format.name,previousTool:data.context?.lastToolName||null,decisionKeys:Object.keys(data.context?.decisions||{}),historyDecisionKeys:(data.context?.projectHistory?.decisions||[]).map(d=>d.key),feedbackIds:(data.context?.unresolvedFeedback||[]).map(f=>f.id),hasPreviousSource:!!data.context?.previousSource,reservedDollars:reserve,status:'pending'};report.calls.push(call);await persist();
  console.log('Live request '+report.calls.length+': '+call.roleStage+' / '+call.model);
  let response;try{response=await fetch(url,options);}catch{call.status='network-error';report.estimatedReservedDollars=committed;await persist();throw Error('Live network request failed');}
  const value=await response.clone().json().catch(()=>null);call.status=response.status;call.responseStatus=value?.status||null;call.requestedTool=value?.output?.find(item=>item.type==='function_call')?.name||null;
  const u=value?.usage;
  if(u&&['input_tokens','output_tokens','total_tokens'].every(k=>Number.isSafeInteger(u[k])&&u[k]>=0)&&u.total_tokens===u.input_tokens+u.output_tokens){call.usage={inputTokens:u.input_tokens,outputTokens:u.output_tokens,totalTokens:u.total_tokens};call.measuredDollars=(u.input_tokens*rate[0]+u.output_tokens*rate[1])/1e6;committed+=call.measuredDollars-reserve;report.measuredDollars+=call.measuredDollars;}else call.unknownUsage=true;
  report.estimatedReservedDollars=committed;await persist();return response;
 };
 const env={GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:key};
 const runtime=createRuntime({env,fetchImpl,countInputTokens:true}),store=new Store(resolve(folder,'runs'));let manager=new Manager(store,{runtime,browserMode:'on'});
 const check=(name,condition)=>{assert.ok(condition,name);report.checks.push({name,passed:true});console.log('Passed: '+name);};
 const settle=async run=>{await manager.jobs.get(run.id);if(run.status==='failed'||run.status==='stopped')throw Error(run.error||run.events.at(-1)?.message||run.status);return run;};
 const plan=async run=>{await settle(run);assert.equal(run.status,'awaiting_plan');await manager.act(run.id,'approve_plan',{planHash:run.planHash});await settle(run);};
 try{
  await manager.initialize();
  const first=report.runs.length?manager.get(report.runs[0]):await manager.create({title:'Moonbrook Beacons',genre:'custom',theme:'forest',difficulty:'beginner',music:true,musicStyle:'calm',musicInstrument:'bell',askStory:true,prompt:'Make a tiny original 2D beacon game. Arrow keys move the player. Each distinct press of J lights one beacon and adds exactly one score; holding J must not add more. Light three beacons to win. Start with health/maxHealth 4. Doing nothing must lose within 10 seconds, setting health to 0. Show beacon progress, health and the player. Keep generated render nodes minimal: player, three beacons and text only; the framework supplies the forest background. Every node must have x,y,size,a six-digit color and a label string (empty for decoration). Restart resets everything. Use calm bell music.'});
  if(!report.runs.includes(first.id))report.runs.push(first.id);
  if(resume&&first.status==='failed'){const calls=report.calls.length,delivery=!!first.build;await manager.act(first.id,delivery?'retry_delivery':/planner exhausted its repair attempts:/.test(first.error||'')?'revise_plan':'retry',{});await settle(first);if(delivery)check('failed version saving recovers without another model call',report.calls.length===calls);}
  if(first.status==='running')await settle(first);
  if(first.status==='awaiting_plan')await plan(first);
  if(first.status==='awaiting_human'){const question=first.questions.find(q=>q.key==='story.direction');assert.ok(question,'Expected story-direction gate');await manager.act(first.id,'answer',{questionId:question.id,answer:'The village is Moonbrook. Mention Moonbrook in every intro, including later versions.'});await settle(first);}
  assert.equal(first.status,'awaiting_review');
  check('first game used real workers and independent model checkers',Object.values(first.results).every(r=>r.report.reviewSources?.includes('openai')));
  check('first build passed actual browser checks',first.browserChecks?.passed===true);
  const project=await manager.projects.get(first.projectId),version=project.versions.find(v=>v.runId===first.id&&v.generation===first.generation);report.projectId=project.id;report.firstVersionId=version.id;report.firstBuildHash=version.buildHash;
  check('human story decision persisted at project scope',project.decisions.some(d=>d.key==='story.direction'&&String(d.answer).includes('Moonbrook')));
  if(!project.feedback.length)await addFeedback(manager.projects,project.id,{versionId:version.id,title:'Validation enhancement: add a persistent build hint',expected:'Display a node label exactly MEMORY CHECK: J throughout ready and playing phases.',actual:'The first task did not require this persistent label. This is a new requested enhancement, not a claimed defect.',steps:'Open the game and inspect the visible control hint.',roles:['coding','ui']});
  manager=new Manager(store,{runtime,browserMode:'on'});await manager.initialize();check('project and unresolved feedback survive server restart',(await manager.projects.get(project.id)).feedback[0].status==='open');
  const secondId=report.secondRunId||report.runs[1];
  const second=!freshSecond&&secondId?manager.get(secondId):await requestChange(manager,project.id,{versionId:version.id,request:'Continue this same project. Address its open playtest feedback using project memory. Preserve the existing gameplay and known story decision.',preserve:['Health/maxHealth start at 4.','One point per distinct J press, three points wins.','Idle loss within ten seconds.','Calm bell music.']});report.secondRunId=second.id;if(!report.runs.includes(second.id))report.runs.push(second.id);
  if(resume&&second.status==='failed'){await manager.act(second.id,second.build?'retry_delivery':'retry');await settle(second);}
  if(second.status!=='awaiting_review')await plan(second);
  check('known project decision is not asked again',second.status!=='awaiting_human'&&!second.questions.some(q=>q.key==='story.direction'));assert.equal(second.status,'awaiting_review');
  check('story remembers Moonbrook across runs',second.results.story.artifact.intro.includes('Moonbrook'));
  check('second build passed real workers checkers and browser tests',second.browserChecks?.passed&&Object.values(second.results).every(r=>r.report.reviewSources?.includes('openai')));
  check('coding request received unresolved feedback',report.calls.some(c=>c.roleStage==='coding_worker'&&c.feedbackIds.length));
  const acceptanceCases=[{name:'requested visible control hint',steps:[{dt:0,actions:[],repeat:1}],assertions:[{field:'label',op:'eq',value:'MEMORY CHECK: J'},{field:'health',op:'eq',value:4}]}];
  const feedbackCheck=await runCodeChecks(second.results.coding.artifact,undefined,{acceptanceCases});await writeFile(resolve(folder,'feedback-execution.json'),JSON.stringify(feedbackCheck,null,2));check('feedback change appears in actual rendered-node output and preserves health',feedbackCheck.passed);
  const updated=await manager.projects.get(project.id),secondVersion=updated.versions.at(-1);report.secondVersionId=secondVersion.id;
  check('feedback stays open after agents finish',updated.feedback[0].status==='open');
  const restored=await restoreVersion(manager,project.id,version.id);report.runs.push(restored.id);report.restoredRunId=restored.id;
  check('restore preserves exact original game bytes',restored.build.sha256===version.buildHash&&await hashBuild(resolve(store.folder(first.id),'builds',String(first.build.generation)))===version.buildHash);
  check('restore requires a fresh plan and has no inherited approval',restored.status==='awaiting_plan'&&!restored.planApproval&&!restored.approval);
  check('restored candidate passed fresh browser checks',restored.browserChecks.passed===true);
  check('restoring does not resolve open feedback',(await manager.projects.get(project.id)).feedback[0].status==='open');
  const astraRuntime=createRuntime({env:{...env,OPENAI_CODING_WORKER_MODEL:'gpt-6-astra'},fetchImpl,countInputTokens:true});
  const astra=await runPair({role:'coding',brief:second.brief,context:{previousSource:second.results.coding.artifact.source,seedOwnedSource:true,plan:second.results.planner.artifact,decisions:second.decisions,memory:readMemory(second,'coding',dependenciesFor('coding','custom')),unresolvedFeedback:(await manager.projects.get(project.id)).feedback.filter(f=>f.status==='open')},execution:{provider:'openai',models:astraRuntime.publicConfig.models.coding,diagnostic:'Explicit Astra worker probe; not a naturally triggered escalation'},directory:resolve(folder,'astra-probe'),...await astraRuntime.route('coding',{}),verifyProposal:artifact=>runCodeChecks(artifact,undefined,{acceptanceCases})});
  check('Astra coding worker passes real execution and an independent Sol checker',astra.status==='accepted'&&astra.report.reviewSources.includes('openai'));
  await writeFile(resolve(folder,'astra-probe-result.json'),JSON.stringify({status:astra.status,report:astra.report,audit:astra.audit},null,2));
  report.passed=true;
 }catch(error){report.error=error.message;console.log('Validation stopped: '+report.error);}
 finally{report.finishedAt=new Date().toISOString();await persist();console.log('Workflow report: '+resolve(folder,'workflow.json'));}
 return report;
}
