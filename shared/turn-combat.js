// Deterministic, bounded RPG rules shared with exported games and tests.
export function newCampaign(difficulty='beginner',options={}){
  return {party:[{name:'Scout',hp:12,maxHp:12,mp:0,maxMp:0},{name:'Mage',hp:8,maxHp:8,mp:6,maxMp:6}],potions:options.progression?.startingPotions??3,xp:0,level:1,encounters:0,difficulty,rules:{attackPower:3,spellPower:6,spellCost:2,enemyDamage:difficulty==='experienced'?3:2,...options.combat,potionHealing:6,xpPerEncounter:10,levelTwoAt:20,levelHeal:4,...options.progression}};
}
export function beginBattle(campaign,index=0){
  const boss=index>=2;return {campaign,actor:Math.max(0,campaign.party.findIndex(p=>p.hp>0)),target:0,round:0,phase:'player',enemies:Array.from({length:boss?1:index===1?2:1},(_,i)=>({name:boss?'Sentinel':i?'Wisp':'Drone',hp:boss?16:6,maxHp:boss?16:6})),message:'Choose an action and target.'};
}
export function battleAction(battle,action,target=battle.target){
  if(battle.phase!=='player')return false;
  const c=battle.campaign,actor=c.party[battle.actor];
  if(!actor||actor.hp<=0)return false;
  let enemy,guarded=false;
  if(action==='attack'||action==='spell'){
    if(!Number.isInteger(target)||target<0||target>=battle.enemies.length)return false;
    enemy=battle.enemies[target];
    if(!enemy||enemy.hp<=0)return false;
    if(action==='spell'){if(actor.mp<c.rules.spellCost){battle.message=`This character needs ${c.rules.spellCost} MP. Guard to pass to the next party member.`;return false;}actor.mp-=c.rules.spellCost;}
    enemy.hp=Math.max(0,enemy.hp-(action==='spell'?c.rules.spellPower+c.level:c.rules.attackPower+c.level));battle.message=`${actor.name} ${action==='spell'?'casts a spell':'attacks'} ${enemy.name}.`;
  }else if(action==='potion'){
    if(c.potions<=0){battle.message='No potions remain.';return false;}
    if(actor.hp===actor.maxHp){battle.message='This character is already healthy.';return false;}
    c.potions--;actor.hp=Math.min(actor.maxHp,actor.hp+c.rules.potionHealing);battle.message=`${actor.name} recovers health.`;
  }else if(action==='guard'){guarded=true;battle.message=`${actor.name} guards.`;}else return false;
  if(battle.enemies.every(e=>e.hp<=0)){
    battle.phase='won';c.xp+=c.rules.xpPerEncounter;c.encounters++;
    if(c.xp>=c.rules.levelTwoAt&&c.level===1){c.level=2;for(const member of c.party){member.maxHp+=2;member.hp=Math.min(member.maxHp,member.hp+c.rules.levelHeal);member.mp=Math.min(member.maxMp,member.mp+2);}battle.message+=' Party reaches level 2!';}
    return true;
  }
  // One enemy response per player turn, with a visible deterministic target.
  const attacker=battle.enemies.find(e=>e.hp>0),living=c.party.filter(p=>p.hp>0),victim=living[battle.round%living.length];
  const damage=Math.max(1,c.rules.enemyDamage-(guarded&&victim===actor?1:0));victim.hp=Math.max(0,victim.hp-damage);battle.message+=` ${attacker.name} hits ${victim.name} for ${damage}.`;
  battle.round++;if(c.party.every(p=>p.hp<=0)){battle.phase='lost';return true;}
  for(let i=1;i<=c.party.length;i++){const next=(battle.actor+i)%c.party.length;if(c.party[next].hp>0){battle.actor=next;break;}}
  battle.target=Math.max(0,battle.enemies.findIndex(e=>e.hp>0));return true;
}
