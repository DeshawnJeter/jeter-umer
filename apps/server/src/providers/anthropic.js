import { createOpenAIClient } from './openai.js';

export const ANTHROPIC_ENDPOINT='https://api.anthropic.com/v1/messages';
// Anthropic's grammar supports fewer bounds than our authoritative local
// schema. Preserve those requirements as descriptions, then validate the
// response against the original schema in the shared harness.
export function anthropicSchema(schema) {
  if(Array.isArray(schema))return schema.map(anthropicSchema);
  if(!schema||typeof schema!=='object')return schema;
  const result={},constraints={};
  for(const [key,value]of Object.entries(schema)){
    if(['minimum','maximum','multipleOf','minLength','maxLength','maxItems','uniqueItems','pattern'].includes(key)||(key==='minItems'&&value>1))constraints[key]=value;
    else result[key]=key==='properties'?Object.fromEntries(Object.entries(value).map(([name,field])=>[name,anthropicSchema(field)])):anthropicSchema(value);
  }
  if(Object.keys(constraints).length)result.description=[result.description,`Required local bounds: ${JSON.stringify(constraints)}.`].filter(Boolean).join(' ');
  return result;
}
export function anthropicRequest(body) {
  const messages=[];
  for(const item of body.input){
    if(item.role==='user')messages.push({role:'user',content:item.content.map(part=>({type:'text',text:part.text}))});
    else if(item.type==='function_call')messages.push({role:'assistant',content:[{type:'tool_use',id:item.call_id,name:item.name,input:JSON.parse(item.arguments)}]});
    else if(item.type==='function_call_output')messages.push({role:'user',content:[{type:'tool_result',tool_use_id:item.call_id,content:item.output}]});
    else throw Error('Unsupported Anthropic conversation item');
  }
  const result={model:body.model,max_tokens:body.max_output_tokens,system:body.instructions,messages,output_config:{format:{type:'json_schema',schema:anthropicSchema(body.text.format.schema)}}};
  if(body.tools?.length){
    result.tools=body.tools.map(tool=>({name:tool.name,description:tool.description,input_schema:anthropicSchema(tool.parameters),strict:true}));
    result.tool_choice={type:body.tool_choice==='required'?'any':body.tool_choice==='none'?'none':'auto',...(body.tool_choice==='none'?{}:{disable_parallel_tool_use:true})};
  }
  return result;
}
export function anthropicResponse(value) {
  if(!value||value.type!=='message'||value.role!=='assistant'||!Array.isArray(value.content))throw Error('Anthropic returned an invalid response envelope');
  let usage=null;
  const u=value.usage;
  if(u&&['input_tokens','output_tokens'].every(key=>Number.isSafeInteger(u[key])&&u[key]>=0)&&['cache_creation_input_tokens','cache_read_input_tokens'].every(key=>u[key]===undefined||Number.isSafeInteger(u[key])&&u[key]>=0)){
    const input=u.input_tokens+(u.cache_creation_input_tokens||0)+(u.cache_read_input_tokens||0);
    usage={input_tokens:input,output_tokens:u.output_tokens,total_tokens:input+u.output_tokens};
  }
  const refusal=value.stop_reason==='refusal'||value.stop_details?.type==='refusal';
  const output=[];
  for(const block of value.content){
    if(block?.type==='text'&&typeof block.text==='string')output.push({type:'message',content:[{type:'output_text',text:block.text}]});
    else if(block?.type==='tool_use'&&value.stop_reason==='tool_use'&&typeof block.id==='string'&&typeof block.name==='string'&&block.input&&typeof block.input==='object'&&!Array.isArray(block.input))output.push({type:'function_call',call_id:block.id,name:block.name,arguments:JSON.stringify(block.input)});
    else if(!['thinking','redacted_thinking'].includes(block?.type))throw Error('Anthropic returned an invalid content block');
  }
  if(refusal)return {status:'completed',usage,output:[{type:'message',content:[{type:'refusal'}]}]};
  const completed=['end_turn','tool_use'].includes(value.stop_reason)&&(value.stop_reason!=='tool_use'||output.some(item=>item.type==='function_call'));
  return {status:completed?'completed':'incomplete',usage,output,...(!completed?{incomplete_details:{reason:value.stop_reason==='max_tokens'?'max_output_tokens':'unsupported_stop_reason'}}:{})};
}
export const anthropicProtocol=Object.freeze({
  label:'Anthropic',endpoint:ANTHROPIC_ENDPOINT,countEndpoint:ANTHROPIC_ENDPOINT+'/count_tokens',
  headers:key=>({'x-api-key':key,'anthropic-version':'2023-06-01','Content-Type':'application/json'}),
  prepare:anthropicRequest,decode:anthropicResponse,
  countBody:body=>Object.fromEntries(['model','messages','system','tools','tool_choice','output_config'].filter(key=>body[key]!==undefined).map(key=>[key,body[key]]))
});
export function createAnthropicClient(apiKey,config,options={}) {
  return createOpenAIClient(apiKey,config,{...options,protocol:anthropicProtocol});
}
