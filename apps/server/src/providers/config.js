import {ROLE_MODELS} from './model-policy.js';
import { ROLES } from '../../../../shared/contracts/index.js';
function integer(env, key, fallback, min, max) {
  const value = env[key] === undefined ? fallback : Number(env[key]);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}; expected an integer from ${min} to ${max}`);
  return value;
}
function model(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,120}$/.test(value)) throw new Error('Configure a valid OpenAI model ID');
  return value;
}
export function providerConfig(env = process.env) {
  const selected = env.GAME_BUILDER_PROVIDER ?? 'demo';
  if (!['demo', 'openai'].includes(selected)) throw new Error('GAME_BUILDER_PROVIDER must be demo or openai');
  if (selected === 'demo') return { mode: 'scripted-demo', publicConfig: { mode: 'scripted-demo' } };
  if (typeof env.OPENAI_API_KEY !== 'string' || !env.OPENAI_API_KEY.trim() || /[\r\n]/.test(env.OPENAI_API_KEY)) throw new Error('Set OPENAI_API_KEY in the server environment before starting OpenAI mode');
  const models = {};
  for (const role of ROLES) models[role] = {
    worker: model(env[`OPENAI_${role.toUpperCase()}_WORKER_MODEL`] || env.OPENAI_WORKER_MODEL || env.OPENAI_MODEL || ROLE_MODELS[role][0]),
    checker: model(env[`OPENAI_${role.toUpperCase()}_CHECKER_MODEL`] || env.OPENAI_CHECKER_MODEL || env.OPENAI_MODEL || ROLE_MODELS[role][1])
  };
  return { mode: 'openai', apiKey: env.OPENAI_API_KEY.trim(), publicConfig: {
    mode: 'openai', models,
    escalation:{enabled:env.OPENAI_ENABLE_ESCALATION!=='false'&&!env.OPENAI_CODING_WORKER_MODEL&&!env.OPENAI_WORKER_MODEL&&!env.OPENAI_MODEL,model:model(env.OPENAI_ESCALATION_MODEL||'gpt-6-astra'),afterAttempt:3},
    maxCalls: integer(env, 'OPENAI_MAX_CALLS', 24, 1, 40),
    maxTotalTokens: integer(env, 'OPENAI_MAX_TOTAL_TOKENS', 64000, 2000, 256000),
    maxOutputTokens: integer(env, 'OPENAI_MAX_OUTPUT_TOKENS', 2048, 256, 8192),
    maxCodingOutputTokens: integer(env, 'OPENAI_CODING_MAX_OUTPUT_TOKENS', env.OPENAI_MAX_OUTPUT_TOKENS === undefined ? 6144 : Number(env.OPENAI_MAX_OUTPUT_TOKENS), 256, 8192),
    maxResponseRepairs: integer(env, 'OPENAI_MAX_RESPONSE_REPAIRS', 2, 0, 2),
    timeoutMs: integer(env, 'OPENAI_TIMEOUT_MS', 30000, 1000, 60000),
    maxRequestBytes: 40000, maxResponseBytes: 131072
  } };
}
