import test from 'node:test';
import assert from 'node:assert/strict';
import { hudFor, validateHud, defaultSettings, validSettings, remap, handlePreferences, SETTINGS_KEY } from '../shared/player-ui.js';
import { defaults, clone, validateArtifact } from '../shared/contracts/index.js';
import { work } from '../agents/ui/agent.js';
import { check } from '../agents/ui/checker.js';
import { validateGame } from '../apps/server/src/validation/index.js';
import { referenceLevel } from '../shared/game-types.js';
import { responseSchema, validateModelOutput } from '../apps/server/src/providers/schemas.js';
import { buildGame } from '../apps/server/src/integration/build.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

test('UI worker and independent checker require actual genre stats and reject invented MP', async () => {
  for (const genre of ['collector','maze','platformer','survival']) {
    const input = { brief:{genre}, context:{plan:clone(defaults.planner)} };
    const { artifact } = await work(input);
    assert.deepEqual(validateArtifact('ui',artifact), []);
    assert.equal((await check({...input,artifact})).verdict,'pass');
    assert.deepEqual(artifact.hud.stats,hudFor(genre).stats);
    for (const hud of [{layout:'cards',stats:['mp','time','stars']}, {layout:'cards',stats:['stars','time','stars']}, {...hudFor(genre),html:'<script>'}, hudFor(genre==='survival'?'collector':'survival')]) {
      assert.equal((await check({...input,artifact:{...artifact,hud}})).verdict,'fail');
    }
    const config={...clone(defaults),genre,ui:artifact,levels:referenceLevel(genre)};
    assert.equal(validateGame(config).passed,true);
    config.ui.hud=hudFor(genre==='survival'?'collector':'survival');
    assert.equal(validateGame(config).passed,false);
  }
});
test('real-model schema includes closed HUD contract and rejects unknown stats', () => {
  const schema=responseSchema('ui','worker').properties.artifact.anyOf[0].properties.hud;
  assert.equal(schema.additionalProperties,false);
  const result={kind:'artifact',artifact:clone(defaults.ui),question:null,summary:'HUD selected'};
  assert.deepEqual(validateModelOutput('ui','worker',result).artifact.hud,hudFor());
  result.artifact.hud.stats[0]='mana'; assert.throws(()=>validateModelOutput('ui','worker',result));
});
test('settings reject duplicate/reserved bindings, injected fields, invalid gains and malformed saved records', () => {
  assert.equal(validSettings(defaultSettings()),true);
  const settings=remap(defaultSettings(),'right','KeyL'); assert.deepEqual(settings.bindings.right,['KeyL']);
  assert.deepEqual(defaultSettings().bindings.right,['ArrowRight','KeyD']);
  for (const key of ['KeyA','Escape','Tab','../../secret','__proto__']) assert.throws(()=>remap(settings,'right',key));
  for (const value of [null,[],{}, {...settings,volume:2}, {...settings,sfxVolume:NaN}, {...settings,musicMuted:'false'}, {...settings,path:'.env'}, {...settings,bindings:{...settings.bindings,left:['Escape']}}]) assert.equal(validSettings(value),false);
});
test('preview preference bridge rejects foreign frames and malformed records and exposes only fixed preferences', () => {
  const reads=[],writes=[],sent=[]; const child={postMessage:(...args)=>sent.push(args)}, frame={contentWindow:child};
  const storage={getItem:key=>{reads.push(key);return JSON.stringify(defaultSettings());},setItem:(...args)=>writes.push(args),removeItem:()=>{}};
  handlePreferences({source:{},data:{type:'workshop:preferences:load'}},frame,storage);
  handlePreferences({source:child,data:{type:'workshop:preferences:save',settings:{key:'.env'}}},frame,storage);
  assert.equal(reads.length+writes.length+sent.length,0);
  handlePreferences({source:child,data:{type:'workshop:preferences:load',key:'OPENAI_API_KEY'}},frame,storage);
  assert.deepEqual(reads,[SETTINGS_KEY]); assert.equal(sent[0][0].saved,true); assert.deepEqual(sent[0][0].settings,defaultSettings());
  handlePreferences({source:child,data:{type:'workshop:preferences:save',settings:defaultSettings()}},frame,storage);
  assert.equal(writes.at(-1)[0],SETTINGS_KEY);
  handlePreferences({source:child,data:{type:'workshop:preferences:load'}},frame,null);
  assert.equal(sent.at(-1)[0].saved,false);
});

test('pause/resume preserves round phase, clears input, and restart cannot resurrect a finished round', async () => {
  const folder=await mkdtemp(join(tmpdir(),'pause-export-'));await buildGame(folder,clone(defaults));
  const {PlayerInterface}=await import(pathToFileURL(join(folder,'interface.js')).href);
  const previousDocument=globalThis.document;
  const elements=new Map(); const el=selector=>{if(!elements.has(selector))elements.set(selector,{textContent:'',open:false,focus(){},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(selector);};
  globalThis.document={querySelector:el};
  try {
    let pauses=0,resumes=0,restarts=0;const playing=[];
    const state={ready:true,phase:'playing',remaining:37,health:2};
    const ui=new PlayerInterface({state,held:new Set(['left']),audio:{setPlaying:value=>playing.push(value)},onPause:()=>pauses++,onResume:()=>resumes++,onRestart:()=>{restarts++;state.phase='ready';}});
    ui.render=()=>{};ui.controls=()=>{};ui.keys.add('KeyA');ui.capture='left';
    ui.pause();ui.pause();assert.equal(pauses,1);assert.equal(state.phase,'paused');assert.equal(el('#pause-menu').open,true);assert.equal(ui.keys.size+ui.held.size,0);
    ui.resume();ui.resume();assert.equal(resumes,1);assert.equal(state.phase,'playing');assert.equal(state.remaining,37);assert.equal(state.health,2);assert.equal(ui.capture,null);assert.deepEqual(playing,[false,true]);
    for(const phase of ['ready','won','lost']) {state.phase=phase;ui.pause();ui.resume();assert.equal(state.phase,phase);assert.equal(playing.at(-1),false);}
    state.phase='lost';ui.pause();ui.restart();assert.equal(restarts,1);assert.equal(state.phase,'ready');assert.equal(el('#pause-menu').open,false);assert.equal(playing.at(-1),false);
  } finally { if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument; }
});
