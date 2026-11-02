import {defaults,clone} from '../../../../shared/contracts/index.js';
import {GAME_TYPES,referenceLevel} from '../../../../shared/game-types.js';
// These are fixed framework services, not model proposals or model approvals.
// Custom rules replace gameplay, so no separate model is needed to tune an
// unused grid, movement template, canned story, or data-only assembly artifact.
export function frameworkConfig(genre,contributions){
  if(!['custom','campaign','roguelike'].includes(genre))return {...contributions,genre};
  const rules=GAME_TYPES[genre];
  return {...clone(defaults),levels:referenceLevel(genre),story:{intro:rules.intro,victory:rules.victory,defeat:rules.defeat},...contributions,genre};
}
