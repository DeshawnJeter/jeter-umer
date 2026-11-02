import {createHash} from 'node:crypto';
import {EXTENSION_SPECS,extensionDefaults,extensionErrors} from '../../../../shared/specialists.js';
import {genreOf} from '../../../../shared/game-types.js';
import {advancedProfile} from '../../../../shared/advanced-games.js';
import {runProjectRules} from './rules-tests.js';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const contributions=context=>Object.fromEntries((context.memory?.dependencies||[]).map(record=>[record.role,record.artifact]));
export const manifestFor=context=>hash((context.memory?.dependencies||[]).map(record=>[record.role,record.hash]));
export function modulesFor(genre){
  const modules=['movement','hud','settings','audio'];
  if(['rpg','front_battle'].includes(genre))modules.push('turn-combat','party-items');
  if(genre==='stealth')modules.push('patrols','vision');
  if(['run_gun','jump_shooter','metroidvania'].includes(genre))modules.push('projectiles');
  if(genre==='metroidvania')modules.push('ability-gates','checkpoints');
  if(advancedProfile(genre)?.platform||genre==='platformer')modules.push('jump');
  return modules;
}
export function referenceFor(role,{brief,context={}}){
  const artifact=extensionDefaults(role),genre=genreOf(brief.genre);
  if(role==='combat')artifact.enemyDamage=brief.difficulty==='experienced'?3:2;
  if(role==='implementation')Object.assign(artifact,{runtime:genre,modules:modulesFor(genre)});
  if(role==='integration')artifact.manifestHash=manifestFor(context);
  if(role==='qa'){const report=runProjectRules({...contributions(context),genre});Object.assign(artifact,{passed:report.passed,evidenceHash:hash({manifest:manifestFor(context),report})});}
  return artifact;
}
export async function work(role,request){const artifact=referenceFor(role,request);return {artifact,summary:`${role}: ${JSON.stringify(artifact)}`.slice(0,500)};}
export async function check(role,request){
  const {artifact,context={}}=request,findings=extensionErrors(role,artifact);
  if(!findings.length){
    if(role==='enemies'&&artifact.chaseSpeed<artifact.patrolSpeed)findings.push('Chase speed must not be slower than patrol speed');
    if(role==='progression'&&artifact.levelTwoAt>artifact.xpPerEncounter*3)findings.push('Level two must be reachable within three encounters');
    if(role==='implementation'){const expected=referenceFor(role,request);if(artifact.runtime!==expected.runtime||artifact.version!==1||JSON.stringify(artifact.modules)!==JSON.stringify(expected.modules))findings.push('Implementation must use the exact trusted runtime and capability modules');}
    if(role==='integration'&&artifact.manifestHash!==manifestFor(context))findings.push('Integration manifest does not match current checked contributions');
    if(role==='qa'){const expected=referenceFor(role,request);if(!expected.passed||!artifact.passed||artifact.evidenceHash!==expected.evidenceHash)findings.push('QA evidence is failing, stale, or does not match actual rule execution');}
  }
  return {verdict:findings.length?'fail':'pass',findings,evidence:[`Validated ${role} fields against the trusted contract`,`Reviewed ${context.memory?.dependencies?.length||0} current checked dependencies`,...(role==='qa'?['Executed trusted level/HUD/settings and applicable combat/checkpoint probes; browser and listening remain untested']:[])],scope:role==='qa'?'rules-and-static':'static'};
}
