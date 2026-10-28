import { readFile } from 'node:fs/promises';
import { drivers } from './drivers.js';

export async function loadCatalog() { return JSON.parse(await readFile(new URL('./fixtures/cases.json', import.meta.url), 'utf8')); }
export function validateCatalog(cases) {
  if (!Array.isArray(cases) || !cases.length) throw new Error('A nonempty case catalog is required');
  const ids = new Set();
  for (const entry of cases) {
    if (!/^(LOCAL|MODEL|HUMAN)-\d{2}$/.test(entry.id || '') || ids.has(entry.id)) throw new Error('Invalid or duplicate case ID');
    ids.add(entry.id);
    for (const field of ['name', 'surface', 'expected']) if (typeof entry[field] !== 'string' || !entry[field].trim()) throw new Error(`Missing case ${field}`);
    if (!['local', 'model-required', 'manual-required'].includes(entry.automation)) throw new Error('Unknown automation mode');
    if (entry.automation === 'local' && !Object.hasOwn(drivers, entry.driver)) throw new Error('Unknown local driver');
    if (!entry.payload || typeof entry.payload !== 'object' || Array.isArray(entry.payload)) throw new Error('Case payload must be JSON object data');
    if (JSON.stringify(entry.payload).length > 12000) throw new Error('Case payload too large');
  }
}
export async function runSuite(cases, { executors = drivers } = {}) {
  validateCatalog(cases);
  const results = [];
  for (const entry of cases) {
    const base = { id: entry.id, name: entry.name, surface: entry.surface, automation: entry.automation, expected: entry.expected };
    if (entry.automation !== 'local') {
      results.push({ ...base, status: 'not_tested', observed: { reason: entry.automation === 'model-required' ? 'No model adapter or paid calls are enabled.' : 'No human listening or playtest was performed by this runner.' }, evidence: [], limits: ['This case must not be counted as a successful defense.'] }); continue;
    }
    try {
      if (!Object.hasOwn(executors, entry.driver)) throw new Error('Authorized executor unavailable');
      const result = await executors[entry.driver](structuredClone(entry.payload));
      if (typeof result?.passed !== 'boolean' || !result.observed || typeof result.observed !== 'object' || Array.isArray(result.observed) || !Array.isArray(result.evidence) || !result.evidence.length || result.evidence.some(item => typeof item !== 'string' || !item.trim()) || (result.limits !== undefined && (!Array.isArray(result.limits) || result.limits.some(item => typeof item !== 'string')))) throw new Error('Probe returned an invalid evidence record');
      results.push({ ...base, status: result.passed ? 'pass' : 'fail', observed: result.observed, evidence: result.evidence, limits: result.limits || [] });
    } catch (error) { results.push({ ...base, status: 'fail', observed: { error: error.message }, evidence: ['Probe execution did not produce the required result'], limits: ['Investigate execution errors separately from confirmed defender vulnerabilities.'] }); }
  }
  const summary = { total: results.length, pass: results.filter(r => r.status === 'pass').length, fail: results.filter(r => r.status === 'fail').length, not_tested: results.filter(r => r.status === 'not_tested').length };
  return { schemaVersion: 1, createdAt: new Date().toISOString(), mode: 'local-scripted-no-key', overall: summary.fail ? 'fail' : summary.not_tested ? 'incomplete' : 'pass', summary, results, limits: ['Local probes do not prove model prompt resistance, OS isolation, truthful checker claims, or human participation.'] };
}
