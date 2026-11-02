import {canSee} from './advanced-games.js';
const cell=p=>`${p.x},${p.y}`;
export function gridPath(level,from,to){
  const blocked=new Set(level.walls.map(cell)),start={x:Math.floor(from.x/48),y:Math.floor(from.y/48)},goal={x:Math.floor(to.x/48),y:Math.floor(to.y/48)};
  const valid=p=>p.x>=0&&p.x<15&&p.y>=0&&p.y<10&&!blocked.has(cell(p));
  if(!valid(start)||!valid(goal))return null;
  const queue=[start],previous=new Map([[cell(start),null]]);
  for(let i=0;i<queue.length;i++){const p=queue[i];if(cell(p)===cell(goal)){const path=[];let id=cell(p);while(previous.get(id)!==null){const [x,y]=id.split(',').map(Number);path.unshift({x:x*48+24,y:y*48+24});id=previous.get(id);}return path;}for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const next={x:p.x+dx,y:p.y+dy};if(valid(next)&&!previous.has(cell(next))){previous.set(cell(next),cell(p));queue.push(next);}}}
  return null;
}
export function patrolPlans(level,count=2){
  const origin={x:level.spawn.x*48+24,y:level.spawn.y*48+24},free=[];
  for(let y=0;y<10;y++)for(let x=0;x<15;x++){const p={x:x*48+24,y:y*48+24};if(gridPath(level,origin,p)!==null&&Math.hypot(p.x-origin.x,p.y-origin.y)>=144)free.push(p);}
  free.sort((a,b)=>Math.hypot(b.x-origin.x,b.y-origin.y)-Math.hypot(a.x-origin.x,a.y-origin.y));
  const plans=[];for(const start of free){if(plans.some(p=>Math.hypot(start.x-p.start.x,start.y-p.start.y)<144))continue;
    const destinations=level.stars.map(p=>({x:p.x*48+24,y:p.y*48+24})).filter(p=>Math.hypot(start.x-p.x,start.y-p.y)>48&&gridPath(level,start,p)!==null);
    const target=destinations.sort((a,b)=>Math.hypot(a.x-start.x,a.y-start.y)-Math.hypot(b.x-start.x,b.y-start.y))[0];
    if(target)plans.push({start,targets:[target,start]});if(plans.length>=count)break;
  }return plans;
}
export const newGuardBrain=()=>({mode:'patrol',alert:0,memory:0,search:0,lastSeen:null});
export function stepGuard(brain,{dt,guard,player,walls,range=210,rate=42,facing=0,hidden=false,contact=false}){
  const sees=contact||(!hidden&&canSee(guard,player,walls,{range,facing,angle:Math.PI/2.5}));
  if(sees){brain.lastSeen={x:player.x,y:player.y};brain.memory=4;brain.search=0;brain.alert=contact?100:Math.min(100,brain.alert+rate*dt);brain.mode=brain.mode==='chase'||brain.alert>=100?'chase':'investigate';}
  else{
    brain.alert=Math.max(0,brain.alert-12*dt);
    if(brain.memory>0)brain.memory=Math.max(0,brain.memory-dt);
    else if(brain.mode==='chase'||brain.mode==='investigate'){brain.mode='search';brain.search=3;}
    else if(brain.mode==='search'){brain.search=Math.max(0,brain.search-dt);if(!brain.search){brain.mode='patrol';brain.lastSeen=null;}}
  }
  return {sees,mode:brain.mode,target:brain.lastSeen};
}
