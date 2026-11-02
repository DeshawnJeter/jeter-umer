import {createGameEvents} from './game-events.js';
import {GameAudio} from './audio.js';
import {PlayerInterface} from './interface.js';
import {advancedProfile} from './advanced-games.js';
import {GAME_TYPES} from './rules.js';
import {createArt,drawBackdrop} from './art.js';
import {lifecycleFor,failureReason} from './lifecycle.js';
export async function startAdvancedGame(config,genre){
  const profile=advancedProfile(genre),rules=GAME_TYPES[genre],lifecycle=lifecycleFor(genre);
  if(!profile)throw Error('Unsupported advanced game');
  const {createMode}=await import(`./genres/${genre}.js`);
  const $=selector=>document.querySelector(selector),audio=new GameAudio(config.audio),held=new Set();let scene,mode,ui,events,last='',clock=0;
  const state={ready:false,genre,phase:'ready',maxHealth:profile.health,health:profile.health,maxMana:profile.mana,mana:profile.mana,score:0,required:config.levels.stars.length,remaining:config.gameplay.timeLimit,objective:rules.objective,progress:'1 / 3',abilities:'Basic jump',alert:0,x:0,y:0};
  $('#title').textContent=config.ui.title;document.title=config.ui.title;$('#genre').textContent=rules.name;$('#message').textContent=config.story.intro;
  const panel=document.createElement('section');panel.id='mode-panel';panel.setAttribute('aria-label','Game actions');$('#game').before(panel);
  const failureNote=document.createElement('p');failureNote.id='failure-rules';failureNote.textContent='Failure: '+lifecycle.failure+' Restart is always available.';panel.before(failureNote);
  const ctx={config,genre,profile,state,audio,held,panel,keys:()=>ui,emit:(type,details)=>events?.emit(type,details),
    end(phase){if(state.phase!=='playing')return;state.failureReason=phase==='lost'?(failureReason(genre,state)||'Mission failed'):null;state.phase=phase;events?.emit(phase==='won'?'victory':'defeat',{x:state.x,y:state.y});scene.physics.pause();mode?.onEnd?.(phase);audio.tone(phase==='won'?config.audio.winFrequency:140);audio.setPlaying(false);$('#message').textContent=config.story[phase==='won'?'victory':'defeat']+(state.failureReason?' '+state.failureReason+'. Choose Restart to try again.':'');render();},
    focus(){ $('#game').focus(); },
    note(text){$('#message').textContent=text;},
    button(label,callback,parent=panel){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{if(state.phase==='playing'){callback();ctx.focus();render();}};parent.append(b);return b;},
    move(player,platform=false){const x=Number(ui.isDown('right'))-Number(ui.isDown('left')),y=Number(ui.isDown('down'))-Number(ui.isDown('up'));if(platform)player.setVelocityX(x*config.gameplay.speed);else{player.setVelocity(x,y);if(x||y)player.body.velocity.normalize().scale(config.gameplay.speed);}if(x)player.setFlipX(x<0);return {x,y};}
  };
  function render(){
    const signature=JSON.stringify([state.phase,state.health,state.maxHealth,state.mana,state.maxMana,state.objective,state.progress,state.abilities,Math.round(state.alert),state.score,Math.ceil(state.remaining)]);
    if(signature!==last){ui.render();$('#status').textContent=`${state.phase.toUpperCase()} · ${state.progress} · ${state.failureReason||state.objective}${lifecycle.timer?' · '+Math.ceil(state.remaining)+'s remaining':''}`;last=signature;}
    const game=$('#game');game.dataset.phase=state.phase;game.dataset.playerX=String(Math.round(state.x));game.dataset.playerY=String(Math.round(state.y));game.dataset.enemyStates=JSON.stringify(state.enemyStates||[]);
  }
  ui=new PlayerInterface({config,genre,state,audio,held,onJump:()=>{if(state.phase==='playing')mode?.jump?.();},onAction:action=>{if(state.phase==='playing')mode?.action?.(action);},onControlsChanged:()=>mode?.refreshControls?.(),onPause:()=>scene?.scene.pause(),onResume:()=>scene?.scene.resume(),onRestart:()=>scene?.scene.restart()});await ui.initialize();
  class AdvancedScene extends Phaser.Scene{
    create(){scene=this;events=createGameEvents();const sceneEvents=events;this.physics.resume();panel.replaceChildren();clock=0;last='';ui.clearInput();Object.assign(state,{ready:true,phase:'ready',health:profile.health,maxHealth:profile.health,mana:profile.mana,maxMana:profile.mana,score:0,remaining:config.gameplay.timeLimit,objective:rules.objective,alert:0,progress:'1 / 3',abilities:'Basic jump',failureReason:null,enemyStates:[]});$('#message').textContent=config.story.intro;createArt(this,config.ui);drawBackdrop(this,{...config.ui,...config.art});mode=createMode(this,ctx);this.events.once('shutdown',()=>{ui.clearInput();audio.setPlaying(false);mode.dispose?.();sceneEvents.dispose();});render();}
    update(_,delta){if(!mode)return;if(state.phase==='playing'){clock+=delta/1000;if(lifecycle.timer)state.remaining=Math.max(0,config.gameplay.timeLimit-clock);if(failureReason(genre,state))ctx.end('lost');if(state.phase==='playing')mode.update(delta/1000,clock);if(state.phase==='playing'&&failureReason(genre,state))ctx.end('lost');}if(mode.player){state.x=mode.player.x;state.y=mode.player.y;}render();}
  }
  new Phaser.Game({type:Phaser.AUTO,width:720,height:480,parent:'game',backgroundColor:config.ui.backgroundColor,physics:{default:'arcade',arcade:{gravity:{x:0,y:0}}},scene:AdvancedScene,audio:{noAudio:true}});
  $('#start').onclick=async()=>{if(!state.ready||state.phase!=='ready')return;state.phase='playing';mode.start?.();ctx.focus();try{await audio.start();audio.setPlaying(state.phase==='playing');}catch{ctx.note('Audio unavailable; gameplay remains available.');}render();};
  $('#restart').onclick=()=>ui.restart();
  for(const b of document.querySelectorAll('[data-control]')){const action=b.dataset.control;b.hidden=!profile.actions.includes(action);b.onpointerdown=e=>{e.preventDefault();if(state.phase!=='playing')return;b.setPointerCapture(e.pointerId);held.add(action);if(action==='jump')mode.jump?.();else mode.action?.(action);};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>held.delete(action);}
  addEventListener('blur',()=>{ui.clearInput();if(state.phase==='playing')ui.pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.phase==='playing')ui.pause();});addEventListener('pagehide',()=>audio.dispose(),{once:true});
  window.gameState=()=>({...state,audio:audio.inspect(),events:events?.inspect()||[]});
}
export function topDownWorld(scene,ctx){
  const center=n=>n*48+24,walls=scene.physics.add.staticGroup();
  for(const point of ctx.config.levels.walls)walls.create(center(point.x),center(point.y),'wall');
  const player=scene.physics.add.sprite(center(ctx.config.levels.spawn.x),center(ctx.config.levels.spawn.y),'player').setCollideWorldBounds(true);player.body.setSize(24,28).setOffset(4,2);scene.physics.add.collider(player,walls);
  return {player,walls,center};
}
