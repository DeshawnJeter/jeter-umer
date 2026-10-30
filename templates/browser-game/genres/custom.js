import {CodeClient} from '../code-client.js';
export function createMode(scene,ctx){
  const client=new CodeClient(),objects=[];let busy=true,disposed=false,lastScore=0,deferred=null;
  const {state}=ctx;state.ready=false;
  function apply(snapshot){
    if(disposed)return;
    if(state.phase==='paused'){deferred=snapshot;return;}
    state.health=snapshot.health;state.maxHealth=snapshot.maxHealth;state.score=snapshot.score;state.progress=String(snapshot.score);state.objective=snapshot.objective;state.codeSnapshot=snapshot;
    state.mana=snapshot.mana??0;state.maxMana=snapshot.maxMana??0;
    if(snapshot.remaining!==undefined){state.remaining=snapshot.remaining;state.timeLimit=snapshot.timeLimit;}else{delete state.timeLimit;}
    if(snapshot.score>lastScore){ctx.emit('pickup',{x:360,y:240});ctx.audio.tone(ctx.config.audio.pickupFrequency);}lastScore=snapshot.score;
    objects.splice(0).forEach(o=>o.destroy());
    for(const node of snapshot.nodes){objects.push(node.asset==='player'&&scene.textures.exists('imported-player')?scene.add.image(node.x,node.y,'imported-player').setDisplaySize(node.size,node.size):scene.add.rectangle(node.x,node.y,node.size,node.size,parseInt(node.color.slice(1),16)));objects.push(scene.add.text(node.x,node.y-node.size,node.label,{fontSize:'12px',color:'#ffffff',stroke:'#08111d',strokeThickness:2}).setOrigin(0.5));}
    if(state.phase==='playing'&&['won','lost'].includes(snapshot.phase))ctx.end(snapshot.phase);
    ctx.refreshHud?.();
  }
  const send=(operation,data)=>{busy=true;return client.request(operation,data).then(apply).catch(()=>{if(!disposed){state.codeError='Generated code stopped. Restart to try again.';ctx.note(state.codeError);if(state.phase==='playing')ctx.end('lost');}}).finally(()=>{busy=false;});};
  send('inspect').then(()=>{if(!disposed)state.ready=true;});
  return {start(){send('start');},update(dt){if(deferred){const pending=deferred;deferred=null;apply(pending);if(state.phase!=='playing')return;}if(busy)return;const input=Object.fromEntries(['left','right','up','down','jump','attack','ability','interact'].map(key=>[key,ctx.keys().isDown(key)]));send('step',{dt:Math.min(dt,0.1),input});},dispose(){disposed=true;client.dispose();objects.forEach(o=>o.destroy());}};
}
