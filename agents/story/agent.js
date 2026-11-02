import { defaults, clone } from '../../shared/contracts/index.js';
export async function work() { return { artifact: clone(defaults.story) }; }
