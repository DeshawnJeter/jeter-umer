import { defaults, clone } from '../../shared/contracts/index.js';
import { GAME_TYPES, genreOf } from '../../shared/game-types.js';
export async function work({ brief, context }) {
  const direction = context.decisions?.['story.direction'];
  if (brief.askStory && !direction) return { question: { key: 'story.direction', text: 'What mood or story direction should the introduction use?', reason: 'Your preference determines the introduction. Other specialists can keep working.', options: [], recommended: 'A hopeful space adventure', blocking: true, affectedRoles: ['story'], maxLength: 100 } };
  const rules = GAME_TYPES[genreOf(brief.genre)];
  const artifact = { intro: rules.intro, victory: rules.victory, defeat: rules.defeat };
  if (direction) artifact.intro = `${direction}. ${rules.intro}`.slice(0, 180);
  return { artifact };
}
