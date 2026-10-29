import {inspectLevel} from '../../../../agents/levels/checker.js';
import {validateHud,hudFor,defaultSettings,validSettings,remap} from '../../../../shared/player-ui.js';
import {newCampaign,beginBattle,battleAction} from '../../../../shared/turn-combat.js';
import {encodeCheckpoint,decodeCheckpoint} from '../../../../shared/advanced-games.js';
export function runProjectRules(config){
  const checks=[];
  const probe=(name,run)=>{try{if(!run())throw Error('Assertion failed');checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:error.message});}};
  probe('level reachability',()=>inspectLevel(config.levels,config.genre).findings.length===0);
  probe('supported HUD',()=>validateHud(config.ui.hud||hudFor(config.genre),config.genre).length===0);
  probe('remapped preferences remain valid',()=>validSettings(remap(defaultSettings(),'attack','KeyL')));
  if(['rpg','front_battle'].includes(config.genre)){
    probe('full-health potion preserves inventory and turn',()=>{const c=newCampaign(config.planner.difficulty,{combat:config.combat,progression:config.progression}),b=beginBattle(c,2),before=JSON.stringify(c);return !battleAction(b,'potion')&&JSON.stringify(c)===before&&b.round===0;});
    probe('spell spends configured MP and health stays bounded',()=>{const c=newCampaign(config.planner.difficulty,{combat:config.combat,progression:config.progression}),b=beginBattle(c,2);battleAction(b,'guard');const mp=c.party[1].mp;return battleAction(b,'spell')&&c.party[1].mp===mp-c.rules.spellCost&&c.party.every(p=>p.hp>=0&&p.hp<=p.maxHp);});
    probe('potion heals within cap and decrements once',()=>{const c=newCampaign(config.planner.difficulty,{combat:config.combat,progression:config.progression}),b=beginBattle(c,2);c.party[0].hp=1;const count=c.potions;return battleAction(b,'potion')&&c.potions===count-1&&c.party[0].hp<=c.party[0].maxHp;});
  }
  if(config.genre==='metroidvania')probe('checkpoint round trip',()=>{const value={version:1,room:2,doubleJump:true,dash:true};return JSON.stringify(decodeCheckpoint(encodeCheckpoint(value)))===JSON.stringify(value);});
  return {scope:'rules-and-static',passed:checks.every(check=>check.passed),checks,browserTested:false,humanApproved:false};
}
