export function projectWorkspace({api,perform,selectRun,getRun}){
 const $=id=>document.getElementById(id),node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 let projectId='',signature='',projects=[],lastRunId='';
 const selector=$('project-select');selector.onchange=()=>{projectId=selector.value;signature='';};
 const runAction=(path,data)=>perform(async()=>{const run=await api(path,data);selectRun(run.id);signature='';});
 $('save-version').onclick=()=>perform(async()=>{const run=getRun();await api(`/api/runs/${run.id}/save_version`,{});projectId=run.projectId;signature='';});
 $('asset-assignment-form').onsubmit=event=>{event.preventDefault();perform(async()=>{await api(`/api/projects/${projectId}/assign_assets`,{bindings:Object.fromEntries(['background','player','music'].map(slot=>[slot,$('asset-'+slot).value]))});signature='';});};
 $('asset-form').onsubmit=event=>{event.preventDefault();perform(async()=>{const file=$('asset-file').files[0];if(!file||file.size>2*1024*1024)throw Error('Choose a file up to 2 MB');const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));await api(`/api/projects/${projectId}/assets`,{name:$('asset-name').value,license:$('asset-license').value,attribution:$('asset-attribution').value,base64:btoa(binary)});$('asset-form').reset();signature='';});};
 $('acceptance-field').onchange=()=>{const label=$('acceptance-field').value==='label';$('acceptance-value').type=label?'text':'number';$('acceptance-value').maxLength=40;$('acceptance-value').value=label?'':'1';};
 $('acceptance-form').onsubmit=event=>{event.preventDefault();perform(async()=>{const p=await api('/api/projects/'+projectId);await api(`/api/projects/${projectId}/acceptance`,{cases:[...(p.acceptanceCases||[]),{name:$('acceptance-name').value,steps:[{dt:0.1,actions:$('acceptance-action').value?[$('acceptance-action').value]:[],repeat:Number($('acceptance-frames').value)}],assertions:[{field:$('acceptance-field').value,op:'eq',value:$('acceptance-field').value==='label'?$('acceptance-value').value:Number($('acceptance-value').value)}]}]});signature='';});};
 $('change-form').onsubmit=event=>{event.preventDefault();runAction(`/api/projects/${projectId}/change`,{versionId:$('feedback-version').value,request:$('change-request').value,preserve:$('change-preserve').value.split('\n').map(s=>s.trim()).filter(Boolean)});};
 $('feedback-form').onsubmit=event=>{event.preventDefault();perform(async()=>{await api(`/api/projects/${projectId}/feedback`,{versionId:$('feedback-version').value,title:$('feedback-title').value,expected:$('feedback-expected').value,actual:$('feedback-actual').value,steps:$('feedback-steps').value,roles:[$('feedback-role').value]});$('feedback-form').reset();signature='';});};
 $('compare-versions').onclick=()=>perform(async()=>{const result=await api(`/api/projects/${projectId}/compare?left=${$('compare-left').value}&right=${$('compare-right').value}`);$('comparison').textContent=`${result.sameBuild?'Identical game files.':'Game files differ.'} Changed contributions: ${result.changedRoles.join(', ')||'none'}. Changed settings: ${result.briefChanges.join(', ')||'none'}.`;});
 return {projectId:()=>selector.value,async refresh(run){
  projects=await api('/api/projects');const selected=selector.value;const optionsSignature=JSON.stringify(projects.map(p=>[p.id,p.title]));
  if(selector.dataset.signature!==optionsSignature){selector.replaceChildren(node('option','New project'));selector.options[0].value='';for(const p of projects){const option=node('option',p.title);option.value=p.id;selector.append(option);}selector.value=selected;selector.dataset.signature=optionsSignature;}
  if(run?.projectId&&run.id!==lastRunId){projectId=run.projectId;lastRunId=run.id;selector.value=projectId;signature='';}
  const p=projects.find(p=>p.id===projectId);$('project-workspace').hidden=!p;if(!p)return;
  $('project-heading').textContent=p.title;$('save-version').disabled=run?.projectId!==p.id||!run?.build||!['awaiting_review','failed','complete'].includes(run.status);
  const next=JSON.stringify([p.versions,p.feedback,p.acceptanceCases,p.assets,p.assetSelection]);if(next===signature)return;signature=next;
  for(const id of ['feedback-version','compare-left','compare-right']){const select=$(id),value=select.value;select.replaceChildren();for(const v of p.versions){const option=node('option',v.label||`${v.createdAt.slice(0,19)} · ${v.buildHash.slice(0,8)}`);option.value=v.id;select.append(option);}if([...select.options].some(o=>o.value===value))select.value=value;else if(id!=='compare-left'&&select.options.length)select.selectedIndex=select.options.length-1;}
  $('feedback-submit').disabled=!p.versions.length;$('compare-versions').disabled=p.versions.length<2;
  $('project-versions').replaceChildren();for(const v of p.versions.toReversed()){
   const row=node('article');row.append(node('p',`${v.label||'Saved version'} · ${v.buildHash.slice(0,12)} · ${v.approval?'Human approved these bytes':'Human approval pending'}`));
   const download=node('a','Download editable project');download.href=`/api/projects/${p.id}/export/${v.id}`;row.append(download);
   const restore=node('button','Restore as a new run');restore.onclick=()=>runAction(`/api/projects/${p.id}/restore`,{versionId:v.id});row.append(restore);
   const name=node('input');name.maxLength=60;name.placeholder='Milestone name';name.setAttribute('aria-label','Milestone name');name.value=v.label;const save=node('button','Name milestone');save.onclick=()=>perform(async()=>{await api(`/api/projects/${p.id}/milestone`,{versionId:v.id,label:name.value});signature='';});row.append(name,save);$('project-versions').append(row);
  }
  for(const slot of ['background','player','music']){const select=$('asset-'+slot);select.replaceChildren(node('option','Procedural / synthesized default'));select.options[0].value='';for(const asset of p.assets||[])if(asset.kind===(slot==='music'?'audio':'image')){const option=node('option',asset.name);option.value=asset.id;select.append(option);}select.value=p.assetSelection?.[slot]||'';}
  $('asset-list').replaceChildren(...(p.assets||[]).map(a=>node('p',`${a.name} · ${a.kind} · ${a.bytes} bytes · ${a.license}`)));
  $('acceptance-list').replaceChildren(...(p.acceptanceCases||[]).map(c=>node('p',c.name+': '+c.assertions.map(a=>a.field+' '+a.op+' '+a.value).join(', '))));
  $('project-feedback').replaceChildren();for(const item of p.feedback.toReversed()){
   const row=node('article');row.append(node('p',`${item.status.toUpperCase()}: ${item.title}`),node('p',`Expected: ${item.expected||'—'} Actual: ${item.actual||'—'}`),node('p',item.steps));
   if(item.status==='open'){const repair=node('button','Make a repair plan');repair.onclick=()=>runAction(`/api/projects/${p.id}/repair`,{versionId:$('feedback-version').value,feedbackIds:[item.id],preserve:[]});row.append(repair);}
   const note=node('input');note.maxLength=500;note.placeholder='Review note';note.setAttribute('aria-label','Feedback review note');row.append(note);
   for(const [status,label]of [['resolved','Resolve after testing selected version'],['deferred','Defer'],['open','Reopen']]){if(item.status===status)continue;const button=node('button',label);button.onclick=()=>perform(async()=>{await api(`/api/projects/${p.id}/feedback/${item.id}`,{status,note:note.value,verifiedVersionId:$('feedback-version').value});signature='';});row.append(button);}$('project-feedback').append(row);
  }
 }};
}
