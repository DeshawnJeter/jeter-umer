const $ = selector => document.querySelector(selector);
let selected = null, current = null, previewUrl = '', busy = false;
const checkLabels = { movement: 'Movement and wall collisions work', collectAndWin: 'Collecting every star and entering the portal wins', timeoutAndRestart: 'Timeout loses, and restart resets the game', audioControls: 'Sound starts after a gesture; mute and volume work', presentation: 'Title, instructions, HUD, and story are readable' };
async function api(path, data) { const res = await fetch(path, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const result = await res.json(); if (!res.ok) throw new Error(result.error); return result; }
function element(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
async function perform(fn) { if (busy) return; busy = true; $('#error').textContent = ''; try { await fn(); await refresh(); } catch (error) { $('#error').textContent = error.message; } finally { busy = false; } }
async function action(name, data = {}) { await api(`/api/runs/${selected}/${name}`, data); }
$('#brief').onsubmit = event => { event.preventDefault(); perform(async () => { const run = await api('/api/runs', { title: $('#title').value, prompt: $('#prompt').value, difficulty: $('#difficulty').value, music: $('#music').checked }); selected = run.id; }); };
function render(run) {
  current = run; $('#empty').hidden = true; $('#run').hidden = false;
  $('#run-title').textContent = run.brief.title; $('#run-status').textContent = `${run.status.replaceAll('_', ' ')} · ${run.steps}/40 steps${run.error ? ' · ' + run.error : ''}`;
  $('#controls').replaceChildren();
  const buttons = run.status === 'running' ? [['Pause', 'pause'], ['Cancel', 'cancel']] : run.status === 'paused' ? [['Resume', 'resume'], ['Cancel', 'cancel']] : ['awaiting_human', 'awaiting_review'].includes(run.status) ? [['Cancel', 'cancel']] : [];
  for (const [label, command] of buttons) { const button = element('button', label, 'secondary'); button.onclick = () => perform(() => action(command)); $('#controls').append(button); }
  $('#question').hidden = run.status !== 'awaiting_human'; $('#question').replaceChildren();
  if (run.status === 'awaiting_human') { $('#question').append(element('h3', 'An agent needs your context'), element('p', run.questions[0].text)); for (const answer of run.questions[0].options) { const button = element('button', answer); button.onclick = () => perform(() => action('answer', { answer })); $('#question').append(button); } }
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
  } else previewUrl = '';
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
refresh().catch(error => { $('#error').textContent = error.message; });
setInterval(() => refresh().catch(error => { $('#error').textContent = error.message; }), 1500);
