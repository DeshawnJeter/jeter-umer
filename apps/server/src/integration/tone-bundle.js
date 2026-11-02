import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
let pending;
export function isolatedToneBundle(){
  pending??=compile().catch(error=>{pending=null;throw error;});
  return pending;
}
async function compile(){
  const entry=resolve('apps/server/src/integration/tone-entry.js');
  const key=createHash('sha256').update(await readFile(new URL(import.meta.url))).update(await readFile(entry)).update(await readFile('package-lock.json')).digest('hex');
  const cache=resolve('.local/vendor-tone',key+'.js');
  try{return await readFile(cache,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  const {build}=await import('vite');
  const result=await build({configFile:false,envDir:false,envPrefix:[],publicDir:false,logLevel:'silent',build:{write:false,minify:true,lib:{entry,name:'Tone',formats:['iife'],fileName:'Tone'}}});
  const outputs=Array.isArray(result)?result:[result],chunks=outputs.flatMap(output=>output.output).filter(output=>output.type==='chunk');
  if(chunks.length!==1)throw Error('Expected one self-contained audio bundle');
  const code=chunks[0].code;await mkdir(dirname(cache),{recursive:true});
  const temporary=cache+'.'+randomUUID()+'.tmp';await writeFile(temporary,code);await rename(temporary,cache);
  return code;
}
