import { SETTINGS_KEY, validSettings } from './player-ui.js';
export async function loadPreferences(fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return { settings: validSettings(value) ? value : fallback, storage: 'device' };
  } catch { /* Opaque preview frames cannot access localStorage. */ }
  if (parent === window) return { settings: fallback, storage: 'session' };
  return new Promise(resolve => {
    let timer;
    const finish = result => { clearTimeout(timer); removeEventListener('message', receive); resolve(result); };
    function receive(event) {
      if (event.source !== parent || event.data?.type !== 'workshop:preferences:loaded') return;
      finish({ settings: validSettings(event.data.settings) ? event.data.settings : fallback, storage: event.data.saved === true ? 'workshop' : 'session' });
    }
    addEventListener('message', receive);
    timer = setTimeout(() => finish({ settings: fallback, storage: 'session' }), 800);
    parent.postMessage({ type: 'workshop:preferences:load' }, '*');
  });
}
export function savePreferences(settings, storage) {
  if (!validSettings(settings)) return false;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); return true; }
  catch {
    if (storage === 'workshop' && parent !== window) { parent.postMessage({ type: 'workshop:preferences:save', settings }, '*'); return true; }
    return false;
  }
}
