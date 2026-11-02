import test from 'node:test';import assert from 'node:assert/strict';import {components as api} from '../shared/code-game.js';
test('reusable button cooldown inventory movement and progression helpers preserve their boundaries',()=>{
 const latch={};assert.equal(api.pressed(latch,'build',true),true);assert.equal(api.pressed(latch,'build',true),false);api.pressed(latch,'build',false);assert.equal(api.pressed(latch,'build',true),true);
 const timer={};assert.equal(api.tick(timer,'shot',0.1,0.2),false);assert.equal(api.tick(timer,'shot',0.1,0.2),true);
 const inventory={potion:1};assert.equal(api.spend(inventory,'potion',2),false);assert.equal(inventory.potion,1);assert.equal(api.spend(inventory,'potion',1),true);assert.equal(inventory.potion,0);assert.throws(()=>api.spend(inventory,'__proto__',1));
 const actor={x:0,y:0};api.approach(actor,{x:1,y:0},100,0.1);assert.equal(actor.x,1);assert.throws(()=>api.approach(actor,{x:Infinity,y:0},100,0.1));
 const level={level:0,health:2};assert.equal(api.nextLevel(level,2),true);assert.equal(api.nextLevel(level,2),false);assert.equal(level.health,2);
});
