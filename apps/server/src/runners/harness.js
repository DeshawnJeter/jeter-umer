import {codeWorkspace} from './code-workspace.js';
import {pendingProposal,reviewedRepair} from './proposal-cache.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROLES, clone, validateArtifact } from '../../../../shared/contracts/index.js';
import { makeTask } from '../../../../shared/contracts/tasks.js';
import { normalizeQuestion } from '../../../../shared/contracts/questions.js';
import { loadProfile, instructionBundle, assertRequestFits } from './instructions.js';

function toolsFor(names, input, role, artifact, calls, workspace,verifyProposal) {
  const available = {
    read_source:path=>workspace.read(path),
    search_source:query=>workspace.search(query),
    inspect_components:()=>workspace.catalog(),
    apply_source_patch:patch=>workspace.patch(patch),
    run_rule_checks:async scenarios=>{if(!verifyProposal)throw Error('Browser execution tool is not enabled for this task');return verifyProposal({source:await workspace.read(),scenarios});},
    inspect_context: () => clone(input),
    propose_artifact: proposed => { const errors = validateArtifact(role, proposed); if (errors.length) throw new Error(errors.join('; ')); return { artifact: clone(proposed) }; },
    inspect_artifact: () => clone(artifact),
    read_project_memory: (section='dependencies') => {if(!['dependencies','decisions','checkpoint','previousHandoff','references'].includes(section))throw Error('Unsupported memory section');return clone(input.context.memory?.[section]??null);}
  };
  return Object.freeze(Object.fromEntries(names.map(name => [name, (...args) => { calls.push(name); return available[name](...args); }])));
}
function assertOutputFits(output, limit) {
  const serialized = JSON.stringify(output);
  if (!serialized || serialized.length > limit) throw new Error('Agent output exceeds the configured limit or is missing');
}
export async function runPair({ role, brief, context = {}, task = makeTask(role), execution = { provider: 'scripted-demo' }, worker, checker, directory, verifyProposal, beforeStep = async () => {}, onEvent = async () => {} }) {
  if (!ROLES.includes(role) || task.role !== role) throw new Error('Unknown agent role or mismatched task');
  const profile = await loadProfile(role);
  const [workerBundle, checkerBundle] = await Promise.all([instructionBundle(role, 'worker', profile,brief), instructionBundle(role, 'checker', profile,brief)]);
  const input = { brief: clone(brief), context: clone(context), task: clone(task), execution: clone(execution) };
  assertRequestFits({ ...workerBundle, ...input }, profile.worker.maxContextChars);
  const folder = resolve(directory, role); await mkdir(folder, { recursive: true });
  const workspace=role==='coding'?codeWorkspace(folder):null;
  const questions = []; let findings = [];
  const prior=role==='coding'?await reviewedRepair(folder,{...workerBundle,...clone(input),findings:[],attempt:1,limits:{maxContextChars:profile.worker.maxContextChars,maxOutputChars:profile.worker.maxOutputChars}},profile.maxAttempts):null;
  if(prior)findings=prior.findings;
  for (let attempt = prior?.attempt??1; attempt <= profile.maxAttempts; attempt++) {
    const workerRequest = { ...workerBundle, ...clone(input), findings: clone(findings), attempt, limits: { maxContextChars: profile.worker.maxContextChars, maxOutputChars: profile.worker.maxOutputChars } };
    if(workspace&&attempt>1)workerRequest.context.previousSource=await workspace.read();
    const workerSize = assertRequestFits(workerRequest, profile.worker.maxContextChars);
    await beforeStep(); await onEvent({ role, stage: 'working', attempt });
    const workerCalls = [];
    const cached=await pendingProposal(folder,attempt,workerRequest);
    if(cached)await onEvent({role,stage:'reusing_proposal',attempt});
    const result = cached?.result||await worker({ ...clone(workerRequest), tools: toolsFor(profile.worker.tools, input, role, undefined, workerCalls, workspace,verifyProposal) });
    if(role==='coding'&&result.artifact?.source==='')result.artifact.source=await workspace.read();
    assertOutputFits(result, profile.worker.maxOutputChars);
    await writeFile(resolve(folder, `attempt-${attempt}-worker.json`), JSON.stringify({ request: workerRequest, contextChars: workerSize, toolCalls: workerCalls, result,...(cached?{reusedProposal:true,proposalRequestHash:cached.requestHash}:{}) }, null, 2));
    if (result.question) {
      const question = normalizeQuestion(result.question, role, 'worker');
      if (question.blocking) return { status: 'needs_human', question, role };
      questions.push(question);
    }
    const artifact = result.artifact; const errors = validateArtifact(role, artifact);
    if(role==='coding'&&typeof artifact?.source==='string'&&artifact.source.length<=6000)await workspace.stage(artifact.source);
    if(role==='coding'&&!errors.length){const sourceReport=await workspace.apply(artifact);errors.push(...sourceReport.findings);}
    let codeExecution;
    if(role==='coding'&&!errors.length&&verifyProposal){codeExecution=await verifyProposal(artifact);if(!codeExecution.passed)errors.push(codeExecution.error||'Code replay checks failed');}
    const checkerRequest = { ...checkerBundle, ...clone(input), ...(codeExecution?{codeExecution}:{}), artifact: clone(artifact), attempt, limits: { maxContextChars: profile.checker.maxContextChars, maxOutputChars: profile.checker.maxOutputChars } };
    const checkerSize = assertRequestFits(checkerRequest, profile.checker.maxContextChars);
    await beforeStep(); await onEvent({ role, stage: 'checking', attempt });
    const checkerCalls = [];
    const report = errors.length ? { verdict: 'fail', findings: errors, evidence: ['Shared contract validation'] } : await checker({ ...clone(checkerRequest), tools: toolsFor(profile.checker.tools, input, role, artifact, checkerCalls, workspace) });
    assertOutputFits(report, profile.checker.maxOutputChars);
    if (!['pass', 'fail', 'needs_human'].includes(report.verdict) || !Array.isArray(report.findings) || !Array.isArray(report.evidence) || !report.evidence.length || [...report.findings, ...report.evidence].some(value => typeof value !== 'string' || !value.trim())) throw new Error('Invalid checker report');
    await writeFile(resolve(folder, `attempt-${attempt}-checker.json`), JSON.stringify({ request: checkerRequest, contextChars: checkerSize, toolCalls: checkerCalls, report }, null, 2));
    await writeFile(resolve(folder, `attempt-${attempt}.json`), JSON.stringify({ artifact, report }, null, 2));
    if (report.question || report.verdict === 'needs_human') {
      const question = normalizeQuestion(report.question, role, 'checker');
      if (question.blocking) return { status: 'needs_human', question, role };
      if (report.verdict === 'needs_human') throw new Error('A needs_human verdict requires a blocking question');
      questions.push(question);
    }
    if (report.verdict === 'pass' && report.findings.length === 0) {
      await writeFile(resolve(folder, 'accepted.json'), JSON.stringify(artifact, null, 2));
      await onEvent({ role, stage: 'accepted', attempt });
      return { status: 'accepted', role, artifact, report, summary:result.summary, questions, audit: { workerHash: workerBundle.hash, checkerHash: checkerBundle.hash, workerSkills: workerBundle.skills, checkerSkills: checkerBundle.skills, execution: clone(execution) } };
    }
    findings = report.findings.length ? report.findings : ['Checker did not accept the contribution'];
    await onEvent({ role, stage: 'repair', attempt, findings });
  }
  throw new Error(`${role} exhausted its repair attempts: ${findings.join('; ')}`);
}
