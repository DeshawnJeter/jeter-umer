export async function check({ artifact }) {
  const findings = [];
  if (!/star/i.test(artifact.intro)) findings.push('Introduction must explain the star objective');
  if (artifact.victory === artifact.defeat) findings.push('Win and loss messages must differ');
  return { verdict: findings.length ? 'fail' : 'pass', findings, evidence: ['Compared introduction with the collection objective', 'Verified distinct victory and defeat messages'] };
}
