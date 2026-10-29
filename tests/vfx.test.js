import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {buildGame} from '../apps/server/src/integration/build.js';import {defaults,clone} from '../shared/contracts/index.js';
test('VFX stays within its pool, honors reduced effects, isolates gameplay and disposes on restart',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'vfx-contract-'));await buildGame(folder,clone(defaults));const {GameVfx}=await import(pathToFileURL(join(folder,'vfx.js')).href);const {createGameEvents}=await import(pathToFileURL(join(folder,'game-events.js')).href);
  let shakes=0,destroyed=0;const make=()=>({setDepth(){return this;},setVisible(){return this;},setAlpha(){return this;},setFillStyle(){return this;},setPosition(){return this;},destroy(){destroyed++;}}),scene={add:{circle:make},cameras:{main:{shake(){shakes++;}}}},settings={reducedEffects:false},bus=createGameEvents(),effects=new GameVfx(scene,bus,{maxParticles:12,particlesPerBurst:6},()=>settings),game={health:6,mp:4,potions:3},before=structuredClone(game);
  for(let i=0;i<1000;i++)bus.emit('damage_taken',{x:10,y:20});assert.ok(effects.inspect().allocated<=12);assert.ok(effects.inspect().active<=12);assert.equal(shakes,1);assert.deepEqual(game,before);
  settings.reducedEffects=true;effects.update(0.01);assert.equal(effects.inspect().active,0);bus.emit('spell_cast',{x:20,y:30});assert.equal(effects.inspect().active,0);assert.equal(shakes,1);
  effects.dispose();assert.equal(destroyed,12);assert.equal(effects.inspect().allocated,0);bus.emit('damage_taken',{});assert.equal(shakes,1);
});
