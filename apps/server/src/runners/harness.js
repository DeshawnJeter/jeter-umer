import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ROLES, clone, validateArtifact } from '../../../../shared/contracts/index.js';
import { policy } from '../../../../shared/policies/index.js';

export async function runPair({ role, brief, context = {}, worker, checker, directory, beforeStep = async () => {}, onEvent = async () => {} }) {
  if (!ROLES.includes(role)) throw new Error('Unknown agent role');
  // Rebuild each request from durable requirements. Never silently truncate context.
  const input = { brief: clone(brief), context: clone(context) };
  if (JSON.stringify(input).length > policy.maxContextChars) throw new Error('Context exceeds the limit. Split the task; no requirements were removed.');
  const instructions = await readFile(resolve('agents', role, 'instructions.md'), 'utf8');
  const checkerInstructions = await readFile(resolve('agents', role, 'checker.md'), 'utf8');
  if (!instructions.trim() || !checkerInstructions.trim()) throw new Error(`Missing instructions for ${role}`);
  let findings = [];
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    await beforeStep();
    await onEvent({ role, stage: 'working', attempt });
    const result = await worker({ ...clone(input), findings: clone(findings), attempt, instructions });
    if (result?.question) {
      if (typeof result.question !== 'string' || !result.question.trim()) throw new Error('Invalid human question');
      return { status: 'needs_human', question: result.question, role };
    }
    const artifact = result?.artifact;
    const errors = validateArtifact(role, artifact);
    await beforeStep();
    await onEvent({ role, stage: 'checking', attempt });
    // Checker receives a fresh copy and cannot modify the specialist artifact.
    const report = errors.length ? { verdict: 'fail', findings: errors, evidence: ['Shared contract validation'] } : await checker({ artifact: clone(artifact), ...clone(input), instructions: checkerInstructions });
    if (!['pass', 'fail', 'needs_human'].includes(report?.verdict) || !Array.isArray(report.findings) || !Array.isArray(report.evidence) || !report.evidence.length) throw new Error('Invalid checker report');
    const folder = resolve(directory, role);
    await mkdir(folder, { recursive: true });
    await writeFile(resolve(folder, `attempt-${attempt}.json`), JSON.stringify({ artifact, report }, null, 2));
    if (report.verdict === 'needs_human') return { status: 'needs_human', question: report.question || report.findings.join('; '), role };
    if (report.verdict === 'pass' && report.findings.length === 0) {
      await writeFile(resolve(folder, 'accepted.json'), JSON.stringify(artifact, null, 2));
      await onEvent({ role, stage: 'accepted', attempt });
      return { status: 'accepted', role, artifact, report };
    }
    findings = report.findings.length ? report.findings : ['Checker did not accept the contribution'];
    await onEvent({ role, stage: 'repair', attempt, findings });
  }
  throw new Error(`${role} exhausted its repair attempts: ${findings.join('; ')}`);
}
