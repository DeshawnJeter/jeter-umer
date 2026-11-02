export const GAME_EVENTS=Object.freeze(['damage_taken','enemy_hit','enemy_defeated','spell_cast','player_shot','pickup','enemy_attack_warning','victory','defeat']);
export function createGameEvents(){
  const listeners=new Set(),history=[];let sequence=0,disposed=false;
  return Object.freeze({
    emit(type,details={}){
      if(disposed)return false;if(!GAME_EVENTS.includes(type)||!details||typeof details!=='object'||Array.isArray(details)||Object.keys(details).some(key=>!['x','y','amount'].includes(key)))throw Error('Invalid gameplay event');
      for(const value of Object.values(details))if(!Number.isFinite(value)||Math.abs(value)>10000)throw Error('Invalid event value');
      const event=Object.freeze({type,sequence:++sequence,...details});history.push(event);if(history.length>64)history.shift();
      for(const listener of listeners)try{listener(event);}catch{/* Presentation listeners cannot interrupt gameplay. */}return true;
    },
    subscribe(listener){if(disposed||typeof listener!=='function'||listeners.size>=8)throw Error('Event listener unavailable');listeners.add(listener);return ()=>listeners.delete(listener);},
    inspect:()=>history.map(event=>({...event})),dispose(){disposed=true;listeners.clear();history.length=0;}
  });
}
