export async function work({ context }) {
  return { artifact: context.plan.difficulty === 'experienced' ? { speed: 220, timeLimit: 35 } : { speed: 190, timeLimit: 60 } };
}
