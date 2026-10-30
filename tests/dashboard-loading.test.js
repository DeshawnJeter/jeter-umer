import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {GAME_TYPES} from '../shared/game-types.js';

test('dashboard module dependencies load over HTTP and expose the current game catalog',async()=>{
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const env={...process.env,PORT:String(port),GAME_BUILDER_PROVIDER:'demo',GAME_BUILDER_RUNS_DIR:await mkdtemp(join(tmpdir(),'dashboard-load-'))};delete env.OPENAI_API_KEY;
  const server=spawn(process.execPath,['apps/server/src/index.js'],{env,stdio:['ignore','pipe','pipe']});
  try{
    await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error('Dashboard server failed to start');}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Dashboard startup timed out')),15000);timer.unref();})]);
    const origin=`http://127.0.0.1:${port}`,seen=new Set();
    async function visit(path){
      if(seen.has(path))return;seen.add(path);
      const response=await fetch(origin+path);assert.equal(response.status,200,path);assert.match(response.headers.get('content-type'),/javascript/,path);
      const source=await response.text();
      for(const match of source.matchAll(/(?:import\s+(?:[^;'"\n]+?\s+from\s*)?|export\s+[^;'"\n]+?\s+from\s*)['"]([^'"]+)['"]/g)){
        const target=new URL(match[1],origin+path);assert.equal(target.origin,origin);await visit(target.pathname);
      }
    }
    await visit('/app.js');assert.ok(seen.has('/advanced-games.js'),'HUD profiles must load through the dashboard preference module');
    const catalog=await (await fetch(origin+'/api/game-catalog')).json();assert.deepEqual(catalog.map(row=>row.value),Object.keys(GAME_TYPES));
    assert.equal((await fetch(origin+'/.env/local.env')).status,404,'Serving a shared module must not expose other repository files');
    const codePort=port>65400?port-100:port+100,codeOrigin=`http://127.0.0.1:${codePort}`;
    assert.equal((await fetch(codeOrigin+'/api/runs')).status,404,'Generated-code origin must not expose workshop state');
    assert.equal((await fetch(codeOrigin+'/.env/local.env')).status,404,'Generated-code origin must not expose credentials');
    assert.equal((await fetch(codeOrigin+'/api/runs',{method:'POST'})).status,403,'Generated-code origin must reject mutations');
  }finally{server.kill();await once(server,'exit').catch(()=>{});}
});
