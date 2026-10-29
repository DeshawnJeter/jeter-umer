import { handlePreferences } from '/player-ui.js';
// The sandbox has an opaque origin. The helper verifies the exact iframe source
// and permits only one fixed, typed preference record; never arbitrary storage.
addEventListener('message', event => {
  let storage;
  try { storage = localStorage; } catch { storage = null; }
  handlePreferences(event, document.querySelector('#preview'), storage);
});
