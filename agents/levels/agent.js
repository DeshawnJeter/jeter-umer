import { defaults, clone } from '../../shared/contracts/index.js';
export async function work({ context }) {
  const artifact = clone(defaults.levels);
  if (context.plan.difficulty === 'experienced') artifact.stars.push({ x: 2, y: 8 }, { x: 12, y: 1 });
  return { artifact };
}
