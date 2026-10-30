import {ROLES} from '../../../../shared/contracts/index.js';
const scoped={music:['audio'],musicStyle:['audio'],musicInstrument:['audio'],theme:['ui','art'],askStory:['story']};
export function changedRoles(before,after){
  const keys=Object.keys(after).filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key]));
  if(!keys.length)return [];
  if(keys.some(key=>!Object.hasOwn(scoped,key)))return [...ROLES];
  return [...new Set(keys.flatMap(key=>scoped[key]))];
}
