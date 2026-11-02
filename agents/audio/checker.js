import { musicStyleOf, instrumentOf, validateScore } from '../../shared/music.js';
export async function check({ artifact, brief }) {
  const findings = [];
  if (artifact.music !== brief.music) findings.push('Music choice differs from the human brief');
  if(brief.music&&(!artifact.enabled||artifact.volume<=0))findings.push('Requested music needs an enabled, audible default; saved player mute preferences remain separate');
  if (artifact.volume > 0.3) findings.push('Default volume must be no more than 0.3');
  if (artifact.pickupFrequency === artifact.winFrequency) findings.push('Pickup and victory effects should differ');
  if (artifact.score) {
    findings.push(...validateScore(artifact.score));
    if (artifact.score.style !== musicStyleOf(brief.musicStyle)) findings.push('Music style differs from the human choice');
    const selected = instrumentOf(brief.musicInstrument,true);
    if (selected !== 'auto' && artifact.score.instrument !== selected) findings.push('Music instrument differs from the human choice');
  } else if (brief.musicStyle) findings.push('A music score is required');
  return { verdict: findings.length ? 'fail' : 'pass', findings, evidence: ['Checked human music preference and volume', 'Compared event tone frequencies'] };
}
