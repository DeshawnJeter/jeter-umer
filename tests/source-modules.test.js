import test from 'node:test';import assert from 'node:assert/strict';import {sourceModule,patchModule} from '../apps/server/src/runners/source-modules.js';
test('module edits preserve other systems and cannot cross ownership or introduce imports',()=>{
 const source='function enemySpeed(){return 2;}\nfunction combatPower(){return 3;}\nexport function createGame(api){return {};}';
 const next=patchModule(source,'generated/modules/enemy.js','return 2','return 4');assert.match(next,/return 4/);assert.match(next,/combatPower\(\)\{return 3;/);assert.match(next,/export function createGame/);
 assert.equal(sourceModule(next,'generated/modules/combat.js').source,'function combatPower(){return 3;}');assert.throws(()=>patchModule(source,'generated/modules/enemy.js','return 2','return 4;} function combatSteal(){return 1'),/only named/);assert.throws(()=>sourceModule(source,'../../.env'),/Outside/);assert.throws(()=>patchModule(source,'generated/modules/level.js','','import x from "x";'),/only named/);
});
