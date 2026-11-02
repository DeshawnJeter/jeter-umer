import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { ROLES } from '../../../../shared/contracts/index.js';
import { policy } from '../../../../shared/policies/index.js';
import {EXTENSION_SPECS} from '../../../../shared/specialists.js';
import { loadSkills } from './skills.js';
export const fingerprint = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export async function loadMasterInstructions() {
  const text = await readFile(resolve('prompts/orchestrator.md'), 'utf8');
  if (!text.trim()) throw new Error('Missing orchestrator instructions');
  if (text.length > policy.maxContextChars) throw new Error('Master instructions exceed the context limit');
  return { text, hash: fingerprint(text), provider: 'scripted-demo' };
}
export async function loadProfile(role) {
  if (!ROLES.includes(role)) throw new Error('Unknown agent role');
  const profile = JSON.parse(await readFile(resolve('agents', role, 'profile.json'), 'utf8'));
  if (profile.version !== 1 || profile.role !== role || profile.provider !== 'scripted-demo' || profile.model !== null || !Number.isInteger(profile.maxAttempts) || profile.maxAttempts < 1 || profile.maxAttempts > policy.maxAttempts) throw new Error(`Invalid ${role} profile`);
  for (const stage of ['worker', 'checker']) {
    const settings = profile[stage]; const allowedTools = stage === 'worker' ? ['inspect_context', 'propose_artifact','read_project_memory',...(role==='coding'?['read_source','search_source','inspect_components']:[])] : ['inspect_context', 'inspect_artifact','read_project_memory'];
    if (!settings || settings.prompt !== (stage === 'worker' ? 'instructions.md' : 'checker.md') || !Array.isArray(settings.tools) || new Set(settings.tools).size !== settings.tools.length || settings.tools.some(name => !allowedTools.includes(name))) throw new Error(`Invalid ${stage} tools or prompt`);
    for (const setting of ['maxContextChars', 'maxOutputChars']) if (!Number.isInteger(settings[setting]) || settings[setting] < 1 || settings[setting] > policy.maxContextChars) throw new Error(`Invalid ${stage} ${setting}`);
  }
  return profile;
}
export async function instructionBundle(role, stage, profile, brief=null) {
  if (!['worker', 'checker'].includes(stage)) throw new Error('Unknown instruction stage');
  const settings = profile[stage];
  const focused=[...(role==='coding'?['code-rules']:[]),...(['gameplay','levels','combat','progression'].includes(role)&&(!brief||['campaign','roguelike'].includes(brief.genre))?['campaign-progression']:[]),...(role==='audio'&&(!brief||brief.music)?['adaptive-audio']:[])];
  const skills = await loadSkills([...new Set([...settings.skills,...focused])]);
  const shared = await readFile(resolve('prompts/shared.md'), 'utf8');
  const roleInstructions = await readFile(resolve('agents', role, settings.prompt), 'utf8');
  if (!shared.trim() || !roleInstructions.trim()) throw new Error(`Missing ${role} instructions`);
  const instructions = [shared, roleInstructions, ...skills.map(skill => `# Application skill: ${skill.name}\n${skill.instructions}`)].join('\n\n');
  return { instructions, hash: fingerprint(instructions), skills: skills.map(skill => skill.name), tools: [...settings.tools] };
}
export function assertRequestFits(request, limit) {
  const size = JSON.stringify(request).length;
  if (size > Math.min(limit, policy.maxContextChars)) throw new Error('Context exceeds the limit. Split the task; no instructions, skills, or requirements were removed.');
  return size;
}
export async function loadSystemManifest() {
  const master = await loadMasterInstructions(); const agents = {};
  for (const role of ROLES) {
    const profile = await loadProfile(role);
    const [worker, checker] = await Promise.all([instructionBundle(role, 'worker', profile), instructionBundle(role, 'checker', profile)]);
    agents[role] = fingerprint({ profile, worker: worker.hash, checker: checker.hash });
  }
  const briefResolver=await readFile(resolve('prompts/brief-resolver.md'),'utf8');
  if(!briefResolver.trim()||briefResolver.length>policy.maxContextChars)throw new Error('Invalid prompt resolver instructions');
  const contracts=fingerprint(EXTENSION_SPECS);
  return { master, agents, contracts,briefResolver:fingerprint(briefResolver), hash: fingerprint({ master: master.hash, agents,contracts, briefResolver:fingerprint(briefResolver) }) };
}
