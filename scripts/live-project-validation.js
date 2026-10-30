import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {ROLE_MODELS} from '../apps/server/src/providers/model-policy.js';

// Explicit opt-in only. Never invoked by npm test and never print credentials.
if(!process.env.OPENAI_API_KEY)process.loadEnvFile('.env/local.env');
if(!process.env.OPENAI_API_KEY?.trim())throw Error('No local API credential available');
const resumeIndex=process.argv.indexOf('--resume'),resume=resumeIndex>=0;
const folder=resume?resolve(process.argv[resumeIndex+1]||''):resolve('.local/live-project-validation',new Date().toISOString().replace(/[:.]/g,'-'));
if(!folder.startsWith(resolve('.local/live-project-validation')+sep))throw Error('Resume only an isolated local validation folder');
await mkdir(folder,{recursive:true});
const models=[...new Set([...Object.values(ROLE_MODELS).flat(),'gpt-6-astra'])];
const access=[];
for(const model of models){
 const response=await fetch('https://api.openai.com/v1/models/'+encodeURIComponent(model),{headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY.trim()},signal:AbortSignal.timeout(20000),redirect:'error'});
 let errorCode=null;if(!response.ok){const value=await response.json().catch(()=>null);errorCode=typeof value?.error?.code==='string'?value.error.code.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80):null;}else await response.body?.cancel();
 access.push({model,status:response.status,accessible:response.ok,errorCode});
 console.log(JSON.stringify(access.at(-1)));
 if(response.status===401||response.status===429)break;
}
await writeFile(resolve(folder,'access.json'),JSON.stringify({createdAt:new Date().toISOString(),models:access,paidCalls:0},null,2));
console.log('Access report: '+folder);
if(access.length!==models.length||access.some(item=>!item.accessible)){process.exitCode=1;}
else if(process.argv.includes('--full')){const {liveProjectWorkflow}=await import('./live-project-workflow.js');const report=await liveProjectWorkflow({folder,key:process.env.OPENAI_API_KEY.trim(),resume,freshSecond:process.argv.includes('--fresh-second'),maxCalls:process.argv.includes('--max-calls')?Number(process.argv[process.argv.indexOf('--max-calls')+1]):undefined,maxDollars:process.argv.includes('--max-dollars')?Number(process.argv[process.argv.indexOf('--max-dollars')+1]):undefined});if(!report.passed)process.exitCode=1;}
else console.log('Access checks only. Use --full to explicitly run billed workflow validation.');
