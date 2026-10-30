import {browserEnvironment} from './browser-environment.js';
import {validateAcceptanceCases} from '../../../../shared/acceptance-cases.js';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile,cp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {resolve,sep,extname,join} from 'node:path';
import {codeScenarios} from '../../../../shared/code-game.js';
import {fingerprint} from '../runners/instructions.js';
import {checkCode} from '../runners/code-workspace.js';
let queue=Promise.resolve();
export function lossDeadlineForBrief(brief){const match=brief?.prompt?.match(/\bdoing nothing (?:must|should|will) lose within (\d+(?:\.\d+)?)\s*(?:s\b|seconds?\b)/i);const value=match?Number(match[1]):null;return value>0&&value<=30?value:null;}
export function runCodeChecks(artifact,signal,options={}){const job=queue.catch(()=>{}).then(()=>execute(artifact,signal,options));queue=job.catch(()=>{});return job;}
async function execute(artifact,signal,{lossDeadlineSeconds=null,acceptanceCases=[]}={}){
  acceptanceCases=validateAcceptanceCases(acceptanceCases);
  const report={passed:false,sourceHash:fingerprint(artifact),scope:'isolated-browser-worker',browserTested:false,tests:[]};
  const syntax=checkCode(artifact,{sourceOnly:true});if(syntax.verdict!=='pass')return {...report,error:syntax.findings.join('; ')};
  let cases=[];try{cases=codeScenarios(artifact.scenarios);}catch(error){report.tests.push({name:'replay structure',passed:false,error:error.message});}
  let browser,server,folder;const abort=()=>browser?.close().catch(()=>{});const deadline=setTimeout(abort,20000);deadline.unref();signal?.addEventListener('abort',abort,{once:true});
  try{
    if(signal?.aborted)throw Error('Code check cancelled');
    folder=await mkdtemp(join(tmpdir(),'game-rules-'));await mkdir(resolve(folder,'generated'));
    await writeFile(resolve(folder,'generated','rules.js'),artifact.source);
    for(const file of ['code-worker.js','code-client.js'])await cp(resolve('templates/browser-game',file),resolve(folder,file));
    await cp(resolve('shared/code-game.js'),resolve(folder,'code-game.js'));
    server=createServer(async(req,res)=>{try{
      const relative=new URL(req.url,'http://127.0.0.1').pathname.slice(1),path=resolve(folder,relative),origin='http://'+req.headers.host;
      if(req.method!=='GET'||!path.startsWith(folder+sep)||relative.includes('..'))throw Error('Outside game');
      res.writeHead(200,{'Content-Type':extname(path)==='.js'?'text/javascript':'text/html','Content-Security-Policy':`default-src 'none'; script-src ${origin}; worker-src ${relative==='code-worker.js'?"'none'":origin}; connect-src 'none'`});res.end(relative==='index.html'?'<!doctype html><title>Isolated rules check</title>':await readFile(path));
    }catch{res.writeHead(404);res.end();}});
    await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});const origin=`http://127.0.0.1:${server.address().port}`;
    const {chromium}=await import('playwright');browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true,args:['--disable-background-networking'],env:browserEnvironment()});
    const context=await browser.newContext({serviceWorkers:'block'});await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(origin+'/index.html');report.browserTested=true;
    const executed=await page.evaluate(async ({cases,lossDeadlineSeconds,acceptanceCases})=>{
      const {CodeClient}=await import('./code-client.js');const tests=[];
      const enter=async client=>{
        const initial=await client.request('inspect');if(initial.phase!=='ready')throw Error('New createGame(api) instance must be ready, before start() is called.');
        const state=await client.request('start');if(state.phase!=='playing')throw Error('game.start() is called without keyboard input before any update. It must immediately set phase to playing; observed '+state.phase+'. Do not bind start to a reset that leaves phase ready.');
        return {initial,state};
      };
      const lifecycle=new CodeClient();try{await enter(lifecycle);tests.push({name:'Start without input',passed:true});}
      catch(error){tests.push({name:'Start without input',passed:false,error:error.message});return {tests,cases};}finally{lifecycle.dispose();}
      for(const c of cases){const client=new CodeClient();try{
        let {initial,state}=await enter(client);
        let frames=0,elapsed=0,extra=0;
        const idle=c.steps.every(step=>Object.values(step.input).every(value=>value===false));
        const deadlineApplies=c.expect==='lost'&&idle&&Number.isFinite(lossDeadlineSeconds)&&lossDeadlineSeconds>0&&lossDeadlineSeconds<=30;
        for(const step of c.steps)for(let n=0;n<(step.repeat??1);n++){
          if(deadlineApplies&&elapsed+step.dt>lossDeadlineSeconds+1e-8&&state.phase!=='lost')throw Error('Idle loss did not occur within the approved '+lossDeadlineSeconds+' seconds; observed '+state.phase+'.');
          state=await client.request('step',{dt:step.dt,input:step.input});frames++;elapsed+=step.dt;
        }
        if(c.expect==='lost'&&state.phase==='playing'&&idle&&Number.isFinite(lossDeadlineSeconds)&&lossDeadlineSeconds>0&&lossDeadlineSeconds<=30){
          while(state.phase==='playing'&&frames+extra<300&&elapsed+0.1<=lossDeadlineSeconds+1e-8){state=await client.request('step',{dt:0.1,input:{}});elapsed+=0.1;extra++;}
          if(state.phase==='lost'&&extra){c.steps.push({dt:0.1,input:{},repeat:extra});}
        }
        if(state.phase!==c.expect)throw Error('Expected '+c.expect+', observed '+state.phase+' after '+c.steps.reduce((sum,step)=>sum+(step.repeat??1),0)+' frames. Replay input starts AFTER game.start(), not before it.');
        const frozen=await client.request('step',{dt:0.1,input:{right:true,attack:true}});if(JSON.stringify(frozen)!==JSON.stringify(state))throw Error('Terminal rules continue changing');
        const reset=await client.request('reset');if(JSON.stringify(reset)!==JSON.stringify(initial))throw Error('Restart did not reset rules');
        tests.push({name:c.name,passed:true,phase:state.phase,frames:frames+extra,elapsedSeconds:Math.round(elapsed*1000)/1000,...(extra?{originalFrames:frames,continuationFrames:extra,approvedLossDeadlineSeconds:lossDeadlineSeconds}:{})});
      }catch(error){tests.push({name:c.name,passed:false,error:error.message});}finally{client.dispose();}}
      for(const c of acceptanceCases){const client=new CodeClient();try{let {state}=await enter(client);for(const step of c.steps)for(let i=0;i<step.repeat;i++)state=await client.request('step',{dt:step.dt,input:Object.fromEntries(step.actions.map(action=>[action,true]))});for(const a of c.assertions){const value=a.field==='nodes'?state.nodes.length:a.field==='label'?state.nodes.map(n=>n.label):state[a.field];if(!(a.field==='label'?value.includes(a.value):a.op==='eq'?value===a.value:a.op==='gte'?value>=a.value:value<=a.value))throw Error(a.field+' '+a.op+' '+a.value+' failed: observed '+value);}tests.push({name:'Independent: '+c.name,passed:true,source:'human-project-requirement'});}catch(error){tests.push({name:'Independent: '+c.name,passed:false,error:error.message,source:'human-project-requirement'});}finally{client.dispose();}}
      return {tests,cases};
    },{cases,lossDeadlineSeconds,acceptanceCases});
    report.tests.push(...executed.tests);
    report.passed=report.tests.every(test=>test.passed);
    if(report.passed&&report.tests.some(test=>test.continuationFrames)){report.originalArtifactHash=report.sourceHash;report.effectiveScenarios=JSON.stringify(executed.cases);codeScenarios(report.effectiveScenarios);report.sourceHash=fingerprint({...artifact,scenarios:report.effectiveScenarios});}
    if(!report.passed)report.error=report.tests.filter(test=>!test.passed).map(test=>test.error).join('; ').slice(0,1500);
  }catch(error){report.error=String(error.message).slice(0,400);report.tests.push({name:'code execution',passed:false,error:report.error});}
  finally{clearTimeout(deadline);signal?.removeEventListener('abort',abort);await browser?.close().catch(()=>{});if(server)await new Promise(resolve=>server.close(resolve));if(folder&&resolve(folder).startsWith(resolve(tmpdir())+sep)&&resolve(folder).startsWith(resolve(tmpdir(),'game-rules-')))await rm(folder,{recursive:true,force:true});}
  return report;
}
