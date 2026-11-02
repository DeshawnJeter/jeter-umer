// Shared by exported runtime, deterministic QA and acceptance documentation.
export const GAME_LIFECYCLES=Object.freeze({
  collector:{timer:true,health:false,failure:'Time runs out before you finish.'},
  maze:{timer:true,health:false,failure:'Time runs out before you escape.'},
  platformer:{timer:true,health:false,failure:'Time runs out before you finish.'},
  survival:{timer:true,health:true,surviveTimer:true,failure:'Your health reaches zero. Survive until the timer ends to win.'},
  rpg:{timer:false,health:true,failure:'Both party members reach zero HP.'},
  front_battle:{timer:false,health:true,failure:'Both party members reach zero HP.'},
  stealth:{timer:true,health:true,failure:'Guards deplete your health, or the mission timer runs out.'},
  run_gun:{timer:false,health:true,failure:'Enemy contact or projectiles deplete your health.'},
  jump_shooter:{timer:false,health:true,failure:'Enemy contact or projectiles deplete your health.'},
  metroidvania:{timer:false,health:true,failure:'Enemy contact or projectiles deplete your health. Continue from a checkpoint or restart.'}
});
export function lifecycleFor(genre='collector'){if(!Object.hasOwn(GAME_LIFECYCLES,genre))throw Error('Unknown game lifecycle');return GAME_LIFECYCLES[genre];}
export function failureReason(genre,state){const rules=lifecycleFor(genre);if(rules.health&&state.health<=0)return ['rpg','front_battle'].includes(genre)?'Party defeated':'Health depleted';if(rules.timer&&!rules.surviveTimer&&state.remaining<=0)return 'Time expired';return null;}
export const BASE_HUMAN_CHECKS=['movement','collectAndWin','timeoutAndRestart','audioControls','presentation'];
export function humanChecksFor(genre){lifecycleFor(genre);return [...BASE_HUMAN_CHECKS,...(genre==='stealth'?['enemyReactions']:[])];}
