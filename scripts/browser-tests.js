import {mkdir,writeFile} from 'node:fs/promises';
import {Manager} from '../apps/server/src/orchestrator/manager.js';
import {Store} from '../apps/server/src/storage/store.js';
import {createRuntime} from '../apps/server/src/providers/runtime.js';
import {GAME_TYPES} from '../shared/game-types.js';
const selected=process.argv.slice(2);if(selected.some(genre=>!Object.hasOwn(GAME_TYPES,genre)))throw Error('Unknown game style');
const root='.local/browser-qa',manager=new Manager(new Store(root+'/runs'),{runtime:createRuntime({env:{}}),browserMode:'on'}),results=[];
await mkdir(root,{recursive:true});
for(const genre of selected.length?selected:Object.keys(GAME_TYPES)){
  const run=await manager.create({title:'Browser QA '+genre,prompt:'An isolated browser acceptance fixture for the supported game template.',genre,difficulty:'beginner',music:false,theme:'forest'});await manager.jobs.get(run.id);
  if(run.status==='awaiting_plan'){await manager.act(run.id,'approve_plan',{planHash:run.planHash});await manager.jobs.get(run.id);}
  const row={genre,id:run.id,status:run.status,error:run.error,report:run.browserChecks};results.push(row);console.log(JSON.stringify({genre,status:run.status,error:run.error,checks:run.browserChecks?.tests?.length}));await writeFile(root+'/latest.json',JSON.stringify({results,paidCalls:0,humanApproved:false},null,2));
}
if(results.some(row=>row.status!=='awaiting_review'||!row.report?.passed))process.exitCode=1;
