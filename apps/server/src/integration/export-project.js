import {DEFAULT_SOURCE} from '../../../../shared/code-game.js';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {zipSync,strToU8} from 'fflate';
import {hashBuild} from './build.js';
export async function exportProject(versions,projectId,versionId){
 const snapshot=await versions.get(projectId,versionId),root=resolve(versions.folder(projectId,versionId),'build'),files={};
 async function walk(prefix=''){for(const entry of await readdir(resolve(root,prefix),{withFileTypes:true})){const path=prefix+entry.name;if(entry.isDirectory())await walk(path+'/');else if(entry.isFile())files['game/'+path]=new Uint8Array(await readFile(resolve(root,path)));else throw Error('Exports require regular files');}}await walk();
 if(await hashBuild(root)!==snapshot.buildHash)throw Error('Version changed during export');
 files['package.json']=strToU8(JSON.stringify({name:'exported-game',private:true,type:'module',scripts:{dev:'vite --host 127.0.0.1',build:'node scripts/build.mjs',preview:'vite preview --host 127.0.0.1'},devDependencies:{vite:'8.3.5'}},null,2));
 files['vite.config.js']=strToU8("export default {root:'game',base:'./',build:{outDir:'../dist',emptyOutDir:true}};\n");
 if(!files['game/generated/rules.js'])files['game/generated/rules.js']=strToU8(DEFAULT_SOURCE);
 files['scripts/build.mjs']=strToU8(`import {build} from 'vite';
import {cp} from 'node:fs/promises';
await build({root:'game',configFile:false,envDir:false,envPrefix:[],publicDir:false,base:'./',build:{outDir:'../dist',emptyOutDir:true}});
for(const file of ['vendor','assets','config.json','music-score.json','assets-manifest.json','imported-assets-manifest.json','lifecycle.json','ASSETS-LICENSE.txt'])try{await cp('game/'+file,'dist/'+file,{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
`);
 files['README.md']=strToU8(`# ${snapshot.brief.title}\n\nInstall Node.js 22.12 or later, then run npm install and npm run dev.\nUse npm run build to create dist for static hosting. Serve over HTTP.\n\nEdit game/generated/rules.js for custom gameplay, game/config.json for game settings, game/music-score.json and config.audio.score for synthesized music, or the game/ runtime files.\nNo API key is required to play or edit this export. Model generation remains in the workshop.\n\nSource version: ${versionId}\nOriginal build hash: ${snapshot.buildHash}\nThe exported development wrapper and any subsequent edits require fresh testing; historical approval does not approve modified/exported files.\n\nPhaser and Tone licenses are in game/vendor. Procedural artwork licensing and asset provenance are included with the game. Keep these notices and review the licenses of imported assets.\n`);
 files['project-provenance.json']=strToU8(JSON.stringify({projectId,versionId,sourceBuildHash:snapshot.buildHash,exportedAt:new Date().toISOString(),humanApproved:false},null,2));
 return zipSync(files);
}
