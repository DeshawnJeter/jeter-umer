import {checkCode} from '../../apps/server/src/runners/code-workspace.js';
export async function check({artifact}){return checkCode(artifact);}
