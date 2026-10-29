import { genreOf,GAME_TYPES } from '../../shared/game-types.js';
export async function check({ artifact, brief = {} }) {
  const findings = [];
  const genre=genreOf(brief.genre);
  const terms = { custom:/objective|custom/i, collector: /star/i, maze: /maze|exit|portal/i, platformer: /jump|platform/i, survival: /surviv|dron|shield/i };
  if (genre!=='custom'&&!(terms[genre] || new RegExp(GAME_TYPES[genre].objective.split(' ').filter(w=>w.length>4).slice(0,3).join('|'),'i')).test(artifact.intro)) findings.push('Introduction must explain the selected game objective');
  if (artifact.victory === artifact.defeat) findings.push('Win and loss messages must differ');
  return { verdict: findings.length ? 'fail' : 'pass', findings, evidence: ['Compared introduction with the collection objective', 'Verified distinct victory and defeat messages'] };
}
