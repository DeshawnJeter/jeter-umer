import { defaults, clone } from '../../shared/contracts/index.js';
export async function work({ brief }) {
  if (!brief.difficulty) return { question: { key: 'brief.difficulty', text: 'Should this game suit beginners or experienced players?', reason: 'Movement speed, time allowance, and level difficulty depend on this choice.', options: ['beginner', 'experienced'], recommended: 'beginner', blocking: true, affectedRoles: ['planner', 'gameplay', 'levels', 'ui', 'story', 'audio'] } };
  return { artifact: { ...clone(defaults.planner), title: brief.title, difficulty: brief.difficulty } };
}
