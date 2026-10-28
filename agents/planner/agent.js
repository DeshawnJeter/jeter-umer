import { defaults, clone } from '../../shared/contracts/index.js';
export async function work({ brief }) {
  if (!brief.difficulty) return { question: 'Should this game suit beginners or experienced players?' };
  return { artifact: { ...clone(defaults.planner), title: brief.title, difficulty: brief.difficulty } };
}
