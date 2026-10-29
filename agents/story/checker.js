import { genreOf } from '../../shared/game-types.js';
export async function check({ artifact, brief = {} }) {
  const findings = [];
  const terms = { collector: /star/i, maze: /maze|exit|portal/i, platformer: /jump|platform/i, survival: /surviv|dron|shield/i };
  if (!terms[genreOf(brief.genre)].test(artifact.intro)) findings.push('Introduction must explain the selected game objective');
  if (artifact.victory === artifact.defeat) findings.push('Win and loss messages must differ');
  return { verdict: findings.length ? 'fail' : 'pass', findings, evidence: ['Compared introduction with the collection objective', 'Verified distinct victory and defeat messages'] };
}
