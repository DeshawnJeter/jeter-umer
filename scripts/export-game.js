import {resolve,relative,sep} from 'node:path';
import {mkdir,cp,readFile,writeFile,realpath} from 'node:fs/promises';
import {build} from 'vite';
import {hashBuild} from '../apps/server/src/integration/build.js';
import {DEFAULT_SOURCE} from '../shared/code-game.js';
const root=await realpath(resolve('.local')),source=await realpath(resolve(process.argv[2]||'')),path=relative(root,source);
if(!path||path.startsWith('..')||path.includes(':'+sep)||!/[\\/]builds[\\/]\d+$/.test(source))throw Error('Choose an existing generated build inside this project .local directory');
const config=JSON.parse(await readFile(resolve(source,'config.json'),'utf8'));
const sourceHash=await hashBuild(source),output=resolve(root,'exports',sourceHash);
await mkdir(output,{recursive:true});
const staging=resolve(root,'export-staging',sourceHash);await cp(source,staging,{recursive:true});
// Vite analyzes every dynamic genre module, including unused custom mode.
// Supply its inert example only in staging; never modify the reviewed build.
if(config.genre!=='custom'){await mkdir(resolve(staging,'generated'),{recursive:true});await writeFile(resolve(staging,'generated','rules.js'),DEFAULT_SOURCE);}
// Trusted Vite configuration only: never load a generated config, plugin,
// package script or environment file. Generated JavaScript is compiled, not run.
await build({root:staging,configFile:false,envDir:false,envPrefix:[],publicDir:false,base:'./',logLevel:'warn',build:{outDir:output,emptyOutDir:false,minify:true}});
for(const file of ['vendor','config.json','music-score.json','assets-manifest.json','lifecycle.json'])await cp(resolve(source,file),resolve(output,file),{recursive:true});
await writeFile(resolve(output,'export-report.json'),JSON.stringify({sourceHash,genre:config.genre,bundled:true,humanApproved:false,note:'This packaged export is a new artifact and requires its own browser/human review.'},null,2));
console.log('Packaged game: '+output);
