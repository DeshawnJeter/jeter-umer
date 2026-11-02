import {MODULE_PATHS} from '../runners/source-modules.js';
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const text=maxLength=>({type:'string',maxLength});
export const CODING_TOOLS=[
  {name:'inspect_components',description:'Read the trusted game-rule API catalog.',parameters:object({})},
  {name:'read_source',description:'Read your current owned source file.',parameters:object({path:{type:'string',enum:['generated/rules.js',...MODULE_PATHS]},startLine:{type:'integer',minimum:1,maximum:6000},maxLines:{type:'integer',minimum:1,maximum:30}})},
  {name:'search_source',description:'Search lines in your owned source file.',parameters:object({query:text(80)})},
  {name:'apply_source_patch',description:'Apply a small exact patch, not a full-file rewrite. Find at most 1000 characters; replacement at most 1600. Replace one exact occurrence in your owned file. Empty find initializes an empty file. Final artifact.source may be empty to submit the patched file.',parameters:object({path:{type:'string',enum:['generated/rules.js',...MODULE_PATHS]},find:text(1000),replacement:text(1600)})},
  {name:'run_rule_checks',description:'Run bounded win/loss scenarios against the current source in an isolated browser worker.',parameters:object({scenarios:text(6000)})}
].map(tool=>({...tool,type:'function',strict:true}));
export async function invokeCodingTool(request,call){
  const definition=CODING_TOOLS.find(tool=>tool.name===call.name);
  if(!definition||!Object.hasOwn(request.tools||{},call.name)||typeof call.call_id!=='string'||call.call_id.length>200||typeof call.arguments!=='string'||call.arguments.length>14000)throw Error('Unrecognized or invalid coding tool call');
  const args=JSON.parse(call.arguments),properties=definition.parameters.properties;
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).sort().join()!==Object.keys(properties).sort().join()||Object.entries(properties).some(([key,rule])=>(rule.type==='integer'?!Number.isInteger(args[key]):typeof args[key]!==rule.type)||rule.minimum!==undefined&&args[key]<rule.minimum||rule.maximum!==undefined&&args[key]>rule.maximum||rule.maxLength!==undefined&&args[key].length>rule.maxLength||rule.enum&&!rule.enum.includes(args[key])))throw Error('Invalid coding tool arguments');
  let value;
  if(call.name==='inspect_components')value=await request.tools.inspect_components();
  if(call.name==='read_source'){const source=await request.tools.read_source(args.path),lines=source.split('\n');value={startLine:args.startLine,totalLines:lines.length,source:lines.slice(args.startLine-1,args.startLine-1+args.maxLines).join('\n').slice(0,1600),truncated:lines.slice(args.startLine-1,args.startLine-1+args.maxLines).join('\n').length>1600};}
  if(call.name==='search_source')value=await request.tools.search_source(args.query);
  if(call.name==='apply_source_patch')value=await request.tools.apply_source_patch(args);
  if(call.name==='run_rule_checks')value=await request.tools.run_rule_checks(args.scenarios);
  const output=JSON.stringify(value);if(output.length>7500)throw Error('Coding tool output exceeds focused context limit');return output;
}
