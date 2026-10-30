import test from 'node:test';import assert from 'node:assert/strict';
import {hudFor,inGameHudModel} from '../shared/player-ui.js';
import {inspectSnapshot} from '../shared/code-game.js';
import {inspectWholeGame,requiresInGameHud} from '../apps/server/src/validation/whole-game-acceptance.js';
import {passingBrowserReport} from './fixtures/browser-report.js';
const state={health:20,maxHealth:20,mana:6,maxMana:6,score:0,required:3,remaining:42,progress:'1 / 3'};
const view=(genre,s=state)=>inGameHudModel(genre,hudFor(genre),s);
test('in-game stats follow real game profiles without inventing health, MP or timers',()=>{
 assert.deepEqual(view('collector').map(x=>x.id),['stars','time']);
 assert.deepEqual(view('maze').map(x=>x.id),['stars','time']);
 assert.deepEqual(view('survival').map(x=>x.id),['health','time','stars']);
 for(const genre of ['rpg','front_battle','campaign','roguelike'])assert.deepEqual(view(genre).map(x=>x.id),['health','mana','score']);
 assert.deepEqual(view('stealth').map(x=>x.id),['health','alert','time']);
 assert.deepEqual(view('jump_shooter').map(x=>x.id),['health','mana']);
 assert.deepEqual(view('metroidvania').map(x=>x.id),['health','ability']);
 assert.deepEqual(view('run_gun').map(x=>x.id),['health','progress']);
 assert.deepEqual(view('platformer').map(x=>x.id),['stars','time']);
});
test('HUD is a read-only projection with accurate zero values and low-resource cues',()=>{
 const s={...state,health:0,mana:0,score:0,remaining:0},before=structuredClone(s);
 assert.deepEqual(view('rpg',s).map(x=>[x.id,x.text,x.low]),[['health','0 / 20',true],['mana','0 / 6',true],['score','0 / 3',false]]);
 assert.equal(view('collector',s).find(x=>x.id==='time').text,'0s');assert.equal(view('collector',s).find(x=>x.id==='time').low,true);assert.deepEqual(s,before);assert.deepEqual(view('rpg',s),view('rpg',s));
});
test('custom HUD shows only explicitly published timer and MP, never the framework placeholder clock',()=>{
 assert.deepEqual(view('custom').map(x=>x.id),['health','progress']);
 const s={...state,remaining:3.2,mana:0,codeSnapshot:{remaining:3.2,timeLimit:10,mana:0,maxMana:6}};
 const items=view('custom',s);assert.equal(items.find(x=>x.id==='time').text,'4s');assert.equal(items.find(x=>x.id==='mana').text,'0 / 6');assert.equal(items.find(x=>x.id==='progress').text,'0');
});
const snapshot={phase:'playing',health:3,maxHealth:3,score:0,objective:'Play',nodes:[]};
test('custom resource snapshots preserve bounded optional numbers and reject incomplete or invalid pairs',()=>{
 assert.deepEqual(inspectSnapshot(snapshot),snapshot);
 const resources={remaining:0,timeLimit:20,mana:0,maxMana:6};assert.deepEqual(inspectSnapshot({...snapshot,...resources}),{...snapshot,...resources});
 for(const extra of [{remaining:3},{timeLimit:20},{remaining:-1,timeLimit:20},{remaining:21,timeLimit:20},{remaining:0,timeLimit:Infinity},{remaining:'3',timeLimit:20},{mana:1},{maxMana:3},{mana:4,maxMana:3},{mana:NaN,maxMana:3},{mana:0,maxMana:101}])assert.throws(()=>inspectSnapshot({...snapshot,...extra}),/Optional/);
 assert.equal(inspectSnapshot({...snapshot,privateField:'discarded'}).privateField,undefined);
});
test('only an explicitly verified historical presentation may omit the new overlay gate',()=>{
 const report=passingBrowserReport('hash');report.tests=report.tests.filter(t=>t.name!=='in-game HUD matches live resources');
 assert.equal(inspectWholeGame(report,'hash').passed,false);assert.equal(inspectWholeGame(report,'hash','collector',[],{inGameHud:false}).passed,true);
 const historic={generation:0,build:{sha256:'old'},restoredFrom:{legacyHud:true,buildHash:'old'}};assert.equal(requiresInGameHud(historic),false);assert.equal(requiresInGameHud({...historic,generation:1}),true);assert.equal(requiresInGameHud({...historic,build:{sha256:'new'}}),true);assert.equal(requiresInGameHud({generation:0,build:{sha256:'new'}}),true);
 assert.equal(requiresInGameHud({generation:0,restoredFrom:{legacyHud:true}}),true);
});
