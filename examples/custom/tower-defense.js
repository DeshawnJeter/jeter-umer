// Example source for the worker API; not imported or executed by the server.
export function createGame(api){
  let phase='ready',health=3,coins=6,score=0,time=0,spawned=0,cooldown=0;
  const enemies=[],towers=[];
  return {
    start(){phase='playing';},
    update(dt,input){
      if(phase!=='playing')return;
      time+=dt;cooldown-=dt;
      if(input.attack&&coins>=2&&towers.length<3){coins-=2;towers.push({x:210+towers.length*160,y:190,reload:0});}
      if(cooldown<=0&&spawned<6){spawned++;cooldown=2;enemies.push({x:30,y:240,hp:3});}
      for(const enemy of enemies)if(enemy.hp>0){api.move(enemy,1,0,36,dt);if(enemy.x>=680){enemy.hp=0;health--;}}
      for(const tower of towers){
        tower.reload-=dt;
        const target=enemies.find(enemy=>enemy.hp>0&&api.distance(tower,enemy)<150);
        if(target&&tower.reload<=0){target.hp--;tower.reload=0.35;if(target.hp===0){score++;coins++;}}
      }
      if(health<=0){health=0;phase='lost';}
      else if(score===6)phase='won';
    },
    inspect(){return {phase,health,maxHealth:3,score,objective:`J builds a tower (2 coins). Coins ${coins}. Defeat all 6 invaders.`,nodes:[{x:690,y:240,size:36,color:'#bb88ff',label:'Crystal'},...towers.map(tower=>({x:tower.x,y:tower.y,size:28,color:'#66e3bd',label:'Tower'})),...enemies.filter(enemy=>enemy.hp>0).map(enemy=>({x:enemy.x,y:enemy.y,size:20,color:'#ff738d',label:'Invader'}))]};}
  };
}
