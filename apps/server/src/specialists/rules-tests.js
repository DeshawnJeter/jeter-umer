import {inspectLevel} from '../../../../agents/levels/checker.js';
import {validateHud,hudFor,defaultSettings,validSettings,remap} from '../../../../shared/player-ui.js';
import {newCampaign,beginBattle,battleAction} from '../../../../shared/turn-combat.js';
import {encodeCheckpoint,decodeCheckpoint} from '../../../../shared/advanced-games.js';
import {lifecycleFor,failureReason} from '../../../../shared/lifecycle.js';
import {patrolPlans,gridPath,newGuardBrain,stepGuard} from '../../../../shared/stealth-rules.js';
import {newEnemyBrain,stepEnemy} from '../../../../shared/enemy-behavior.js';
export function enemyFairnessEvidence(settings={}){
  const brain=newEnemyBrain('sentry'),input={dt:0.1,position:{x:24,y:24},target:{x:120,y:24},health:3,maxHealth:3,settings};brain.idle=0;brain.cooldown=0;
  const first=stepEnemy(brain,input);let elapsed=0,shots=0,firstShot=0;
  for(let i=0;i<40;i++){elapsed+=0.1;const action=stepEnemy(brain,input);if(action.fired){shots++;if(!firstShot)firstShot=elapsed;}}
  const cancel=newEnemyBrain();cancel.idle=0;cancel.cooldown=0;stepEnemy(cancel,input);const blocked=stepEnemy(cancel,{...input,lineOfSight:false});
  const stuck=newEnemyBrain();stuck.idle=0;stuck.cooldown=99;let recovery=false;for(let i=0;i<20;i++)recovery=stepEnemy(stuck,{...input,lineOfSight:false}).recover||recovery;
  return {warningBeforeDamage:first.telegraph&&!first.fired,windupRespected:firstShot+1e-6>=(settings.telegraphMs??650)/1000,boundedAttackRate:shots>=1&&shots<=3,wallsCancelAttacks:!blocked.fired&&cancel.windup===0,stuckRecovery:recovery};
}
export function stealthBehaviorEvidence(settings={}){
  const brain=newGuardBrain(),input={dt:0.1,guard:{x:24,y:24},player:{x:96,y:24},walls:new Set(),facing:0,range:settings.visionRange??210,rate:settings.alertRate??42};
  stepGuard(brain,input);const investigates=brain.mode==='investigate';
  for(let i=0;i<60;i++)stepGuard(brain,input);const chases=brain.mode==='chase';stepGuard(brain,{...input,hidden:true});const remembers=brain.mode==='chase'&&brain.alert<100;
  let searched=false;for(let i=0;i<100;i++){stepGuard(brain,{...input,hidden:true});searched||=brain.mode==='search';}
  const behindWall=newGuardBrain();stepGuard(behindWall,{...input,walls:new Set(['1,0'])});
  return {investigates,chases,remembers,searched,returnsToPatrol:brain.mode==='patrol',wallBlocksSight:behindWall.mode==='patrol'&&behindWall.alert===0};
}
export function runProjectRules(config){
  const checks=[];
  const probe=(name,run)=>{try{if(!run())throw Error('Assertion failed');checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:error.message});}};
  probe('level reachability',()=>inspectLevel(config.levels,config.genre).findings.length===0);
  probe('supported HUD',()=>validateHud(config.ui.hud||hudFor(config.genre),config.genre).length===0);
  probe('remapped preferences remain valid',()=>validSettings(remap(defaultSettings(),'attack','KeyL')));
  if(config.enemies)probe('enemy warnings cooldowns occlusion and recovery',()=>Object.values(enemyFairnessEvidence(config.enemies)).every(Boolean));
  probe('explicit reachable failure condition',()=>{const rules=lifecycleFor(config.genre),playing={health:20,remaining:30};return !failureReason(config.genre,playing)&&!!failureReason(config.genre,{health:rules.health?0:20,remaining:rules.timer&&!rules.surviveTimer?0:30});});
  if(['rpg','front_battle'].includes(config.genre)){
    probe('party defeat ends combat',()=>{const c=newCampaign(config.planner.difficulty,{combat:config.combat,progression:config.progression}),battle=beginBattle(c,2);for(let i=0;i<100&&battle.phase==='player';i++)battleAction(battle,'guard');return battle.phase==='lost'&&c.party.every(member=>member.hp===0);});
    probe('full-health potion preserves inventory and turn',()=>{const c=newCampaign(config.planner.difficulty,{combat:config.combat,progression:config.progression}),b=beginBattle(c,2),before=JSON.stringify(c);return !battleAction(b,'potion')&&JSON.stringify(c)===before&&b.round===0;});
    probe('spell spends configured MP and health stays bounded',()=>{const c=newCampaign(config.planner.difficulty,{combat:config.combat,progression:config.progression}),b=beginBattle(c,2);battleAction(b,'guard');const mp=c.party[1].mp;return battleAction(b,'spell')&&c.party[1].mp===mp-c.rules.spellCost&&c.party.every(p=>p.hp>=0&&p.hp<=p.maxHp);});
    probe('potion heals within cap and decrements once',()=>{const c=newCampaign(config.planner.difficulty,{combat:config.combat,progression:config.progression}),b=beginBattle(c,2);c.party[0].hp=1;const count=c.potions;return battleAction(b,'potion')&&c.potions===count-1&&c.party[0].hp<=c.party[0].maxHp;});
  }
  if(config.genre==='stealth'){
    probe('two reachable patrols and routes',()=>{const plans=patrolPlans(config.levels,config.planner.difficulty==='beginner'?2:3);return plans.length>=2&&plans.every(plan=>(gridPath(config.levels,plan.start,plan.targets[0])||[]).length>0&&(gridPath(config.levels,plan.targets[0],plan.start)||[]).length>0);});
    probe('sightings trigger investigation, pursuit, search and recovery',()=>Object.values(stealthBehaviorEvidence(config.enemies)).every(Boolean));
  }
  if(config.genre==='metroidvania')probe('checkpoint round trip',()=>{const value={version:1,room:2,doubleJump:true,dash:true};return JSON.stringify(decodeCheckpoint(encodeCheckpoint(value)))===JSON.stringify(value);});
  return {scope:'rules-and-static',passed:checks.every(check=>check.passed),checks,browserTested:false,humanApproved:false};
}
