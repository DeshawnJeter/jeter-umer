import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Store } from '../storage/store.js';
import { runPair } from '../runners/harness.js';
import { route } from '../router/index.js';
import { SPECIALISTS, clone, validateBrief } from '../../../../shared/contracts/index.js';
import { policy, assertTransition, terminalStates } from '../../../../shared/policies/index.js';
import { buildGame, hashBuild } from '../integration/build.js';
import { validateGame, HUMAN_CHECKS } from '../validation/index.js';

export class Manager {
  constructor(store = new Store()) { this.store = store; this.runs = new Map(); this.jobs = new Map(); this.writes = new Map(); }
  async initialize() {
    for (const run of await this.store.list()) {
      // In-flight operations cannot be assumed successful after a process restart.
      if (run.status === 'running' || run.status === 'queued') { run.status = 'paused'; run.events.push({ at: new Date().toISOString(), message: 'Server restarted. Resume to continue from accepted artifacts.' }); await this.store.save(run); }
      this.runs.set(run.id, run);
    }
  }
  save(run) {
    const snapshot = clone(run); const prior = this.writes.get(run.id) || Promise.resolve();
    const next = prior.catch(() => {}).then(() => this.store.save(snapshot)); this.writes.set(run.id, next); return next;
  }
  async event(run, message) { run.events.push({ at: new Date().toISOString(), message }); await this.save(run); }
  transition(run, next) { assertTransition(run.status, next); run.status = next; }
  get(id) { const run = this.runs.get(id); if (!run) throw new Error('Run not found'); return run; }
  async create(brief) {
    const run = { id: randomUUID(), createdAt: new Date().toISOString(), mode: 'scripted-demo', brief: validateBrief(brief), status: 'queued', steps: 0, generation: 0, agents: {}, results: {}, questions: [], answers: [], events: [], build: null, validation: null };
    this.runs.set(run.id, run); await this.save(run); this.transition(run, 'running'); await this.save(run); this.launch(run); return run;
  }
  launch(run) {
    if (this.jobs.has(run.id)) return;
    const job = this.drive(run).catch(async error => {
      if (!terminalStates.has(run.status)) { run.status = 'failed'; run.error = error.message; await this.event(run, error.message); }
    }).finally(() => this.jobs.delete(run.id));
    this.jobs.set(run.id, job);
  }
  async checkpoint(run) {
    if (run.status !== 'running') { const error = new Error('Run suspended'); error.suspended = true; throw error; }
    if (run.steps >= policy.maxSteps) { this.transition(run, 'stopped'); await this.event(run, 'Step budget exhausted. Run remains unfinished.'); const error = new Error('Budget exhausted'); error.suspended = true; throw error; }
    run.steps++; await this.save(run);
  }
  async execute(run, role) {
    if (run.results[role]) return;
    const handlers = await route(role);
    const result = await runPair({ role, brief: run.brief, context: role === 'planner' ? {} : { plan: run.results.planner.artifact }, ...handlers,
      directory: resolve(this.store.folder(run.id), 'workspaces', `generation-${run.generation}`), beforeStep: () => this.checkpoint(run),
      onEvent: async event => { run.agents[role] = event; await this.event(run, `${role}: ${event.stage} (attempt ${event.attempt})`); } });
    if (run.status !== 'running') return;
    if (result.status === 'needs_human') {
      run.questions = [{ id: randomUUID(), role, text: result.question, options: ['beginner', 'experienced'] }];
      this.transition(run, 'awaiting_human'); await this.event(run, `${role} needs human context`); return;
    }
    run.results[role] = result; await this.save(run);
  }
  async drive(run) {
    try {
      await this.execute(run, 'planner'); if (run.status !== 'running') return;
      for (let i = 0; i < SPECIALISTS.length; i += policy.concurrency) {
        const outcomes = await Promise.allSettled(SPECIALISTS.slice(i, i + policy.concurrency).map(role => this.execute(run, role)));
        const failure = outcomes.find(outcome => outcome.status === 'rejected' && !outcome.reason.suspended);
        if (failure) throw failure.reason;
        if (run.status !== 'running') return;
      }
      await this.checkpoint(run);
      const config = Object.fromEntries(Object.entries(run.results).map(([role, result]) => [role, result.artifact]));
      run.validation = validateGame(config);
      if (!run.validation.passed) throw new Error(`Integration failed: ${run.validation.findings.join('; ')}`);
      await this.event(run, 'Static integration checks passed. Building playable preview.');
      const folder = resolve(this.store.folder(run.id), 'builds', String(run.generation));
      const sha256 = await buildGame(folder, config);
      if (run.status !== 'running') return;
      run.build = { generation: run.generation, sha256, url: `/preview/${run.id}/${run.generation}/index.html`, checksRequired: HUMAN_CHECKS };
      this.transition(run, 'awaiting_review'); await this.event(run, 'Ready for human playtest. Static checks do not prove browser behavior.');
    } catch (error) { if (!error.suspended) throw error; }
  }
  async act(id, action, data = {}) {
    const run = this.get(id);
    if (action === 'cancel') { this.transition(run, 'cancelled'); await this.event(run, 'Human cancelled the run'); return run; }
    if (action === 'pause') { this.transition(run, 'paused'); await this.event(run, 'Human paused the run'); return run; }
    if (action === 'resume') {
      if (run.status !== 'paused') throw new Error('Only paused runs can resume');
      await this.jobs.get(id); this.transition(run, 'running'); await this.save(run); this.launch(run); return run;
    }
    if (action === 'answer') {
      if (run.status !== 'awaiting_human' || !['beginner', 'experienced'].includes(data.answer)) throw new Error('Choose beginner or experienced');
      await this.jobs.get(id); run.brief.difficulty = data.answer;
      run.answers.push({ question: run.questions[0], answer: data.answer, at: new Date().toISOString() }); run.questions = [];
      this.transition(run, 'running'); await this.event(run, 'Human answer saved to shared context'); this.launch(run); return run;
    }
    if (action === 'revise') {
      if (run.status !== 'awaiting_review') throw new Error('Revisions require a reviewable build');
      await this.jobs.get(id);
      if (!['beginner', 'experienced'].includes(data.difficulty)) throw new Error('Select difficulty for the revision');
      run.brief.difficulty = data.difficulty; run.brief.music = data.music === true;
      run.generation++; run.results = {}; run.agents = {}; run.build = null; run.validation = null;
      this.transition(run, 'running'); await this.event(run, 'Human revised difficulty/audio. Prior checks and approval are invalidated.'); this.launch(run); return run;
    }
    if (action === 'approve') {
      if (run.status !== 'awaiting_review' || !run.validation?.passed || data.sha256 !== run.build?.sha256 || HUMAN_CHECKS.some(key => data.checks?.[key] !== true)) throw new Error('Playtest every required item and approve the current build');
      if (await hashBuild(resolve(this.store.folder(id), 'builds', String(run.build.generation))) !== run.build.sha256) throw new Error('Build changed since validation. Rebuild before approval.');
      run.approval = { sha256: run.build.sha256, checks: clone(data.checks), at: new Date().toISOString(), source: 'human-attestation' };
      this.transition(run, 'complete'); await this.event(run, 'Human approved this exact build after playtesting'); return run;
    }
    throw new Error('Unknown action');
  }
}
