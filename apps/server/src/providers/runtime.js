import { providerConfig } from './config.js';
import { createOpenAIClient } from './openai.js';
import { route } from '../router/index.js';
export function createRuntime({ env = process.env, fetchImpl } = {}) {
  const selected = providerConfig(env), publicConfig = structuredClone(selected.publicConfig);
  const client = selected.mode === 'openai' ? createOpenAIClient(selected.apiKey, publicConfig, { fetchImpl }) : null;
  return Object.freeze({ mode: selected.mode, publicConfig, async route(role, hooks) {
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
        if (modelReport.verdict === 'needs_human') return { ...modelReport, evidence, reviewSources: ['openai', 'deterministic'] };
        const findings = [...modelReport.findings, ...localReport.findings];
        return { verdict: findings.length ? 'fail' : 'pass', findings, evidence, reviewSources: ['openai', 'deterministic'] };
      }
    };
  } });
}
