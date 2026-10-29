import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
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

export class Manager {
  constructor(store = new Store(), { router, runtime = createRuntime(),browserRunner=runBrowserSmoke,browserMode=process.env.GAME_BUILDER_BROWSER_QA||'on' } = {}) {
    if(!['on','off'].includes(browserMode))throw Error('Invalid browser QA mode');this.browserRunner=browserRunner;this.browserMode=browserMode;
    this.store = store; this.router = router; this.runtime = runtime; this.controllers = new Map(); this.runs = new Map(); this.jobs = new Map(); this.writes = new Map(); this.actions = new Map();
  }
  async initialize() {
    for (const run of await this.store.list()) {
      run.decisions ??= {}; run.tasks ??= {}; run.planApproval ??= null; run.planHash ??= null;
      run.browserQaMode??=this.browserMode;
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
      run.version = 2; await this.store.save(run); this.runs.set(run.id, run);
    }
  }
  save(run) {
    const snapshot = clone(run); const prior = this.writes.get(run.id) || Promise.resolve();
    const next = prior.catch(() => {}).then(() => this.store.save(snapshot)); this.writes.set(run.id, next); return next;
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
    if (run.status !== 'running') { const error = new Error('Run suspended'); error.suspended = true; throw error; }
    try { reserveUsage(run.providerUsage, run.providerConfig, estimate); }
    catch (error) {
      if (error.budgetExhausted) { this.transition(run, 'stopped'); this.controllers.get(run.id)?.abort(); await this.event(run, error.message); error.suspended = true; }
      throw error;
    }
    await this.save(run);
  }
  async create(brief) {
    const run = { version: 2, id: randomUUID(), createdAt: new Date().toISOString(), mode: this.runtime.mode, providerConfig: clone(this.runtime.publicConfig), providerUsage: this.runtime.mode === 'openai' ? emptyUsage() : null, brief: validateBrief(brief), instructions: await this.manifest(), status: 'queued', steps: 0, generation: 0, agents: {}, tasks: {}, results: {}, questions: [], answers: [], decisions: {}, events: [], planHash: null, planApproval: null, build: null, validation: null };
    run.maxSteps=policy.maxSteps;run.browserQaMode=this.browserMode;ensureMemory(run);this.runs.set(run.id, run); await this.save(run); this.transition(run, 'running'); await this.save(run); this.launch(run); return run;
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
      finish: async (usage, estimate) => { finishUsage(run.providerUsage, usage, estimate); await this.save(run); },
      onAttempt: async audit => {
        run.modelResponses ??= [];
        run.modelResponses.push({ ...audit, generation:run.generation, at:new Date().toISOString() });
        if (audit.outcome === 'invalid_output') await this.event(run, `${role} ${audit.stage}: response format rejected (${audit.code}, request ${audit.attempt}); bounded repair applies.`);
        else if (audit.outcome === 'accepted' && audit.attempt > 1) await this.event(run, `${role} ${audit.stage}: response format recovered on request ${audit.attempt}.`);
        else await this.save(run);
      }
    };
  }
  async execute(run, role) {
    if (run.results[role] || this.blocked(run, role)) return;
    const handlers = this.router ? await this.router(role) : await this.runtime.route(role, this.providerHooks(run,role));
    const task = makeTask(role, run.generation);
    if (role !== 'planner') task.dependencies = [...dependenciesFor(role,run.brief.genre).map(parent=>run.tasks[parent]?.id||`${run.generation}:${parent}`), 'human:plan-approval'];
    run.tasks[role] = { ...task, status: 'running' };
    const execution = { provider: this.runtime.mode, ...(this.runtime.mode === 'openai' ? { models: clone(this.runtime.publicConfig.models[role]) } : {}) };
    const memoryDependencies=dependenciesFor(role,run.brief.genre);
    const dependencyHashes=Object.fromEntries(memoryDependencies.map(parent=>[parent,run.memory.artifacts[parent].hash]));
    const result = await runPair({ role, task, execution, brief: run.brief, context: { ...(run.lastBrowserFailure?{browserFeedback:clone(run.lastBrowserFailure)}:{}),memory:readMemory(run,role,memoryDependencies),...(role === 'planner' ? {} : { plan: run.results.planner.artifact }), decisions: clone(run.decisions), ...(run.briefResolution?{promptResolution:{assumptions:run.briefResolution.proposal.assumptions,unsupportedRequests:run.briefResolution.proposal.unsupportedRequests}}:{}) }, ...handlers,
      directory: resolve(this.store.folder(run.id), 'workspaces', `generation-${run.generation}`), beforeStep: () => this.checkpoint(run),
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
    run.results[role] = result;acceptMemory(run,role,result,memoryDependencies);if(role==='qa')recordTests(run,'qa-rules',runProjectRules({...Object.fromEntries(Object.entries(run.results).map(([name,value])=>[name,value.artifact])),genre:run.brief.genre})); run.tasks[role].status = 'accepted'; await this.save(run);
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
      const planHash = fingerprint({ brief: run.brief, plan: run.results.planner.artifact, instructions: run.instructions.hash, briefResolution:run.briefResolution || null }); run.planHash = planHash;
      if (run.planApproval?.hash !== planHash) { this.transition(run, 'awaiting_plan'); await this.event(run, 'Checked plan ready. Human approval is required before implementation.'); return; }
      if(run.mode==='openai'&&run.providerConfig.maxCalls-run.providerUsage.calls<run.requiredRoles.filter(role=>!run.results[role]).length*2){this.transition(run,'stopped');await this.event(run,'Remaining model call budget cannot cover every required worker/checker pair. Create a run with an explicitly configured budget; limits were not increased.');return;}
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
      const config = { ...Object.fromEntries(Object.entries(run.results).map(([role, result]) => [role, result.artifact])), genre: run.brief.genre ?? 'collector' };
      run.validation = validateGame(config);
      recordTests(run,'static-integration',run.validation);
      if (!run.validation.passed) throw new Error(`Integration failed: ${run.validation.findings.join('; ')}`);
      await this.event(run, 'Static integration checks passed. Building playable preview.');
      const folder = resolve(this.store.folder(run.id), 'builds', String(run.generation));
      const sha256 = await buildGame(folder, config); if (run.status !== 'running') return;
      run.build = { generation: run.generation, sha256, url: `/preview/${run.id}/${run.generation}/index.html`, checksRequired: humanChecksFor(run.brief.genre) };
      if(run.browserQaMode==='on'){
        await this.event(run,'Running isolated browser smoke checks against the delivered build.');
        const report=await this.browserRunner({folder,config,buildHash:sha256,reportFolder:resolve(this.store.folder(run.id),'browser-checks',`generation-${run.generation}`),signal:this.controllers.get(run.id)?.signal});
        if(run.status!=='running')return;
        run.browserChecks=report;recordTests(run,'browser-smoke',report);await this.save(run);
        if(!report.passed||report.buildHash!==sha256||await hashBuild(folder)!==sha256)throw Error('Browser QA failed: '+(report.error||'The delivered game did not pass current-build smoke checks'));
      }else{run.browserChecks={scope:'browser-smoke',buildHash:sha256,browserTested:false,passed:null,reason:'Browser QA explicitly disabled; manual playtesting is required'};await this.save(run);}
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
      run.brief = updated; run.questions = [];
      if (Object.hasOwn(run.decisions, 'brief.difficulty')) run.decisions['brief.difficulty'] = updated.difficulty;
      this.invalidate(run, ROLES);
      this.transition(run, 'running'); await this.event(run, 'Human revised requirements. Plan approval and final approval require renewal.'); this.launch(run); return run;
    }
    if (action === 'approve') {
      if(run.browserQaMode==='on'&&(!run.browserChecks?.passed||run.browserChecks.buildHash!==run.build?.sha256))throw Error('Current build must pass browser checks before human approval');
      if (run.status !== 'awaiting_review' || !run.planApproval || run.planApproval.hash !== run.planHash || run.questions.some(question => question.blocking) || !run.validation?.passed || data.sha256 !== run.build?.sha256 || humanChecksFor(run.brief.genre).some(key => data.checks?.[key] !== true)) throw new Error('Playtest every required item and approve the current build');
      if ((await this.manifest()).hash !== run.instructions.hash) throw new Error('Instructions changed. Revise the plan before approving.');
      if (await hashBuild(resolve(this.store.folder(id), 'builds', String(run.build.generation))) !== run.build.sha256) throw new Error('Build changed since validation. Rebuild before approval.');
      run.approval = { sha256: run.build.sha256, checks: clone(data.checks), at: new Date().toISOString(), source: 'human-attestation' };
      this.transition(run, 'complete'); await this.event(run, 'Human approved this exact build after playtesting'); return run;
    }
    throw new Error('Unknown action');
  }
}
