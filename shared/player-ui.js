// Shared by workers, checkers, the workshop and exported games. No browser globals.
import {advancedProfile} from './advanced-games.js';
import {lifecycleFor} from './lifecycle.js';
export const HUD_STATS = Object.freeze(['health', 'stars', 'time', 'objective','mana','alert','progress','ability']);
export function hudFor(genre = 'collector') {
  return { layout: 'cards', stats: advancedProfile(genre)?.hud || (genre === 'survival' ? ['health', 'time', 'stars'] : ['stars', 'time', 'objective']) };
}
export function validateHud(hud, genre) {
  if (!hud || typeof hud !== 'object' || Array.isArray(hud) || Object.keys(hud).sort().join() !== 'layout,stats' || !['cards', 'compact'].includes(hud.layout) || !Array.isArray(hud.stats) || hud.stats.length !== 3 || new Set(hud.stats).size !== 3 || hud.stats.some(stat => !HUD_STATS.includes(stat))) return ['Invalid HUD layout or stats'];
  if (genre && hudFor(genre).stats.some(stat => !hud.stats.includes(stat))) return ['HUD must show the stats supported by the selected game type'];
  return [];
}
// A read-only view: never create counters, run a clock or change gameplay here.
export function inGameHudModel(genre='collector',hud=hudFor(genre),state={}){
  const selected=new Set(hud.stats.filter(stat=>stat!=='objective'));
  if(genre==='custom'){
    selected.delete('time');selected.delete('mana');
    if(Number.isFinite(state.codeSnapshot?.remaining))selected.add('time');
    if(state.codeSnapshot?.maxMana>0)selected.add('mana');
  }else if(lifecycleFor(genre).timer)selected.add('time');
  if(['rpg','front_battle','campaign','roguelike'].includes(genre))selected.add('score');
  const result=[];
  for(const id of selected){
    let label,text,low=false;
    if(id==='health'){label='HP';const max=state.maxHealth||3;text=`${Math.max(0,state.health)} / ${max}`;low=state.health<=Math.max(1,max/4);}
    if(id==='mana'&&state.maxMana>0){label=genre==='jump_shooter'?'Energy':'MP';text=`${state.mana} / ${state.maxMana}`;low=state.mana===0;}
    if(id==='time'&&Number.isFinite(state.remaining)){label='Time';text=`${Math.ceil(state.remaining)}s`;low=state.remaining<=10;}
    if(id==='stars'){label=genre==='stealth'?'Intel':'Stars';text=`${state.score} / ${state.required}`;}
    if(id==='score'){label='Encounters';text=`${state.score} / ${state.required}`;}
    if(id==='progress'){label=genre==='custom'?'Score':'Stage';text=genre==='custom'?String(state.score):state.progress||'1 / 3';}
    if(id==='alert'){label='Detection';text=`${Math.round(state.alert||0)}%`;low=(state.alert||0)>=75;}
    if(id==='ability'){label='Abilities';text=state.abilities||'Basic jump';}
    if(text!==undefined)result.push({id,label,text,low});
  }
  return result;
}
export const ACTIONS = Object.freeze(['left', 'right', 'up', 'down', 'jump','attack','ability','interact']);
export const KEY_CODES = Object.freeze(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', ...Array.from({length:26}, (_, i) => `Key${String.fromCharCode(65+i)}`), ...Array.from({length:10}, (_, i) => `Digit${i}`)]);
export const SETTINGS_KEY = 'game-workshop.player-settings.v1';
export function defaultSettings(volume = 0.18, muted = false) {
  return { version: 3, reducedEffects:false, volume, muted, musicVolume: 1, sfxVolume: 1, musicMuted: false, sfxMuted: false, bindings: { left: ['ArrowLeft','KeyA'], right: ['ArrowRight','KeyD'], up: ['ArrowUp','KeyW'], down: ['ArrowDown','KeyS'], jump: ['Space'],attack:['KeyJ'],ability:['KeyK'],interact:['KeyE'] } };
}
export function validSettings(value) {
  if (!value || typeof value !== 'object' || Object.keys(value).sort().join() !== Object.keys(defaultSettings()).filter(key=>value.version===3||key!=='reducedEffects').sort().join() || ![1,2,3].includes(value.version)) return false;
  if(value.version===3&&typeof value.reducedEffects!=='boolean')return false;
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
export function upgradeSettings(value,reducedDefault=false){
  if(!validSettings(value))throw Error('Invalid settings');const next=structuredClone(value);
  if(next.version===3)return next;
  if(next.version===2){next.version=3;next.reducedEffects=!!reducedDefault;return next;}
  const used=new Set(Object.values(next.bindings).flat());
  for(const action of ACTIONS.slice(5)){const preferred=defaultSettings().bindings[action][0],key=!used.has(preferred)?preferred:KEY_CODES.find(code=>!used.has(code));next.bindings[action]=[key];used.add(key);}
  next.version=3;next.reducedEffects=!!reducedDefault;return next;
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
