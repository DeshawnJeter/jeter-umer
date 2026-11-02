import {newCampaign} from './turn-combat.js';
export function createExpedition({difficulty='beginner',combat,progression,rooms=3,seed=1,randomized=false}={}){
  if(!Number.isInteger(rooms)||rooms<2||rooms>8||!Number.isSafeInteger(seed))throw Error('Invalid expedition settings');
  let value=seed>>>0;
  const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
  const maps=Array.from({length:rooms},(_,index)=>{
    const y=randomized?2+Math.floor(random()*5):2+index%5;
    // Keep a connected perimeter and a clear path through the encounter.
    const walls=randomized?[]:[{x:4,y:6},{x:5,y:6},{x:9,y:3+index%3}];
    if(randomized)for(let n=0;n<24;n++){
      const p={x:2+Math.floor(random()*11),y:2+Math.floor(random()*6)};
      if(p.x===7||walls.some(w=>w.x===p.x&&w.y===p.y))continue;
      walls.push(p);
    }
    return {spawn:{x:1,y:1},exit:{x:13,y:8},stars:[{x:7,y}],walls,reward:randomized?1+Math.floor(random()*2):1,enemy:index===rooms-1?2:0,enemyName:randomized?['Mossling','Crystal Wisp','Cave Drone'][Math.floor(random()*3)]:'Drone'};
  });
  return {version:1,seed,randomized,room:0,maps,party:newCampaign(difficulty,{combat,progression}),cleared:[],phase:'exploring'};
}
export function clearRoom(run){
  if(run.phase!=='exploring'||run.cleared.includes(run.room)||run.party.party.every(p=>p.hp<=0))return false;
  run.cleared.push(run.room);run.party.potions=Math.min(12,run.party.potions+run.maps[run.room].reward);return true;
}
export function advanceRoom(run){
  if(run.phase!=='exploring'||!run.cleared.includes(run.room)||run.party.party.every(p=>p.hp<=0))return false;
  if(run.room===run.maps.length-1){run.phase='won';return true;}
  run.room++;return true;
}
