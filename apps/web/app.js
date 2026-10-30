import {projectWorkspace} from './project-workspace.js';
import './preferences.js';
const $ = selector => document.querySelector(selector);
function handoffDescription(handoff){
  const prefix=handoff.role+': ';
  if(handoff.summary.startsWith(prefix+'{')){try{const fields=JSON.parse(handoff.summary.slice(prefix.length));return Object.entries(fields).filter(([key])=>!key.endsWith('Hash')).map(([key,value])=>`${key.replace(/[A-Z]/g,letter=>' '+letter.toLowerCase())}: ${Array.isArray(value)?value.join(', '):value}`).join('; ');}catch{/* Older summaries remain readable plain text. */}}
  return handoff.summary;
}
let selected = null, current = null, previewUrl = '', questionSignature = '', planSignature = '', busy = false, providerMode = 'scripted-demo';
const checkLabels = { enemyReactions:'Stealth guards patrol, investigate sightings, pursue, search, and can cause defeat', movement: 'Applicable movement, collisions, jumping or battle targeting work', collectAndWin: 'The selected game mechanics, resources, objective and win condition work', timeoutAndRestart: 'Loss, restart, checkpoints and any timer work where applicable', audioControls: 'Sound starts after a gesture; mute and volume work', presentation: 'Title, instructions, HUD, animation and visual effects are readable' };
async function api(path, data) { const res = await fetch(path, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const result = await res.json(); if (!res.ok) throw new Error(result.error); return result; }
function element(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
function choiceLabel(selector,value) { return [...$(selector).options].find(option=>option.value===value)?.textContent || value; }
async function perform(fn) { if (busy) return; busy = true; $('#error').textContent = ''; try { await fn(); await refresh(); } catch (error) { $('#error').textContent = error.message; } finally { busy = false; } }
async function action(name, data = {}) { await api(`/api/runs/${selected}/${name}`, data); }
$('#prompt-only').onchange = () => {
  const promptOnly=$('#prompt-only').checked;$('#manual-settings').disabled=promptOnly;$('#manual-settings').hidden=promptOnly;
  $('#input-mode-help').textContent=promptOnly?(providerMode==='openai'?'The planner will interpret your prompt. ':'Demo mode recognizes supported labels and keywords. ')+'Hidden form values are ignored. Review, edit and approve the checked plan before specialists start.':'Form selections take priority over your description. You will review a plan before building.';
};
$('#brief').onsubmit = event => { event.preventDefault(); perform(async () => {
  const data=$('#prompt-only').checked?{inputMode:'prompt',prompt:$('#prompt').value}:{inputMode:'manual',title:$('#title').value,prompt:$('#prompt').value,genre:$('#genre').value,theme:$('#theme').value,musicStyle:$('#music-style').value,musicInstrument:$('#music-instrument').value,difficulty:$('#difficulty').value,music:$('#music').checked,askStory:$('#ask-story').checked};
  data.budgetLimits={...($('#budget-calls').value?{maxCalls:Number($('#budget-calls').value)}:{}),...($('#budget-tokens').value?{maxTotalTokens:Number($('#budget-tokens').value)}:{})};data.projectId=workspace.projectId()||undefined;const run=await api('/api/runs',data);selected=run.id;
}); };
function renderPlan(run) {
  $('#plan').hidden = run.status !== 'awaiting_plan';
  const signature = `${run.id}:${run.status}:${run.planHash}`;
  if (signature === planSignature) return; planSignature = signature; $('#plan').replaceChildren();
  if (run.status !== 'awaiting_plan') return;
  const plan = run.results.planner.artifact;
  if(run.costEstimate)$('#plan').append(element('p',`Estimated first pass: ${run.costEstimate.calls} model requests${run.costEstimate.estimatedDollars===null?'':` · about ${run.costEstimate.estimatedDollars}`}. ${run.costEstimate.assumptions||run.costEstimate.note} ${run.budgetLimits?`Limits: ${run.budgetLimits.maxCalls} calls / ${run.budgetLimits.maxTotalTokens} tokens.`:''}`));
  if(plan.acceptance){const list=element('ul');list.append(...plan.acceptance.map(item=>element('li',item)));$('#plan').append(element('h4','What we will test'),list);}
  if(run.brief.genre==='custom'&&run.mode!=='openai')$('#plan').append(element('p','Local demo uses a small example game. OpenAI mode is required to write new mechanics from your description.'));
  $('#plan').append(element('h3', 'Review the checked plan'), element('p', `${plan.title}: ${plan.objective}`), element('p', `Game type: ${choiceLabel('#genre',run.brief.genre || 'collector')}. Art: ${choiceLabel('#theme',run.brief.theme || 'space')}. Difficulty: ${plan.difficulty}. Music: ${run.brief.music ? `${choiceLabel('#music-style',run.brief.musicStyle || 'adventure')} · ${choiceLabel('#music-instrument',run.brief.musicInstrument || 'auto')}` : 'disabled'}.`), element('p', 'The planner checker passed. Specialists will start after you approve this plan.'));
  if(plan.acceptance){const list=element('ul');list.append(...plan.acceptance.map(item=>element('li',item)));$('#plan').append(element('h4','What we will test'),list);}
  const resolution=run.briefResolution?.proposal;
  if(resolution){
    $('#plan').append(element('p',run.brief.inputMode==='prompt'?'Settings were extracted from your prompt and independently checked.':'The prompt settings were manually edited. This checked plan uses your edits.'));
    const source=element('details');source.append(element('summary','Original prompt'),element('p',run.briefResolution.sourcePrompt));$('#plan').append(source);
    for(const [key,label] of [['assumptions','Suggestions and assumptions'],['unsupportedRequests','Requested features this version cannot build']])if(resolution[key].length){const list=element('ul');list.append(...resolution[key].map(note=>element('li',note)));$('#plan').append(element('h4',label),list);}
  }
  const approve = element('button', 'Approve plan and start specialists'); const id = run.id, planHash = run.planHash;
  if(run.mode==='openai'&&run.minimumModelCalls)$('#plan').append(element('p',`This game activates ${run.requiredRoles.length} jobs: at least ${run.minimumModelCalls} model requests including independent checks. Current call limit: ${run.providerConfig.maxCalls}. Repairs and revisions use additional requests; token limits also apply.`));
  let acknowledge;
  if(resolution?.unsupportedRequests.length){const label=element('label',undefined,'inline');acknowledge=document.createElement('input');acknowledge.type='checkbox';acknowledge.id='acknowledge-unsupported';label.append(acknowledge,document.createTextNode('I understand these features will be omitted. Build only the supported plan above.'));$('#plan').append(label);approve.disabled=true;acknowledge.onchange=()=>{approve.disabled=!acknowledge.checked;};}
  approve.onclick = () => perform(() => api(`/api/runs/${id}/approve_plan`, { planHash,acceptUnsupported:acknowledge?.checked===true })); $('#plan').append(approve);
  const form = document.createElement('form');
  const title = element('label', 'Revise game title'); const field = document.createElement('input'); field.value = run.brief.title; field.maxLength = 60; field.required = true; title.append(field);
  const difficultyLabel = element('label', 'Revised difficulty'); const difficulty = document.createElement('select');
  for (const value of ['beginner', 'experienced']) { const option = element('option', value); option.value = value; difficulty.append(option); } difficulty.value = run.brief.difficulty; difficultyLabel.append(difficulty);
  const fields={};
  for(const [key,source,label] of [['genre','#genre','Edit game type'],['theme','#theme','Edit art theme'],['musicStyle','#music-style','Edit music style'],['musicInstrument','#music-instrument','Edit lead instrument']]){const row=element('label',label),select=$(source).cloneNode(true);select.id=`plan-${key}`;select.disabled=false;select.value=run.brief[key];row.append(select);fields[key]=select;form.append(row);}
  const musicLabel=element('label',undefined,'inline'),music=document.createElement('input');music.type='checkbox';music.checked=run.brief.music;musicLabel.append(music,document.createTextNode('Music enabled in this plan'));
  const revise = element('button', 'Update plan', 'secondary'); revise.type = 'submit'; form.prepend(title,difficultyLabel);form.append(musicLabel,revise);
  form.onsubmit = event => { event.preventDefault(); perform(() => api(`/api/runs/${id}/revise_plan`, { inputMode:'manual',title: field.value, difficulty: difficulty.value,music:music.checked,...Object.fromEntries(Object.entries(fields).map(([key,select])=>[key,select.value])) })); };
  const details=element('details');details.append(element('summary','Edit proposed settings'),form);$('#plan').append(details);
}
function renderQuestions(run) {
  $('#question').hidden = !run.questions.length;
  const allowed = ['awaiting_human', 'awaiting_plan', 'awaiting_review'].includes(run.status);
  const signature = `${run.id}:${JSON.stringify(run.questions)}`;
  if (signature === questionSignature) { for (const button of $('#question').querySelectorAll('button')) button.disabled = !allowed; return; }
  const drafts = new Map([...$('#question').querySelectorAll('form[data-question]')].map(form => [form.dataset.question, form.querySelector('textarea').value]));
  questionSignature = signature; $('#question').replaceChildren();
  for (const question of run.questions) {
    const section = element('section'); const source = question.requesters?.map(requester => `${requester.role} ${requester.source}`).join(', ') || question.role;
    section.append(element('h3', question.text), element('p', question.reason), element('p', `${source}. ${question.blocking ? 'Waiting: ' + question.affectedRoles.join(', ') : 'Optional context; other work can continue.'}`));
    if (question.recommended) section.append(element('p', `Suggested answer: ${question.recommended}`));
    const id = run.id;
    const respond = answer => perform(() => api(`/api/runs/${id}/answer`, { questionId: question.id, answer }));
    if (question.options.length) for (const answer of question.options) { const button = element('button', answer); button.disabled = !allowed; button.onclick = () => respond(answer); section.append(button); }
    else {
      const form = document.createElement('form'); form.dataset.question = question.id; const label = element('label', 'Your answer'); const field = document.createElement('textarea'); field.maxLength = question.maxLength; field.required = true; field.value = drafts.get(question.id) || ''; label.append(field);
      const button = element('button', 'Send answer'); button.type = 'submit'; button.disabled = !allowed; form.append(label, button);
      form.onsubmit = event => { event.preventDefault(); respond(field.value); }; section.append(form);
    }
    $('#question').append(section);
  }
}
function render(run) {
  current = run; $('#empty').hidden = true; $('#run').hidden = false;
  $('#run-title').textContent = run.brief.title; $('#run-status').textContent = `${run.status.replaceAll('_', ' ')} · ${run.steps}/${run.maxSteps||80} steps · ${run.mode === 'openai' ? `OpenAI: ${run.providerUsage?.calls || 0} calls, ${run.providerUsage?.totalTokens || 0} reported tokens` : 'local demo'}${run.error ? ' · ' + run.error : ''}`;
  $('#controls').replaceChildren();
  const buttons = run.status === 'running' ? [['Pause', 'pause'], ['Cancel', 'cancel']] : run.status === 'paused' ? [['Resume', 'resume'], ['Cancel', 'cancel']] : run.status==='failed'&&!run.build ? [['Retry interrupted work','retry'],['Cancel','cancel']] : ['awaiting_human', 'awaiting_plan', 'awaiting_review'].includes(run.status) ? [['Cancel', 'cancel']] : [];
  for (const [label, command] of buttons) { const button = element('button', label, 'secondary'); button.onclick = () => perform(() => action(command)); $('#controls').append(button); }
  $('#run-status').textContent += run.revisionScope ? ` · reused ${run.revisionScope.reusedRoles.length} checked contributions` : '';
  renderPlan(run); renderQuestions(run);
  $('#agents').replaceChildren();
  const selectedRoles=run.requiredRoles||['planner','gameplay','levels','ui','story','audio'];
  for (const role of selectedRoles) {
    const agent = run.agents[role], result = run.results[role]; const box = element('div', undefined, `agent ${result ? 'accepted' : ''}`);
    box.append(element('strong', role), element('p', agent ? `${agent.stage} · attempt ${agent.attempt}` : 'Waiting for dependencies'));
    if (run.roleUsage?.[role]) box.append(element('small', `${run.roleUsage[role].calls} model requests · ${run.roleUsage[role].totalTokens} reported tokens${run.roleUsage[role].unknownUsageCalls?' · some usage unreported':''}`));
    if (result) { box.append(element('small', 'Independent checker: pass')); const details = element('details'); details.append(element('summary', 'Evidence'), element('p', result.report.evidence.join('. '))); box.append(details); }
    $('#agents').append(box);
  }
  const existingMemory=$('#memory-summary'),memorySignature=run.memory?run.id+':'+run.memory.revision:'';
  if(existingMemory?.dataset.signature!==memorySignature){
    const wasOpen=existingMemory?.open&&existingMemory.dataset.project===run.id;existingMemory?.remove();
    if(run.memory){
      const memory=element('details');memory.id='memory-summary';memory.dataset.signature=memorySignature;memory.dataset.project=run.id;memory.open=!!wasOpen;
      memory.append(element('summary',`Project memory · revision ${run.memory.revision} · ${run.memory.handoffs.length} checked handoffs`));
      memory.append(element('p',`${run.memory.decisions.length} human decisions · ${run.memory.tests.length} test records. Changes mark dependent work stale; agent summaries do not approve requirements.`));
      for(const decision of run.memory.decisions)memory.append(element('p',`Your decision — ${decision.key}: ${decision.answer}`));
      for(const handoff of run.memory.handoffs.slice(-15))memory.append(element('p',`${handoff.role}: ${handoffDescription(handoff)}`));
      for(const record of run.memory.tests)memory.append(element('p',`${record.kind}: ${record.stale?'needs fresh checks':'current'}; browser playtesting and final approval remain yours.`));
      const link=element('a','View full project record');link.href=`/api/runs/${run.id}/memory`;link.target='_blank';memory.append(link);$('#agents').after(memory);
    }
  }
  $('#review').hidden = !run.build;
  if (run.build) {
    $('#validation').textContent = run.validation.scope+(run.browserChecks?(' Browser checks: '+(run.browserChecks.passed===true?'passed; full playthrough, audio quality and final approval remain yours.':run.browserChecks.passed===false?'failed — '+run.browserChecks.error:run.browserChecks.reason)):'');
    const previousBrowser=$('#browser-check-report'),browserSignature=JSON.stringify(run.browserChecks||null);
    if(previousBrowser?.dataset.signature!==browserSignature){const open=previousBrowser?.open;previousBrowser?.remove();if(run.browserChecks){const details=element('details');details.id='browser-check-report';details.dataset.signature=browserSignature;details.open=!!open||run.browserChecks.passed===false;details.append(element('summary','Automatic browser checks: '+(run.browserChecks.passed===true?'passed':run.browserChecks.passed===false?'failed':'disabled')));for(const check of run.browserChecks.tests||[])details.append(element('p',(check.passed?'Passed: ':'Failed: ')+check.name+(check.error?' — '+check.error:'')));details.append(element('p','These checks cover build loading, basic controls, failure and restart under a controlled clock. Full playthroughs, difficulty balance, music quality and final approval remain yours.'));$('#validation').after(details);}}
    const nextUrl = run.build.url;
    if (previewUrl !== nextUrl) {
      previewUrl = nextUrl; $('#preview').setAttribute('sandbox',run.brief.genre==='custom'?'allow-scripts allow-same-origin':'allow-scripts'); $('#preview').src = nextUrl; $('#checklist').replaceChildren();
      for (const key of (run.build.checksRequired||Object.keys(checkLabels).filter(key=>key!=='enemyReactions'))) { const label=checkLabels[key]||key; const row = element('label', undefined, 'inline'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.dataset.check = key; row.append(checkbox, document.createTextNode(label)); $('#checklist').append(row); }
      $('#revision-difficulty').value = run.brief.difficulty; $('#revision-music').checked = run.brief.music; $('#revision-genre').value = run.brief.genre || 'collector'; $('#revision-theme').value = run.brief.theme || 'space'; $('#revision-music-style').value = run.brief.musicStyle || 'adventure'; $('#revision-music-instrument').value = run.brief.musicInstrument || 'auto';
    }
    $('#open-game').href = nextUrl; $('#download').href = `/api/runs/${run.id}/download`;
    $('#approve').disabled = run.status !== 'awaiting_review'; $('#revise').disabled = !['awaiting_review','failed'].includes(run.status);
  } else { if (previewUrl) $('#preview').src = 'about:blank'; previewUrl = ''; }
  $('#events').replaceChildren(...run.events.slice(-50).map(event => element('li', `${new Date(event.at).toLocaleTimeString()} ${event.message}`)));
}
$('#approve').onclick = () => perform(() => action('approve', { sha256: current.build.sha256, checks: Object.fromEntries([...document.querySelectorAll('[data-check]')].map(el => [el.dataset.check, el.checked])) }));
$('#revise').onclick = () => perform(() => action('revise', { genre: $('#revision-genre').value, theme: $('#revision-theme').value, musicStyle: $('#revision-music-style').value, musicInstrument: $('#revision-music-instrument').value, difficulty: $('#revision-difficulty').value, music: $('#revision-music').checked }));
const workspace=projectWorkspace({api,perform,getRun:()=>current,selectRun:id=>{selected=id;}});
let refreshing = false;
async function refresh() {
  if (refreshing) return; refreshing = true;
  try { const runs = await api('/api/runs'); $('#history').replaceChildren(); for (const run of runs) { const button = element('button', `${run.brief.title} · ${run.status.replaceAll('_', ' ')}`); button.onclick = () => { selected = run.id; refresh(); }; $('#history').append(button); } if (!selected && runs.length) selected = runs[0].id; if (selected) render(await api(`/api/runs/${selected}`)); await workspace.refresh(current); }
  finally { refreshing = false; }
}
function musicOptions(id,options,value) { const select=$(id);select.replaceChildren(...options.map(item=>{const option=element('option',item.label);option.value=item.value;return option;}));select.value=value; }
Promise.all([api('/api/config'),api('/api/music-catalog'),api('/api/game-catalog')]).then(([config,catalog,games]) => {
  providerMode=config.mode;for(const id of ['#genre','#revision-genre'])musicOptions(id,games,'collector');
  for(const id of ['#music-style','#revision-music-style'])musicOptions(id,catalog.styles,'adventure');
  for(const id of ['#music-instrument','#revision-music-instrument'])musicOptions(id,catalog.instruments,'auto');
  $('#provider-status').textContent = config.mode === 'openai' ? 'OpenAI mode · API usage is billed' : 'Local demo · no API calls'; $('#create-run').textContent = config.mode === 'openai' ? 'Build with OpenAI' : 'Build a game'; $('#create-run').disabled = false; return refresh();
}).catch(error => { $('#error').textContent = error.message; });
setInterval(() => refresh().catch(error => { $('#error').textContent = error.message; }), 1500);
