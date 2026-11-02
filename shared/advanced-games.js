// Trusted capabilities, never model-controlled code or asset paths.
export const ADVANCED_PROFILES = Object.freeze({
  rpg:{health:20,mana:6,actions:['left','right','up','down','attack','ability','interact'],hud:['health','mana','objective'],manaLabel:'Party MP'},
  front_battle:{health:20,mana:6,actions:['attack','ability','interact'],hud:['health','mana','objective'],manaLabel:'Party MP'},
  stealth:{health:4,mana:0,actions:['left','right','up','down','ability'],hud:['health','alert','objective']},
  run_gun:{health:6,mana:0,platform:true,actions:['left','right','up','down','jump','attack'],hud:['health','progress','objective']},
  jump_shooter:{health:6,mana:6,platform:true,actions:['left','right','jump','attack','ability'],hud:['health','mana','objective'],manaLabel:'Weapon energy'},
  metroidvania:{health:6,mana:0,platform:true,actions:['left','right','jump','attack','ability'],hud:['health','ability','objective']}
});
export const advancedProfile=genre=>Object.hasOwn(ADVANCED_PROFILES,genre)?ADVANCED_PROFILES[genre]:null;
export function canSee(from,to,walls,{range=200,angle=Math.PI/3,facing=0}={}){
  const dx=to.x-from.x,dy=to.y-from.y;
  if(Math.hypot(dx,dy)>range)return false;
  const difference=Math.atan2(Math.sin(Math.atan2(dy,dx)-facing),Math.cos(Math.atan2(dy,dx)-facing));
  if(Math.abs(difference)>angle/2)return false;
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/8));
  for(let i=1;i<steps;i++)if(walls.has(`${Math.floor((from.x+dx*i/steps)/48)},${Math.floor((from.y+dy*i/steps)/48)}`))return false;
  return true;
}
export function validateCheckpoint(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join()!=='dash,doubleJump,room,version')return false;
  return value.version===1&&Number.isInteger(value.room)&&value.room>=0&&value.room<=2&&typeof value.doubleJump==='boolean'&&typeof value.dash==='boolean'&&(!value.dash||value.doubleJump)&&(value.room<1||value.doubleJump)&&(value.room<2||value.dash);
}
export function encodeCheckpoint(value){if(!validateCheckpoint(value))throw Error('Invalid checkpoint');return JSON.stringify(value);}
export function decodeCheckpoint(text){if(typeof text!=='string'||text.length>200)throw Error('Invalid save code');const value=JSON.parse(text);if(!validateCheckpoint(value))throw Error('Invalid checkpoint');return value;}
