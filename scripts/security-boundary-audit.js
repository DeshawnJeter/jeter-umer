import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {request as httpRequest} from 'node:http';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {browserEnvironment} from '../apps/server/src/validation/browser-environment.js';
import {checkCode} from '../apps/server/src/runners/code-workspace.js';
import {emptyUsage,reserveUsage} from '../apps/server/src/providers/usage.js';
import {DEFAULT_SOURCE,DEFAULT_SCENARIOS} from '../shared/code-game.js';
import {unzipSync} from 'fflate';

// Explicit, non-destructive local audit. No .env loading, real credentials,
// external model requests, package installation or user-project mutations.
const folder=resolve('.local/security-audit',new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(folder,{recursive:true});
const results=[];
const record=(id,status,evidence,scope)=>results.push({id,status,evidence,scope});
const freePort=async()=>{const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(yes=>server.close(yes));return port;};
const port=await freePort();let codePort=await freePort();while(codePort===port)codePort=await freePort();
const origin=`http://127.0.0.1:${port}`,codeOrigin=`http://127.0.0.1:${codePort}`,id=randomUUID(),root=join(folder,'runs'),build=join(root,id,'builds','0');
await mkdir(build,{recursive:true});
const canary='AUDIT_FAKE_CREDENTIAL_'+randomUUID();
await writeFile(join(root,id,'state.json'),JSON.stringify({version:2,id,createdAt:new Date().toISOString(),mode:'scripted-demo',providerConfig:{mode:'scripted-demo'},status:'awaiting_review',generation:0,steps:0,brief:{title:'Security fixture',genre:'custom',prompt:'Controlled local security probe',difficulty:'beginner'},results:{},answers:[],questions:[],decisions:{},events:[],build:{generation:0,sha256:'synthetic-audit-build',url:codeOrigin+`/preview/${id}/0/index.html`}}));
await writeFile(join(build,'index.html'),'<!doctype html><title>Security fixture</title><script type="module" src="./runner.js"></script>');
await writeFile(join(build,'probe.json'),'{}');
await writeFile(join(build,'nested.js'),'// Harmless nested-worker canary.');
await writeFile(join(build,'runner.js'),`const worker=new Worker(new URL('./code-worker.js',import.meta.url),{type:'module'});worker.onmessage=e=>{window.auditResult=e.data;worker.terminate();};worker.onerror=()=>{window.auditResult={workerError:true};};worker.postMessage({});`);
await writeFile(join(build,'code-worker.js'),`onmessage=async()=>{
 const result={};
 try{Object['constructor']('return 7')();result.dynamicCodeBlocked=false;}catch{result.dynamicCodeBlocked=true;}
 try{await fetch(new URL('./probe.json',location.href));result.networkBlocked=false;}catch{result.networkBlocked=true;}
 result.nestedWorkerBlocked=await new Promise(resolve=>{try{const worker=new Worker(new URL('./nested.js',location.href),{type:'module'});worker.onerror=e=>{e.preventDefault();worker.terminate();resolve(true);};setTimeout(()=>{worker.terminate();resolve(false);},500);}catch{resolve(true);}});
 postMessage(result);
};`);
const env={...browserEnvironment(),GAME_BUILDER_PROVIDER:'demo',GAME_BUILDER_BROWSER_QA:'off',GAME_BUILDER_RUNS_DIR:root,PORT:String(port),GAME_BUILDER_CODE_PREVIEW_PORT:String(codePort),ANTHROPIC_API_KEY:canary};
const server=spawn(process.execPath,['apps/server/src/index.js'],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});
let browser;
try{
 for(let attempt=0;;attempt++){try{const res=await fetch(origin+'/api/config');if(res.ok)break;}catch{}if(attempt>=100)throw Error('Disposable audit server did not start');await new Promise(yes=>setTimeout(yes,100));}
 const response=await fetch(origin+'/api/runs'),runs=await response.json();
 record('local-api-authentication',response.status===401||response.status===403?'pass':'fail',{httpStatus:response.status,fixtureReadable:Array.isArray(runs)&&runs.some(run=>run.id===id)},'No credentials sent. Loopback exposure only; this does not prove remote Internet access.');
 const create=await fetch(origin+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Disposable unauthenticated write probe'})});
 record('local-api-write-authentication',[401,403].includes(create.status)?'pass':'fail',{httpStatus:create.status},'Creates only a project inside this disposable demo store. No game or paid request is started.');
 const hostile=await fetch(origin+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://audit.invalid'},body:'{"title":"Cross-origin canary"}'});
 record('foreign-browser-origin',hostile.status===403?'pass':'fail',{httpStatus:hostile.status},'Checks the explicit foreign-Origin rejection.');
 const badHost=await new Promise((yes,no)=>{const req=httpRequest(origin+'/api/config',{headers:{Host:'audit.invalid'}},res=>{res.resume();res.on('end',()=>yes(res.statusCode));});req.on('error',no);req.end();});
 record('host-validation',badHost===403?'pass':'fail',{httpStatus:badHost},'Uses raw HTTP so the client cannot normalize the unexpected Host back to localhost.');
 const endpoints=['/.env/local.env','/.git/config','/preview/'+id+'/0/%2e%2e/%2e%2e/.env/local.env'];
 const denied=[];for(const path of endpoints){const res=await fetch(origin+path);denied.push({path,status:res.status});await res.body?.cancel();}
 record('private-path-serving',denied.every(r=>[403,404].includes(r.status))?'pass':'fail',denied,'No real private file contents are read.');
 const codeApi=await fetch(codeOrigin+'/api/runs'),codeWrite=await fetch(codeOrigin+'/api/runs',{method:'POST'});
 record('preview-api-separation',codeApi.status===404&&codeWrite.status===403?'pass':'fail',{read:codeApi.status,write:codeWrite.status},'The custom-game origin must not expose the workshop API.');
 const publicConfig=await(await fetch(origin+'/api/config')).text(),publicRuns=JSON.stringify(runs);
 const archive=await fetch(origin+`/api/runs/${id}/download`);const files=unzipSync(new Uint8Array(await archive.arrayBuffer()));
 const exposed=publicConfig.includes(canary)||publicRuns.includes(canary)||Object.values(files).some(bytes=>Buffer.from(bytes).includes(Buffer.from(canary)));
 record('synthetic-secret-disclosure',exposed?'fail':'pass',{canaryExposed:exposed,downloadedFiles:Object.keys(files).length},'Fake environment credential only; real keys are never read.');
 const {chromium}=await import('playwright');browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true,env:browserEnvironment()});
 const page=await browser.newPage();await page.goto(codeOrigin+`/preview/${id}/0/index.html`);await page.waitForFunction(()=>window.auditResult,{timeout:15000});
 const observed=await page.evaluate(()=>window.auditResult);
 record('worker-csp-dynamic-code',observed.dynamicCodeBlocked===true?'pass':'fail',observed,'Only a harmless function returning 7 is attempted.');
 record('worker-csp-network',observed.networkBlocked===true?'pass':'fail',observed,'Only a request for a local, existing empty JSON fixture is attempted.');
 record('worker-csp-nested-worker',observed.nestedWorkerBlocked===true?'pass':'fail',observed,'Only a harmless local nested worker is attempted.');
 const indirect=DEFAULT_SOURCE.replace('export function createGame(api){',`export function createGame(api){const auditCanary=Object['constructor']('return 7');`);
 if(indirect===DEFAULT_SOURCE)throw Error('Dynamic-code canary could not be inserted');
 const staticResult=checkCode({source:indirect,scenarios:DEFAULT_SCENARIOS},{sourceOnly:true});
 record('static-dynamic-code-rejection',staticResult.verdict==='fail'?'pass':'warning',{staticVerdict:staticResult.verdict,previewExecutionBlocked:observed.dynamicCodeBlocked},'The static blocklist accepts indirect function construction; current preview CSP blocks execution. Export-host protections require separate validation.');
 const a=emptyUsage(),b=emptyUsage(),limits={maxCalls:1,maxTotalTokens:1000};reserveUsage(a,limits,100);let blocked=false;try{reserveUsage(a,limits,100);}catch(error){blocked=error.budgetExhausted===true;}reserveUsage(b,limits,100);
 record('per-run-budget',blocked?'pass':'fail',{secondCallBlocked:blocked},'Synthetic counters; no provider request is made.');
 record('global-spending-cap','fail',{separateRunCanReserveAgain:b.calls===1},'Budgets are per run. Source review confirms no account-wide daily/dollar allowance in the app; this does not test Anthropic account limits.');
 const ignored=spawnSync('git',['check-ignore','.env/local.env'],{encoding:'utf8'});
 record('local-secret-ignored',ignored.status===0?'pass':'fail',{ignored:ignored.status===0},'Checks ignore rules, not credential validity or historical compromise.');
 const tracked=spawnSync('git',['ls-files','-z'],{encoding:'utf8'});if(tracked.status!==0)throw Error('Tracked-file inventory failed');const matches=[];
 for(const file of tracked.stdout.split('\0').filter(Boolean)){try{const bytes=await readFile(resolve(file));if(/sk-(?:proj|ant-(?:api\d*|usr))-[A-Za-z0-9_-]{20,}/.test(bytes.toString('utf8')))matches.push(file);}catch{}}
 record('tracked-secret-patterns',matches.length?'fail':'pass',{matchingFiles:matches},'Current tracked files only. Pattern scanning cannot prove that all secrets or Git history are clean.');
 record('real-key-compromise-status','not_tested',{},'Keys previously pasted in chat remain exposed; this audit does not access provider account activity or rotate credentials.');
 record('global-disk-quota','not_tested',{},'No disk-exhaustion or destructive resource test is performed.');
}catch(error){record('audit-execution','error',{message:error.message},'A probe execution error is not a passing defense.');}
finally{await browser?.close();server.kill();if(server.exitCode===null)await once(server,'exit');}
const summary=Object.fromEntries(['pass','fail','warning','not_tested','error'].map(status=>[status,results.filter(r=>r.status===status).length]));
await writeFile(join(folder,'boundaries.json'),JSON.stringify({createdAt:new Date().toISOString(),paidCalls:0,summary,results},null,2));
console.log(JSON.stringify({folder,summary,results}));process.exitCode=summary.fail||summary.error?1:0;
