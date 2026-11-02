// Offline regression compatibility for historical run/protocol fixtures only.
// Production no longer has an OpenAI endpoint, credential path or client.
import {providerConfig as claudeConfig} from '../../apps/server/src/providers/config.js';
import {createRuntime as claudeRuntime,createRoutedRuntime} from '../../apps/server/src/providers/runtime.js';
import {createModelClient,buildRequest} from '../../apps/server/src/providers/model-client.js';
import {ROLES} from '../../shared/contracts/index.js';
export {buildRequest};
export const ENDPOINT='https://api.openai.com/v1/responses',TOKEN_COUNT_ENDPOINT=ENDPOINT+'/input_tokens';
const S='gpt-6.1-sol',T='gpt-6.1-terra',L='gpt-6-luna';
const oldModels={planner:[S,S],coding:[S,S],gameplay:[L,L],combat:[L,S],enemies:[L,S],levels:[L,S],progression:[L,S],ui:[T,T],art:[T,T],vfx:[L,T],story:[T,L],audio:[L,L],implementation:[S,S],integration:[S,S],qa:[S,S]};
export function providerConfig(env={}){
 if(env.GAME_BUILDER_PROVIDER!=='openai')return claudeConfig(env);
 const converted={GAME_BUILDER_PROVIDER:'anthropic',ANTHROPIC_MAX_TOTAL_TOKENS:64000,ANTHROPIC_TIMEOUT_MS:30000,ANTHROPIC_ENABLE_ESCALATION:env.OPENAI_ENABLE_ESCALATION||'true',ANTHROPIC_ESCALATION_MODEL:env.OPENAI_ESCALATION_MODEL||'gpt-6-astra'};
 for(const [key,value]of Object.entries(env))if(key.startsWith('OPENAI_'))converted[key.replace('OPENAI_','ANTHROPIC_')]=value;
 for(const role of ROLES)for(const [stage,index]of [['WORKER',0],['CHECKER',1]])converted[`ANTHROPIC_${role.toUpperCase()}_${stage}_MODEL`]=env[`OPENAI_${role.toUpperCase()}_${stage}_MODEL`]||env[`OPENAI_${stage}_MODEL`]||env.OPENAI_MODEL||oldModels[role][index];
 let result;try{result=claudeConfig(converted);}catch(error){throw Error(error.message.replaceAll('ANTHROPIC','OPENAI'));}
 result.mode=result.publicConfig.mode='openai';result.publicConfig.escalation.enabled=env.OPENAI_ENABLE_ESCALATION!=='false'&&!env.OPENAI_CODING_WORKER_MODEL&&!env.OPENAI_WORKER_MODEL&&!env.OPENAI_MODEL;
 return result;
}
export function createOpenAIClient(key,config,options={}){
 if(typeof options.fetchImpl!=='function'||options.fetchImpl===globalThis.fetch)throw Error('Legacy regression transport requires an injected offline fixture');
 return createModelClient(key,config,{...options,protocol:{label:'OpenAI',endpoint:ENDPOINT,countEndpoint:TOKEN_COUNT_ENDPOINT,headers:()=>({Authorization:`Bearer ${key}`,'Content-Type':'application/json'}),prepare:body=>body,decode:value=>value,countBody:body=>Object.fromEntries(['model','input','instructions','tools','tool_choice','parallel_tool_calls','text','reasoning'].filter(k=>body[k]!==undefined).map(k=>[k,body[k]]))}});
}
export function createRuntime(options={}){
 if(options.env?.GAME_BUILDER_PROVIDER!=='openai')return claudeRuntime(options);
 const selected=providerConfig(options.env);return createRoutedRuntime(selected,createOpenAIClient(selected.apiKey,selected.publicConfig,options));
}
