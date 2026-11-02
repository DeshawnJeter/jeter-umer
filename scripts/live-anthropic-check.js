import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRuntime} from '../apps/server/src/providers/runtime.js';
import {Manager} from '../apps/server/src/orchestrator/manager.js';
import {Store} from '../apps/server/src/storage/store.js';

// Explicit opt-in validation. Never imported by ordinary tests. Use synthetic
// approval only for this isolated fixture, never for a user's workshop run.
if(!process.env.ANTHROPIC_API_KEY)process.loadEnvFile('.env/local.env');
if(!process.env.ANTHROPIC_API_KEY?.trim())throw Error('No local Anthropic credential configured');
const folder=resolve('.local/anthropic-validation',new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(folder,{recursive:true});
const report={provider:'anthropic',createdAt:new Date().toISOString(),calls:[],passed:false,approvalSource:'isolated validation driver; not user approval'};
const persist=()=>writeFile(resolve(folder,'report.json'),JSON.stringify(report,null,2));
const headers={'x-api-key':process.env.ANTHROPIC_API_KEY.trim(),'anthropic-version':'2023-06-01'};
try{
  const access=await fetch('https://api.anthropic.com/v1/models',{headers,redirect:'error',signal:AbortSignal.timeout(20000)});
  report.accessStatus=access.status;await access.body?.cancel();if(!access.ok)throw Error('Anthropic access check failed (HTTP '+access.status+')');
  if(!process.argv.includes('--full')){report.passed=true;}
  else{
    const fetchImpl=async(url,options)=>{
      if(url==='https://api.anthropic.com/v1/messages/count_tokens')return fetch(url,options);
      if(url!=='https://api.anthropic.com/v1/messages')throw Error('Unexpected provider endpoint');
      if(report.calls.length>=20)throw Error('Live validation reached its 20-request limit');
      const body=JSON.parse(options.body),call={number:report.calls.length+1,model:body.model,status:'pending'};report.calls.push(call);await persist();
      const res=await fetch(url,options);call.status=res.status;const value=await res.clone().json().catch(()=>null);call.usage=value?.usage||null;call.stopReason=value?.stop_reason||null;
      if(!res.ok)call.diagnostic=String(value?.error?.message||value?.error?.type||'No provider diagnosis').replaceAll(process.env.ANTHROPIC_API_KEY,'[credential redacted]').slice(0,600);
      await persist();
      console.log('Claude validation request '+call.number+': HTTP '+res.status);return res;
    };
    const runtime=createRuntime({env:{GAME_BUILDER_PROVIDER:'anthropic',ANTHROPIC_API_KEY:process.env.ANTHROPIC_API_KEY},fetchImpl,countInputTokens:true});
    const manager=new Manager(new Store(resolve(folder,'runs')),{runtime,browserMode:'on'});await manager.initialize();
    const run=await manager.create({inputMode:'prompt',prompt:'Create a tiny original custom 2D JavaScript game called Claude Lantern Test. Beginner difficulty, moonlit forest, calm bell music. Arrow keys move. Each distinct J press lights the next lantern and adds one score; holding J must not repeat. No proximity requirement. Start health/maxHealth 4 and score 0. Three lanterns lit wins. Idle ten seconds loses and sets health to 0. Outcomes freeze gameplay; restart resets all state. Keep render nodes minimal: labeled player, three lanterns and text. Every node has x,y,size,six-digit color,label (empty string for decorations). Show health, score and lantern progress. Framework owns pause, settings and audio.'});
    report.runId=run.id;await manager.jobs.get(run.id);
    if(run.status!=='awaiting_plan')throw Error(run.error||'Validation did not reach checked plan review: '+run.status);
    report.resolved=run.brief;report.plan=run.results.planner.artifact;
    await manager.act(run.id,'approve_plan',{planHash:run.planHash,acceptUnsupported:true});await manager.jobs.get(run.id);
    report.status=run.status;report.usage=run.providerUsage;report.roles=Object.fromEntries(Object.entries(run.results).map(([role,result])=>[role,{provider:result.audit?.execution?.provider,models:result.audit?.execution?.models,verdict:result.report?.verdict}]));
    report.browserPassed=run.browserChecks?.passed===true;report.buildHash=run.build?.sha256;
    if(run.status!=='awaiting_review'||!report.browserPassed)throw Error(run.error||'Validation build did not pass browser review: '+run.status);
    if(Object.values(report.roles).some(role=>role.provider!=='anthropic'||role.verdict!=='pass'))throw Error('Missing independent Anthropic acceptance');
    report.passed=true;
  }
}catch(error){report.error=error.message.replaceAll(process.env.ANTHROPIC_API_KEY,'[credential redacted]');process.exitCode=1;}
await persist();console.log(JSON.stringify({passed:report.passed,status:report.status,error:report.error,requests:report.calls.length,report:resolve(folder,'report.json')}));
