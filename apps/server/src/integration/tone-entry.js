// Avoid Tone's eager index exports, which create a worker clock on import.
export {Context} from 'tone/build/esm/core/context/Context.js';
export {getContext,setContext,start} from 'tone/build/esm/core/Global.js';
export {Gain} from 'tone/build/esm/core/context/Gain.js';
export {Limiter} from 'tone/build/esm/component/dynamics/Limiter.js';
export {Synth} from 'tone/build/esm/instrument/Synth.js';
export {FMSynth} from 'tone/build/esm/instrument/FMSynth.js';
export {MembraneSynth} from 'tone/build/esm/instrument/MembraneSynth.js';
export {Sequence} from 'tone/build/esm/event/Sequence.js';
import {getContext} from 'tone/build/esm/core/Global.js';
export const getTransport=()=>getContext().transport;
