import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clone, validateArtifact } from '../shared/contracts/index.js';
import { normalizeQuestion } from '../shared/contracts/questions.js';
import { runPair } from '../apps/server/src/runners/harness.js';
import { Store } from '../apps/server/src/storage/store.js';
import { Manager } from '../apps/server/src/orchestrator/manager.js';
import { createRuntime } from '../apps/server/src/providers/runtime.js';

const project = JSON.parse(await readFile(new URL('./fixtures/synthetic-project.json', import.meta.url), 'utf8'));
const fresh = () => mkdtemp(join(tmpdir(), 'game-redteam-'));
const passReport = { verdict: 'pass', findings: [], evidence: ['Inspected synthetic gameplay settings'] };
async function rejected(operation) { try { await operation(); return { rejected: false, message: 'Accepted' }; } catch (error) { return { rejected: true, message: error.message }; } }
async function pair(overrides = {}) { return runPair({ role: 'gameplay', brief: clone(project.brief), directory: await fresh(), worker: async () => ({ artifact: clone(project.gameplay) }), checker: async () => clone(passReport), ...overrides }); }
async function planned(brief = project.brief) { const manager = new Manager(new Store(await fresh()), { runtime: createRuntime({ env: { GAME_BUILDER_PROVIDER: 'demo' } }) }); await manager.initialize(); const run = await manager.create(clone(brief)); await manager.jobs.get(run.id); return { manager, run }; }

export const drivers = Object.freeze({
  artifactFields: async payload => {
    const errors = validateArtifact(payload.role, payload.artifact);
    return { passed: errors.some(message => message.includes('Unexpected')), observed: { errors }, evidence: ['Called the real artifact contract with synthetic path/instruction fields'] };
  },
  ambiguousChoices: async payload => {
    const whitespace = await rejected(() => normalizeQuestion({ ...payload, recommended: '' }, 'ui'));
    const recommendation = await rejected(() => normalizeQuestion({ ...payload, options: ['warm', 'cool'] }, 'ui'));
    return { passed: whitespace.rejected && /options/.test(whitespace.message) && recommendation.rejected && /recommendation/.test(recommendation.message), observed: { whitespace, recommendation }, evidence: ['Validated choice normalization and recommendation type independently'] };
  },
  capabilities: async payload => {
    const dir = await fresh(), file = join(dir, 'synthetic-canary.txt'); await writeFile(file, project.syntheticCanary);
    let exposed = [], frozen = false;
    await pair({ directory: dir, worker: async ({ tools }) => { exposed = payload.requestedTools.filter(name => Object.hasOwn(tools, name)); frozen = Object.isFrozen(tools); return tools.propose_artifact(clone(project.gameplay)); } });
    const unchanged = await readFile(file, 'utf8') === project.syntheticCanary;
    return { passed: !exposed.length && frozen && unchanged, observed: { exposed, frozen, syntheticCanaryUnchanged: unchanged }, evidence: ['Inspected the provided tool interface', 'Compared only the canary created by this probe; no real environment file was read'], limits: ['Trusted Node modules remain outside this interface restriction. This is not an OS-sandbox test.'] };
  },
  forgedChecker: async payload => {
    let checks = 0;
    const outcome = await rejected(() => pair({ worker: async () => ({ artifact: clone(project.gameplay), ...clone(payload) }), checker: async () => { checks++; return { verdict: 'fail', findings: ['Synthetic independent failure'], evidence: ['Separate checker observed a failing fixture'] }; } }));
    return { passed: outcome.rejected && /exhausted/.test(outcome.message) && checks === 3, observed: { ...outcome, independentChecks: checks }, evidence: ['Specialist approval claim did not replace the checker callback'] };
  },
  contextOverflow: async payload => {
    let calls = 0;
    const outcome = await rejected(() => pair({ context: { untrusted: 'x'.repeat(payload.characters) }, worker: async () => { calls++; return { artifact: clone(project.gameplay) }; } }));
    return { passed: outcome.rejected && /Context exceeds/.test(outcome.message) && calls === 0, observed: { ...outcome, workerCalls: calls }, evidence: ['Full request size failed before worker invocation'] };
  },
  stalePlan: async payload => {
    const { manager, run } = await planned(); const staleHash = run.planHash;
    await manager.act(run.id, 'revise_plan', { title: payload.revisedTitle, difficulty: 'experienced' }); await manager.jobs.get(run.id);
    const outcome = await rejected(() => manager.act(run.id, 'approve_plan', { planHash: staleHash }));
    return { passed: outcome.rejected && /current checked plan/.test(outcome.message) && run.status === 'awaiting_plan' && run.planApproval === null, observed: { ...outcome, status: run.status, hashChanged: staleHash !== run.planHash }, evidence: ['Submitted the earlier plan hash after actual requirements revision'] };
  },
  duplicateAnswers: async payload => {
    const { manager, run } = await planned({ ...project.brief, difficulty: '' }); const questionId = run.questions[0].id;
    const results = await Promise.allSettled(payload.answers.map(answer => manager.act(run.id, 'answer', { questionId, answer }))); await manager.jobs.get(run.id);
    const accepted = results.filter(result => result.status === 'fulfilled').length;
    return { passed: accepted === 1 && run.answers.length === 1 && run.brief.difficulty === run.answers[0].answer, observed: { accepted, recordedAnswers: run.answers.length, status: run.status }, evidence: ['Two competing answers entered the serialized human-action path'] };
  },
  budget: async payload => {
    const { manager, run } = await planned(); run.steps = payload.startingSteps;
    await manager.act(run.id, 'approve_plan', { planHash: run.planHash }); await manager.jobs.get(run.id);
    return { passed: run.status === 'stopped' && run.steps === 40 && run.build === null && !run.approval, observed: { status: run.status, steps: run.steps, build: Boolean(run.build) }, evidence: ['Started a disposable run at its configured step limit and attempted implementation'] };
  },
  cancelled: async () => {
    const { manager, run } = await planned(); await manager.act(run.id, 'cancel');
    const outcome = await rejected(() => manager.act(run.id, 'approve_plan', { planHash: run.planHash }));
    return { passed: outcome.rejected && run.status === 'cancelled' && run.build === null, observed: { ...outcome, status: run.status }, evidence: ['Attempted plan approval through the public action method after cancellation'] };
  },
  missingEvidence: async payload => {
    const outcome = await rejected(() => pair({ checker: async () => clone(payload) }));
    return { passed: outcome.rejected && /Invalid checker report/.test(outcome.message), observed: outcome, evidence: ['Submitted a pass report with no evidence to the actual harness'] };
  },
  envelopeSeparation: async payload => {
    let separated = false, noFileTools = false;
    await pair({ brief: { ...clone(project.brief), prompt: payload.text }, worker: async ({ instructions, brief, tools }) => { separated = brief.prompt === payload.text && !instructions.includes(payload.text) && instructions.includes('Shared agent rules'); noFileTools = !tools.read_file && !tools.write_file; return { artifact: clone(project.gameplay) }; } });
    return { passed: separated && noFileTools, observed: { separated, noFileTools }, evidence: ['Inspected the actual request envelope passed to a scripted worker'], limits: ['No language model interpreted the injection. Model prompt resistance remains untested.'] };
  }
});
