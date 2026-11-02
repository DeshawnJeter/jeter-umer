import { GAME_TYPES, genreOf } from '../../shared/game-types.js';
export async function check({ artifact, brief }) {
  const findings = [];
  if (artifact.title !== brief.title) findings.push('The plan must preserve the requested title');
  if (artifact.difficulty !== brief.difficulty) findings.push('Difficulty must match the human decision');
  const genre = genreOf(brief.genre);
  const terms = { collector: /star/i, maze: /maze|exit|portal/i, platformer: /jump|platform/i, survival: /surviv/i };
  if (!(terms[genre] || new RegExp(GAME_TYPES[genre].objective.split(' ').filter(w=>w.length>4).slice(0,3).join('|'),'i')).test(artifact.objective)) findings.push(`The plan must describe the ${GAME_TYPES[genre].name} objective`);
  return { verdict: findings.length ? 'fail' : 'pass', findings, evidence: ['Compared title and difficulty with the human brief', `Verified the objective fits the selected ${genre} template`] };
}
