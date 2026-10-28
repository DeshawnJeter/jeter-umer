const $ = selector => document.querySelector(selector);
let selected = null, current = null, previewUrl = '', questionSignature = '', planSignature = '', busy = false;
const checkLabels = { movement: 'Movement and wall collisions work', collectAndWin: 'Collecting every star and entering the portal wins', timeoutAndRestart: 'Timeout loses, and restart resets the game', audioControls: 'Sound starts after a gesture; mute and volume work', presentation: 'Title, instructions, HUD, and story are readable' };
async function api(path, data) { const res = await fetch(path, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const result = await res.json(); if (!res.ok) throw new Error(result.error); return result; }
function element(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
async function perform(fn) { if (busy) return; busy = true; $('#error').textContent = ''; try { await fn(); await refresh(); } catch (error) { $('#error').textContent = error.message; } finally { busy = false; } }
async function action(name, data = {}) { await api(`/api/runs/${selected}/${name}`, data); }
$('#brief').onsubmit = event => { event.preventDefault(); perform(async () => { const run = await api('/api/runs', { title: $('#title').value, prompt: $('#prompt').value, difficulty: $('#difficulty').value, music: $('#music').checked, askStory: $('#ask-story').checked }); selected = run.id; }); };
function renderPlan(run) {
  $('#plan').hidden = run.status !== 'awaiting_plan';
  const signature = `${run.id}:${run.status}:${run.planHash}`;
  if (signature === planSignature) return; planSignature = signature; $('#plan').replaceChildren();
  if (run.status !== 'awaiting_plan') return;
  const plan = run.results.planner.artifact;
  $('#plan').append(element('h3', 'Review the checked plan'), element('p', `${plan.title}: ${plan.objective}`), element('p', `Difficulty: ${plan.difficulty}. Music: ${run.brief.music ? 'enabled' : 'disabled'}.`), element('p', 'The planner checker passed. Specialists will start after you approve this plan.'));
  const approve = element('button', 'Approve plan and start specialists'); const id = run.id, planHash = run.planHash;
  approve.onclick = () => perform(() => api(`/api/runs/${id}/approve_plan`, { planHash })); $('#plan').append(approve);
  const form = document.createElement('form');
  const title = element('label', 'Revise game title'); const field = document.createElement('input'); field.value = run.brief.title; field.maxLength = 60; field.required = true; title.append(field);
  const difficultyLabel = element('label', 'Revised difficulty'); const difficulty = document.createElement('select');
  for (const value of ['beginner', 'experienced']) { const option = element('option', value); option.value = value; difficulty.append(option); } difficulty.value = run.brief.difficulty; difficultyLabel.append(difficulty);
  const revise = element('button', 'Update plan', 'secondary'); revise.type = 'submit'; form.append(title, difficultyLabel, revise);
  form.onsubmit = event => { event.preventDefault(); perform(() => api(`/api/runs/${id}/revise_plan`, { title: field.value, difficulty: difficulty.value })); }; $('#plan').append(form);
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
  $('#run-title').textContent = run.brief.title; $('#run-status').textContent = `${run.status.replaceAll('_', ' ')} · ${run.steps}/40 steps · ${run.mode === 'openai' ? `OpenAI: ${run.providerUsage?.calls || 0} calls, ${run.providerUsage?.totalTokens || 0} reported tokens` : 'local demo'}${run.error ? ' · ' + run.error : ''}`;
  $('#controls').replaceChildren();
  const buttons = run.status === 'running' ? [['Pause', 'pause'], ['Cancel', 'cancel']] : run.status === 'paused' ? [['Resume', 'resume'], ['Cancel', 'cancel']] : ['awaiting_human', 'awaiting_plan', 'awaiting_review'].includes(run.status) ? [['Cancel', 'cancel']] : [];
  for (const [label, command] of buttons) { const button = element('button', label, 'secondary'); button.onclick = () => perform(() => action(command)); $('#controls').append(button); }
  renderPlan(run); renderQuestions(run);
  $('#agents').replaceChildren();
  for (const role of ['planner', 'gameplay', 'levels', 'ui', 'story', 'audio']) {
    const agent = run.agents[role], result = run.results[role]; const box = element('div', undefined, `agent ${result ? 'accepted' : ''}`);
    box.append(element('strong', role), element('p', agent ? `${agent.stage} · attempt ${agent.attempt}` : 'Waiting for dependencies'));
    if (result) { box.append(element('small', 'Independent checker: pass')); const details = element('details'); details.append(element('summary', 'Evidence'), element('p', result.report.evidence.join('. '))); box.append(details); }
    $('#agents').append(box);
  }
  $('#review').hidden = !run.build;
  if (run.build) {
    $('#validation').textContent = run.validation.scope;
    const nextUrl = run.build.url;
    if (previewUrl !== nextUrl) {
      previewUrl = nextUrl; $('#preview').src = nextUrl; $('#checklist').replaceChildren();
      for (const [key, label] of Object.entries(checkLabels)) { const row = element('label', undefined, 'inline'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.dataset.check = key; row.append(checkbox, document.createTextNode(label)); $('#checklist').append(row); }
      $('#revision-difficulty').value = run.brief.difficulty; $('#revision-music').checked = run.brief.music;
    }
    $('#open-game').href = nextUrl; $('#download').href = `/api/runs/${run.id}/download`;
    $('#approve').disabled = run.status !== 'awaiting_review'; $('#revise').disabled = run.status !== 'awaiting_review';
  } else { if (previewUrl) $('#preview').src = 'about:blank'; previewUrl = ''; }
  $('#events').replaceChildren(...run.events.slice(-50).map(event => element('li', `${new Date(event.at).toLocaleTimeString()} ${event.message}`)));
}
$('#approve').onclick = () => perform(() => action('approve', { sha256: current.build.sha256, checks: Object.fromEntries([...document.querySelectorAll('[data-check]')].map(el => [el.dataset.check, el.checked])) }));
$('#revise').onclick = () => perform(() => action('revise', { difficulty: $('#revision-difficulty').value, music: $('#revision-music').checked }));
let refreshing = false;
async function refresh() {
  if (refreshing) return; refreshing = true;
  try { const runs = await api('/api/runs'); $('#history').replaceChildren(); for (const run of runs) { const button = element('button', `${run.brief.title} · ${run.status.replaceAll('_', ' ')}`); button.onclick = () => { selected = run.id; refresh(); }; $('#history').append(button); } if (!selected && runs.length) selected = runs[0].id; if (selected) render(await api(`/api/runs/${selected}`)); }
  finally { refreshing = false; }
}
api('/api/config').then(config => { $('#provider-status').textContent = config.mode === 'openai' ? 'OpenAI mode · API usage is billed' : 'Local demo · no API calls'; $('#create-run').textContent = config.mode === 'openai' ? 'Build with OpenAI' : 'Build a game'; $('#create-run').disabled = false; return refresh(); }).catch(error => { $('#error').textContent = error.message; });
setInterval(() => refresh().catch(error => { $('#error').textContent = error.message; }), 1500);
