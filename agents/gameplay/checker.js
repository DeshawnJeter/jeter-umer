export async function check({ artifact, context }) {
  const findings = [];
  if (context.plan.difficulty === 'beginner' && artifact.timeLimit < 60) findings.push('Beginners need at least 60 seconds');
  if (artifact.speed > 250) findings.push('Player movement is too fast for this template');
  return { verdict: findings.length ? 'fail' : 'pass', findings, evidence: ['Checked time allowance against difficulty', 'Checked the template movement-speed constraint'] };
}
