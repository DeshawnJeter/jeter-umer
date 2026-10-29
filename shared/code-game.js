export const COMPONENT_CATALOG='Available api: clamp(value,min,max); damage(actor,amount); give(inventory,item,count); move(actor,dx,dy,speed,dt); distance(a,b). Write export function createGame(api) returning {start(),update(dt,input),inspect()}. input: left/right/up/down/jump/attack/ability/interact booleans. inspect returns {phase:ready|playing|won|lost,health:0..100,maxHealth:1..100,score:0..100000,objective:string,nodes:[{x:0..720,y:0..480,color:#RRGGBB,size:2..80,label:string}]}. Maximum 64 nodes. No DOM, imports, network, storage or host access. Keep simulation deterministic; dt is seconds, at most 0.1. Own only generated/rules.js. Include JSON scenarios: [{name,steps:[{dt:0..0.1,input:{...}}],expect:won|lost}]. At least one win and one loss scenario, each at most 300 steps. A step may include repeat:1..300 to compress repeated input. Browser worker executes rules; Phaser renders nodes; shared UI owns pause/settings/restart/audio.';
export const DEFAULT_SOURCE=`export function createGame(api){
  let phase='ready',score=0,health=3,time=0;
  const player={x:360,y:380};
  return {start(){phase='playing';},update(dt,input){
    if(phase!=='playing')return;time+=dt;
    api.move(player,Number(!!input.right)-Number(!!input.left),Number(!!input.down)-Number(!!input.up),180,dt);
    if(input.attack){score++;if(score>=5)phase='won';}
    if(time>=10){health=0;phase='lost';}
  },inspect(){return {phase,health,maxHealth:3,score,objective:'Press J five times before ten seconds expire.',nodes:[{x:player.x,y:player.y,color:'#66e3bd',size:24,label:'Player'}]};}};
}`;
export const DEFAULT_SCENARIOS=JSON.stringify([{name:'win',steps:[{dt:0.1,input:{attack:true},repeat:5}],expect:'won'},{name:'loss',steps:[{dt:0.1,input:{},repeat:110}],expect:'lost'}]);
export const components=Object.freeze({clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),damage(actor,amount){actor.health=Math.max(0,actor.health-Math.max(0,amount));return actor.health;},give(inventory,item,count=1){if(!/^[a-z]{1,24}$/.test(item)||!Number.isInteger(count)||count<0||count>100)throw Error('Invalid item');inventory[item]=Math.min(100,(inventory[item]||0)+count);},move(actor,dx,dy,speed,dt){actor.x=Math.max(0,Math.min(720,actor.x+dx*speed*dt));actor.y=Math.max(0,Math.min(480,actor.y+dy*speed*dt));},distance:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)});
export function inspectSnapshot(value){
  if(!value||!['ready','playing','won','lost'].includes(value.phase)||!Number.isFinite(value.health)||value.health<0||value.health>100||!Number.isFinite(value.maxHealth)||value.maxHealth<1||value.maxHealth>100||value.health>value.maxHealth||!Number.isFinite(value.score)||value.score<0||value.score>100000||typeof value.objective!=='string'||value.objective.length>180||!Array.isArray(value.nodes)||value.nodes.length>64)throw Error('Invalid game snapshot');
  const nodes=value.nodes.map(n=>{if(!n||![n.x,n.y,n.size].every(Number.isFinite)||n.x<0||n.x>720||n.y<0||n.y>480||n.size<2||n.size>80||!/^#[0-9a-f]{6}$/i.test(n.color)||typeof n.label!=='string'||n.label.length>40)throw Error('Invalid render node');return {x:n.x,y:n.y,size:n.size,color:n.color,label:n.label};});
  return {phase:value.phase,health:value.health,maxHealth:value.maxHealth,score:value.score,objective:value.objective,nodes};
}
export function codeScenarios(text){
  if(typeof text!=='string'||text.length>12000)throw Error('Scenarios exceed limit');const cases=JSON.parse(text);
  if(!Array.isArray(cases)||cases.length<2||cases.length>4||!cases.some(c=>c?.expect==='won')||!cases.some(c=>c?.expect==='lost'))throw Error('Supply win and loss scenarios');
  for(const [index,c] of cases.entries()){
    const label='Scenario '+(index+1);
    if(!c||typeof c!=='object'||typeof c.name!=='string'||c.name.length>50||!['won','lost'].includes(c.expect)||!Array.isArray(c.steps)||c.steps.length<1||c.steps.length>300)throw Error(label+': provide a name, won/lost expectation and 1–300 steps');
    let total=0;
    for(const [stepIndex,step] of c.steps.entries()){
      const at=label+', step '+(stepIndex+1);
      if(!step||typeof step!=='object'||!Number.isFinite(step.dt)||step.dt<0||step.dt>0.1)throw Error(at+': dt must be between 0 and 0.1 seconds');
      if(!Number.isInteger(step.repeat??1)||(step.repeat??1)<1||(step.repeat??1)>300)throw Error(at+': repeat must be an integer from 1 to 300');
      if(!step.input||typeof step.input!=='object'||Array.isArray(step.input)||Object.entries(step.input).some(([key,value])=>!['left','right','up','down','jump','attack','ability','interact'].includes(key)||typeof value!=='boolean'))throw Error(at+': input must use boolean left/right/up/down/jump/attack/ability/interact actions; J maps to attack');
      total+=step.repeat??1;
    }
    if(total>300)throw Error(label+': expanded replay has '+total+' steps; at most 300 total, including setup steps, are allowed. Reduce repeat counts.');
  }
  return cases;
}
