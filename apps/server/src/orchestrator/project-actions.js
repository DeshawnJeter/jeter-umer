import {isModelProvider} from '../../../../shared/providers.js';
import {runCodeChecks} from '../validation/code-checks.js';
import {randomUUID} from 'node:crypto';
import {cp,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validateGame} from '../validation/index.js';
import {hashBuild} from '../integration/build.js';
import {fingerprint} from '../runners/instructions.js';
import {ensureMemory} from '../memory/project.js';
import {humanChecksFor} from '../../../../shared/lifecycle.js';
import {emptyUsage} from '../providers/usage.js';
import {inspectWholeGame} from '../validation/whole-game-acceptance.js';
export async function restoreVersion(manager,projectId,versionId){
 const snapshot=await manager.versions.get(projectId,versionId),project=await manager.projects.get(projectId);
 const id=randomUUID(),folder=resolve(manager.store.folder(id),'builds','0');
 const run={version:2,id,projectId,createdAt:new Date().toISOString(),generation:0,mode:manager.runtime.mode,providerConfig:structuredClone(manager.runtime.publicConfig),providerUsage:isModelProvider(manager.runtime.mode)?emptyUsage():null,status:'paused',steps:0,agents:{},tasks:{},questions:[],answers:[],decisions:{},events:[],results:structuredClone(snapshot.results),brief:structuredClone(snapshot.brief),instructions:await manager.manifest(),planApproval:null,planHash:null,build:null,validation:null,browserQaMode:manager.browserMode,projectHistory:manager.projects.context(project),acceptanceCases:structuredClone(project.acceptanceCases||[]),assetSelection:structuredClone(project.assetSelection||{}),parentVersionId:versionId,restoredFrom:{versionId,buildHash:snapshot.buildHash,instructionsHash:snapshot.instructionsHash},memory:structuredClone(snapshot.memory)};
 // Historical contributions are preserved as provenance, never relabeled as
 // newly model-reviewed work. New approval and browser evidence are required.
 run.memory.projectId=projectId;run.memory.specification=null;ensureMemory(run);
 await cp(resolve(manager.versions.folder(projectId,versionId),'build'),folder,{recursive:true});
 if(await hashBuild(folder)!==snapshot.buildHash)throw Error('Restored bytes differ');
 const config=JSON.parse(await readFile(resolve(folder,'config.json'),'utf8'));
 run.validation=validateGame(config);if(!run.validation.passed)throw Error('Historical version fails current static checks');
 run.build={generation:0,sha256:snapshot.buildHash,url:`/preview/${id}/0/index.html`,checksRequired:humanChecksFor(run.brief.genre)};
 run.planHash=fingerprint({brief:run.brief,plan:run.results.planner.artifact,instructions:run.instructions.hash,restoredFrom:run.restoredFrom});
 run.browserChecks=manager.browserMode==='on'?await manager.browserRunner({folder,config,buildHash:snapshot.buildHash,reportFolder:resolve(manager.store.folder(id),'browser-checks','generation-0'),acceptanceCases:run.acceptanceCases}):{passed:null,browserTested:false,buildHash:snapshot.buildHash,reason:'Browser QA explicitly disabled'};
 if(manager.browserMode==='on'){run.browserChecks.acceptance=inspectWholeGame(run.browserChecks,snapshot.buildHash,config.genre,run.acceptanceCases);run.browserChecks.passed=run.browserChecks.acceptance.passed;run.browserChecks.fullPlaythrough=run.browserChecks.acceptance.fullPlaythrough;if(!run.browserChecks.passed&&!run.browserChecks.error)run.browserChecks.error=run.browserChecks.acceptance.findings.join('; ').slice(0,600);if(await hashBuild(folder)!==snapshot.buildHash){run.browserChecks.passed=false;run.browserChecks.error='Restored build changed during browser checks';}}
 if(config.genre==='custom'&&run.acceptanceCases.length){run.independentChecks=await runCodeChecks(config.coding,undefined,{acceptanceCases:run.acceptanceCases});if(!run.independentChecks.passed){run.browserChecks.passed=false;run.browserChecks.error=run.independentChecks.error;}}
 run.status=run.browserChecks.passed===false?'failed':'awaiting_plan';
 if(run.status==='failed')run.error='Restored version failed current browser checks';
 run.events.push({at:new Date().toISOString(),message:'Restored exact historical bytes to a new run. Historical model reviews retained; current plan and human playtest approval required.'});
 manager.runs.set(id,run);await manager.save(run);await manager.versions.capture(run,folder);return run;
}
export async function compareVersions(manager,projectId,leftId,rightId){
 const [left,right]=await Promise.all([manager.versions.get(projectId,leftId),manager.versions.get(projectId,rightId)]);
 const roles=[...new Set([...Object.keys(left.results),...Object.keys(right.results)])];
 return {left:leftId,right:rightId,sameBuild:left.buildHash===right.buildHash,changedRoles:roles.filter(role=>fingerprint(left.results[role]?.artifact||null)!==fingerprint(right.results[role]?.artifact||null)),briefChanges:Object.keys({...left.brief,...right.brief}).filter(key=>JSON.stringify(left.brief[key])!==JSON.stringify(right.brief[key])),leftApproval:(await manager.projects.get(projectId)).versions.find(v=>v.id===leftId).approval,rightApproval:(await manager.projects.get(projectId)).versions.find(v=>v.id===rightId).approval};
}
