export async function check({ artifact, brief }) {
  const findings = [];
  if (artifact.title !== brief.title) findings.push('The plan must preserve the requested title');
  if (artifact.difficulty !== brief.difficulty) findings.push('Difficulty must match the human decision');
  if (!artifact.objective.toLowerCase().includes('star')) findings.push('This template requires collecting stars');
  return { verdict: findings.length ? 'fail' : 'pass', findings, evidence: ['Compared title and difficulty with the human brief', 'Verified the objective fits the supported star-collector template'] };
}
