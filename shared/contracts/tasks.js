import { ROLES } from './index.js';
export function makeTask(role, generation = 0) {
  if (!ROLES.includes(role)) throw new Error('Unknown task role');
  return {
    id: `${generation}:${role}`, role, generation, artifact: `${role}.json`,
    ownership: [role === 'planner' ? 'brief/plan.json' : role==='coding'?'generated/rules.js':`game/config/${role}.json`],
    dependencies: role === 'planner' ? [] : [`${generation}:planner`, 'human:plan-approval'],
    acceptance: [`Pass the ${role} artifact contract`, `Pass the independent ${role} checker`, 'Respect applicable human decisions'],
    output: 'artifact proposal or structured human question'
  };
}
