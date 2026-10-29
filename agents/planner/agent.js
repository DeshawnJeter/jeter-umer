import { defaults, clone } from '../../shared/contracts/index.js';
import { GAME_TYPES, genreOf } from '../../shared/game-types.js';
import {lifecycleFor} from '../../shared/lifecycle.js';
export async function work({ brief }) {
  if (!brief.difficulty) return { question: { key: 'brief.difficulty', text: 'Should this game suit beginners or experienced players?', reason: 'Movement speed, time allowance, and level difficulty depend on this choice.', options: ['beginner', 'experienced'], recommended: 'beginner', blocking: true, affectedRoles: ['planner', 'gameplay', 'levels', 'ui', 'story', 'audio'] } };
  const genre=genreOf(brief.genre);
  return { artifact: { ...clone(defaults.planner), title: brief.title, objective: GAME_TYPES[genre].objective, difficulty: brief.difficulty,acceptance:[('Win: '+GAME_TYPES[genre].objective).slice(0,180),('Failure: '+lifecycleFor(genre).failure).slice(0,180),'Restart restores the initial game resources and progression.'] } };
}
