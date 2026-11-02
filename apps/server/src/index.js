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
import { readFile, stat, readdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { Manager } from './orchestrator/manager.js';
import { terminalStates } from '../../../shared/policies/index.js';
import { MUSIC_STYLES, MUSIC_INSTRUMENTS } from '../../../shared/music.js';
import {GAME_TYPES} from '../../../shared/game-types.js';
import {EXTENSION_SPECS,activeRoles,dependenciesFor} from '../../../shared/specialists.js';
const manager = new Manager(); await manager.initialize();
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be 1024–65535');
const origin = `http://127.0.0.1:${port}`;
const codePort=Number(process.env.GAME_BUILDER_CODE_PREVIEW_PORT)||(port>65400?port-100:port+100);
if(!Number.isInteger(codePort)||codePort<1024||codePort>65535||codePort===port)throw Error('Invalid isolated code preview port');
const codeOrigin=`http://127.0.0.1:${codePort}`;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png':'image/png', '.wav':'audio/wav' };
function runView(value){if(value?.version!==2||!value.brief||!value.build)return value;return {...value,build:{...value.build,url:`${value.brief.genre==='custom'?codeOrigin:''}/preview/${value.id}/${value.build.generation}/index.html`}};}
function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(Array.isArray(data)?data.map(runView):runView(data))); }
async function body(req,limit=12000) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('Use application/json');
  let text = ''; for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > limit) throw new Error('Request too large'); } return JSON.parse(text || '{}');
}
async function serve(res, base, relative, preview = false, isolated = false) {
  const file = resolve(base, relative); const root = resolve(base);
  if (!file.startsWith(root + sep) || relative.split(/[\\/]/).some(part => part.startsWith('.'))) { json(res, 404, { error: 'Not found' }); return; }
  if (!(await stat(file)).isFile()) throw new Error('Not a file');
  // The preview keeps an opaque sandbox origin. Explicit local asset origins let
  // its modules/config load without granting allow-same-origin to generated games.
  const assetOrigins = isolated?codeOrigin:`${origin} http://localhost:${port}`;
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(isolated?{'Content-Security-Policy':`default-src 'none'; script-src ${codeOrigin}; style-src ${codeOrigin} 'unsafe-inline'; connect-src ${relative==='code-worker.js'?"'none'":codeOrigin}; worker-src ${relative==='code-worker.js'?"'none'":codeOrigin}; img-src ${codeOrigin} data: blob:; object-src 'none'; base-uri 'none'`}:{}), ...(!isolated && preview ? { 'Access-Control-Allow-Origin': '*', 'Content-Security-Policy': `default-src 'none'; script-src ${assetOrigins} 'unsafe-inline'; style-src ${assetOrigins} 'unsafe-inline'; connect-src ${assetOrigins}; img-src ${assetOrigins} data: blob:; media-src ${assetOrigins} blob:; object-src 'none'; base-uri 'none'` } : {}) }); res.end(await readFile(file));
}
async function archive(folder) {
  const { zipSync } = await import('fflate'); const files = {};
  async function walk(dir, prefix = '') { for (const entry of await readdir(dir, { withFileTypes: true })) { const key = prefix + entry.name; if (entry.isDirectory()) await walk(resolve(dir, entry.name), key + '/'); else files[key] = new Uint8Array(await readFile(resolve(dir, entry.name))); } }
  await walk(folder); return zipSync(files);
}
const server = createServer(async (req, res) => {
  try {
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) return json(res, 403, { error: 'Local access only' });
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
      if(parts[0]==='api'&&parts[1]==='projects'&&parts.length===2)return json(res,201,await manager.projects.create((await body(req)).title));
      if (parts[0] !== 'api' || parts[1] !== 'runs') return json(res, 404, { error: 'Not found' });
      const data = await body(req);
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
      const run = manager.get(parts[1]); if(run.brief.genre==='custom'){res.writeHead(302,{Location:codeOrigin+url.pathname});res.end();return;} if (!/^\d+$/.test(parts[2]) || !run.build || Number(parts[2]) !== run.build.generation) return json(res, 404, { error: 'Build unavailable' });
      return await serve(res, resolve(manager.store.folder(run.id), 'builds', parts[2]), parts.slice(3).join('/'), true);
    }
    if (url.pathname === '/') return await serve(res, 'apps/web', 'index.html');
    if (url.pathname === '/providers.js') return await serve(res, 'shared', 'providers.js');
    if (url.pathname === '/player-ui.js') return await serve(res, 'shared', 'player-ui.js');
    if (url.pathname === '/advanced-games.js') return await serve(res, 'shared', 'advanced-games.js');
    if (url.pathname === '/lifecycle.js') return await serve(res, 'shared', 'lifecycle.js');
    if (url.pathname === '/project-workspace.js' || url.pathname === '/app.js' || url.pathname === '/preferences.js' || url.pathname === '/style.css') return await serve(res, 'apps/web', parts[0]);
    json(res, 404, { error: 'Not found' });
  } catch (error) { json(res, error.code === 'ENOENT' ? 404 : 400, { error: error.code === 'ENOENT' ? 'Not found' : error.message }); }
});
server.listen(port, '127.0.0.1', () => console.log(`Game builder: ${origin} (${isModelProvider(manager.runtime.mode) ? `${providerLabel(manager.runtime.mode)} mode; API usage is billed` : 'scripted demo; no API calls'})`));

const codeServer=createServer(async(req,res)=>{try{
  if(req.method!=='GET'||req.headers.host!==new URL(codeOrigin).host)return json(res,403,{error:'Read-only game origin'});
  const parts=decodeURIComponent(new URL(req.url,codeOrigin).pathname).split('/').filter(Boolean);
  if(parts[0]!=='preview'||parts.length<4) return json(res,404,{error:'Game asset not found'});
  const run=manager.get(parts[1]);if(run.brief.genre!=='custom'||!run.build||String(run.build.generation)!==parts[2])return json(res,404,{error:'Build unavailable'});
  await serve(res,resolve(manager.store.folder(run.id),'builds',parts[2]),parts.slice(3).join('/'),false,true);
}catch{json(res,404,{error:'Game asset not found'});}});
codeServer.listen(codePort,'127.0.0.1');
