import { ROLES } from '../../../../shared/contracts/index.js';
import { normalizeQuestion } from '../../../../shared/contracts/questions.js';
import { MELODY_NOTES, BASS_NOTES, MUSIC_STYLES, MUSIC_INSTRUMENTS } from '../../../../shared/music.js';
import { ModelOutputError } from './output-errors.js';
import { validateResolution } from '../../../../shared/prompt-brief.js';
import {GAME_TYPES} from '../../../../shared/game-types.js';
import {HUD_STATS} from '../../../../shared/player-ui.js';
import {EXTENSION_SPECS} from '../../../../shared/specialists.js';
const string = { type: 'string' }, number = { type: 'number' }, boolean = { type: 'boolean' };
const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const array = items => ({ type: 'array', items });
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] });
const boundedText = maxLength => ({ type:'string', minLength:1, maxLength, pattern:'\\S' });
const reportStrings = minItems => ({ type:'array', items:boundedText(500), minItems, maxItems:12 });
export const resolutionSchema = object({title:boundedText(60),genre:{type:'string',enum:Object.keys(GAME_TYPES)},theme:{type:'string',enum:['space','forest','neon']},difficulty:{type:'string',enum:['beginner','experienced']},music:boolean,musicStyle:{type:'string',enum:Object.keys(MUSIC_STYLES)},musicInstrument:{type:'string',enum:['auto',...Object.keys(MUSIC_INSTRUMENTS)]},assumptions:{type:'array',items:boundedText(240),maxItems:16},unsupportedRequests:{type:'array',items:boundedText(240),maxItems:16}});
export function resolutionResponseSchema(stage) {
  if(!['worker','checker'].includes(stage))throw new Error('Invalid resolution stage');
  if(stage==='worker')return object({kind:{type:'string',enum:['artifact']},artifact:resolutionSchema,question:{type:'null'},summary:boundedText(500)});
  const schema=providerResponseSchema('planner','checker');schema.properties.review.anyOf=schema.properties.review.anyOf.slice(0,2);return schema;
}
export function decodeResolutionOutput(stage,value) {
  if(stage==='checker'){if(!matches(resolutionResponseSchema(stage),value))throw new ModelOutputError('schema');return decodeProviderOutput('planner','checker',value);}
  if(!matches(resolutionResponseSchema(stage),value))throw new ModelOutputError('schema');
  let artifact;try{artifact=validateResolution(value.artifact);}catch{throw new ModelOutputError('schema');}
  return {artifact,summary:value.summary};
}
const point = object({ x: { type: 'integer' }, y: { type: 'integer' } });
const artifacts = {
  planner: object({ title: boundedText(60), objective: boundedText(180), difficulty: { type: 'string', enum: ['beginner', 'experienced'] },acceptance:{type:'array',items:boundedText(180),minItems:3,maxItems:6} }),
  gameplay: object({ speed: number, timeLimit: number }),
  levels: object({ spawn: point, exit: point, stars: array(point), walls: array(point) }),
  ui: object({ title: boundedText(60), playerColor: string, backgroundColor: string, theme: { type: 'string', enum: ['space', 'forest', 'neon'] }, hud: object({ layout: { type:'string', enum:['cards','compact'] }, stats: array({ type:'string', enum:HUD_STATS }) }) }),
  story: object({ intro: boundedText(180), victory: boundedText(180), defeat: boundedText(180) }),
  audio: object({ enabled: boolean, volume: number, music: boolean, pickupFrequency: number, winFrequency: number, score: object({ style: { type: 'string', enum: Object.keys(MUSIC_STYLES) }, instrument: { type:'string', enum:Object.keys(MUSIC_INSTRUMENTS) }, tempo: { type: 'integer' }, waveform: { type: 'string', enum: ['sine','triangle','square'] }, melody: array({ type: 'string', enum: MELODY_NOTES }), bass: array({ type: 'string', enum: BASS_NOTES }), drums: boolean }) })
};
export const questionSchema = object({
  key: { type:'string', minLength:1, maxLength:80, pattern:'^[a-z][a-z0-9_.-]{0,79}$', description:'Stable lowercase decision key. No constructor, prototype or __proto__ path segments.' },
  text: boundedText(400), reason: boundedText(600),
  options: { type:'array', maxItems:6, items:{type:'string',minLength:1,maxLength:100,pattern:'^\\S(?:[\\s\\S]*\\S)?$'}, description:'Unique exact answer strings, with no leading/trailing whitespace. Each must fit maxLength. Empty array allows free text.' },
  recommended: { type:'string',maxLength:1000,description:'Empty string for no recommendation. Otherwise copy one offered option exactly; for free text, fit maxLength.' },
  blocking: {type:'boolean',enum:[true]},
  affectedRoles: {type:'array',maxItems:ROLES.length,items:{type:'string',enum:ROLES}},
  maxLength: {type:'integer',minimum:1,maximum:1000,description:'Maximum answer length in characters, not number of options. Use 500 unless a smaller bound is needed; must fit every option and recommendation.'}
});
for(const [role,spec]of Object.entries(EXTENSION_SPECS))artifacts[role]=object(Object.fromEntries(Object.entries(spec.fields).map(([key,rule])=>[key,rule.type==='array'?array({type:'string',enum:rule.enum}):{type:rule.type,...(rule.enum?{enum:rule.enum}:{})}])));
export function responseSchema(role, stage) {
  if (!ROLES.includes(role) || !['worker', 'checker'].includes(stage)) throw new Error('Invalid model role or stage');
  return stage === 'worker'
    ? object({ kind: { type: 'string', enum: ['artifact', 'question'] }, artifact: nullable(artifacts[role]), question: nullable(questionSchema), summary: { ...boundedText(500), description:'A concise, nonblank summary, at most 500 characters.' } })
    : object({ verdict: { type: 'string', enum: ['pass', 'fail', 'needs_human'] }, findings: reportStrings(0), evidence: reportStrings(1), question: nullable(questionSchema) });
}
// A nested union is supported by strict Structured Outputs; a root-level union
// is not. Encode verdict consistency in the wire schema, not just the prompt.
export function providerResponseSchema(role, stage) {
  const schema = responseSchema(role, stage);
  if(stage==='worker'&&role==='coding'){
    const wire=structuredClone(schema),actions=['left','right','up','down','jump','attack','ability','interact'];
    wire.properties.artifact.anyOf[0].properties.scenarios={type:'array',minItems:2,maxItems:4,items:object({name:boundedText(50),steps:{type:'array',minItems:1,maxItems:300,items:object({dt:{type:'number',minimum:0,maximum:0.1},actions:{type:'array',maxItems:8,items:{type:'string',enum:actions}},repeat:{type:'integer',minimum:1,maximum:300}})},expect:{type:'string',enum:['won','lost']}})};
    return wire;
  }
  if (stage === 'worker') return schema;
  return object({ review: { anyOf: [
    object({ evidence:reportStrings(1), findings:{...reportStrings(0),maxItems:0,description:'No unresolved defects: an empty array.'}, verdict:{type:'string',enum:['pass']}, question:{type:'null'} }),
    object({ evidence:reportStrings(1), findings:{...reportStrings(1),description:'Only actual unresolved defects requiring artifact changes. Successful, valid, allowed or matching checks belong in evidence.'}, verdict:{type:'string',enum:['fail']}, question:{type:'null'} }),
    object({ evidence:reportStrings(1), findings:reportStrings(0), verdict:{type:'string',enum:['needs_human']}, question:questionSchema })
  ] } });
}
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function matches(schema, value) {
  if (schema.anyOf) return schema.anyOf.some(candidate => matches(candidate, value));
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === 'null') return value === null;
  if (schema.type === 'object') return record(value) && Object.keys(value).length === schema.required.length && schema.required.every(key => Object.hasOwn(value, key) && matches(schema.properties[key], value[key]));
  if (schema.type === 'array') return Array.isArray(value) && value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? Infinity) && value.every(item => matches(schema.items, item));
  if (schema.type === 'string') return typeof value === 'string' && value.length >= (schema.minLength ?? 0) && value.length <= (schema.maxLength ?? Infinity) && (!schema.pattern || new RegExp(schema.pattern).test(value));
  if (schema.type === 'integer') return Number.isInteger(value)&&value>=(schema.minimum??-Infinity)&&value<=(schema.maximum??Infinity);
  if (schema.type === 'number') return Number.isFinite(value)&&value>=(schema.minimum??-Infinity)&&value<=(schema.maximum??Infinity);
  return typeof value === schema.type;
}
function exactKeys(value, keys) { if (!record(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw new ModelOutputError('shape', 'Model output has unexpected or missing fields'); }
function humanQuestion(value, role, stage) {
  exactKeys(value, Object.keys(questionSchema.properties));
  let normalized;
  try { normalized = normalizeQuestion(value, role, stage); } catch { throw new ModelOutputError('question'); }
  if (!normalized.blocking) throw new ModelOutputError('question', 'A question-only model response must be blocking');
  return value;
}
export function validateModelOutput(role, stage, value) {
  if (stage === 'worker' && record(value) && (typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 500)) throw new ModelOutputError('summary', 'Invalid model summary');
  if (stage === 'checker' && record(value) && (!Array.isArray(value.evidence) || !value.evidence.length || [value.findings,value.evidence].some(items => !Array.isArray(items) || items.length > 12 || items.some(item => typeof item !== 'string' || !item.trim() || item.length > 500)))) throw new ModelOutputError('checker', 'Invalid model checker report');
  if (!matches(responseSchema(role, stage), value)) throw new ModelOutputError('schema', 'Model output failed structured schema validation');
  if (stage === 'worker') {
    exactKeys(value, ['kind', 'artifact', 'question', 'summary']);
    if (value.kind === 'question' && value.artifact === null) return { question: humanQuestion(value.question, role, stage), summary: value.summary };
    if (value.kind !== 'artifact' || value.question !== null || value.artifact === null) throw new ModelOutputError('proposal', 'Invalid model proposal kind');
    // Domain constraints are checked by the harness and fed back as repair findings.
    if (role === 'levels') for (const point of [value.artifact.spawn, value.artifact.exit, ...value.artifact.stars, ...value.artifact.walls]) exactKeys(point, ['x', 'y']);
    return { artifact: value.artifact, summary: value.summary };
  }
  exactKeys(value, ['verdict', 'findings', 'evidence', 'question']);
  if (value.verdict === 'needs_human') humanQuestion(value.question, role, stage);
  else if (value.question !== null || (value.verdict === 'pass' && value.findings.length) || (value.verdict === 'fail' && !value.findings.length)) throw new ModelOutputError('contradiction', 'Contradictory model checker report');
  return { verdict: value.verdict, findings: value.findings, evidence: value.evidence, ...(value.question ? { question: value.question } : {}) };
}
export function decodeProviderOutput(role, stage, value) {
  if(stage==='worker'&&role==='coding'){
    if(!matches(providerResponseSchema(role,stage),value))throw new ModelOutputError('schema');
    const normalized=structuredClone(value);
    if(normalized.artifact)normalized.artifact.scenarios=JSON.stringify(normalized.artifact.scenarios.map(c=>({name:c.name,expect:c.expect,steps:c.steps.map(step=>({dt:step.dt,input:Object.fromEntries(step.actions.map(action=>[action,true])),repeat:step.repeat}))})));
    return validateModelOutput(role,stage,normalized);
  }
  if (stage === 'worker') return validateModelOutput(role, stage, value);
  exactKeys(value, ['review']);
  const report = validateModelOutput(role, stage, value.review);
  if (!matches(providerResponseSchema(role, stage), value)) throw new ModelOutputError('schema');
  return report;
}
