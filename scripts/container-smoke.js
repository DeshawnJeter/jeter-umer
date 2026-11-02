// Disposable CI fixture only: no local environment files, user projects or model calls.
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve,sep} from 'node:path';
import {randomBytes} from 'node:crypto';import {request} from 'node:http';
import {passwordHash} from '../apps/server/src/deployment/control.js';
const name='workshop-ci-'+randomBytes(6).toString('hex'),volume=name+'-data',root=await mkdtemp(join(tmpdir(),'workshop-container-')),envFile=join(root,'fixture.env'),image='workshop-deployment-check';
const appOrigin='https://workshop.example',previewOrigin='https://games.example.net',password=randomBytes(24).toString('base64url'),recoveredName=name+'-recovered';let created=false,volumeCreated=false,recoveredCreated=false;
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:2000000}).trim();
const sleep=ms=>new Promise(yes=>setTimeout(yes,ms));
async function rpc(port,path,{method='GET',headers={},data,host=new URL(appOrigin).host}={}){return new Promise((yes,no)=>{const req=request({hostname:'127.0.0.1',port,path,method,headers:{Host:host,...headers}},res=>{const chunks=[];res.on('data',d=>chunks.push(d));res.on('end',()=>{const text=Buffer.concat(chunks).toString();let value;try{value=JSON.parse(text);}catch{}yes({status:res.statusCode,headers:res.headers,value});});});req.on('error',no);req.setTimeout(10000,()=>req.destroy(Error('Container HTTP timeout')));req.end(data===undefined?undefined:JSON.stringify(data));});}
async function ready(port){for(let i=0;i<240;i++){try{if((await rpc(port,'/healthz')).status===200)return;}catch{}await sleep(250);}throw Error('Container did not become healthy');}
try{
 docker('version','--format','{{.Server.Version}}');
 if(spawnSync('docker',['volume','inspect',volume],{stdio:'ignore'}).status===0)throw Error('Refusing to reuse an existing fixture volume');
 docker('volume','create','--label','workshop-fixture='+name,volume);volumeCreated=true;
 await writeFile(envFile,`NODE_ENV=production\nPORT=10000\nWORKSHOP_DATA_DIR=/var/data/workshop\nWORKSHOP_PUBLIC_ORIGIN=${appOrigin}\nWORKSHOP_PREVIEW_ORIGIN=${previewOrigin}\nWORKSHOP_PASSWORD_HASH=${await passwordHash(password)}\nWORKSHOP_SESSION_SECRET=${randomBytes(32).toString('hex')}\nWORKSHOP_BACKUP_KEY=${randomBytes(32).toString('hex')}\nGAME_BUILDER_PROVIDER=demo\nGAME_BUILDER_BROWSER_QA=on\n`,{mode:0o600});
 docker('run','--detach','--name',name,'--mount',`type=volume,src=${volume},dst=/var/data`,'--publish','127.0.0.1::10000','--env-file',envFile,image);created=true;
 const getPort=(container=name)=>Number(docker('inspect','--format','{{(index (index .NetworkSettings.Ports "10000/tcp") 0).HostPort}}',container));let port=getPort();await ready(port);
 const uid=docker('exec',name,'cat','/proc/1/status').match(/^Uid:\s+(\d+)/m)?.[1];if(uid!=='1000')throw Error('Application is not running as the unprivileged node user');
 const lock=spawnSync('docker',['run','--rm','--mount',`type=volume,src=${volume},dst=/var/data`,'--env-file',envFile,image,'node','-e','process.exit(0)'],{encoding:'utf8'});if(lock.status!==1)throw Error('Concurrent container writer was not rejected');
 if((await rpc(port,'/api/runs')).status!==401)throw Error('Unauthenticated API access was not rejected');
 const signed=await rpc(port,'/auth/login',{method:'POST',headers:{Origin:appOrigin,'Content-Type':'application/json'},data:{password}});if(signed.status!==200)throw Error('Container sign-in failed');const cookie=signed.headers['set-cookie'][0].split(';')[0],session=await rpc(port,'/auth/session',{headers:{Cookie:cookie}}),headers={Cookie:cookie,Origin:appOrigin,'Content-Type':'application/json','X-Workshop-CSRF':session.value.csrf};
 const project=await rpc(port,'/api/projects',{method:'POST',headers,data:{title:'Disposable container fixture'}});if(project.status!==201)throw Error('Container project creation failed');
 const createdRun=await rpc(port,'/api/runs',{method:'POST',headers,data:{title:'Container collector',prompt:'Collect stars then reach the exit.',genre:'collector',difficulty:'beginner',music:true,projectId:project.value.id}});if(createdRun.status!==201)throw Error('Container run creation failed');const id=createdRun.value.id;
 async function status(target){for(let i=0;i<1200;i++){const r=await rpc(port,'/api/runs/'+id,{headers});if(r.value?.status===target)return r.value;if(['failed','stopped'].includes(r.value?.status))throw Error('Container fixture build failed: '+r.value.error);await sleep(250);}throw Error('Container fixture build timed out');}
 const plan=await status('awaiting_plan');
 // This explicit fixture-driver approval applies only to the disposable demo plan.
 if((await rpc(port,'/api/runs/'+id+'/approve_plan',{method:'POST',headers,data:{planHash:plan.planHash}})).status!==200)throw Error('Fixture plan approval failed');
 const run=await status('awaiting_review');if(!run.browserChecks?.passed||run.approval)throw Error('Container build lacks browser evidence or fabricated human approval');const preview=new URL(run.build.url);if(preview.origin!==previewOrigin||(await rpc(port,preview.pathname,{host:preview.host})).status!==200)throw Error('Isolated container preview failed');
 if((await rpc(port,'/api/runs',{host:new URL(previewOrigin).host})).status!==404)throw Error('Preview origin exposed the workshop API');
 docker('restart','-t','30',name);port=getPort();await ready(port);let saved=await rpc(port,'/api/projects/'+project.value.id,{headers});if(saved.status!==200||saved.value.versions.length!==1)throw Error('Game version did not persist across graceful restart');
 docker('kill',name);docker('start',name);port=getPort();await ready(port);saved=await rpc(port,'/api/projects/'+project.value.id,{headers});if(saved.status!==200||saved.value.versions.length!==1)throw Error('Storage lock or data recovery failed after unclean restart');
 const latest=docker('exec',name,'node','-e',"const fs=require('fs');console.log(fs.readdirSync('/var/data/workshop/backups').filter(n=>!n.startsWith('.')).sort().at(-1))");if(!/^\d{4}-\d\d-\d\dT[\da-fTZ-]+$/.test(latest))throw Error('Missing valid encrypted recovery snapshot');docker('stop','-t','30',name);
 docker('run','--rm','--mount',`type=volume,src=${volume},dst=/var/data`,'--env-file',envFile,'--env','WORKSHOP_DATA_DIR=/var/data/restored',image,'node','scripts/restore-workshop.js','/var/data/workshop/backups/'+latest,'/var/data/restored');
 docker('run','--detach','--name',recoveredName,'--mount',`type=volume,src=${volume},dst=/var/data`,'--publish','127.0.0.1::10000','--env-file',envFile,'--env','WORKSHOP_DATA_DIR=/var/data/restored',image);recoveredCreated=true;port=getPort(recoveredName);await ready(port);
 if((await rpc(port,'/api/projects',{headers})).status!==401)throw Error('Disaster restore did not revoke old sessions');const newLogin=await rpc(port,'/auth/login',{method:'POST',headers:{Origin:appOrigin,'Content-Type':'application/json'},data:{password}});if(newLogin.status!==200)throw Error('Restored workshop cannot sign in');const newCookie=newLogin.headers['set-cookie'][0].split(';')[0];saved=await rpc(port,'/api/projects/'+project.value.id,{headers:{Cookie:newCookie}});if(saved.status!==200||saved.value.versions.length!==1)throw Error('Encrypted restore did not preserve the game version');
 console.log('Container checks passed: unprivileged startup, one writer, sign-in, demo agents/browser QA, isolated preview, persisted version, graceful restart, crash recovery and encrypted disaster restore with revoked sessions. No paid model calls or human game approval.');
}finally{
 if(recoveredCreated)spawnSync('docker',['rm','--force',recoveredName],{stdio:'ignore'});
 if(created)spawnSync('docker',['rm','--force',name],{stdio:'ignore'});
 if(volumeCreated&&/^workshop-ci-[a-f0-9]{12}-data$/.test(volume))spawnSync('docker',['volume','rm',volume],{stdio:'ignore'});
 if(resolve(root).startsWith(resolve(tmpdir())+sep)&&root.includes('workshop-container-'))await rm(root,{recursive:true,force:true});
}
