export function createGame(api){
// Constants
const CRYSTAL_POS={x:680,y:240};
const CRYSTAL_MAX_HEALTH=3;
const INVADER_SPEED=40;
const PATH_START={x:40,y:240},PATH_END=CRYSTAL_POS;
const PATH_COLOR="#9bd5e9";
const SPAWN_TIMES=[0,0,3,3,6,6];
const MAX_INVADERS=6;
const TOWER_SITES=[{x:200,y:190},{x:360,y:190},{x:520,y:190}];
const TOWER_RANGE=130;
const TOWER_COOLDOWN=0.5;
const TOWER_COST=2;
const START_COINS=6;

// State
let phase="ready";
let health=CRYSTAL_MAX_HEALTH;
let coins=START_COINS;
let defeated=0;
let invaders=[]; // {x,y,t,pathDone,attacked}
let towers=[]; // {x,y,cooldown}
let nextTowerSite=0;
let time=0;
let spawnIdx=0;
let buildHeld=false;
let nodes=[];

function start(){
  if(phase!="ready")return;
  health=CRYSTAL_MAX_HEALTH;
  coins=START_COINS;
  defeated=0;
  invaders=[];
  towers=[];
  nextTowerSite=0;
  time=0;
  spawnIdx=0;
  buildHeld=false;
  phase="playing";
  nodes=[];
}

function update(dt,input){
  if(phase!=="playing")return;
  // Handle build input (J)
  if(input.attack&&!buildHeld&&nextTowerSite<TOWER_SITES.length&&coins>=TOWER_COST){
    towers.push({x:TOWER_SITES[nextTowerSite].x,y:TOWER_SITES[nextTowerSite].y,cooldown:0});
    coins-=TOWER_COST;
    nextTowerSite++;

  }
  buildHeld=!!input.attack;
  // Time and spawn logic
  time+=dt;
  while(spawnIdx<SPAWN_TIMES.length&&time>=SPAWN_TIMES[spawnIdx]){
    invaders.push({x:PATH_START.x,y:PATH_START.y,t:0,pathDone:false});
    spawnIdx++;
  }
  // Move invaders
  for(let inv of invaders){
    if(inv.pathDone)continue;
    let dx=CRYSTAL_POS.x-inv.x,dy=CRYSTAL_POS.y-inv.y;
    let dist=Math.sqrt(dx*dx+dy*dy);
    let moveDist=Math.min(INVADER_SPEED*dt,dist);
    if(dist>0){
      inv.x+=dx/dist*moveDist;
      inv.y+=dy/dist*moveDist;
      if(moveDist>=dist){
        inv.x=CRYSTAL_POS.x;inv.y=CRYSTAL_POS.y;
        inv.pathDone=true;
      }
    }
  }
  // Towers attack (every 0.5 seconds)
  for(let t of towers){
    t.cooldown-=dt;
    if(t.cooldown<=0){
      let targetIdx=-1; let minDist=9999;
      for(let i=0;i<invaders.length;++i){
        let inv=invaders[i];
        if(inv.pathDone)continue;
        let d=api.distance(t,inv);
        if(d<=TOWER_RANGE&&d<minDist){
          minDist=d;targetIdx=i;
        }
      }
      if(targetIdx>=0){
        // Defeat invader
        invaders[targetIdx].pathDone=true;
        defeated++;
        coins++;
        t.cooldown=TOWER_COOLDOWN;
      }else{
        t.cooldown=0;
      }
    }
  }
  // Invaders damage crystal
  for(let inv of invaders){
    if(inv.pathDone && !inv._didDmg){
      if(inv.x===CRYSTAL_POS.x && inv.y===CRYSTAL_POS.y&& defeated<MAX_INVADERS){
        health--;
        inv._didDmg=1;
      }
    }
  }
  // Win/loss check
  if(defeated>=MAX_INVADERS){phase="won";}
  if(health<=0){health=0;phase="lost";}
}

function inspect(){
  // HUD & Objective
  let hud=`Crystal: ${health}/${CRYSTAL_MAX_HEALTH}   Coins: ${coins}   Defeated: ${defeated}/6`;
  // Render
  let n=[];
  // Path
  n=n.concat(api.pathNodes(PATH_START,CRYSTAL_POS,PATH_COLOR));
  // Sites
  for(let i=0;i<TOWER_SITES.length;i++){
    let s=TOWER_SITES[i];
    n.push({x:s.x,y:s.y,color: i<nextTowerSite?"#8dac57":"#7867b1",size:26,label:"Site"});
  }
  // Towers
  for(let t of towers){
    n.push({x:t.x,y:t.y,color:"#c1a0ff",size:32,label:"Tower"});
  }
  // Crystal
  n.push({x:CRYSTAL_POS.x,y:CRYSTAL_POS.y,color:"#b5e3fc",size:44,label:"Crystal"});
  // Invaders
  for(let inv of invaders){
    if(inv.pathDone&&inv._didDmg)continue;
    let color=inv.pathDone?"#e76d7a":"#da9524";
    n.push({x:inv.x,y:inv.y,color,size:26,label:inv.pathDone?"Smash!":"Invader"});
  }
  // HUD
  n.push({x:370,y:38,color:"#596b65",size:26,label:hud});
  // Title/Objective on ready
  if(phase=="ready"){
    n.push({x:370,y:75,color:"#283d3a",size:22,label:"Moonwood Crystal Guard"});
    n.push({x:370,y:104,color:"#283d3a",size:16,label:"Press Start to begin. J: Build"});
  }
  // Win/Loss overlay
  if(phase=="won")n.push({x:370,y:70,color:"#58b96c",size:30,label:"Victory! All invaders defeated."});
  if(phase=="lost")n.push({x:370,y:70,color:"#cf4141",size:30,label:"Crystal destroyed!"});
  return {
    phase,
    health,
    maxHealth:CRYSTAL_MAX_HEALTH,
    score:defeated,
    objective:"Defend the crystal from 6 invaders.",
    nodes:n.slice(0,64)
  };
}
return{start,update,inspect};
}
