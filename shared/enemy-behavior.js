export const ENEMY_TYPES=['patroller','sentry','rusher'];
export function enemyType(mix,index){return mix==='sentries'?'sentry':mix==='rushers'?'rusher':ENEMY_TYPES[index%ENEMY_TYPES.length];}
export function newEnemyBrain(type='patroller'){if(!ENEMY_TYPES.includes(type)&&type!=='boss')throw Error('Unknown enemy type');return {type,mode:'idle',idle:0.4,cooldown:0.6,windup:0,recovery:0,phase:1,aim:null,stuck:0,lastPosition:null};}
export function stepEnemy(brain,{dt,position,target,health,maxHealth=3,lineOfSight=true,settings={}}){
  const delta=Math.max(0,Math.min(dt,0.25)),distance=Math.hypot(position.x-target.x,position.y-target.y),range=brain.type==='rusher'?44:600;
  let fired=false,telegraph=false;brain.phase=brain.type==='boss'&&health<=maxHealth/2?2:1;
  brain.cooldown=Math.max(0,brain.cooldown-delta);
  if(health<=0){brain.mode='dead';brain.windup=0;return {mode:brain.mode,fired,telegraph,phase:brain.phase};}
  if(brain.windup>0){
    if(!lineOfSight||distance>range+48){brain.windup=0;brain.cooldown=0.4;brain.mode='patrol';}
    else{brain.windup=Math.max(0,brain.windup-delta);if(brain.windup<1e-6)brain.windup=0;brain.mode='attack';if(brain.windup===0){fired=true;brain.recovery=0.25;brain.cooldown=Math.max(0.8,(settings.attackCooldown??1.4)/(brain.phase===2?1.25:1));}}
  }else if(brain.recovery>0){brain.recovery=Math.max(0,brain.recovery-delta);brain.mode='idle';}
  else if(brain.idle>0){brain.idle=Math.max(0,brain.idle-delta);brain.mode='idle';}
  else if(brain.type==='rusher'&&health/maxHealth<=(settings.retreatAt??0.3)){brain.mode='retreat';}
  else if(lineOfSight&&distance<=range&&brain.cooldown===0){brain.mode='attack';brain.windup=(settings.telegraphMs??650)/1000;brain.aim={x:target.x,y:target.y};telegraph=true;}
  else brain.mode=lineOfSight&&brain.type==='rusher'?'chase':brain.type==='sentry'||brain.type==='boss'?'idle':'patrol';
  const moving=['patrol','chase','retreat'].includes(brain.mode);
  if(moving&&brain.lastPosition&&Math.hypot(position.x-brain.lastPosition.x,position.y-brain.lastPosition.y)<0.5)brain.stuck+=delta;else brain.stuck=0;
  brain.lastPosition={x:position.x,y:position.y};const recover=brain.stuck>=1.5;if(recover)brain.stuck=0;
  return {mode:brain.mode,fired,telegraph,phase:brain.phase,recover,aim:brain.aim};
}
