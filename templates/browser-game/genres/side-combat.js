export function sideCombat(scene,ctx,{stageBosses=false,exploration=false}={}){
  const {config,state}=ctx,center=n=>n*48+24,width=2160,keys=()=>ctx.keys();scene.physics.world.setBounds(0,0,width,480);scene.cameras.main.setBounds(0,0,width,480);
  const walls=scene.physics.add.staticGroup();for(let room=0;room<3;room++){
    scene.add.rectangle(room*720+360,240,720,480,room%2?0x142537:0x122434).setDepth(-20);
    for(const point of config.levels.walls)walls.create(room*720+center(point.x),center(point.y),'wall');
    scene.add.text(room*720+28,28,`${exploration?'ROOM':'SECTOR'} ${room+1}`,{fontSize:'18px',color:'#b8dacf'});
  }
  const player=scene.physics.add.sprite(center(config.levels.spawn.x),center(config.levels.spawn.y),'player').setCollideWorldBounds(true);player.body.setSize(24,28).setOffset(4,2);player.setGravityY(1000);scene.physics.add.collider(player,walls);scene.cameras.main.startFollow(player,true,0.12,0.12);
  const enemies=scene.physics.add.group(),shots=scene.physics.add.group(),hostile=scene.physics.add.group(),gates=[];let facing=1,lastShot=-1,lastEnemyShot=0,lastHit=-2,time=0,jumps=0,bosses=0,currentRoom=0;
  for(let room=0;room<3;room++){
    for(const [index,p]of config.levels.stars.slice(0,3).entries()){
      const enemy=enemies.create(room*720+Math.min(600,center(p.x)+100),408,'enemy');Object.assign(enemy,{hp:3,boss:false,home:room*720+Math.min(600,center(p.x)+100),direction:index%2?-1:1});enemy.setGravityY(1000).setCollideWorldBounds(true);
    }
    if(!exploration&&(stageBosses||room===2)){const boss=enemies.create(room*720+570,390,'enemy').setScale(1.8);Object.assign(boss,{hp:stageBosses?6+room*2:12,boss:true,home:room*720+570,direction:1,room});boss.setGravityY(1000).setCollideWorldBounds(true);if(stageBosses){const gate=scene.physics.add.staticImage(room*720+700,384,'wall').setDisplaySize(24,96).refreshBody();scene.physics.add.collider(player,gate);gates[room]=gate;}}
  }
  scene.physics.add.collider(enemies,walls);
  function damage(){if(state.phase!=='playing'||time-lastHit<1.2)return;lastHit=time;state.health=Math.max(0,state.health-1);ctx.audio.tone(140);if(!state.health)ctx.end('lost');}
  scene.physics.add.overlap(player,enemies,damage);scene.physics.add.overlap(player,hostile,(_,bullet)=>{bullet.destroy();damage();});
  scene.physics.add.collider(shots,walls,bullet=>bullet.destroy());scene.physics.add.collider(hostile,walls,bullet=>bullet.destroy());
  scene.physics.add.overlap(shots,enemies,(bullet,enemy)=>{if(!bullet.active||!enemy.active)return;enemy.hp-=bullet.damage;bullet.destroy();if(enemy.hp<=0){if(enemy.boss){bosses++;gates[enemy.room]?.destroy();ctx.note('Boss defeated. Gate opened.');}enemy.destroy();ctx.audio.tone(660);}});
  function fire(power=false){
    if(state.phase!=='playing'||time-lastShot<(power?0.45:0.2)||shots.countActive()>=24)return;
    if(power){if(state.mana<2){ctx.note('Need 2 weapon energy for a powered shot.');return;}state.mana-=2;}
    lastShot=time;const up=!exploration&&ctx.genre==='run_gun'&&keys().isDown('up'),down=!exploration&&ctx.genre==='run_gun'&&keys().isDown('down');
    const bullet=shots.create(player.x+facing*20,player.y-2,'star').setScale(power?0.7:0.35);bullet.body.setAllowGravity(false);bullet.setVelocity(up||down?0:facing*480,up?-480:down?480:0);Object.assign(bullet,{born:time,damage:power?3:1});ctx.audio.tone(power?440:260);
  }
  for(let room=0;room<3;room++)for(const point of config.levels.stars){const item=scene.physics.add.staticImage(room*720+center(point.x),center(point.y),'star');scene.physics.add.overlap(player,item,()=>{if(state.phase!=='playing'||!item.active)return;item.destroy();state.health=Math.min(state.maxHealth,state.health+1);state.mana=Math.min(state.maxMana,state.mana+2);ctx.audio.tone(config.audio.pickupFrequency);});}
  const exit=scene.physics.add.staticImage(width-72,408,'portal');scene.physics.add.overlap(player,exit,()=>{if(state.phase==='playing'&&!exploration&&bosses===(stageBosses?3:1))ctx.end('won');});
  const map=document.createElement('p');ctx.panel.append(map);ctx.note(exploration?'Explore and unlock movement abilities.':config.story.intro);
  const api={player,walls,enemies,shots,width,damage,fire,get time(){return time;},get room(){return currentRoom;},set jumps(value){jumps=value;},jump(){if(player.body.blocked.down)jumps=0;const allowed=exploration&&api.doubleJump?2:1;if(jumps<allowed&&(player.body.blocked.down||jumps>0)){player.setVelocityY(-480);jumps++;}},doubleJump:false,action(action){if(action==='attack')fire();if(action==='ability'&&stageBosses)fire(true);},update(dt,clock){
    time=clock;const movement=ctx.move(player,true);if(movement.x)facing=movement.x;if(player.body.blocked.down)jumps=0;
    if(keys().isDown('attack'))fire();player.setAlpha(time-lastHit<1.2?0.5:1);currentRoom=Math.min(2,Math.floor(player.x/720));state.progress=`${currentRoom+1} / 3`;
    for(const enemy of enemies.getChildren()){if(enemy.boss)enemy.setVelocityX(0);else{if(Math.abs(enemy.x-enemy.home)>75||enemy.body.blocked.left||enemy.body.blocked.right)enemy.direction*=-1;enemy.setVelocityX(enemy.direction*40);}}
    if(time-lastEnemyShot>1.2){lastEnemyShot=time;for(const enemy of enemies.getChildren())if(Math.abs(enemy.x-player.x)<650&&hostile.countActive()<16){const bullet=hostile.create(enemy.x,enemy.y,'enemy').setScale(0.25);bullet.body.setAllowGravity(false);scene.physics.moveToObject(bullet,player,enemy.boss?200:140);bullet.born=time;}}
    for(const group of [shots,hostile])for(const bullet of group.getChildren())if(time-bullet.born>2||bullet.x<0||bullet.x>width||bullet.y<0||bullet.y>480)bullet.destroy();
    if(!exploration)state.objective=`Bosses ${bosses}/${stageBosses?3:1} · reach final portal`;
    map.textContent=exploration?`Map: room ${currentRoom+1} / 3`:`Sector ${currentRoom+1}/3 · ${stageBosses?'Powered shot costs 2 energy':'Aim up/down while firing'} · enemies ${enemies.countActive()}`;
  }};
  return api;
}
