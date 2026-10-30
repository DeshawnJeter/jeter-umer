export function validateChange(data){
 if(typeof data.request!=='string'||!data.request.trim()||data.request.length>600)throw Error('Describe the change in 1–600 characters');
 if(!Array.isArray(data.preserve)||data.preserve.length>6||data.preserve.some(item=>typeof item!=='string'||!item.trim()||item.length>180))throw Error('List up to six behaviors to preserve');
 return {request:data.request.trim(),preserve:data.preserve.map(item=>item.trim()),sourceVersionId:data.versionId,status:'proposed'};
}
export async function requestChange(manager,projectId,data){
 const change=validateChange(data),snapshot=await manager.versions.get(projectId,data.versionId);
 const prompt=`${snapshot.brief.prompt}\nRequested change: ${change.request}\nPreserve: ${change.preserve.join('; ')}`;
 if(prompt.length>2000)throw Error('Combined game brief and change exceed 2000 characters; shorten the change or preservation list');
 return manager.create({...snapshot.brief,prompt,inputMode:'manual',projectId},{parentVersionId:data.versionId,changeRequest:change,initialSource:snapshot.results.coding?.artifact.source||null});
}
