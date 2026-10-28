export async function check({ artifact, brief }) {
  const findings = [];
  if (artifact.music !== brief.music) findings.push('Music choice differs from the human brief');
  if (artifact.volume > 0.3) findings.push('Default volume must be no more than 0.3');
  if (artifact.pickupFrequency === artifact.winFrequency) findings.push('Pickup and victory effects should differ');
  return { verdict: findings.length ? 'fail' : 'pass', findings, evidence: ['Checked human music preference and volume', 'Compared event tone frequencies'] };
}
