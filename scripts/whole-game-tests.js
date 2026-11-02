import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {defaults,clone} from '../shared/contracts/index.js';
import {GAME_TYPES,referenceLevel} from '../shared/game-types.js';
import {hudFor} from '../shared/player-ui.js';
import {DEFAULT_SOURCE,DEFAULT_SCENARIOS} from '../shared/code-game.js';
import {modulesFor} from '../apps/server/src/specialists/jobs.js';
import {buildGame,hashBuild} from '../apps/server/src/integration/build.js';
import {runBrowserSmoke} from '../apps/server/src/validation/browser-smoke.js';
const selected=process.argv.slice(2),genres=selected.length?selected:Object.keys(GAME_TYPES);
if(genres.some(genre=>!Object.hasOwn(GAME_TYPES,genre)))throw Error('Unknown game style');
const root=resolve('.local/whole-game-qa',new Date().toISOString().replace(/[:.]/g,'-')),results=[];await mkdir(root,{recursive:true});
for(const genre of genres){
 const config={...clone(defaults),genre};config.levels=referenceLevel(genre);config.ui.hud=hudFor(genre);config.implementation={runtime:genre,version:1,modules:modulesFor(genre)};
 if(genre==='custom')config.coding={source:DEFAULT_SOURCE,scenarios:DEFAULT_SCENARIOS};
 const folder=resolve(root,genre);await buildGame(folder,config);
 const report=await runBrowserSmoke({folder,config,buildHash:await hashBuild(folder),reportFolder:resolve(root,genre+'-report')});results.push({genre,report});
 console.log(JSON.stringify({genre,passed:report.passed,fullPlaythrough:report.fullPlaythrough,error:report.error,checks:report.tests.length}));
 await writeFile(resolve(root,'results.json'),JSON.stringify({results,paidCalls:0,humanApproved:false},null,2));
}
console.log('Reports: '+root);if(results.some(row=>!row.report.passed))process.exitCode=1;
