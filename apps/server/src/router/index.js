import { ROLES } from '../../../../shared/contracts/index.js';
export async function route(role) {
  if (!ROLES.includes(role)) throw new Error(`No specialist for ${role}`);
  const [{ work }, { check }] = await Promise.all([import(`../../../../agents/${role}/agent.js`), import(`../../../../agents/${role}/checker.js`)]);
  return { worker: work, checker: check };
}
