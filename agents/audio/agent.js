import { defaults, clone } from '../../shared/contracts/index.js';
import { composeScore, musicStyleOf } from '../../shared/music.js';
export async function work({ brief }) { return { artifact: { ...clone(defaults.audio), music: brief.music, score: composeScore(musicStyleOf(brief.musicStyle), `${brief.title}:${brief.genre || 'collector'}`, brief.musicInstrument) } }; }
