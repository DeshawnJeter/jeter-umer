import { defaults, clone } from '../../shared/contracts/index.js';
export async function work({ brief, context }) {
  const direction = context.decisions?.['story.direction'];
  if (brief.askStory && !direction) return { question: { key: 'story.direction', text: 'What mood or story direction should the introduction use?', reason: 'Your preference determines the introduction. Other specialists can keep working.', options: [], recommended: 'A hopeful space adventure', blocking: true, affectedRoles: ['story'], maxLength: 100 } };
  const artifact = clone(defaults.story);
  if (direction) artifact.intro = `${direction}. Collect the scattered stars, then find the portal.`;
  return { artifact };
}
