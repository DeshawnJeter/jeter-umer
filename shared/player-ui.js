// Shared by workers, checkers, the workshop and exported games. No browser globals.
import {advancedProfile} from './advanced-games.js';
export const HUD_STATS = Object.freeze(['health', 'stars', 'time', 'objective','mana','alert','progress','ability']);
export function hudFor(genre = 'collector') {
  return { layout: 'cards', stats: advancedProfile(genre)?.hud || (genre === 'survival' ? ['health', 'time', 'stars'] : ['stars', 'time', 'objective']) };
}
export function validateHud(hud, genre) {
  if (!hud || typeof hud !== 'object' || Array.isArray(hud) || Object.keys(hud).sort().join() !== 'layout,stats' || !['cards', 'compact'].includes(hud.layout) || !Array.isArray(hud.stats) || hud.stats.length !== 3 || new Set(hud.stats).size !== 3 || hud.stats.some(stat => !HUD_STATS.includes(stat))) return ['Invalid HUD layout or stats'];
  if (genre && hudFor(genre).stats.some(stat => !hud.stats.includes(stat))) return ['HUD must show the stats supported by the selected game type'];
  return [];
}
export const ACTIONS = Object.freeze(['left', 'right', 'up', 'down', 'jump','attack','ability','interact']);
export const KEY_CODES = Object.freeze(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', ...Array.from({length:26}, (_, i) => `Key${String.fromCharCode(65+i)}`), ...Array.from({length:10}, (_, i) => `Digit${i}`)]);
export const SETTINGS_KEY = 'game-workshop.player-settings.v1';
export function defaultSettings(volume = 0.18, muted = false) {
  return { version: 2, volume, muted, musicVolume: 1, sfxVolume: 1, musicMuted: false, sfxMuted: false, bindings: { left: ['ArrowLeft','KeyA'], right: ['ArrowRight','KeyD'], up: ['ArrowUp','KeyW'], down: ['ArrowDown','KeyS'], jump: ['Space'],attack:['KeyJ'],ability:['KeyK'],interact:['KeyE'] } };
}
export function validSettings(value) {
  if (!value || typeof value !== 'object' || Object.keys(value).sort().join() !== Object.keys(defaultSettings()).sort().join() || ![1,2].includes(value.version)) return false;
  if (!['muted','musicMuted','sfxMuted'].every(key => typeof value[key] === 'boolean')) return false;
  if (!['volume','musicVolume','sfxVolume'].every(key => Number.isFinite(value[key]) && value[key] >= 0 && value[key] <= (key === 'volume' ? 0.3 : 1))) return false;
  const bindings = value.bindings;
  const actions=value.version===1?ACTIONS.slice(0,5):ACTIONS;
  if (!bindings || typeof bindings !== 'object' || Object.keys(bindings).sort().join() !== [...actions].sort().join()) return false;
  const all = [];
  for (const action of actions) {
    if (!Array.isArray(bindings[action]) || bindings[action].length < 1 || bindings[action].length > 2 || bindings[action].some(code => !KEY_CODES.includes(code))) return false;
    all.push(...bindings[action]);
  }
  return new Set(all).size === all.length;
}
export function upgradeSettings(value){
  if(!validSettings(value))throw Error('Invalid settings');const next=structuredClone(value);
  if(next.version===2)return next;
  const used=new Set(Object.values(next.bindings).flat());
  for(const action of ACTIONS.slice(5)){const preferred=defaultSettings().bindings[action][0],key=!used.has(preferred)?preferred:KEY_CODES.find(code=>!used.has(code));next.bindings[action]=[key];used.add(key);}
  next.version=2;return next;
}
export const keyLabel = code => code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : code.replace('Arrow', '') === code ? code : `${code.slice(5)} arrow`;
export function remap(settings, action, code) {
  const next = structuredClone(settings);
  if (!ACTIONS.includes(action) || !KEY_CODES.includes(code)) throw new Error('Unsupported control');
  next.bindings[action] = [code];
  if (!validSettings(next)) throw new Error('That key is already assigned to another action');
  return next;
}
export function handlePreferences(event, frame, storage) {
  if (!frame?.contentWindow || event.source !== frame.contentWindow || !['workshop:preferences:load','workshop:preferences:save'].includes(event.data?.type)) return;
  if (event.data.type === 'workshop:preferences:save') {
    if (validSettings(event.data.settings)) { try { storage.setItem(SETTINGS_KEY, JSON.stringify(event.data.settings)); } catch { /* Session remains playable. */ } }
    return;
  }
  let settings = null, saved = false;
  try { settings = JSON.parse(storage.getItem(SETTINGS_KEY)); storage.setItem(SETTINGS_KEY + '.probe', '1'); storage.removeItem(SETTINGS_KEY + '.probe'); saved = true; } catch { /* Storage disabled. */ }
  frame.contentWindow.postMessage({ type: 'workshop:preferences:loaded', settings: validSettings(settings) ? settings : null, saved }, '*');
}
