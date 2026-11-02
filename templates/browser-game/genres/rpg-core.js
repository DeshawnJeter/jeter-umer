import {topDownWorld} from '../advanced.js';
import {newCampaign,beginBattle,battleAction} from '../turn-combat.js';
import {createExpedition,clearRoom,advanceRoom} from '../campaign.js';
import {keyLabel} from '../player-ui.js';
import {createBattleBackdrop} from '../battle-backdrop.js';
export function rpgMode(scene,ctx,{frontView=false,multiLevel=false,randomized=false}={}){
  const {state,config,panel}=ctx,expedition=multiLevel?createExpedition({difficulty:config.planner.difficulty,combat:config.combat,progression:config.progression,rooms:randomized?5:3,randomized,seed:randomized?Math.floor(Math.random()*4294967296):1}):null,campaign=expedition?.party||newCampaign(config.planner.difficulty,{combat:config.combat,progression:config.progression}),cleared=new Set();let world=null,battle=null,battleIndex=0,portraits=[],markers=[],exit=null;
  const roomConfig=()=>multiLevel?{...config,levels:expedition.maps[expedition.room]}:config;
  const total=multiLevel?expedition.maps.length:frontView?3:config.levels.stars.length;
  state.required=total;
  const sync=()=>{state.health=campaign.party.reduce((n,p)=>n+p.hp,0);state.maxHealth=campaign.party.reduce((n,p)=>n+p.maxHp,0);state.mana=campaign.party.reduce((n,p)=>n+p.mp,0);state.maxMana=campaign.party.reduce((n,p)=>n+p.maxMp,0);state.room=expedition?.room??0;state.roomMap=roomConfig().levels;state.potions=campaign.potions;state.party=campaign.party.map(p=>({...p}));state.seed=expedition?.seed;state.progress=multiLevel?`Level ${expedition.room+1} / ${total}`:`${cleared.size} / ${total}`;state.objective=battle?`${battle.phase==='player'?campaign.party[battle.actor].name+' turn':battle.phase} · encounter ${battleIndex+1}/${total}`:`Clear encounters ${cleared.size}/${total}, then reach portal`;};
  const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;panel.append(el);return el;};
  const shortcut=action=>ctx.keys().settings.bindings[action].map(keyLabel).join(' / ');
  let battleBackdrop=null;
  function paint(){
    state.presentation=battle?'battle':'overworld';
    if(battle&&!battleBackdrop)battleBackdrop=createBattleBackdrop(scene,config.ui.theme,config.art?.battleBackdrop);
    if(!battle&&battleBackdrop){battleBackdrop.destroy();battleBackdrop=null;}
    panel.replaceChildren();portraits.forEach(p=>p.destroy());portraits=[];
    text('p',`Party level ${campaign.level} · XP ${campaign.xp} · Potions ${campaign.potions}`);
    text('p',campaign.party.map(p=>`${p.name}: HP ${p.hp}/${p.maxHp}${p.maxMp?' · MP '+p.mp+'/'+p.maxMp:''}`).join(' | '));
    if(!battle){if(multiLevel)text('p',`Level ${expedition.room+1}/${total} · cleared ${expedition.cleared.length} · resources carry between levels`);text('p',frontView?'Start your expedition. Three encounters await.':'Walk onto an enemy marker to begin a turn-based encounter.');sync();return;}
    text('p',battle.message).setAttribute('role','status');
    battle.enemies.forEach((enemy,i)=>{
      if(enemy.hp>0)portraits.push(scene.add.image(280+i*140,190,'enemy').setScale(frontView?4:2).setDepth(20));
      const button=ctx.button(`${i===battle.target?'Target: ':''}${enemy.name} HP ${enemy.hp}/${enemy.maxHp}`,()=>{battle.target=i;paint();});button.disabled=enemy.hp<=0||battle.phase!=='player';
    });
    if(battle.phase==='player'){
      for(const [label,action]of [[`Attack (${shortcut('attack')})`,'attack'],[`Spell · ${campaign.rules.spellCost} MP (${shortcut('ability')})`,'spell'],[`Potion (${shortcut('interact')})`,'potion'],['Guard / next party member','guard']]){const button=ctx.button(label,()=>act(action));const actor=campaign.party[battle.actor];button.disabled=action==='spell'&&actor.mp<campaign.rules.spellCost||action==='potion'&&(campaign.potions===0||actor.hp===actor.maxHp);}
    }else if(battle.phase==='won')ctx.button(frontView?(cleared.size===total?'Finish expedition':'Next encounter'):'Return to exploration',()=>{
      battle=null;portraits.forEach(p=>p.destroy());portraits=[];
      if(frontView){if(cleared.size===total)ctx.end('won');else engage(cleared.size);}else paint();
    });
    sync();
  }
  function act(action){if(state.phase!=='playing'||!battle||battle.phase!=='player')return;const previousHealth=campaign.party.reduce((sum,member)=>sum+member.hp,0);const accepted=battleAction(battle,action);if(accepted){if(action==='spell')ctx.emit?.('spell_cast',{x:280+battle.target*140,y:190});if(action==='attack')ctx.emit?.('enemy_hit',{x:280+battle.target*140,y:190});const health=campaign.party.reduce((sum,member)=>sum+member.hp,0);if(health<previousHealth)ctx.emit?.('damage_taken',{x:world?.player.x??360,y:world?.player.y??320,amount:previousHealth-health});if(battle.phase==='won')ctx.emit?.('enemy_defeated',{x:360,y:190});}if(accepted)ctx.audio.tone(action==='spell'?720:300);if(battle.phase==='won'){cleared.add(multiLevel?expedition.room:battleIndex);markers[battleIndex]?.destroy();if(multiLevel)clearRoom(expedition);state.score=cleared.size;}if(battle.phase==='lost'){sync();ctx.end('lost');}paint();}
  function engage(index){battleIndex=index;battle=beginBattle(campaign,multiLevel?expedition.maps[expedition.room].enemy:index);if(randomized&&expedition.room<total-1)battle.enemies[0].name=expedition.maps[expedition.room].enemyName;world?.player.setVelocity(0);paint();}
  function loadWorld(){
    markers.forEach(marker=>marker.destroy());exit?.destroy();world?.dispose?.();
    world=frontView?null:topDownWorld(scene,{...ctx,config:roomConfig()});
    markers=frontView?[]:roomConfig().levels.stars.map((point,index)=>{
      const marker=scene.physics.add.staticImage(world.center(point.x),world.center(point.y),'enemy');
      scene.physics.add.overlap(world.player,marker,()=>{if(state.phase==='playing'&&!battle&&!(multiLevel?expedition.cleared.includes(expedition.room):cleared.has(index)))engage(index);});return marker;
    });
    if(world){exit=scene.physics.add.staticImage(world.center(roomConfig().levels.exit.x),world.center(roomConfig().levels.exit.y),'portal');scene.physics.add.overlap(world.player,exit,()=>{
      if(state.phase!=='playing'||battle)return;
      if(multiLevel){if(!advanceRoom(expedition))return;if(expedition.phase==='won')ctx.end('won');else{loadWorld();paint();}}else if(cleared.size===total)ctx.end('won');
    });}
    sync();
  }
  loadWorld();
  paint();
  return {get player(){return world?.player;},refreshControls:paint,start(){if(frontView)engage(0);},update(){if(world){if(battle)world.player.setVelocity(0);else ctx.move(world.player);}sync();},action(action){act({attack:'attack',ability:'spell',interact:'potion'}[action]);}};
}

