import { defaults, clone } from '../../shared/contracts/index.js';
export async function work({ context }) { return { artifact: { ...clone(defaults.ui), title: context.plan.title } }; }
