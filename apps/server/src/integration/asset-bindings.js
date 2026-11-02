import {mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
export function validateBindings(project,bindings){
 const result={};for(const slot of Object.keys(bindings)){if(!['background','player','music'].includes(slot))throw Error('Unknown asset slot');const id=bindings[slot];if(!id)continue;const asset=project.assets?.find(a=>a.id===id);if(!asset||asset.kind!==(slot==='music'?'audio':'image'))throw Error('Assignment must use an asset of the right kind from this project');result[slot]=id;}return result;
}
export async function bindAssets(manager,run,config){
 const project=await manager.projects.get(run.projectId),bindings={...run.assetSelection};
 for(const slot of ['background','player','music']){const choice=config.art?.[slot+'Asset'];if(choice==='none')delete bindings[slot];else if(choice&&choice!=='auto'&&!bindings[slot])bindings[slot]=choice;}
 const selected=validateBindings(project,bindings),records=[];config.importedAssets={};
 for(const [slot,id]of Object.entries(selected)){const {asset,bytes}=await manager.assets.bytes(project.id,id);const path=`assets/${id}.${asset.extension}`;config.importedAssets[slot]=path;records.push({slot,path,asset,bytes});}
 return async folder=>{await mkdir(resolve(folder,'assets'),{recursive:true});for(const record of records)await writeFile(resolve(folder,record.path),record.bytes);await writeFile(resolve(folder,'imported-assets-manifest.json'),JSON.stringify(records.map(({bytes,...record})=>record),null,2));};
}
