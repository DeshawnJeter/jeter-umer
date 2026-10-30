import {isModelProvider} from '../../../../shared/providers.js';
import {bindAssets} from '../integration/asset-bindings.js';
import {Assets} from '../storage/assets.js';
import {buildBudget,estimateBuild} from '../providers/build-budget.js';
import {feedbackFor} from '../memory/feedback.js';
import {Versions} from '../storage/versions.js';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import {Projects,inheritedProjectDecisions} from '../storage/projects.js';
import { Store } from '../storage/store.js';
import { runPair } from '../runners/harness.js';
import { fingerprint, loadSystemManifest } from '../runners/instructions.js';
import { ROLES, SPECIALISTS, clone, validateBrief } from '../../../../shared/contracts/index.js';
import { makeTask } from '../../../../shared/contracts/tasks.js';
import { combineQuestion, validateAnswer } from '../../../../shared/contracts/questions.js';
import { policy, assertTransition, terminalStates } from '../../../../shared/policies/index.js';
import { buildGame, hashBuild } from '../integration/build.js';
import { validateGame, HUMAN_CHECKS } from '../validation/index.js';
import { createRuntime } from '../providers/runtime.js';
import { emptyUsage, reserveUsage, finishUsage, recoverUsage } from '../providers/usage.js';
import {ensureMemory,approveSpecification,recordDecision,checkpointMemory,acceptMemory,invalidateMemory,readMemory,recordTests,assertCurrentMemory} from '../memory/project.js';
import {activeRoles,dependenciesFor} from '../../../../shared/specialists.js';
import {runProjectRules} from '../specialists/rules-tests.js';
import {humanChecksFor} from '../../../../shared/lifecycle.js';
import {runBrowserSmoke,assertBrowserInstalled} from '../validation/browser-smoke.js';
import {inspectWholeGame,requiresInGameHud} from '../validation/whole-game-acceptance.js';
import {changedRoles} from './change-scope.js';
import {runCodeChecks,lossDeadlineForBrief} from '../validation/code-checks.js';
import {frameworkConfig} from '../integration/framework.js';

export class Manager {
  constructor(store = new Store(), { router, runtime = createRuntime(),browserRunner=runBrowserSmoke,browserMode=process.env.GAME_BUILDER_BROWSER_QA||'on' } = {}) {
    if(!['on','off'].includes(browserMode))throw Error('Invalid browser QA mode');this.browserRunner=browserRunner;this.browserMode=browserMode;
    this.store = store; this.projects=new Projects(store.root); this.versions=new Versions(store.root,this.projects);this.assets=new Assets(store.root,this.projects); this.router = router; this.runtime = runtime; this.controllers = new Map(); this.runs = new Map(); this.jobs = new Map(); this.writes = new Map(); this.actions = new Map();this.usageWaiters=new Map();
  }
  async initialize() {
    for (const run of await this.store.list()) {
      run.decisions ??= {}; run.tasks ??= {}; run.planApproval ??= null; run.planHash ??= null;
      run.browserQaMode??=this.browserMode;
      if(!run.projectId){try{await this.projects.get(run.id);}catch(error){if(error.code!=='ENOENT')throw error;await this.projects.create(run.brief.title,run.id);}run.projectId=run.id;}
      ensureMemory(run);
      for(const role of ROLES)if(run.results?.[role]&&!run.memory.artifacts[role])acceptMemory(run,role,run.results[role],role==='planner'?[]:['planner']);
      if (run.providerUsage) recoverUsage(run.providerUsage);
      if (run.version !== 2 && !terminalStates.has(run.status)) {
        invalidateMemory(run,ROLES,'Legacy run requires fresh checked work');
        run.status = 'paused'; run.generation++; run.results = {}; run.agents = {}; run.questions = []; run.build = null; run.validation = null;
        run.events.push({ at: new Date().toISOString(), message: 'Upgraded unfinished run. Resume to rebuild with checked prompts and human plan approval.' });
      } else if (run.status === 'running' || run.status === 'queued') {
        run.status = 'paused'; run.events.push({ at: new Date().toISOString(), message: 'Server restarted. Resume from saved accepted artifacts and questions.' });
      }
      run.version = 2; await this.store.save(run); await this.projects.record(run); this.runs.set(run.id, run);
    }
  }
  save(run) {
    const snapshot = clone(run); const prior = this.writes.get(run.id) || Promise.resolve();
    const next = prior.catch(() => {}).then(async () => {await this.store.save(snapshot);if(snapshot.projectId)await this.projects.record(snapshot);}); this.writes.set(run.id, next); return next;
  }
  async event(run, message) { run.events.push({ at: new Date().toISOString(), message }); await this.save(run); }
  transition(run, next) { assertTransition(run.status, next); run.status = next; }
  get(id) { const run = this.runs.get(id); if (!run) throw new Error('Run not found'); return run; }
  async manifest() {
    const instructions = await loadSystemManifest();
    return { ...instructions, runtime: clone(this.runtime.publicConfig),browserQaMode:this.browserMode, hash: fingerprint({ instructions: instructions.hash, runtime: this.runtime.publicConfig,browserQaMode:this.browserMode }) };
  }
  assertRuntime(run) {
    if (run.mode !== this.runtime.mode || (run.providerConfig && fingerprint(run.providerConfig) !== fingerprint(this.runtime.publicConfig))) throw new Error('Restart with this run’s provider/model configuration, or create a new run. Providers never switch silently.');
  }
  async reserveCall(run, estimate) {
    for(;;){
    if (run.status !== 'running') { const error = new Error('Run suspended'); error.suspended = true; throw error; }
    try { reserveUsage(run.providerUsage, {...run.providerConfig,...run.budgetLimits}, estimate); }
    catch (error) {
      if(error.budgetPending){await this.waitForUsage(run);continue;}
      if (error.budgetExhausted) { this.transition(run, 'stopped'); this.controllers.get(run.id)?.abort(); await this.event(run, error.message); error.suspended = true; }
      throw error;
    }
    await this.save(run);return;
    }
  }
  notifyUsage(id){for(const wake of [...(this.usageWaiters.get(id)||[])])wake();}
  waitForUsage(run){
    const signal=this.controllers.get(run.id)?.signal;
    if(signal?.aborted||run.status!=='running'){const error=Error('Run suspended');error.suspended=true;throw error;}
    return new Promise(resolve=>{let waiters=this.usageWaiters.get(run.id);if(!waiters){waiters=new Set();this.usageWaiters.set(run.id,waiters);}const wake=()=>{waiters.delete(wake);if(!waiters.size)this.usageWaiters.delete(run.id);signal?.removeEventListener('abort',wake);resolve();};waiters.add(wake);signal?.addEventListener('abort',wake,{once:true});});
  }
  async create(brief,options={}) {
    const budgetLimits=buildBudget(this.runtime.publicConfig,brief.budgetLimits||{});
    const project=brief.projectId?await this.projects.get(brief.projectId):await this.projects.create(validateBrief(brief).title);
    const projectHistory=this.projects.context(project),inherited=inheritedProjectDecisions(project);
    const run = { version: 2, id: randomUUID(), projectId:project.id, projectHistory, assetSelection:clone(project.assetSelection||{}),budgetLimits, costEstimate:estimateBuild(this.runtime.publicConfig,validateBrief(brief)), parentVersionId:options.parentVersionId||null,changeRequest:options.changeRequest||null,initialSource:options.initialSource||null,acceptanceCases:clone(project.acceptanceCases||[]), createdAt: new Date().toISOString(), mode: this.runtime.mode, providerConfig: clone(this.runtime.publicConfig), providerUsage: isModelProvider(this.runtime.mode) ? emptyUsage() : null, brief: validateBrief(brief), instructions: await this.manifest(), status: 'queued', steps: 0, generation: 0, agents: {}, tasks: {}, results: {}, questions: [], answers: [], decisions: Object.fromEntries(inherited.map(d=>[d.key,d.answer])), events: [], planHash: null, planApproval: null, build: null, validation: null };
    run.maxSteps=policy.maxSteps;run.browserQaMode=this.browserMode;ensureMemory(run);run.memory.decisions=clone(inherited);this.runs.set(run.id, run); await this.save(run); this.transition(run, 'running'); await this.save(run); this.launch(run); return run;
  }
  launch(run) {
    if (this.jobs.has(run.id)) return;
    this.controllers.set(run.id, new AbortController());
    const job = Promise.resolve().then(() => this.drive(run)).catch(async error => {
      if (!terminalStates.has(run.status)) { run.status = 'failed'; run.error = error.message; await this.event(run, error.message); }
    }).finally(() => { this.jobs.delete(run.id); this.controllers.delete(run.id); });
    this.jobs.set(run.id, job);
  }
  async checkpoint(run) {
    if (run.status !== 'running') { const error = new Error('Run suspended'); error.suspended = true; throw error; }
    if (run.steps >= policy.maxSteps) { this.transition(run, 'stopped'); await this.event(run, 'Step budget exhausted. Run remains unfinished.'); const error = new Error('Budget exhausted'); error.suspended = true; throw error; }
    run.steps++; await this.save(run);
  }
  blocked(run, role) { return run.questions.some(question => question.blocking && (question.affectedRoles.includes(role) || question.affectedRoles.includes('planner'))); }
  async addQuestion(run, question) {
    if (Object.hasOwn(run.decisions, question.key)) throw new Error(`Question ${question.key} was already answered. Consult shared decisions instead of asking again.`);
    const existing = run.questions.find(item => item.key === question.key);
    if (existing) combineQuestion(existing, question);
    else run.questions.push({ ...clone(question), id: randomUUID(), generation: run.generation });
    if (question.blocking) for (const role of invalidateMemory(run,question.affectedRoles,'Blocking human context required')) { delete run.results[role]; if (run.tasks[role]) run.tasks[role].status = 'blocked'; }
    await this.event(run, `${question.requesters[0].role} needs human context: ${question.text}`);
  }
  invalidate(run, roles) {
    const affected = invalidateMemory(run,roles.includes('planner') ? ROLES : roles);
    for (const role of affected) { delete run.results[role]; delete run.agents[role]; delete run.tasks[role]; }
    run.generation++; run.build = null; run.validation = null;run.browserChecks=null; delete run.approval;
    if (affected.includes('planner')) { run.planHash = null; run.planApproval = null; if(run.brief.inputMode==='prompt')run.briefResolution=null; }
  }
  providerHooks(run,role) {
    return {
      signal: this.controllers.get(run.id)?.signal,
      reserve: estimate => this.reserveCall(run, estimate),
      finish: async (usage, estimate) => {
        finishUsage(run.providerUsage, usage, estimate);
        run.roleUsage??={};const counters=run.roleUsage[role]??={calls:0,inputTokens:0,outputTokens:0,totalTokens:0,unknownUsageCalls:0};counters.calls++;
        if(usage){counters.inputTokens+=usage.inputTokens;counters.outputTokens+=usage.outputTokens;counters.totalTokens+=usage.totalTokens;}else counters.unknownUsageCalls++;
        try{await this.save(run);}finally{this.notifyUsage(run.id);}
      },
      onAttempt: async audit => {
        run.modelResponses ??= [];
        run.modelResponses.push({ ...audit, generation:run.generation, at:new Date().toISOString() });
        if(audit.toolUse&&['reads','edits','tests'].includes(audit.toolUse.category)){
          run.roleToolUsage??={};const tools=run.roleToolUsage[role]??={reads:0,edits:0,tests:0,progress:0};
          tools[audit.toolUse.category]++;if(audit.toolUse.progress)tools.progress++;
          if(audit.toolUse.kind)tools.policy={kind:audit.toolUse.kind,actionLimit:audit.toolUse.actionLimit,maxActions:audit.toolUse.maxActions,extended:audit.toolUse.extended,stopReason:audit.toolUse.stopReason};
        }
        if (audit.outcome === 'invalid_output') await this.event(run, `${role} ${audit.stage}: response format rejected (${audit.code}, request ${audit.attempt}); bounded repair applies.`);
        else if (audit.outcome === 'accepted' && audit.attempt > 1) await this.event(run, `${role} ${audit.stage}: response format recovered on request ${audit.attempt}.`);
        else if(audit.toolUse)await this.event(run,`${role}: ${audit.toolUse.category} tool ${audit.toolUse.success?'completed':'failed'}${audit.toolUse.extended?' · repair allowance extended after measured progress':''}${audit.toolUse.stopReason?' · '+audit.toolUse.stopReason.replaceAll('_',' '):''}`);
        else await this.save(run);
      }
    };
  }
  async execute(run, role) {
    if (run.results[role] || this.blocked(run, role)) return;
    const projectAssets=run.projectId&&['ui','art','audio'].includes(role)?(await this.projects.get(run.projectId)).assets||[]:[];
    const unresolvedFeedback=run.projectId?feedbackFor(await this.projects.get(run.projectId),role):[];
    const handlers = this.router ? await this.router(role) : await this.runtime.route(role, this.providerHooks(run,role));
    const task = makeTask(role, run.generation);
    if (role !== 'planner') task.dependencies = [...dependenciesFor(role,run.brief.genre).map(parent=>run.tasks[parent]?.id||`${run.generation}:${parent}`), 'human:plan-approval'];
    run.tasks[role] = { ...task, status: 'running' };
    const execution = { provider: this.runtime.mode, ...(isModelProvider(this.runtime.mode) ? { models: clone(this.runtime.publicConfig.models[role]) } : {}) };
    const memoryDependencies=dependenciesFor(role,run.brief.genre);
    const dependencyHashes=Object.fromEntries(memoryDependencies.map(parent=>[parent,run.memory.artifacts[parent].hash]));
    const result = await runPair({ role, task, execution, brief: run.brief, context: { ...(unresolvedFeedback.length?{unresolvedFeedback}:{}),...(projectAssets.length?{projectAssets:projectAssets.map(({id,name,kind,width,height,license})=>({id,name,kind,width,height,license}))}:{}),...(run.acceptanceCases?.length?{independentAcceptance:run.acceptanceCases.map(c=>({name:c.name,assertions:c.assertions}))}:{}),...(run.changeRequest?{changeRequest:clone(run.changeRequest)}:{}),...(role==='coding'&&run.initialSource?{previousSource:run.initialSource,seedOwnedSource:true}:{}),...(['planner','story'].includes(role)&&run.projectHistory&&(run.projectHistory.priorRuns.length||run.projectHistory.priorSpecification||run.projectHistory.decisions.length)?{projectHistory:clone(run.projectHistory)}:{}),...(run.lastBrowserFailure?{browserFeedback:clone(run.lastBrowserFailure)}:{}),memory:readMemory(run,role,memoryDependencies),...(role === 'planner' ? {} : { plan: run.results.planner.artifact }), decisions: clone(run.decisions), ...(run.briefResolution?{promptResolution:{assumptions:run.briefResolution.proposal.assumptions,unsupportedRequests:run.briefResolution.proposal.unsupportedRequests}}:{}) }, ...handlers,
      directory: resolve(this.store.folder(run.id), 'workspaces', `generation-${run.generation}`), ...(role==='coding'?{verifyProposal:async artifact=>{const report=await runCodeChecks(artifact,this.controllers.get(run.id)?.signal,{lossDeadlineSeconds:lossDeadlineForBrief(run.brief),acceptanceCases:run.acceptanceCases||[]});recordTests(run,'code-worker',report);return report;}}:{}), beforeStep: () => this.checkpoint(run),
      onEvent: async event => { checkpointMemory(run,role,event);run.agents[role] = event; await this.event(run, `${role}: ${event.stage} (attempt ${event.attempt})`); } });
    if (run.status !== 'running') return;
    // Revalidate the complete handoff chain after asynchronous worker/checker
    // execution, including changes to result payloads or checker acceptance.
    let dependenciesCurrent=true;
    try{for(const parent of memoryDependencies)assertCurrentMemory(run,parent);}catch{dependenciesCurrent=false;}
    if(!dependenciesCurrent||task.generation!==run.generation||memoryDependencies.some(parent=>run.memory.artifacts[parent]?.hash!==dependencyHashes[parent])){checkpointMemory(run,role,{stage:'stale',attempt:run.agents[role]?.attempt||1});await this.event(run,`${role}: stale in-flight contribution discarded; dependency changed`);return;}
    if (result.status === 'needs_human') {
      await this.addQuestion(run, result.question); run.agents[role].stage = 'awaiting_human'; run.tasks[role].status = 'blocked'; await this.save(run); return;
    }
    for (const question of result.questions || []) await this.addQuestion(run, question);
    if (this.blocked(run, role)) { run.tasks[role].status = 'blocked'; return; }
    run.results[role] = result;acceptMemory(run,role,result,memoryDependencies);if(role==='qa')recordTests(run,'qa-rules',runProjectRules(frameworkConfig(run.brief.genre,Object.fromEntries(Object.entries(run.results).map(([name,value])=>[name,value.artifact]))))); run.tasks[role].status = 'accepted'; await this.save(run);
  }
  async drive(run) {
    try {
      if (run.status !== 'running') return;
      this.assertRuntime(run);
      if(run.browserQaMode==='on'&&this.browserRunner===runBrowserSmoke)await assertBrowserInstalled();
      const instructions = await this.manifest();
      if (run.instructions && run.instructions.hash !== instructions.hash) {
        this.invalidate(run, ROLES); run.questions = [];
        await this.event(run, 'Instructions or profiles changed. Prior results and approvals require fresh checks.');
      }
      run.instructions = instructions;
      // Resumed runs can reuse checked work only while both stored copies and
      // the independent acceptance of every ancestor still agree.
      for(const role of Object.keys(run.results))assertCurrentMemory(run,role);
      if(run.brief.inputMode==='prompt'&&!run.briefResolution){
        const resolution=await this.runtime.resolveBrief({brief:clone(run.brief),decisions:clone(run.decisions),hooks:this.providerHooks(run,'planner'),directory:resolve(this.store.folder(run.id),'workspaces',`generation-${run.generation}`),beforeStep:()=>this.checkpoint(run),onEvent:async event=>{run.agents.planner={role:'planner',...event};await this.event(run,`Planner: ${event.stage.replaceAll('_',' ')} (attempt ${event.attempt})`);}});
        if(run.status!=='running')return;
        const resolved=validateBrief({...resolution.proposal,prompt:run.brief.prompt,inputMode:'manual'});
        run.brief={...resolved,inputMode:'prompt'};run.briefResolution=resolution;await this.save(run);
      }
      await this.execute(run, 'planner'); if (run.status !== 'running') return;
      run.requiredRoles=activeRoles(run.brief.genre);
      run.minimumModelCalls=run.requiredRoles.length*2+(run.briefResolution?2:0);
      if (!run.results.planner) { this.transition(run, 'awaiting_human'); await this.save(run); return; }
      const planHash = fingerprint({ brief: run.brief, plan: run.results.planner.artifact, instructions: run.instructions.hash, briefResolution:run.briefResolution || null,acceptanceCases:run.acceptanceCases||[] }); run.planHash = planHash;
      if (run.planApproval?.hash !== planHash) { this.transition(run, 'awaiting_plan'); await this.event(run, 'Checked plan ready. Human approval is required before implementation.'); return; }
      if(isModelProvider(run.mode)&&(run.budgetLimits?.maxCalls||run.providerConfig.maxCalls)-run.providerUsage.calls<run.requiredRoles.filter(role=>!run.results[role]).length*2){this.transition(run,'stopped');await this.event(run,'Remaining model call budget cannot cover every required worker/checker pair. Create a run with an explicitly configured budget; limits were not increased.');return;}
      const required=activeRoles(run.brief.genre).filter(role=>role!=='planner');
      while(required.some(role=>!run.results[role])) {
        const ready=required.filter(role=>!run.results[role]&&!this.blocked(run,role)&&dependenciesFor(role,run.brief.genre).every(parent=>run.results[parent]));
        if(!ready.length)break;
        const outcomes = await Promise.allSettled(ready.slice(0,policy.concurrency).map(role => this.execute(run, role)));
        const failure = outcomes.find(outcome => outcome.status === 'rejected' && !outcome.reason.suspended);
        if (failure) throw failure.reason;
        if (run.status !== 'running') return;
      }
      if (run.questions.some(question => question.blocking) || required.some(role => !run.results[role])) {
        this.transition(run, 'awaiting_human'); await this.event(run, 'Independent ready tasks finished. Waiting for context needed by blocked roles.'); return;
      }
      await this.checkpoint(run);
      const config = frameworkConfig(run.brief.genre??'collector',Object.fromEntries(Object.entries(run.results).map(([role,result])=>[role,result.artifact])));
      if(config.genre==='custom'){
        const rules=runProjectRules(config);recordTests(run,'qa-rules',rules);
        if(!rules.passed)throw Error('Automatic integration rule checks failed');
      }
      const copyAssets=await bindAssets(this,run,config);
      run.validation = validateGame(config);
      recordTests(run,'static-integration',run.validation);
      if (!run.validation.passed) throw new Error(`Integration failed: ${run.validation.findings.join('; ')}`);
      await this.event(run, 'Static integration checks passed. Building playable preview.');
      const folder = resolve(this.store.folder(run.id), 'builds', String(run.generation));
      await buildGame(folder, config);await copyAssets(folder);const sha256=await hashBuild(folder); if (run.status !== 'running') return;
      run.build = { generation: run.generation, sha256, url: `${run.brief.genre==='custom'?`http://127.0.0.1:${Number(process.env.GAME_BUILDER_CODE_PREVIEW_PORT)||((Number(process.env.PORT)||3000)>65400?(Number(process.env.PORT)||3000)-100:(Number(process.env.PORT)||3000)+100)}`:''}/preview/${run.id}/${run.generation}/index.html`, checksRequired: humanChecksFor(run.brief.genre) };
      if(run.browserQaMode==='on'){
        await this.event(run,'Running isolated browser smoke checks against the delivered build.');
        const report=await this.browserRunner({folder,config,buildHash:sha256,reportFolder:resolve(this.store.folder(run.id),'browser-checks',`generation-${run.generation}`),signal:this.controllers.get(run.id)?.signal,acceptanceCases:run.acceptanceCases||[]});
        if(run.status!=='running')return;
        report.acceptance=inspectWholeGame(report,sha256,config.genre,run.acceptanceCases||[]);report.passed=report.acceptance.passed;report.fullPlaythrough=report.acceptance.fullPlaythrough;if(!report.passed&&!report.error)report.error=report.acceptance.findings.join('; ').slice(0,600);
        run.browserChecks=report;recordTests(run,'browser-smoke',report);await this.save(run);
        if(!report.passed||report.buildHash!==sha256||await hashBuild(folder)!==sha256)throw Error('Browser QA failed: '+(report.error||'The delivered game did not pass current-build smoke checks'));
      }else{run.browserChecks={scope:'browser-smoke',buildHash:sha256,browserTested:false,passed:null,reason:'Browser QA explicitly disabled; manual playtesting is required'};await this.save(run);}
      await this.versions.capture(run,folder);
      this.transition(run, 'awaiting_review'); await this.event(run, 'Ready for human playtest. Static checks do not prove browser behavior.');
    } catch (error) { if (!error.suspended) throw error; }
  }
  act(id, action, data = {}) {
    const prior = this.actions.get(id) || Promise.resolve();
    const next = prior.catch(() => {}).then(() => this.applyAction(id, action, clone(data)));
    this.actions.set(id, next); return next;
  }
  async applyAction(id, action, data) {
    const run = this.get(id);
    if (action === 'cancel') { this.transition(run, 'cancelled'); this.controllers.get(id)?.abort(); await this.event(run, 'Human cancelled the run'); return run; }
    if (action === 'pause') { this.transition(run, 'paused'); this.controllers.get(id)?.abort(); await this.event(run, 'Human paused the run'); return run; }
    await this.jobs.get(id);
    this.assertRuntime(run);
    if(action==='retry_delivery'){
      if(run.status!=='failed'||!run.build||!run.validation?.passed||!run.browserChecks?.passed)throw Error('Only an already validated delivery can retry saving');
      if(run.browserQaMode==='on'&&!inspectWholeGame(run.browserChecks,run.build.sha256,run.brief.genre,run.acceptanceCases||[],{inGameHud:requiresInGameHud(run)}).passed)throw Error('Current build needs whole-game browser checks before retrying delivery');
      if((await this.manifest()).hash!==run.instructions.hash)throw Error('Instructions changed; revise the build before retrying delivery');
      const folder=resolve(this.store.folder(id),'builds',String(run.build.generation));
      if(await hashBuild(folder)!==run.build.sha256||run.browserChecks.buildHash!==run.build.sha256)throw Error('Delivered bytes or browser evidence changed');
      await this.versions.capture(run,folder);delete run.error;this.transition(run,'running');this.transition(run,'awaiting_review');await this.event(run,'Saved the already validated delivery without repeating model requests. Human playtesting remains required.');return run;
    }
    if(action==='retry'){
      if(run.status!=='failed'||run.build)throw Error('Only interrupted agent work can retry; delivered builds require a revision');
      if(/ exhausted its repair attempts:/.test(run.error||''))throw Error('Repair attempts are exhausted. Review a new plan before starting another task; prior attempt evidence is retained.');
      delete run.error;this.transition(run,'running');await this.event(run,'Retrying interrupted agent work within remaining budgets; accepted contributions are retained.');this.launch(run);return run;
    }
    if (action === 'resume') {
      if (run.status !== 'paused') throw new Error('Only paused runs can resume');
      this.transition(run, 'running'); await this.save(run); this.launch(run); return run;
    }
    if (action === 'approve_plan') {
      if (run.status !== 'awaiting_plan' || !run.planHash || data.planHash !== run.planHash) throw new Error('Approve the current checked plan');
      if ((await this.manifest()).hash !== run.instructions.hash) throw new Error('Instructions changed. Revise the plan before approving.');
      if(run.briefResolution?.proposal.unsupportedRequests.length&&data.acceptUnsupported!==true)throw new Error('Acknowledge the unsupported requests before approving the supported plan, or edit the prompt/settings.');
      run.planApproval = { hash: run.planHash, at: new Date().toISOString(), source: 'human', ...(run.briefResolution?.proposal.unsupportedRequests.length?{unsupportedAcknowledged:true}:{}) };
      approveSpecification(run);
      if(run.restoredFrom&&run.build){run.status='awaiting_review';await this.event(run,'Human approved restored plan; playtest this exact restored build');return run;}
      this.transition(run, 'running'); await this.event(run, 'Human approved the checked plan'); this.launch(run); return run;
    }
    if (action === 'answer') {
      if (!['awaiting_human', 'awaiting_review', 'awaiting_plan'].includes(run.status)) throw new Error('No human response is expected');
      const question = run.questions.find(item => item.id === data.questionId);
      if (!question) throw new Error('Choose a current question; it may already have been answered');
      const answer = validateAnswer(question, data.answer);
      if (question.key === 'brief.difficulty') { if (!['beginner', 'experienced'].includes(answer)) throw new Error('Invalid difficulty'); run.brief.difficulty = answer; }
      run.decisions[question.key] = answer;
      run.answers.push({ question: clone(question), answer, at: new Date().toISOString() });
      recordDecision(run,question.key,answer,question);
      run.questions = run.questions.filter(item => item.id !== question.id);
      this.invalidate(run, question.affectedRoles);
      this.transition(run, 'running'); await this.event(run, 'Human answer saved. Only affected contributions require fresh work.'); this.launch(run); return run;
    }
    if (action === 'revise' || action === 'revise_plan') {
      if (!['awaiting_plan', 'awaiting_review','failed'].includes(run.status)) throw new Error('Revisions require a checked plan, failed run or reviewable build');
      delete run.error;
      if(run.browserChecks?.passed===false)run.lastBrowserFailure={buildHash:run.browserChecks.buildHash,generation:run.generation,reason:run.browserChecks.error||'Browser acceptance failed',failedChecks:(run.browserChecks.tests||[]).filter(check=>!check.passed).map(check=>({name:check.name,error:check.error||''}))};
      const updated = validateBrief({ ...run.brief, ...data, inputMode:data.inputMode ?? 'manual' });
      if (updated.inputMode!=='prompt'&&!updated.difficulty) throw new Error('Select difficulty for the revision');
      const affected=changedRoles(run.brief,updated);
      run.brief = updated; run.questions = [];
      if (Object.hasOwn(run.decisions, 'brief.difficulty')) run.decisions['brief.difficulty'] = updated.difficulty;
      // Failed builds need fresh integration/QA even when settings did not change.
      this.invalidate(run, affected.length?affected:['implementation','integration','qa']);
      run.revisionScope={generation:run.generation,reusedRoles:activeRoles(run.brief.genre).filter(role=>run.results[role]),rerunRoles:activeRoles(run.brief.genre).filter(role=>!run.results[role])};
      run.planHash=null;run.planApproval=null;run.memory.specification=null;
      this.transition(run, 'running'); await this.event(run, 'Human revised requirements. Unchanged checked contributions are retained; plan and build approvals require renewal.'); this.launch(run); return run;
    }
    if (action === 'approve') {
      if(run.browserQaMode==='on'&&!inspectWholeGame(run.browserChecks,run.build?.sha256,run.brief.genre,run.acceptanceCases||[],{inGameHud:requiresInGameHud(run)}).passed)throw Error('Current build must pass whole-game browser checks before human approval');
      if (run.status !== 'awaiting_review' || !run.planApproval || run.planApproval.hash !== run.planHash || run.questions.some(question => question.blocking) || !run.validation?.passed || data.sha256 !== run.build?.sha256 || humanChecksFor(run.brief.genre).some(key => data.checks?.[key] !== true)) throw new Error('Playtest every required item and approve the current build');
      if ((await this.manifest()).hash !== run.instructions.hash) throw new Error('Instructions changed. Revise the plan before approving.');
      if (await hashBuild(resolve(this.store.folder(id), 'builds', String(run.build.generation))) !== run.build.sha256) throw new Error('Build changed since validation. Rebuild before approval.');
      run.approval = { sha256: run.build.sha256, checks: clone(data.checks), at: new Date().toISOString(), source: 'human-attestation' };
      await this.versions.capture(run,resolve(this.store.folder(run.id),'builds',String(run.build.generation)));await this.versions.approve(run);
      this.transition(run, 'complete'); await this.event(run, 'Human approved this exact build after playtesting'); return run;
    }
    throw new Error('Unknown action');
  }
}
