import {MODULE_PATHS,sourceModule,patchModule} from './source-modules.js';
import {parse} from 'acorn';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {codeScenarios,COMPONENT_CATALOG,DEFAULT_SCENARIOS} from '../../../../shared/code-game.js';
export function checkCode(artifact,{sourceOnly=false}={}){
  const findings=[];
  try{
    if(typeof artifact.source!=='string'||artifact.source.length>6000)throw Error('Source exceeds 6000 characters');
    const tree=parse(artifact.source,{ecmaVersion:'latest',sourceType:'module'});
    let exported=false;
    const walk=node=>{if(!node||typeof node!=='object')return;
      if(['ImportDeclaration','ImportExpression','ExportAllDeclaration'].includes(node.type)||node.type==='ExportNamedDeclaration'&&node.source)throw Error('Imports and re-exports are not allowed; use supplied api components');
      if(node.type==='ExportNamedDeclaration'&&node.declaration?.type==='FunctionDeclaration'&&node.declaration.id?.name==='createGame')exported=true;
      if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&node.callee.object.type==='Identifier'&&node.callee.object.name==='api'){const key=node.callee.computed?node.callee.property.value:node.callee.property.name;if(!['clamp','damage','give','move','distance','pathNodes','pressed','tick','spend','approach','nextLevel'].includes(key))throw Error('Unavailable api method: '+String(key).slice(0,40)+'. Only clamp, damage, give, move, distance pathNodes, pressed, tick, spend, approach and nextLevel are supplied. Framework owns music and sound.');}
      const target=node.type==='AssignmentExpression'?node.left:node.type==='UpdateExpression'||node.type==='UnaryExpression'&&node.operator==='delete'?node.argument:null;
      if(target?.type==='MemberExpression'&&target.object.type==='Identifier'&&target.object.name==='input')throw Error('Input is read-only and replaced every worker step. Store button latches in persistent game state, never on input.');
      if(node.type==='Identifier'&&['eval','Function','fetch','XMLHttpRequest','WebSocket','Worker','SharedWorker','importScripts','globalThis','self','postMessage','close','navigator','location','indexedDB','caches'].includes(node.name))throw Error('Host capabilities are unavailable in game rules');
      for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
    };walk(tree);if(!exported)throw Error('Export function createGame(api)');if(!sourceOnly)codeScenarios(artifact.scenarios);
  }catch(error){findings.push(error.message.slice(0,300));}
  return {verdict:findings.length?'fail':'pass',findings,evidence:['Parsed JavaScript without executing it on the server',sourceOnly?'Checked source ownership and unavailable capabilities':'Checked source ownership, unavailable capabilities and bounded win/loss scenario structure'],scope:'syntax-and-contract'};
}
export function compactComments(source){
  const comments=[];parse(source,{ecmaVersion:'latest',sourceType:'module',onComment:comments});
  for(const comment of comments.reverse()){const breaks=source.slice(comment.start,comment.end).match(/[\r\n\u2028\u2029]/g);source=source.slice(0,comment.start)+(breaks?breaks.join(''):' ')+source.slice(comment.end);}
  return source;
}
export function codeWorkspace(directory){
  const file=resolve(directory,'generated','rules.js');
  return Object.freeze({catalog:()=>COMPONENT_CATALOG,async read(path='generated/rules.js'){if(MODULE_PATHS.includes(path))return sourceModule(await this.read(),path).source;if(path!=='generated/rules.js')throw Error('Outside owned game source');return readFile(file,'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});},async search(query){if(typeof query!=='string'||query.length>80)throw Error('Invalid search');return (await this.read()).split('\n').map((line,i)=>({line:i+1,text:line})).filter(row=>row.text.includes(query)).slice(0,12);},async stage(source){if(typeof source!=='string'||source.length>6000)throw Error('Source exceeds 6000 characters');await mkdir(resolve(directory,'generated'),{recursive:true});await writeFile(file,source);},async patch({path,find,replacement}){const current=await this.read(path);if(typeof find!=='string'||typeof replacement!=='string'||!find&&current||find&&current.split(find).length!==2)return {verdict:'fail',findings:['Patch did not match one exact location; read_source before retrying. The owned file was not changed.'],sourceLength:current.length};let source;if(MODULE_PATHS.includes(path)){try{source=patchModule(await this.read(),path,find,replacement);}catch(error){return {verdict:'fail',findings:[error.message]};}}else source=find?current.replace(find,()=>replacement):replacement;let compacted=false;if(source.length>6000){try{source=compactComments(source);compacted=true;}catch{}}if(source.length>6000)return {verdict:'fail',findings:['Patch would exceed the 6000-character source limit. Remove unused code or make a smaller replacement. The owned source was not changed.'],sourceLength:current.length};const report=checkCode({source,scenarios:DEFAULT_SCENARIOS},{sourceOnly:true});if(report.verdict!=='pass'){report.findings.push('Patch rejected; the owned source was not changed. Submit a complete syntactically valid replacement for this location.');return report;}await this.stage(source);if(compacted)report.evidence.push('Removed comments with Acorn ranges, preserving all line terminators; executable tokens remain unchanged');return report;},async apply(artifact,options){const report=checkCode(artifact,options);if(report.verdict!=='pass')return report;await mkdir(resolve(directory,'generated'),{recursive:true});await writeFile(file,artifact.source);return report;}});
}
