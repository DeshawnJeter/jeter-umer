import { ROLES } from '../../../../shared/contracts/index.js';
import { normalizeQuestion } from '../../../../shared/contracts/questions.js';
import { MELODY_NOTES, BASS_NOTES, MUSIC_STYLES, MUSIC_INSTRUMENTS } from '../../../../shared/music.js';
const string = { type: 'string' }, number = { type: 'number' }, boolean = { type: 'boolean' };
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const array = items => ({ type: 'array', items });
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] });
const point = object({ x: { type: 'integer' }, y: { type: 'integer' } });
const artifacts = {
  planner: object({ title: string, objective: string, difficulty: { type: 'string', enum: ['beginner', 'experienced'] } }),
  gameplay: object({ speed: number, timeLimit: number }),
  levels: object({ spawn: point, exit: point, stars: array(point), walls: array(point) }),
  ui: object({ title: string, playerColor: string, backgroundColor: string, theme: { type: 'string', enum: ['space', 'forest', 'neon'] }, hud: object({ layout: { type:'string', enum:['cards','compact'] }, stats: array({ type:'string', enum:['health','stars','time','objective'] }) }) }),
  story: object({ intro: string, victory: string, defeat: string }),
  audio: object({ enabled: boolean, volume: number, music: boolean, pickupFrequency: number, winFrequency: number, score: object({ style: { type: 'string', enum: Object.keys(MUSIC_STYLES) }, instrument: { type:'string', enum:Object.keys(MUSIC_INSTRUMENTS) }, tempo: { type: 'integer' }, waveform: { type: 'string', enum: ['sine','triangle','square'] }, melody: array({ type: 'string', enum: MELODY_NOTES }), bass: array({ type: 'string', enum: BASS_NOTES }), drums: boolean }) })
};
export const questionSchema = object({ key: string, text: string, reason: string, options: array(string), recommended: string, blocking: boolean, affectedRoles: array({ type: 'string', enum: ROLES }), maxLength: { type: 'integer' } });
export function responseSchema(role, stage) {
  if (!ROLES.includes(role) || !['worker', 'checker'].includes(stage)) throw new Error('Invalid model role or stage');
  return stage === 'worker'
    ? object({ kind: { type: 'string', enum: ['artifact', 'question'] }, artifact: nullable(artifacts[role]), question: nullable(questionSchema), summary: string })
    : object({ verdict: { type: 'string', enum: ['pass', 'fail', 'needs_human'] }, findings: array(string), evidence: array(string), question: nullable(questionSchema) });
}
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function matches(schema, value) {
  if (schema.anyOf) return schema.anyOf.some(candidate => matches(candidate, value));
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === 'null') return value === null;
  if (schema.type === 'object') return record(value) && Object.keys(value).length === schema.required.length && schema.required.every(key => Object.hasOwn(value, key) && matches(schema.properties[key], value[key]));
  if (schema.type === 'array') return Array.isArray(value) && value.every(item => matches(schema.items, item));
  if (schema.type === 'integer') return Number.isInteger(value);
  if (schema.type === 'number') return Number.isFinite(value);
  return typeof value === schema.type;
}
function exactKeys(value, keys) { if (!record(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw new Error('Model output has unexpected or missing fields'); }
function humanQuestion(value, role, stage) {
  exactKeys(value, Object.keys(questionSchema.properties));
  const normalized = normalizeQuestion(value, role, stage);
  if (!normalized.blocking) throw new Error('A question-only model response must be blocking');
  return value;
}
export function validateModelOutput(role, stage, value) {
  if (!matches(responseSchema(role, stage), value)) throw new Error('Model output failed structured schema validation');
  if (stage === 'worker') {
    exactKeys(value, ['kind', 'artifact', 'question', 'summary']);
    if (typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 500) throw new Error('Invalid model summary');
    if (value.kind === 'question' && value.artifact === null) return { question: humanQuestion(value.question, role, stage), summary: value.summary };
    if (value.kind !== 'artifact' || value.question !== null) throw new Error('Invalid model proposal kind');
    // Domain constraints are checked by the harness and fed back as repair findings.
    if (role === 'levels') for (const point of [value.artifact.spawn, value.artifact.exit, ...value.artifact.stars, ...value.artifact.walls]) exactKeys(point, ['x', 'y']);
    return { artifact: value.artifact, summary: value.summary };
  }
  exactKeys(value, ['verdict', 'findings', 'evidence', 'question']);
  if (!['pass', 'fail', 'needs_human'].includes(value.verdict) || !Array.isArray(value.findings) || !Array.isArray(value.evidence) || !value.evidence.length || value.findings.length > 12 || value.evidence.length > 12 || [...value.findings, ...value.evidence].some(item => typeof item !== 'string' || !item.trim() || item.length > 500)) throw new Error('Invalid model checker report');
  if (value.verdict === 'needs_human') humanQuestion(value.question, role, stage);
  else if (value.question !== null || (value.verdict === 'pass' && value.findings.length) || (value.verdict === 'fail' && !value.findings.length)) throw new Error('Contradictory model checker report');
  return { verdict: value.verdict, findings: value.findings, evidence: value.evidence, ...(value.question ? { question: value.question } : {}) };
}
