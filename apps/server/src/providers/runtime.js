import { providerConfig } from './config.js';
import { createAnthropicClient } from './anthropic.js';
import { route } from '../router/index.js';
import { resolvePromptBrief } from '../runners/brief.js';
export function createRuntime({ env = process.env, fetchImpl,countInputTokens } = {}) {
  const selected = providerConfig(env);
  const client = selected.mode==='anthropic' ? createAnthropicClient(selected.apiKey, selected.publicConfig, { fetchImpl,...(countInputTokens===undefined?{}:{countInputTokens}) }) : null;
  return createRoutedRuntime(selected,client);
}
export function createRoutedRuntime(selected,client) {
  const publicConfig=structuredClone(selected.publicConfig);
  return Object.freeze({ mode: selected.mode, publicConfig, resolveBrief:options=>resolvePromptBrief({...options,client}), async route(role, hooks) {
    const deterministic = await route(role);
    if (!client) return deterministic;
    return {
      worker: async request => {
        // Required human choices are policy gates, not model guesses or error fallbacks.
        if ((role === 'planner' && !request.brief.difficulty) || (role === 'story' && request.brief.askStory && !request.context.decisions?.['story.direction'])) {
          const prerequisite = await deterministic.worker(request);
          if (!prerequisite.question) throw new Error('Missing required human-context question');
          return prerequisite;
        }
        return client.generate(role, 'worker', request, hooks);
      },
      checker: async request => {
        const localReport = await deterministic.checker(request);
        const modelReport = await client.generate(role, 'checker', { ...request, deterministicReview:structuredClone(localReport) }, hooks);
        const evidence = [...modelReport.evidence.map(item => `Model static review: ${item}`), ...localReport.evidence.map(item => `Deterministic check: ${item}`)];
        if (modelReport.verdict === 'needs_human') return { ...modelReport, evidence, reviewSources: [selected.mode, 'deterministic'] };
        const findings = [...modelReport.findings, ...localReport.findings];
        return { verdict: findings.length ? 'fail' : 'pass', findings, evidence, reviewSources: [selected.mode, 'deterministic'] };
      }
    };
  } });
}
