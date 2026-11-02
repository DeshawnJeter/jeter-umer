import {check as execute} from '../../apps/server/src/specialists/jobs.js';
export const check=request=>execute('vfx',request);
