import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {deploymentConfig} from '../apps/server/src/deployment/config.js';
import {Control,passwordHash} from '../apps/server/src/deployment/control.js';
import {authorize,RateLimit,securityHeaders} from '../apps/server/src/deployment/access.js';
import {snapshot,restoreSnapshot,exclusiveData,storageBytes} from '../apps/server/src/deployment/operations.js';
import {createRuntime} from '../apps/server/src/providers/runtime.js';
import {Manager} from '../apps/server/src/orchestrator/manager.js';
import {Store} from '../apps/server/src/storage/store.js';
import {defaults} from '../shared/contracts/index.js';
import {checkCode} from '../apps/server/src/runners/code-workspace.js';
import {browserEnvironment} from '../apps/server/src/validation/browser-environment.js';
import {RunGate} from '../apps/server/src/deployment/run-gate.js';
import {exportProject} from '../apps/server/src/integration/export-project.js';
const password='Fixture team password 4242',secret='a'.repeat(64),backupKey='b'.repeat(64);
const temp=()=>mkdtemp(join(tmpdir(),'workshop-security-'));
async function fixture(options={}){const root=await temp(),config={...deploymentConfig({WORKSHOP_AUTH:'on',WORKSHOP_DATA_DIR:root,WORKSHOP_PASSWORD_HASH:await passwordHash(password),WORKSHOP_SESSION_SECRET:secret}),...options};return {root,config,control:await new Control(config,options.clock).initialize()};}

test('production fails closed without HTTPS, separate origins, persistent storage and secrets',async()=>{
 assert.throws(()=>deploymentConfig({NODE_ENV:'production'}));
 const env={NODE_ENV:'production',WORKSHOP_PUBLIC_ORIGIN:'https://workshop.example',WORKSHOP_PREVIEW_ORIGIN:'https://games.example.net',WORKSHOP_DATA_DIR:await temp(),WORKSHOP_PASSWORD_HASH:await passwordHash(password),WORKSHOP_SESSION_SECRET:secret,GAME_BUILDER_BROWSER_QA:'on'};
 assert.equal(deploymentConfig(env).host,'0.0.0.0');
 for(const change of [{WORKSHOP_PREVIEW_ORIGIN:env.WORKSHOP_PUBLIC_ORIGIN},{WORKSHOP_PUBLIC_ORIGIN:'http://workshop.example'},{WORKSHOP_DATA_DIR:'relative'},{WORKSHOP_SESSION_SECRET:'short'},{GAME_BUILDER_BROWSER_QA:'off'}])assert.throws(()=>deploymentConfig({...env,...change}));
});
test('sign-in stores only token hashes, enforces CSRF/origin and revokes logout across restart',async()=>{
 const {config,control,root}=await fixture();await assert.rejects(control.login('wrong'),/Invalid sign-in/);const {token,csrf}=await control.login(password),cookie=control.cookie(token);assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(new Control({...config,hosted:true}).cookie(token),/^__Host-workshop=.*Secure$/);
 const headers={cookie,origin:config.appOrigin,'x-workshop-csrf':csrf};assert.ok(authorize({method:'POST',headers},config,control));
 for(const bad of [{...headers,origin:'https://evil.example'},{...headers,'x-workshop-csrf':'forged'},{...headers,cookie:'workshop-session=bad'}])assert.throws(()=>authorize({method:'POST',headers:bad},config,control));
 assert.ok(!(await readFile(join(root,'control.json'),'utf8')).includes(token));const recovered=await new Control(config).initialize();assert.ok(recovered.session({headers}));await recovered.logout(recovered.session({headers}));assert.equal((await new Control(config).initialize()).session({headers}),null);
});
test('password attempts and session count are bounded without trusting proxy addresses',async()=>{
 const {control}=await fixture({maxSessions:1});await control.login(password);await assert.rejects(control.login(password),/Session limit/);
 for(let i=0;i<8;i++)await assert.rejects(control.login('wrong'));
 await assert.rejects(control.login(password),/Too many/);let now=0;const limiter=new RateLimit({limit:2,now:()=>now});limiter.take();limiter.take();assert.throws(()=>limiter.take(),/Request limit/);now=60001;limiter.take();
});
test('rotating team credentials revokes saved sessions and preview links while preserving usage',async()=>{const {control,config}=await fixture();const {token}=await control.login(password),run={id:'rotation',build:{generation:0}},ticket=control.ticket(run),id=await control.reserve(40);await control.settle(id,null);const rotated=await new Control({...config,passwordHash:await passwordHash('Replacement team password 4242')}).initialize();assert.equal(rotated.session({headers:{cookie:control.cookie(token)}}),null);assert.equal(rotated.verifyTicket(ticket,run.id,'0'),false);assert.equal(rotated.usage().totalTokens,40);});
test('preview capabilities are stable, bound to a build, expire and reject tampering',async()=>{
 let now=1000;const {control}=await fixture({clock:{now:()=>now}}),run={id:'some-run',build:{generation:3}};const token=control.ticket(run);now+=100;assert.equal(control.ticket(run),token);assert.equal(control.verifyTicket(token,run.id,'3'),true);assert.equal(control.verifyTicket(token,'foreign-run','3'),false);assert.equal(control.verifyTicket(token,run.id,'4'),false);assert.equal(control.verifyTicket(token+'x',run.id,'3'),false);now+=3600001;assert.equal(control.verifyTicket(token,run.id,'3'),false);
});
test('shared reservations serialize concurrent runs and remain charged after restart',async()=>{
 const {control,config}=await fixture({dailyTokens:100,totalTokens:120,dailyCalls:2});const results=await Promise.allSettled([control.reserve(70),control.reserve(70)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const id=results.find(r=>r.status==='fulfilled').value;await control.settle(id,{totalTokens:20});assert.equal(control.usage().totalTokens,20);await control.reserve(80);const recovered=await new Control(config).initialize();assert.equal(recovered.usage().totalTokens,100);await assert.rejects(recovered.reserve(1),/allowance exhausted/);
});
test('lifetime allowance survives a UTC day change and cancellation refunds only unsent work',async()=>{
 let now=Date.UTC(2026,0,1);const {control}=await fixture({totalTokens:100,dailyTokens:100,dailyCalls:3,clock:{now:()=>now}});let id=await control.reserve(90);await control.settle(id,null,{cancel:true});assert.equal(control.usage().used.calls,0);id=await control.reserve(90);await control.settle(id,null);now+=86400000;await assert.rejects(control.reserve(11),/allowance exhausted/);control.blocked=true;await assert.rejects(control.reserve(1),/shutting down/);
});
test('corrupt shared allowance state fails closed instead of resetting spending',async()=>{const {root,config}=await fixture();await writeFile(join(root,'control.json'),'{bad');await assert.rejects(new Control(config).initialize());});
test('missing accounting cannot silently reset an existing workshop',async()=>{const {root,config}=await fixture();await mkdir(join(root,'runs'));await mkdir(join(root,'runs','existing'));await rm(join(root,'control.json'));await assert.rejects(new Control(config).initialize(),/ledger is missing/);});
test('shared cap blocks a fresh model run before any generation request',async()=>{
 const {control}=await fixture({dailyTokens:1,totalTokens:1});let calls=0;
 const runtime=createRuntime({env:{GAME_BUILDER_PROVIDER:'anthropic',ANTHROPIC_API_KEY:'SYNTHETIC_CREDENTIAL'},sharedBudget:control,countInputTokens:false,fetchImpl:async()=>{calls++;throw Error('must not call');}});
 const manager=new Manager(new Store(await temp()),{runtime,browserMode:'off'});await manager.initialize();for(let i=0;i<2;i++){const run=await manager.create({title:'Budget fixture',prompt:'Collect stars',genre:'collector',difficulty:'beginner',music:false});await manager.jobs.get(run.id);assert.equal(run.status,'failed');assert.match(run.error,/Shared model allowance/);}assert.equal(calls,0);
});
test('admission limits apply to every manager creation path, before writing a project',async()=>{let count=0;const manager=new Manager(new Store(await temp()),{runtime:createRuntime({env:{GAME_BUILDER_PROVIDER:'demo'}}),browserMode:'off',admitCreate:async()=>{if(count++>=1)throw Error('Admission denied');}});await manager.initialize();const brief={title:'One',prompt:'Collect stars',difficulty:'beginner',music:false};const result=await Promise.allSettled([manager.create(brief),manager.create(brief)]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal((await manager.projects.list()).length,1);await Promise.allSettled([...manager.jobs.values()]);});
test('hosted builds share a bounded slot and queued cancellation never consumes one',async()=>{const gate=new RunGate(1),first=await gate.acquire();let entered=false;const controller=new AbortController(),cancelled=gate.acquire(controller.signal);const blocked=assert.rejects(cancelled,/suspended/);controller.abort();await blocked;const queued=gate.acquire().then(release=>{entered=true;return release;});await new Promise(yes=>setTimeout(yes,10));assert.equal(entered,false);assert.equal(gate.active,1);first();const release=await queued;assert.equal(entered,true);assert.equal(gate.active,1);release();release();assert.equal(gate.active,0);});
test('queued manager work pauses without failing or starting its drive',async()=>{const manager=new Manager(new Store(await temp()),{runtime:createRuntime({env:{GAME_BUILDER_PROVIDER:'demo'}}),browserMode:'off',runConcurrency:1});await manager.initialize();let finish;const held=new Promise(yes=>finish=yes),started=[];manager.drive=async run=>{started.push(run.id);await held;};const brief={title:'Queue fixture',prompt:'Collect stars',difficulty:'beginner',music:false},first=await manager.create(brief),second=await manager.create(brief);await new Promise(yes=>setTimeout(yes,20));assert.deepEqual(started,[first.id]);await manager.act(second.id,'pause');await manager.jobs.get(second.id);assert.equal(second.status,'paused');assert.deepEqual(started,[first.id]);finish();await manager.jobs.get(first.id);});
test('encrypted snapshots restore project bytes, revoke sessions and reject corruption or wrong keys',async()=>{
 const {control,root}=await fixture();await control.login(password);await mkdir(join(root,'runs'));await writeFile(join(root,'runs','fixture.json'),'saved project bytes');const bytes=await storageBytes(root);assert.ok(bytes>0);const name=await snapshot(root,backupKey),folder=join(root,'backups',name),target=await temp();assert.ok(!(await readFile(join(folder,'0.enc'),'utf8')).includes('saved project bytes'));assert.equal(await restoreSnapshot(folder,target,backupKey),2);assert.equal(await readFile(join(target,'runs','fixture.json'),'utf8'),'saved project bytes');assert.deepEqual(JSON.parse(await readFile(join(target,'control.json'),'utf8')).sessions,{});await assert.rejects(restoreSnapshot(folder,await temp(),'c'.repeat(64)),/authentication/);await assert.rejects(restoreSnapshot(folder,target,backupKey),/empty destination/);await writeFile(join(folder,'0.enc'),'corrupt');const broken=await temp();await assert.rejects(restoreSnapshot(folder,broken,backupKey));assert.deepEqual(await readdir(broken),[]);
});
test('persistent storage has one writer and hosted headers restrict parent, network and dynamic code',async()=>{
 const root=await temp(),release=await exclusiveData(root);await assert.rejects(exclusiveData(root),/already in use/);await release();await (await exclusiveData(root))();const headers={};securityHeaders({setHeader:(k,v)=>headers[k]=v},{hosted:true,appOrigin:'https://workshop.example',previewOrigin:'https://games.example.net'},{preview:true,worker:true});assert.match(headers['Content-Security-Policy'],/connect-src 'none'/);assert.match(headers['Content-Security-Policy'],/worker-src 'none'/);assert.ok(!headers['Content-Security-Policy'].includes('unsafe-eval'));assert.equal(headers['Referrer-Policy'],'no-referrer');assert.ok(!Object.hasOwn(browserEnvironment({PATH:'ok',WORKSHOP_SESSION_SECRET:'private',WORKSHOP_BACKUP_KEY:'private'}),'WORKSHOP_BACKUP_KEY'));
});
test('a stale same-PID local lock can recover, but a currently held lock cannot',async()=>{const root=await temp();await writeFile(join(root,'server.lock'),String(process.pid));const release=await exclusiveData(root);await assert.rejects(exclusiveData(root),/already in use/);await release();});
test('editable export stops before reading files beyond the configured byte allowance',async()=>{const root=await temp();await mkdir(join(root,'build'));await writeFile(join(root,'build','oversize.bin'),'0123456789abcdef!');await assert.rejects(exportProject({get:async()=>({brief:{title:'Fixture'},buildHash:'unused'}),folder:()=>root},'project','version',{maxBytes:16}),error=>error.status===413);});
test('code checker rejects direct and literal computed constructor traversal',()=>{for(const expression of ['({}).constructor','(()=>{})["constructor"]','({})["__proto__"]'])assert.equal(checkCode({source:`export function createGame(api){${expression};return {};}`},{sourceOnly:true}).verdict,'fail');});
