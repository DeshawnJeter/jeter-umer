import {topDownWorld} from '../advanced.js';
import {canSee} from '../advanced-games.js';
export function createMode(scene,ctx){
  const {state,config}=ctx,world=topDownWorld(scene,ctx),{player,center}=world;
  const walls=new Set(config.levels.walls.map(p=>`${p.x},${p.y}`)),free=[];
  for(let y=1;y<9;y++)for(let x=1;x<14;x++)if(!walls.has(`${x},${y}`))free.push({x,y,d:Math.hypot(x-config.levels.spawn.x,y-config.levels.spawn.y)});
  const starts=free.sort((a,b)=>b.d-a.d).filter((p,i,array)=>i===0||Math.hypot(p.x-array[0].x,p.y-array[0].y)>4).slice(0,config.planner.difficulty==='beginner'?2:3);
  const guards=starts.map((p,index)=>{const sprite=scene.physics.add.sprite(center(p.x),center(p.y),'enemy').setCollideWorldBounds(true);scene.physics.add.collider(sprite,world.walls);return {sprite,facing:Math.PI,waypoint:index%2?{x:72,y:408}:{x:648,y:72},path:[],repath:0};});
  const covers=config.levels.stars.slice(0,3).map(p=>new Phaser.Geom.Rectangle(center(p.x)-32,center(p.y)-32,64,64));
  for(const box of covers)scene.add.rectangle(box.centerX,box.centerY,box.width,box.height,0x438d65,0.35).setDepth(-0.1);
  let intel=0,quiet=false,lastHit=-2,alarms=0,wasAlert=false;const cones=scene.add.graphics();
  const instruction=document.createElement('p');instruction.textContent='Green cover hides you while quiet or stationary. K toggles quiet movement. Recover all intel, then extract.';ctx.panel.append(instruction);
  const toggle=ctx.button('Quiet movement: off',()=>setQuiet());
  function setQuiet(){quiet=!quiet;toggle.textContent=`Quiet movement: ${quiet?'on':'off'}`;}
  for(const point of config.levels.stars){const item=scene.physics.add.staticImage(center(point.x),center(point.y),'star');scene.physics.add.overlap(player,item,()=>{if(state.phase==='playing'&&item.active){item.destroy();intel++;state.score=intel;ctx.audio.tone(config.audio.pickupFrequency);}});}
  const exit=scene.physics.add.staticImage(center(config.levels.exit.x),center(config.levels.exit.y),'portal');scene.physics.add.overlap(player,exit,()=>{if(state.phase==='playing'&&intel===state.required)ctx.end('won');});
  function route(from,to){const start={x:Math.max(0,Math.min(14,Math.floor(from.x/48))),y:Math.max(0,Math.min(9,Math.floor(from.y/48)))},goal={x:Math.floor(to.x/48),y:Math.floor(to.y/48)},queue=[start],previous=new Map([[`${start.x},${start.y}`,null]]);for(let i=0;i<queue.length;i++){const p=queue[i];if(p.x===goal.x&&p.y===goal.y){const path=[];let key=`${p.x},${p.y}`;while(previous.get(key)!==null){const [x,y]=key.split(',').map(Number);path.unshift({x:center(x),y:center(y)});key=previous.get(key);}return path;}for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;if(x>=0&&x<15&&y>=0&&y<10&&!walls.has(key)&&!previous.has(key)){previous.set(key,`${p.x},${p.y}`);queue.push({x,y});}}}return [];}
  return {player,usesTimer:true,action(action){if(action==='ability')setQuiet();},update(dt,time){
    const move=ctx.move(player);if(quiet)player.body.velocity.scale(0.45);
    const hidden=covers.some(box=>box.contains(player.x,player.y))&&(quiet||(!move.x&&!move.y));player.setAlpha(hidden?0.4:1);let spotted=false;cones.clear();
    for(const guard of guards){
      const sees=!hidden&&canSee(guard.sprite,player,walls,{range:210,facing:guard.facing,angle:Math.PI/2.5});spotted||=sees;
      const chasing=state.alert>=100;guard.repath-=dt;
      if(guard.repath<=0){guard.path=route(guard.sprite,chasing?player:guard.waypoint);guard.repath=0.8;}
      let target=guard.path[0];if(target&&Phaser.Math.Distance.Between(guard.sprite.x,guard.sprite.y,target.x,target.y)<7){guard.path.shift();target=guard.path[0];}
      if(target){guard.facing=Math.atan2(target.y-guard.sprite.y,target.x-guard.sprite.x);scene.physics.moveTo(guard.sprite,target.x,target.y,chasing?110:58);}else{guard.sprite.setVelocity(0);guard.waypoint={x:guard.waypoint.x===72?648:72,y:guard.waypoint.y===72?408:72};guard.repath=0;}
      cones.fillStyle(chasing?0xff4966:0xffcc66,0.13);cones.beginPath();cones.moveTo(guard.sprite.x,guard.sprite.y);for(let a=-0.6;a<=0.6;a+=0.1)cones.lineTo(guard.sprite.x+Math.cos(guard.facing+a)*200,guard.sprite.y+Math.sin(guard.facing+a)*200);cones.closePath();cones.fillPath();
      if(Phaser.Math.Distance.Between(player.x,player.y,guard.sprite.x,guard.sprite.y)<29&&time-lastHit>1.2){state.health--;lastHit=time;state.alert=100;ctx.audio.tone(120);if(state.health<=0)ctx.end('lost');}
    }
    state.alert=Phaser.Math.Clamp(state.alert+(spotted?42:-12)*dt,0,100);if(state.alert>=99&&!wasAlert){alarms++;wasAlert=true;}if(state.alert<35)wasAlert=false;
    state.objective=`Intel ${intel}/${state.required} · alarms ${alarms}${hidden?' · hidden':''}`;
  }};
}
