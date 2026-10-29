import {parse} from 'acorn';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {codeScenarios,COMPONENT_CATALOG} from '../../../../shared/code-game.js';
export function checkCode(artifact){
  const findings=[];
  try{
    if(typeof artifact.source!=='string'||artifact.source.length>6000)throw Error('Source exceeds 6000 characters');
    const tree=parse(artifact.source,{ecmaVersion:'latest',sourceType:'module'});
    let exported=false;
    const walk=node=>{if(!node||typeof node!=='object')return;
      if(['ImportDeclaration','ImportExpression','ExportAllDeclaration'].includes(node.type)||node.type==='ExportNamedDeclaration'&&node.source)throw Error('Imports and re-exports are not allowed; use supplied api components');
      if(node.type==='ExportNamedDeclaration'&&node.declaration?.type==='FunctionDeclaration'&&node.declaration.id?.name==='createGame')exported=true;
      if(node.type==='Identifier'&&['eval','Function','fetch','XMLHttpRequest','WebSocket','Worker','SharedWorker','importScripts','globalThis','self','postMessage','close','navigator','location','indexedDB','caches'].includes(node.name))throw Error('Host capabilities are unavailable in game rules');
      for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
    };walk(tree);if(!exported)throw Error('Export function createGame(api)');codeScenarios(artifact.scenarios);
  }catch(error){findings.push(error.message.slice(0,300));}
  return {verdict:findings.length?'fail':'pass',findings,evidence:['Parsed JavaScript without executing it on the server','Checked source ownership, unavailable capabilities and bounded win/loss scenario structure'],scope:'syntax-and-contract'};
}
export function codeWorkspace(directory){
  const file=resolve(directory,'generated','rules.js');
  return Object.freeze({catalog:()=>COMPONENT_CATALOG,async read(path='generated/rules.js'){if(path!=='generated/rules.js')throw Error('Outside owned game source');return readFile(file,'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});},async search(query){if(typeof query!=='string'||query.length>80)throw Error('Invalid search');return (await this.read()).split('\n').map((line,i)=>({line:i+1,text:line})).filter(row=>row.text.includes(query)).slice(0,12);},async apply(artifact){const report=checkCode(artifact);if(report.verdict!=='pass')return report;await mkdir(resolve(directory,'generated'),{recursive:true});await writeFile(file,artifact.source);return report;}});
}
