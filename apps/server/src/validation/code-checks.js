import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile,cp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {resolve,sep,extname,join} from 'node:path';
import {codeScenarios} from '../../../../shared/code-game.js';
import {fingerprint} from '../runners/instructions.js';
import {checkCode} from '../runners/code-workspace.js';
let queue=Promise.resolve();
export function runCodeChecks(artifact,signal){const job=queue.catch(()=>{}).then(()=>execute(artifact,signal));queue=job.catch(()=>{});return job;}
async function execute(artifact,signal){
  const report={passed:false,sourceHash:fingerprint(artifact),scope:'isolated-browser-worker',browserTested:false,tests:[]};
  const syntax=checkCode(artifact);if(syntax.verdict!=='pass')return {...report,error:syntax.findings.join('; ')};
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
    const {chromium}=await import('playwright');browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true,args:['--disable-background-networking'],env:Object.fromEntries(Object.entries(process.env).filter(([key,value])=>typeof value==='string'&&!/^(OPENAI_|AWS_|GH_|GITHUB_|CODEX_)/.test(key)))});
    const context=await browser.newContext({serviceWorkers:'block'});await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(origin+'/index.html');report.browserTested=true;
    report.tests=await page.evaluate(async cases=>{
      const {CodeClient}=await import('./code-client.js');const tests=[];
      for(const c of cases){const client=new CodeClient();try{
        const initial=await client.request('inspect');if(initial.phase!=='ready')throw Error('New game must be ready');
        let state=await client.request('start');if(state.phase!=='playing')throw Error('Start must enter gameplay');
        for(const step of c.steps)for(let n=0;n<(step.repeat??1);n++)state=await client.request('step',{dt:step.dt,input:step.input});
        if(state.phase!==c.expect)throw Error('Expected '+c.expect+', observed '+state.phase);
        const frozen=await client.request('step',{dt:0.1,input:{right:true,attack:true}});if(JSON.stringify(frozen)!==JSON.stringify(state))throw Error('Terminal rules continue changing');
        const reset=await client.request('reset');if(JSON.stringify(reset)!==JSON.stringify(initial))throw Error('Restart did not reset rules');
        tests.push({name:c.name,passed:true,phase:state.phase});
      }finally{client.dispose();}}
      return tests;
    },codeScenarios(artifact.scenarios));
    report.passed=report.tests.every(t=>t.passed);
  }catch(error){report.error=String(error.message).slice(0,400);report.tests.push({name:'code execution',passed:false,error:report.error});}
  finally{clearTimeout(deadline);signal?.removeEventListener('abort',abort);await browser?.close().catch(()=>{});if(server)await new Promise(resolve=>server.close(resolve));if(folder&&resolve(folder).startsWith(resolve(tmpdir())+sep)&&resolve(folder).startsWith(resolve(tmpdir(),'game-rules-')))await rm(folder,{recursive:true,force:true});}
  return report;
}
