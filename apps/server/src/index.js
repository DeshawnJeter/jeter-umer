import {isModelProvider,providerLabel} from '../../../shared/providers.js';
import {validateBindings} from './integration/asset-bindings.js';
import {estimateBuild} from './providers/build-budget.js';
import {validateBrief} from '../../../shared/contracts/index.js';
import {exportProject} from './integration/export-project.js';
import {repairFeedback} from './orchestrator/feedback-repair.js';
import {validateAcceptanceCases} from '../../../shared/acceptance-cases.js';
import {requestChange} from './orchestrator/change-request.js';
import {restoreVersion,compareVersions} from './orchestrator/project-actions.js';
import {addFeedback,updateFeedback} from './memory/feedback.js';
import { createServer } from 'node:http';
import { readFile, stat, readdir, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { Manager } from './orchestrator/manager.js';
import { terminalStates } from '../../../shared/policies/index.js';
import { MUSIC_STYLES, MUSIC_INSTRUMENTS } from '../../../shared/music.js';
import {GAME_TYPES} from '../../../shared/game-types.js';
import {EXTENSION_SPECS,activeRoles,dependenciesFor} from '../../../shared/specialists.js';
import {Store} from './storage/store.js';
import {createRuntime} from './providers/runtime.js';
import {deploymentConfig} from './deployment/config.js';
import {trustedPreviewRelay} from './deployment/relay.js';
import {Control,failure} from './deployment/control.js';
import {authorize,requireOrigin,securityHeaders,RateLimit,SIGNIN_HTML} from './deployment/access.js';
import {exclusiveData,storageBytes,snapshot} from './deployment/operations.js';
const deployment=deploymentConfig(),{port,previewPort:codePort,appOrigin:origin,previewOrigin:codeOrigin}=deployment;
if(deployment.hosted&&!/^[a-f0-9]{64}$/.test(process.env.WORKSHOP_BACKUP_KEY||''))throw Error('Production requires WORKSHOP_BACKUP_KEY');
const release=deployment.enabled&&process.env.WORKSHOP_OS_LOCKED!=='1'?await exclusiveData(deployment.root):async()=>{};
const control=deployment.enabled?await new Control(deployment).initialize():null;
const manager = new Manager(deployment.enabled?new Store(resolve(deployment.root,'runs')):undefined,{runtime:createRuntime({sharedBudget:control}),runConcurrency:control?1:undefined,admitCreate:async brief=>{
 if(!control)return;if(stopping||maintenance)throw failure(503,'Workshop maintenance in progress');
 if(manager.runs.size>=deployment.maxRuns||[...manager.runs.values()].filter(r=>!terminalStates.has(r.status)).length>=5)throw failure(429,'Run allowance reached');
 if(!brief.projectId&&(await manager.projects.list()).length>=deployment.maxProjects)throw failure(429,'Project allowance reached');
 if(await storageBytes(deployment.root)>deployment.maxDataBytes)throw failure(507,'Storage allowance reached');
}}); await manager.initialize();
let maintenance=false,stopping=false,backupError=false,lastBackup=0,mutations=0;
if(control)control.beforeReserve=async()=>{if(backupError||await storageBytes(deployment.root)>deployment.maxDataBytes)throw failure(507,'Model generation is blocked until storage and backups are healthy');};
const writes=new RateLimit({limit:120}),loginTraffic=new RateLimit({limit:20,interval:900000});
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png':'image/png', '.wav':'audio/wav' };
function runView(value){if(value?.version!==2||!value.brief||!value.build)return value;return {...value,build:{...value.build,url:control?`${codeOrigin}/play/${control.ticket(value)}/preview/${value.id}/${value.build.generation}/index.html`:`${value.brief.genre==='custom'?codeOrigin:''}/preview/${value.id}/${value.build.generation}/index.html`}};}
function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(Array.isArray(data)?data.map(runView):runView(data))); }
async function body(req,limit=12000) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('Use application/json');
  let text = ''; for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > limit) throw new Error('Request too large'); } return JSON.parse(text || '{}');
}
async function serve(res, base, relative, preview = false, isolated = false, worker = false) {
  const file = resolve(base, relative); const root = resolve(base);
  if (!file.startsWith(root + sep) || relative.split(/[\\/]/).some(part => part.startsWith('.'))) { json(res, 404, { error: 'Not found' }); return; }
  if (!(await stat(file)).isFile()||!(await realpath(file)).startsWith((await realpath(root))+sep)) throw new Error('Not a file');
  // The preview keeps an opaque sandbox origin. Explicit local asset origins let
  // its modules/config load without granting allow-same-origin to generated games.
  const assetOrigins = isolated?codeOrigin:`${origin} http://localhost:${port}`;
  if(control){securityHeaders(res,deployment,{preview,worker:worker||relative==='code-worker.js'});if(preview)res.setHeader('Access-Control-Allow-Origin','*');}
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(!control&&isolated?{'Content-Security-Policy':`default-src 'none'; script-src ${codeOrigin}; style-src ${codeOrigin} 'unsafe-inline'; connect-src ${relative==='code-worker.js'?"'none'":codeOrigin}; worker-src ${relative==='code-worker.js'?"'none'":codeOrigin}; img-src ${codeOrigin} data: blob:; object-src 'none'; base-uri 'none'`}:{}), ...(!control&&!isolated && preview ? { 'Access-Control-Allow-Origin': '*', 'Content-Security-Policy': `default-src 'none'; script-src ${assetOrigins} 'unsafe-inline'; style-src ${assetOrigins} 'unsafe-inline'; connect-src ${assetOrigins}; img-src ${assetOrigins} data: blob:; media-src ${assetOrigins} blob:; object-src 'none'; base-uri 'none'` } : {}) }); res.end(await readFile(file));
}
async function archive(folder) {
  const { zipSync } = await import('fflate'); const files = {};let bytes=0;
  async function walk(dir, prefix = '') { for (const entry of await readdir(dir, { withFileTypes: true })) { const key = prefix + entry.name; if (entry.isDirectory()) await walk(resolve(dir, entry.name), key + '/'); else if(entry.isFile()){bytes+=(await stat(resolve(dir,entry.name))).size;if(bytes>32000000)throw failure(413,'Download exceeds the 32 MB allowance');files[key] = new Uint8Array(await readFile(resolve(dir, entry.name)));}else throw failure(400,'Downloads require regular files'); } }
  await walk(folder); return zipSync(files);
}
const server = createServer(async (req, res) => {
  if(req.method==='POST'){mutations++;let counted=true;const done=()=>{if(counted){mutations--;counted=false;}};res.once('finish',done);res.once('close',done);}
  try {
    if(control&&trustedPreviewRelay(req,process.env.WORKSHOP_PREVIEW_RELAY_SECRET)){req.headers.host=new URL(codeOrigin).host;return await previewRequest(req,res);}
    if(control&&req.headers.host===new URL(codeOrigin).host)return await previewRequest(req,res);
    if(req.url==='/healthz'&&req.method==='GET')return json(res,stopping||backupError||maintenance?503:200,{ready:!stopping&&!backupError&&!maintenance});
    const hosts=deployment.hosted?[new URL(origin).host]:[`127.0.0.1:${port}`,`localhost:${port}`];
    if (!hosts.includes(req.headers.host)) return json(res, 403, { error: 'Host rejected' });
    if(control){securityHeaders(res,deployment);if(stopping||maintenance)throw failure(503,'Workshop maintenance in progress. Try again shortly.');
      const path=new URL(req.url,origin).pathname;
      if(req.method==='GET'&&path==='/signin'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(SIGNIN_HTML);}
      if(req.method==='GET'&&['/signin.js','/style.css'].includes(path))return await serve(res,'apps/web',path.slice(1));
      if(req.method==='GET'&&path==='/auth/session'){const session=control.session(req);return json(res,200,{required:true,authenticated:!!session,...(session?{csrf:session.csrf}:{})});}
      if(req.method==='POST'&&path==='/auth/login'){requireOrigin(req,deployment);loginTraffic.take();const {token}=await control.login((await body(req,1024)).password);res.setHeader('Set-Cookie',control.cookie(token));return json(res,200,{signedIn:true});}
      if(req.method==='GET'&&path==='/'&&!control.session(req)){res.writeHead(302,{Location:'/signin'});return res.end();}
      const session=authorize(req,deployment,control);
      if(req.method==='POST'){writes.take();if(path==='/auth/logout'){await control.logout(session);res.setHeader('Set-Cookie',control.cookie('',true));return json(res,200,{signedOut:true});}
        if(!/\/(?:pause|cancel)$/.test(path)&&await storageBytes(deployment.root)>deployment.maxDataBytes)throw failure(507,'Storage allowance reached. Export or archive data before starting more work.');
      }
      if(req.method==='GET'&&path==='/api/usage')return json(res,200,control.usage());
      if(req.method==='GET'&&path==='/api/backup-status')return json(res,200,{lastBackup:lastBackup?new Date(lastBackup).toISOString():null,healthy:!backupError});
    }else if(req.url==='/auth/session'&&req.method==='GET')return json(res,200,{required:false});
    const url = new URL(req.url, origin); const parts = decodeURIComponent(url.pathname).split('/').filter(Boolean);
    if (req.method === 'POST') {
      if (req.headers.origin && ![origin, `http://localhost:${port}`].includes(req.headers.origin)) return json(res, 403, { error: 'Origin rejected' });
      if(parts[0]==='api'&&parts[1]==='projects'&&parts.length===4&&parts[3]==='assign_assets'){const data=await body(req);return json(res,200,await manager.projects.update(parts[2],project=>{project.assetSelection=validateBindings(project,data.bindings||{});}));}
      if(parts[0]==='api'&&parts[1]==='projects'&&parts.length===4&&parts[3]==='assets')return json(res,201,await manager.assets.add(parts[2],await body(req,2850000)));
      if(url.pathname==='/api/runs/estimate')return json(res,200,estimateBuild(manager.runtime.publicConfig,validateBrief(await body(req))));
      if(parts[0]==='api'&&parts[1]==='projects'&&parts.length===4&&parts[3]==='repair')return json(res,201,await repairFeedback(manager,parts[2],await body(req)));
      if(parts[0]==='api'&&parts[1]==='projects'&&parts.length===4&&parts[3]==='acceptance'){const data=await body(req);return json(res,200,await manager.projects.update(parts[2],project=>{project.acceptanceCases=validateAcceptanceCases(data.cases);}));}
      if(parts[0]==='api'&&parts[1]==='projects'&&parts.length===4&&parts[3]==='change')return json(res,201,await requestChange(manager,parts[2],await body(req)));
      if(parts[0]==='api'&&parts[1]==='projects'&&parts.length===4&&parts[3]==='restore')return json(res,201,await restoreVersion(manager,parts[2],(await body(req)).versionId));
      if(parts[0]==='api'&&parts[1]==='projects'&&parts.length===4&&parts[3]==='milestone'){const data=await body(req);if(typeof data.label!=='string'||!data.label.trim()||data.label.length>60)throw Error('Milestone requires a short name');return json(res,200,await manager.projects.update(parts[2],project=>{const v=project.versions.find(v=>v.id===data.versionId);if(!v)throw Error('Version not found');v.label=data.label.trim();}));}
      if(parts[0]==='api'&&parts[1]==='projects'&&parts[3]==='feedback'){const data=await body(req);if(parts.length===4)return json(res,201,await addFeedback(manager.projects,parts[2],data));if(parts.length===5)return json(res,200,await updateFeedback(manager.projects,parts[2],parts[4],data));}
      if(parts[0]==='api'&&parts[1]==='projects'&&parts.length===2){if(control&&(await manager.projects.list()).length>=deployment.maxProjects)throw failure(429,'Project allowance reached');return json(res,201,await manager.projects.create((await body(req)).title));}
      if (parts[0] !== 'api' || parts[1] !== 'runs') return json(res, 404, { error: 'Not found' });
      const data = await body(req);
      if(control&&manager.runs.size>=deployment.maxRuns&&parts.length===2)throw failure(429,'Saved-run allowance reached');
      if (parts.length === 2) {
        if ([...manager.runs.values()].filter(run => !terminalStates.has(run.status)).length >= 5) throw new Error('Finish or cancel an existing run before creating another');
        return json(res, 201, await manager.create(data));
      }
      if(parts.length===4&&parts[3]==='save_version'){const run=manager.get(parts[2]);if(!['awaiting_review','complete','failed'].includes(run.status)||!run.build)throw Error('Wait for a delivered build');await manager.versions.capture(run,resolve(manager.store.folder(run.id),'builds',String(run.build.generation)));return json(res,200,await manager.projects.get(run.projectId));}
      if (parts.length === 4) return json(res, 200, await manager.act(parts[2], parts[3], data));
      return json(res, 404, { error: 'Not found' });
    }
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
    if(parts[0]==='api'&&parts[1]==='projects'&&parts.length===5&&parts[3]==='export'){const bytes=await exportProject(manager.versions,parts[2],parts[4]);res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':'attachment; filename=editable-game-project.zip'});return res.end(bytes);}
    if(parts[0]==='api'&&parts[1]==='projects'&&parts.length===4&&parts[3]==='compare')return json(res,200,await compareVersions(manager,parts[2],url.searchParams.get('left'),url.searchParams.get('right')));
    if(url.pathname==='/api/projects')return json(res,200,await manager.projects.list());
    if(parts[0]==='api'&&parts[1]==='projects'&&parts.length===3)return json(res,200,await manager.projects.get(parts[2]));
    if(url.pathname==='/api/game-catalog'&&req.method==='GET')return json(res,200,Object.entries(GAME_TYPES).map(([value,game])=>({value,label:game.name})));
    if(url.pathname==='/api/agent-catalog')return json(res,200,{roles:['planner','gameplay','levels','ui','story','audio',...Object.keys(EXTENSION_SPECS)],jobs:EXTENSION_SPECS});
    if(parts[0]==='api'&&parts[1]==='runs'&&parts.length===4&&parts[3]==='memory')return json(res,200,manager.get(parts[2]).memory||null);
    if (url.pathname === '/api/config') return json(res, 200, manager.runtime.publicConfig);
    if (url.pathname === '/api/music-catalog') return json(res, 200, { styles:Object.entries(MUSIC_STYLES).map(([value,entry])=>({value,label:entry.name})), instruments:[{value:'auto',label:'Let the agent choose'},...Object.entries(MUSIC_INSTRUMENTS).map(([value,entry])=>({value,label:entry.name}))] });
    if (url.pathname === '/api/runs') return json(res, 200, [...manager.runs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    if (parts[0] === 'api' && parts[1] === 'runs' && parts.length === 3) return json(res, 200, manager.get(parts[2]));
    if (parts[0] === 'api' && parts[1] === 'runs' && parts[3] === 'download' && parts.length === 4) {
      const run = manager.get(parts[2]); if (!run.build) throw new Error('No build available');
      const bytes = await archive(resolve(manager.store.folder(run.id), 'builds', String(run.build.generation)));
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="star-collector.zip"' }); return res.end(bytes);
    }
    if (parts[0] === 'preview' && parts.length >= 4) {
      if(control){const run=manager.get(parts[1]);if(!run.build||String(run.build.generation)!==parts[2])throw failure(404,'Build unavailable');res.writeHead(302,{Location:runView(run).build.url});return res.end();}
      const run = manager.get(parts[1]); if(run.brief.genre==='custom'){res.writeHead(302,{Location:codeOrigin+url.pathname});res.end();return;} if (!/^\d+$/.test(parts[2]) || !run.build || Number(parts[2]) !== run.build.generation) return json(res, 404, { error: 'Build unavailable' });
      return await serve(res, resolve(manager.store.folder(run.id), 'builds', parts[2]), parts.slice(3).join('/'), true);
    }
    if (url.pathname === '/') return await serve(res, 'apps/web', 'index.html');
    if (url.pathname === '/providers.js') return await serve(res, 'shared', 'providers.js');
    if (url.pathname === '/player-ui.js') return await serve(res, 'shared', 'player-ui.js');
    if (url.pathname === '/advanced-games.js') return await serve(res, 'shared', 'advanced-games.js');
    if (url.pathname === '/lifecycle.js') return await serve(res, 'shared', 'lifecycle.js');
    if (url.pathname === '/session.js' || url.pathname === '/project-workspace.js' || url.pathname === '/app.js' || url.pathname === '/preferences.js' || url.pathname === '/style.css') return await serve(res, 'apps/web', parts[0]);
    json(res, 404, { error: 'Not found' });
  } catch (error) { const status=error.status||(error.code==='ENOENT'?404:400);json(res,status,{error:status===404?'Not found':control&&!error.status?'Request could not be completed':error.message}); }
});
server.requestTimeout=15000;server.headersTimeout=10000;server.maxConnections=100;
server.listen(port, deployment.host, () => console.log(`Game builder: ${origin} (${isModelProvider(manager.runtime.mode) ? `${providerLabel(manager.runtime.mode)} mode; API usage is billed` : 'scripted demo; no API calls'})`));

async function previewRequest(req,res){try{
  if(req.method!=='GET'||req.headers.host!==new URL(codeOrigin).host)return json(res,403,{error:'Read-only game origin'});
  let parts=decodeURIComponent(new URL(req.url,codeOrigin).pathname).split('/').filter(Boolean);
  if(control){if(parts[0]!=='play'||!control.verifyTicket(parts[1]||'',parts[3],parts[4]))return json(res,404,{error:'Game asset not found'});parts=parts.slice(2);}
  if(parts[0]!=='preview'||parts.length<4) return json(res,404,{error:'Game asset not found'});
  const run=manager.get(parts[1]);if(!control&&run.brief.genre!=='custom'||!run.build||String(run.build.generation)!==parts[2])return json(res,404,{error:'Build unavailable'});
  await serve(res,resolve(manager.store.folder(run.id),'builds',parts[2]),parts.slice(3).join('/'),!!control,true,req.headers['sec-fetch-dest']==='worker');
}catch{json(res,404,{error:'Game asset not found'});}}
const codeServer=deployment.hosted?null:createServer(previewRequest);
codeServer?.listen(codePort,'127.0.0.1');
async function backup(){if(!control||maintenance||stopping||mutations||manager.jobs.size||Date.now()-lastBackup<6*60*60*1000)return;maintenance=true;try{await Promise.all([...manager.writes.values(),...manager.projects.pending.values(),control.queue]);await snapshot(deployment.root,process.env.WORKSHOP_BACKUP_KEY);lastBackup=Date.now();backupError=false;}catch{backupError=true;console.error('Workshop backup failed. Inspect persistent storage and backup configuration.');}finally{maintenance=false;}}
const backupTimer=control&&process.env.WORKSHOP_BACKUP_KEY?setInterval(backup,15*60*1000):null;backupTimer?.unref();
if(backupTimer)await backup();
async function shutdown(){if(stopping)return;stopping=true;if(control)control.blocked=true;if(backupTimer)clearInterval(backupTimer);const timeout=setTimeout(()=>process.exit(1),25000);timeout.unref();const closed=Promise.all([new Promise(yes=>server.close(yes)),...(codeServer?[new Promise(yes=>codeServer.close(yes))]:[])]);for(const run of manager.runs.values())if(run.status==='running')try{await manager.act(run.id,'pause',{});}catch{/* Preserve accepted artifacts on the next checkpoint. */}await closed;for(const run of manager.runs.values())if(run.status==='running')try{await manager.act(run.id,'pause',{});}catch{}await Promise.allSettled([...manager.jobs.values(),...manager.writes.values(),...manager.projects.pending.values(),...(control?[control.queue]:[])]);await release();clearTimeout(timeout);process.exit(0);}
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
