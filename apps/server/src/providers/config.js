import {ROLE_MODELS} from './model-policy.js';
import { ROLES } from '../../../../shared/contracts/index.js';
function integer(env, key, fallback, min, max) {
  const value = env[key] === undefined ? fallback : Number(env[key]);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}; expected an integer from ${min} to ${max}`);
  return value;
}
function model(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,120}$/.test(value)) throw new Error('Configure a valid provider model ID');
  return value;
}
export function providerConfig(env = process.env) {
  const selected = env.GAME_BUILDER_PROVIDER ?? 'demo';
  if (!['demo', 'openai', 'anthropic'].includes(selected)) throw new Error('GAME_BUILDER_PROVIDER must be demo, openai or anthropic');
  if (selected === 'demo') return { mode: 'scripted-demo', publicConfig: { mode: 'scripted-demo' } };
  const prefix=selected==='anthropic'?'ANTHROPIC':'OPENAI',key=env[`${prefix}_API_KEY`];
  if (typeof key !== 'string' || !key.trim() || /[\r\n]/.test(key)) throw new Error(`Set ${prefix}_API_KEY in the server environment before starting ${selected} mode`);
  const models = {};
  for (const role of ROLES) models[role] = {
    worker: model(env[`${prefix}_${role.toUpperCase()}_WORKER_MODEL`] || env[`${prefix}_WORKER_MODEL`] || env[`${prefix}_MODEL`] || (selected==='anthropic'?'claude-sonnet-5-5':ROLE_MODELS[role][0])),
    checker: model(env[`${prefix}_${role.toUpperCase()}_CHECKER_MODEL`] || env[`${prefix}_CHECKER_MODEL`] || env[`${prefix}_MODEL`] || (selected==='anthropic'?'claude-sonnet-5-5':ROLE_MODELS[role][1]))
  };
  return { mode: selected, apiKey: key.trim(), publicConfig: {
    mode: selected, models,
    escalation:{enabled:(selected==='anthropic'?env.ANTHROPIC_ENABLE_ESCALATION==='true':env.OPENAI_ENABLE_ESCALATION!=='false')&&!env[`${prefix}_CODING_WORKER_MODEL`]&&!env[`${prefix}_WORKER_MODEL`]&&!env[`${prefix}_MODEL`],model:model(env[`${prefix}_ESCALATION_MODEL`]||(selected==='anthropic'?'claude-opus-5-5':'gpt-6-astra')),afterAttempt:3},
    maxCalls: integer(env, `${prefix}_MAX_CALLS`, 24, 1, 40),
    maxTotalTokens: integer(env, `${prefix}_MAX_TOTAL_TOKENS`, selected==='anthropic'?128000:64000, 2000, 256000),
    maxOutputTokens: integer(env, `${prefix}_MAX_OUTPUT_TOKENS`, 2048, 256, 8192),
    maxCodingOutputTokens: integer(env, `${prefix}_CODING_MAX_OUTPUT_TOKENS`, env[`${prefix}_MAX_OUTPUT_TOKENS`] === undefined ? 6144 : Number(env[`${prefix}_MAX_OUTPUT_TOKENS`]), 256, 8192),
    maxResponseRepairs: integer(env, `${prefix}_MAX_RESPONSE_REPAIRS`, 2, 0, 2),
    timeoutMs: integer(env, `${prefix}_TIMEOUT_MS`, selected==='anthropic'?60000:30000, 1000, 60000),
    maxRequestBytes: 40000, maxResponseBytes: 131072
  } };
}
