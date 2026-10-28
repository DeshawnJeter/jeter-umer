import { ROLES } from './index.js';
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export function normalizeQuestion(value, role, source = 'worker') {
  if (!ROLES.includes(role) || !['worker', 'checker'].includes(source) || !value || typeof value !== 'object') throw new Error('Invalid human question');
  if (!/^[a-z][a-z0-9_.-]{0,79}$/.test(value.key || '') || value.key.split('.').some(part => ['constructor', 'prototype', '__proto__'].includes(part))) throw new Error('Invalid question key');
  if (!text(value.text, 400) || !text(value.reason, 600)) throw new Error('Question requires text and reason');
  const options = value.options ?? [];
  if (!Array.isArray(options) || options.length > 6 || options.some(option => !text(option, 100)) || new Set(options).size !== options.length) throw new Error('Invalid question options');
  const blocking = value.blocking ?? true;
  if (typeof blocking !== 'boolean') throw new Error('Invalid blocking status');
  const affectedRoles = [...new Set([role, ...(value.affectedRoles ?? [role])])];
  if (affectedRoles.some(affected => !ROLES.includes(affected))) throw new Error('Unknown affected role');
  const maxLength = value.maxLength ?? 500;
  if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 1000) throw new Error('Invalid answer length');
  if (value.recommended && (!text(value.recommended, maxLength) || (options.length && !options.includes(value.recommended)))) throw new Error('Invalid question recommendation');
  return { key: value.key, text: value.text.trim(), reason: value.reason.trim(), options: [...options], recommended: value.recommended || '', blocking, affectedRoles, maxLength, requesters: [{ role, source }] };
}
export function validateAnswer(question, answer) {
  if (!text(answer, question.maxLength)) throw new Error(`Answer must contain 1–${question.maxLength} characters`);
  const normalized = answer.trim();
  if (question.options.length && !question.options.includes(normalized)) throw new Error('Choose one of the offered answers');
  return normalized;
}
export function combineQuestion(existing, incoming) {
  if (existing.text !== incoming.text || existing.reason !== incoming.reason || JSON.stringify(existing.options) !== JSON.stringify(incoming.options) || existing.blocking !== incoming.blocking || existing.maxLength !== incoming.maxLength || existing.recommended !== incoming.recommended) throw new Error(`Conflicting questions for ${incoming.key}`);
  existing.affectedRoles = [...new Set([...existing.affectedRoles, ...incoming.affectedRoles])];
  existing.requesters = [...existing.requesters, ...incoming.requesters].filter((value, index, list) => list.findIndex(other => other.role === value.role && other.source === value.source) === index);
  return existing;
}
