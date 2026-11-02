import { defaults, clone } from '../../shared/contracts/index.js';
import { referenceLevel, genreOf } from '../../shared/game-types.js';
export async function work({ context, brief = {} }) {
  const genre = genreOf(brief.genre), artifact = referenceLevel(genre);
  if (context.plan.difficulty === 'experienced' && genre === 'collector') artifact.stars.push({ x: 2, y: 8 }, { x: 12, y: 1 });
  return { artifact };
}
