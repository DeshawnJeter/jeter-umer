import {topDownWorld} from '../advanced.js';
import {gridPath,patrolPlans,newGuardBrain,stepGuard} from '../stealth-rules.js';
export function createMode(scene,ctx){
  const {state,config}=ctx,world=topDownWorld(scene,ctx),{player}=world;
  const walls=new Set(config.levels.walls.map(p=>p.x+','+p.y));
  const plans=patrolPlans(config.levels,config.planner.difficulty==='beginner'?2:3);
  if(plans.length<2)throw Error('Stealth level needs two reachable patrol routes');
  const guards=plans.map(plan=>{const sprite=scene.physics.add.sprite(plan.start.x,plan.start.y,'enemy').setCollideWorldBounds(true);sprite.body.setSize(24,24).setOffset(4,4);scene.physics.add.collider(sprite,world.walls);return {sprite,brain:newGuardBrain(),targets:plan.targets,index:0,facing:Math.atan2(plan.targets[0].y-plan.start.y,plan.targets[0].x-plan.start.x),path:[],goal:'',repath:0,label:scene.add.text(plan.start.x-25,plan.start.y-35,'PATROL',{fontSize:'10px',color:'#ffffff'})};});
  const covers=config.levels.stars.slice(0,3).map(p=>new Phaser.Geom.Rectangle(p.x*48+24-32,p.y*48+24-32,64,64));
  for(const box of covers)scene.add.rectangle(box.centerX,box.centerY,box.width,box.height,0x438d65,0.35).setDepth(-0.1);
  let intel=0,quiet=false,lastHit=-2,alarms=0;const cones=scene.add.graphics();
  const instruction=document.createElement('p');instruction.textContent='Guards investigate sightings, chase when alerted, then search your last known position. Green cover hides you while quiet or stationary. Contact costs health; the mission timer can also end the run.';ctx.panel.append(instruction);
  const report=document.createElement('p');report.setAttribute('aria-live','polite');ctx.panel.append(report);let previousReport='';
  const toggle=ctx.button('Quiet movement: off',()=>setQuiet());
  function setQuiet(){quiet=!quiet;toggle.textContent='Quiet movement: '+(quiet?'on':'off');}
  for(const point of config.levels.stars){const item=scene.physics.add.staticImage(point.x*48+24,point.y*48+24,'star');scene.physics.add.overlap(player,item,()=>{if(state.phase==='playing'&&item.active){item.destroy();intel++;state.score=intel;ctx.audio.tone(config.audio.pickupFrequency);}});}
  const exit=scene.physics.add.staticImage(config.levels.exit.x*48+24,config.levels.exit.y*48+24,'portal');scene.physics.add.overlap(player,exit,()=>{if(state.phase==='playing'&&intel===state.required)ctx.end('won');});
  return {player,usesTimer:true,action(action){if(action==='ability')setQuiet();},update(dt,time){
    const move=ctx.move(player);if(quiet)player.body.velocity.scale(0.45);
    const hidden=covers.some(box=>box.contains(player.x,player.y))&&(quiet||(!move.x&&!move.y));player.setAlpha(hidden?0.4:1);cones.clear();
    for(const guard of guards){
      const contact=Phaser.Math.Distance.Between(player.x,player.y,guard.sprite.x,guard.sprite.y)<29,oldMode=guard.brain.mode;
      const result=stepGuard(guard.brain,{dt,guard:guard.sprite,player,walls,range:config.enemies?.visionRange??210,rate:config.enemies?.alertRate??42,facing:guard.facing,hidden,contact});
      if(oldMode!=='chase'&&result.mode==='chase')alarms++;
      if(contact&&time-lastHit>1.2){state.health=Math.max(0,state.health-1);lastHit=time;ctx.audio.tone(120);if(!state.health){ctx.end('lost');return;}}
      const pursuing=result.mode==='investigate'||result.mode==='chase',target=pursuing?result.target:guard.targets[guard.index];guard.repath-=dt;
      if(result.mode==='search'){guard.sprite.setVelocity(0);guard.facing+=dt;guard.path=[];guard.goal='';}
      else if(target){
        const goal=Math.floor(target.x/48)+','+Math.floor(target.y/48);
        if(goal!==guard.goal||oldMode!==result.mode){if(guard.repath<=0||oldMode!==result.mode){guard.path=gridPath(config.levels,guard.sprite,target)||[];const center={x:Math.floor(guard.sprite.x/48)*48+24,y:Math.floor(guard.sprite.y/48)*48+24};if(Math.hypot(center.x-guard.sprite.x,center.y-guard.sprite.y)>6)guard.path.unshift(center);guard.goal=goal;guard.repath=0.35;}}
        while(guard.path[0]&&Math.hypot(guard.path[0].x-guard.sprite.x,guard.path[0].y-guard.sprite.y)<6)guard.path.shift();
        const waypoint=guard.path[0]||(pursuing?target:null);
        if(waypoint){guard.facing=Math.atan2(waypoint.y-guard.sprite.y,waypoint.x-guard.sprite.x);scene.physics.moveTo(guard.sprite,waypoint.x,waypoint.y,pursuing?(config.enemies?.chaseSpeed??110):(config.enemies?.patrolSpeed??58));}
        else{guard.sprite.setVelocity(0);if(!pursuing){guard.index=(guard.index+1)%guard.targets.length;guard.goal='';}}
      }
      guard.label.setPosition(guard.sprite.x-32,guard.sprite.y-36).setText(result.mode.toUpperCase());guard.sprite.setTint(result.mode==='chase'?0xff546d:result.mode==='investigate'?0xffcb66:0xffffff);
      const range=config.enemies?.visionRange??210;cones.fillStyle(result.mode==='chase'?0xff4966:0xffcc66,0.13);cones.beginPath();cones.moveTo(guard.sprite.x,guard.sprite.y);for(let a=-Math.PI/5;a<=Math.PI/5+0.01;a+=Math.PI/25)cones.lineTo(guard.sprite.x+Math.cos(guard.facing+a)*range,guard.sprite.y+Math.sin(guard.facing+a)*range);cones.closePath();cones.fillPath();
    }
    state.alert=Math.max(0,...guards.map(guard=>guard.brain.alert));
    state.enemyStates=guards.map(guard=>({mode:guard.brain.mode,x:Math.round(guard.sprite.x),y:Math.round(guard.sprite.y)}));
    const text='Guards: '+guards.map(guard=>guard.brain.mode).join(' / ');if(text!==previousReport){report.textContent=text;previousReport=text;}
    state.objective='Intel '+intel+'/'+state.required+' · alarms '+alarms+(hidden?' · hidden':'');
  }};
}
