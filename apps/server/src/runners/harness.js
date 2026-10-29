import {codeWorkspace,checkCode} from './code-workspace.js';
import {pendingProposal,reviewedRepair} from './proposal-cache.js';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROLES, clone, validateArtifact } from '../../../../shared/contracts/index.js';
import { makeTask } from '../../../../shared/contracts/tasks.js';
import { normalizeQuestion } from '../../../../shared/contracts/questions.js';
import { loadProfile, instructionBundle, assertRequestFits, fingerprint } from './instructions.js';

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
async function reviewVerifiedCandidate({prior,role,input,profile,workerBundle,checkerBundle,workspace,folder,checker,beforeStep,onEvent}){
  const artifact=clone(prior.artifact),codeExecution=prior.codeExecution,attempt=profile.maxAttempts;
  artifact.scenarios=codeExecution.effectiveScenarios;
  if(validateArtifact(role,artifact).length||checkCode(artifact).verdict!=='pass'||fingerprint(artifact)!==codeExecution.sourceHash||artifact.source!==await workspace.read())throw Error('Verified candidate does not match the owned source');
  const request={...checkerBundle,...clone(input),artifact:clone(artifact),codeExecution,attempt,limits:{maxContextChars:profile.checker.maxContextChars,maxOutputChars:profile.checker.maxOutputChars}};
  const reviewKey=fingerprint({artifact,brief:input.brief,decisions:input.context.decisions,plan:input.context.plan,execution:input.execution,checkerHash:checkerBundle.hash});
  try{const saved=JSON.parse(await readFile(resolve(folder,'revalidated-proposal-checker.json'),'utf8'));if(saved.reviewKey===reviewKey&&saved.report.verdict==='fail')throw Error('This verified candidate was already rejected by its independent checker. Change the source or requirements before another review.');}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
  assertRequestFits(request,profile.checker.maxContextChars);await beforeStep();await onEvent({role,stage:'checking_revalidated_proposal',attempt});
  const calls=[],report=await checker({...clone(request),tools:toolsFor(profile.checker.tools,input,role,artifact,calls,workspace)});
  assertOutputFits(report,profile.checker.maxOutputChars);
  if(!['pass','fail','needs_human'].includes(report.verdict)||!Array.isArray(report.findings)||!Array.isArray(report.evidence)||!report.evidence.length||[...report.findings,...report.evidence].some(value=>typeof value!=='string'||!value.trim()))throw Error('Invalid checker report');
  await writeFile(resolve(folder,'revalidated-proposal-checker.json'),JSON.stringify({reviewKey,originalWorkerAudit:'attempt-'+attempt+'-worker.json',request,report,toolCalls:calls},null,2));
  if(report.question||report.verdict==='needs_human'){const question=normalizeQuestion(report.question,role,'checker');if(question.blocking)return {status:'needs_human',role,question};}
  if(report.verdict!=='pass'||report.findings.length)throw Error('Existing coding proposal did not pass independent review: '+report.findings.join('; '));
  if(artifact.source!==await workspace.read())throw Error('Owned source changed during independent review');
  await writeFile(resolve(folder,'accepted.json'),JSON.stringify(artifact,null,2));await onEvent({role,stage:'accepted',attempt});
  return {status:'accepted',role,artifact,report,questions:[],summary:'Existing real-model source revalidated with an audited idle replay continuation, then independently reviewed.',audit:{workerHash:workerBundle.hash,checkerHash:checkerBundle.hash,workerSkills:workerBundle.skills,checkerSkills:checkerBundle.skills,execution:clone(input.execution),revalidatedProposal:true,originalWorkerAttempt:attempt,verificationHash:fingerprint(codeExecution)}};
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
  if(prior){
    findings=prior.findings;
    if(prior.codeExecution?.passed===false&&verifyProposal){
      prior.source=await workspace.read();prior.artifact={...prior.artifact,source:prior.source};
      await onEvent({role,stage:'rechecking_saved_source',attempt:prior.attempt});
      const refreshed=await verifyProposal(prior.artifact);await writeFile(resolve(folder,'repair-preflight-'+prior.attempt+'.json'),JSON.stringify(refreshed,null,2));prior.codeExecution=refreshed;
      const actual=(refreshed.tests||[]).filter(test=>!test.passed).map(test=>test.error).filter(Boolean);findings=actual.length?actual:[refreshed.error||'Saved source must pass replay checks'];
    }
  }
  if(prior?.attempt>profile.maxAttempts&&prior.codeExecution?.passed&&prior.codeExecution.effectiveScenarios)return reviewVerifiedCandidate({prior,role,input,profile,workerBundle,checkerBundle,workspace,folder,checker,beforeStep,onEvent});
  let previousExecution=prior?.codeExecution,previousProposalSource=prior?.source;
  for (let attempt = prior?.attempt??1; attempt <= profile.maxAttempts; attempt++) {
    const workerRequest = { ...workerBundle, ...clone(input), findings: clone(findings), attempt, limits: { maxContextChars: profile.worker.maxContextChars, maxOutputChars: profile.worker.maxOutputChars } };
    if(workspace&&attempt>1){
      const source=await workspace.read(),failures=(previousExecution?.tests||[]).filter(test=>!test.passed);
      const replayOnly=source===previousProposalSource&&failures.length&&failures.every(test=>test.name==='replay structure')&&previousExecution.tests.some(test=>test.name==='Start without input'&&test.passed);
      if(replayOnly){workerRequest.replayRepair={scope:'scenarios-only',sourceHash:fingerprint(source)};workerRequest.context.sourceReference={hash:fingerprint(source),characters:source.length};}
      else workerRequest.context.previousSource=source;
    }
    const workerSize = assertRequestFits(workerRequest, profile.worker.maxContextChars);
    await beforeStep(); await onEvent({ role, stage: 'working', attempt });
    const workerCalls = [];
    const cached=await pendingProposal(folder,attempt,workerRequest);
    if(cached)await onEvent({role,stage:'reusing_proposal',attempt});
    const result = cached?.result||await worker({ ...clone(workerRequest), tools: toolsFor(profile.worker.tools, input, role, undefined, workerCalls, workspace,verifyProposal) });
    if(workerRequest.replayRepair&&result.artifact){const current=await workspace.read();if(result.artifact.source!==''||fingerprint(current)!==workerRequest.replayRepair.sourceHash)throw Error('Replay-only repair cannot change its locked source');}
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
    if(role==='coding'&&!errors.length){const sourceReport=await workspace.apply(artifact,{sourceOnly:!!verifyProposal});errors.push(...sourceReport.findings);}
    let codeExecution;
    if(role==='coding'&&!errors.length&&verifyProposal){codeExecution=await verifyProposal(artifact);if(codeExecution.passed&&codeExecution.effectiveScenarios){artifact.scenarios=codeExecution.effectiveScenarios;if(fingerprint(artifact)!==codeExecution.sourceHash||checkCode(artifact).verdict!=='pass')throw Error('Verified replay correction does not match the current artifact');await writeFile(resolve(folder,'replay-correction-'+attempt+'.json'),JSON.stringify(codeExecution,null,2));}if(!codeExecution.passed){const failures=(codeExecution.tests||[]).filter(test=>!test.passed).map(test=>test.error).filter(Boolean);errors.push(...(failures.length?failures:[codeExecution.error||'Code replay checks failed']));}}
    previousExecution=codeExecution;previousProposalSource=artifact?.source;
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
