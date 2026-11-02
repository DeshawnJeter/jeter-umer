import {genreOf} from '../../../../shared/game-types.js';
import {modulesFor} from '../specialists/jobs.js';
export function compileAssembly(config){
  const expected={runtime:genreOf(config.genre),modules:modulesFor(genreOf(config.genre)),version:1},value=config.implementation||expected;
  if(value.runtime!==expected.runtime||value.version!==1||JSON.stringify(value.modules)!==JSON.stringify(expected.modules)||Object.keys(value).sort().join()!=='modules,runtime,version')throw Error('Implementation assembly must match trusted runtime capabilities');
  // Only JSON data is compiled. Models cannot supply source or import paths.
  return 'export const assembly=Object.freeze('+JSON.stringify(value).replaceAll('<','\\u003c')+');\n';
}
