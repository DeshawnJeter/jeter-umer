import { defaults, clone } from '../../shared/contracts/index.js';
export async function work({ brief }) { return { artifact: { ...clone(defaults.audio), music: brief.music } }; }
