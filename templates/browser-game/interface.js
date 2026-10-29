import { hudFor, validateHud, defaultSettings, remap, KEY_CODES, keyLabel } from './player-ui.js';
import { loadPreferences, savePreferences } from './preferences.js';
const $ = selector => document.querySelector(selector);
export class PlayerInterface {
  constructor(options) { Object.assign(this, options); this.keys = new Set(); this.previousPhase = null; this.capture = null; }
  async initialize() {
    const loaded = await loadPreferences(defaultSettings(this.audio.volume, this.audio.muted));
    this.settings = loaded.settings; this.storage = loaded.storage;
    this.hud = validateHud(this.config.ui.hud, this.genre).length ? hudFor(this.genre) : this.config.ui.hud;
    $('#hud').dataset.layout = this.hud.layout;
    for (const stat of this.hud.stats) {
      const card = document.createElement('div'); card.className = 'stat'; card.id = `stat-${stat}`;
      const label = document.createElement('span'); label.className = 'stat-label'; label.textContent = { health:'Health / shields', stars:this.genre === 'survival' ? 'Healing stars' : this.genre === 'maze' ? 'Bonus stars' : 'Stars collected', time:this.genre === 'survival' ? 'Survive for' : 'Time remaining', objective:'Portal objective' }[stat];
      const value = document.createElement('strong'); value.id = `value-${stat}`; card.append(label, value);
      if (['time','health'].includes(stat)) { const meter = document.createElement('progress'); meter.id = `meter-${stat}`; meter.setAttribute('aria-label', label.textContent); card.append(meter); }
      $('#hud').append(card);
    }
    $('#pause').onclick = () => this.pause(); $('#resume').onclick = () => this.resume();
    $('#menu-restart').onclick = () => this.restart();
    $('#pause-menu').addEventListener('cancel', event => { event.preventDefault(); this.resume(); });
    for (const key of ['volume','musicVolume','sfxVolume']) {
      $(`#${key}`).oninput = event => { this.settings[key] = Number(event.target.value); this.apply(true); };
    }
    for (const key of ['muted','musicMuted','sfxMuted']) $(`#${key}`).onchange = event => { this.settings[key] = event.target.checked; this.apply(true); };
    $('#mute').onclick = () => this.toggleMute();
    $('#reset-controls').onclick = () => { this.settings.bindings = defaultSettings().bindings; this.capture = null; $('#binding-error').textContent = ''; this.apply(true); this.controls(); };
    $('#pause-menu').addEventListener('close', () => { if (this.previousPhase !== null) this.resume(); });
    addEventListener('keydown', event => this.keydown(event));
    addEventListener('keyup', event => this.keys.delete(event.code));
    this.apply(); this.controls(); this.render();
    if (!this.config.audio.music) { $('#musicVolume').disabled = true; $('#musicMuted').disabled = true; $('#music-note').textContent = 'This game was built without background music.'; }
  }
  apply(save = false) {
    const { volume, muted, musicVolume, sfxVolume, musicMuted, sfxMuted } = this.settings;
    Object.assign(this.audio, { volume, muted, musicVolume, sfxVolume, musicMuted, sfxMuted }); this.audio.update();
    for (const key of ['volume','musicVolume','sfxVolume']) { $(`#${key}`).value = this.settings[key]; $(`#${key}-value`).textContent = `${Math.round(this.settings[key] / (key === 'volume' ? 0.3 : 1) * 100)}%`; }
    for (const key of ['muted','musicMuted','sfxMuted']) $(`#${key}`).checked = this.settings[key];
    $('#mute').textContent = muted ? 'Unmute all' : 'Mute all'; $('#mute').setAttribute('aria-pressed', String(muted));
    const saved = save ? savePreferences(this.settings, this.storage) : this.storage !== 'session';
    $('#settings-status').textContent = saved ? 'Preferences saved on this device.' : 'Preferences apply to this session; device storage is unavailable.';
  }
  toggleMute() {
    this.settings.muted = !this.settings.muted; this.apply(true);
    if (this.state.phase === 'playing') $('#game').focus();
  }
  controls(focusAction) {
    $('#bindings').replaceChildren();
    const actions = this.genre === 'platformer' ? ['left','right','jump'] : ['left','right','up','down'];
    for (const action of actions) {
      const row = document.createElement('div'); row.className = 'binding';
      const label = document.createElement('span'); label.textContent = action[0].toUpperCase() + action.slice(1);
      const button = document.createElement('button'); button.type = 'button'; button.textContent = this.capture === action ? 'Press a letter, number or arrow…' : this.settings.bindings[action].map(keyLabel).join(' / '); button.setAttribute('aria-label', `Change ${action} control`);
      button.onclick = () => { this.capture = action; $('#binding-error').textContent = 'Press a key. Escape cancels. Keys must be unique.'; this.controls(); $('#bindings').querySelector(`[aria-label="Change ${action} control"]`).focus(); };
      row.append(label, button); $('#bindings').append(row);
    }
    const hint = actions.map(action => `${action}: ${this.settings.bindings[action].map(keyLabel).join(' / ')}`).join(' · ');
    $('#instructions').textContent = `${hint}. Escape pauses. ${this.config.planner.objective}`;
    if (focusAction) $('#bindings').querySelector(`[aria-label="Change ${focusAction} control"]`)?.focus();
  }
  keydown(event) {
    if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
    if (this.capture) {
      event.preventDefault();
      const action = this.capture;
      if (event.code === 'Escape') { this.capture = null; $('#binding-error').textContent = ''; this.controls(action); return; }
      if (!KEY_CODES.includes(event.code)) { $('#binding-error').textContent = 'Use a letter, number, arrow key or Space.'; return; }
      try { this.settings = remap(this.settings, action, event.code); this.capture = null; this.apply(true); $('#binding-error').textContent = 'Control updated.'; this.controls(action); } catch (error) { $('#binding-error').textContent = error.message; }
      return;
    }
    if (event.code === 'Escape' && !event.repeat) { event.preventDefault(); if (this.previousPhase !== null) this.resume(); else this.pause(); return; }
    if (this.state.phase !== 'playing' || event.target.closest?.('button,input,select,textarea,dialog')) return;
    if (Object.values(this.settings.bindings).some(codes => codes.includes(event.code))) {
      event.preventDefault(); this.keys.add(event.code);
      const jumpKeys = this.settings.bindings.jump;
      if (!event.repeat && this.genre === 'platformer' && jumpKeys.includes(event.code)) this.onJump();
    }
  }
  isDown(action) { return this.held.has(action) || this.settings.bindings[action].some(key => this.keys.has(key)); }
  clearInput() { this.keys.clear(); this.held.clear(); }
  pause() {
    if (!this.state.ready || this.previousPhase !== null) return;
    this.previousPhase = this.state.phase; this.state.phase = 'paused'; this.clearInput(); this.onPause(); this.audio.setPlaying(false); this.render(); $('#status').textContent = 'PAUSED';
    $('#pause-menu').showModal(); $('#resume').focus();
  }
  resume() {
    if (this.previousPhase === null) return;
    this.capture = null; this.clearInput(); this.state.phase = this.previousPhase; this.previousPhase = null;
    $('#pause-menu').close(); this.onResume(); this.audio.setPlaying(this.state.phase === 'playing'); this.controls(); this.render(); $('#status').textContent = this.state.phase.toUpperCase(); $('#game').focus();
  }
  restart() { if (this.previousPhase !== null) this.resume(); this.clearInput(); this.audio.setPlaying(false); this.onRestart(); }
  render() {
    $('#hud').dataset.phase = this.state.phase;
    for (const stat of this.hud.stats) {
      const value = $(`#value-${stat}`);
      if (stat === 'health') { value.textContent = `${Math.max(0,this.state.health)} / 3`; $('#meter-health').max = 3; $('#meter-health').value = Math.max(0,this.state.health); $('#stat-health').dataset.low = String(this.state.health <= 1); }
      if (stat === 'stars') value.textContent = `${this.state.score} / ${this.state.required}`;
      if (stat === 'time') { value.textContent = `${Math.ceil(this.state.remaining)}s`; $('#meter-time').max = this.config.gameplay.timeLimit; $('#meter-time').value = this.state.remaining; $('#stat-time').dataset.low = String(this.state.remaining <= 10); }
      if (stat === 'objective') value.textContent = this.genre === 'maze' || this.state.score >= this.state.required ? 'Reach the portal' : 'Collect all stars';
    }
  }
}
