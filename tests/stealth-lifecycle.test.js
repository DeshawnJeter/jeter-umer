import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {GAME_TYPES,referenceLevel,roundOutcome} from '../shared/game-types.js';
import {lifecycleFor,failureReason,humanChecksFor} from '../shared/lifecycle.js';
import {patrolPlans,gridPath,newGuardBrain,stepGuard} from '../shared/stealth-rules.js';
import {stealthBehaviorEvidence} from '../apps/server/src/specialists/rules-tests.js';
import {Manager} from '../apps/server/src/orchestrator/manager.js';
import {Store} from '../apps/server/src/storage/store.js';
import {createRuntime} from '../apps/server/src/providers/runtime.js';
import {buildGame} from '../apps/server/src/integration/build.js';
import {defaults,clone} from '../shared/contracts/index.js';

test('all enabled styles have an explicit reachable failure state without imposing a timer on turn-based combat',()=>{
  for(const genre of Object.keys(GAME_TYPES)){
    const rules=lifecycleFor(genre);assert.ok(rules.failure);assert.equal(failureReason(genre,{health:20,remaining:30}),null);
    assert.ok(failureReason(genre,{health:rules.health?0:20,remaining:rules.timer&&!rules.surviveTimer?0:30}),genre);
  }
  assert.equal(failureReason('rpg',{health:1,remaining:0}),null);
  assert.equal(roundOutcome({genre:'survival',health:0,remaining:0}),'lost');assert.equal(roundOutcome({genre:'survival',health:1,remaining:0}),'won');
});
test('stealth reacts immediately, remembers pursuit below full alert, searches and returns to patrol',()=>{
  assert.ok(Object.values(stealthBehaviorEvidence({alertRate:20,visionRange:120})).every(Boolean));
  const brain=newGuardBrain(),input={dt:0.1,guard:{x:24,y:24},player:{x:96,y:24},walls:new Set(),facing:0};
  stepGuard(brain,input);assert.equal(brain.mode,'investigate');assert.ok(brain.lastSeen);
  stepGuard(brain,{...input,contact:true});stepGuard(brain,{...input,hidden:true});assert.equal(brain.mode,'chase');assert.ok(brain.alert<100);
  stepGuard(brain,input);assert.equal(brain.mode,'chase','Reacquiring sight must not downgrade an active pursuit');
});
test('guard spawns and patrol endpoints avoid walls and disconnected free pockets',()=>{
  const level=referenceLevel('stealth');level.walls.push({x:13,y:9},{x:14,y:8});const origin={x:72,y:72},pocket={x:696,y:456};assert.equal(gridPath(level,origin,pocket),null);
  const plans=patrolPlans(level,3);assert.equal(plans.length,3);for(const plan of plans){assert.ok(gridPath(level,origin,plan.start));assert.ok(gridPath(level,plan.start,plan.targets[0]).length);assert.ok(gridPath(level,plan.targets[0],plan.start).length);}
});
test('stealth human approval requires observed enemy reactions, and delivered failure rules are hashed assets',async()=>{
  const manager=new Manager(new Store(await mkdtemp(join(tmpdir(),'stealth-gate-'))),{runtime:createRuntime({env:{}})});await manager.initialize();
  const run=await manager.create({title:'Patrol gate',prompt:'A supported stealth mission',genre:'stealth',difficulty:'beginner',music:false});await manager.jobs.get(run.id);await manager.act(run.id,'approve_plan',{planHash:run.planHash});await manager.jobs.get(run.id);assert.equal(run.status,'awaiting_review',run.error);
  assert.ok(run.build.checksRequired.includes('enemyReactions'));const checks=Object.fromEntries(humanChecksFor('collector').map(key=>[key,true]));await assert.rejects(manager.act(run.id,'approve',{sha256:run.build.sha256,checks}),/Playtest/);
  const folder=join(manager.store.folder(run.id),'builds','0'),manifest=JSON.parse(await readFile(join(folder,'lifecycle.json'),'utf8'));assert.ok(manifest.requiredHumanChecks.includes('enemyReactions'));assert.match(await readFile(join(folder,'assembly.js'),'utf8'),/failure-state/);
  assert.ok(run.memory.tests.find(record=>record.kind==='qa-rules').evidence.checks.some(check=>check.name.includes('pursuit')&&check.passed));
});
test('actual exported side-combat damage reaches defeat and rejects damage after the terminal state',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'side-loss-'));await buildGame(folder,clone(defaults));
  const {sideCombat}=await import(pathToFileURL(join(folder,'genres/side-combat.js')).href);
  const oldDocument=globalThis.document;globalThis.document={createElement:()=>({textContent:''})};
  function sprite(x,y){const result={x,y,active:true,body:{blocked:{down:true},velocity:{y:0},setSize(){return this;},setOffset(){return this;},setAllowGravity(){return this;}},setCollideWorldBounds(){return this;},setGravityY(){return this;},setScale(){return this;},setDisplaySize(){return this;},refreshBody(){return this;},setVelocity(){return this;},setVelocityX(){return this;},setVelocityY(){return this;},setAlpha(){return this;},destroy(){this.active=false;}};return result;}
  const group=()=>{const children=[];return {create(x,y){const item=sprite(x,y);children.push(item);return item;},getChildren:()=>children.filter(item=>item.active),countActive:()=>children.filter(item=>item.active).length,clear(){children.length=0;}};};
  const scene={physics:{world:{setBounds(){}},add:{staticGroup:group,group,sprite,staticImage:sprite,collider(){},overlap(){}},moveToObject(){}},cameras:{main:{setBounds(){},startFollow(){}}},add:{rectangle(){return {setDepth(){}};},text(){}}};
  try{for(const genre of ['run_gun','jump_shooter','metroidvania']){const state={phase:'playing',health:6,maxHealth:6,mana:6,maxMana:6},config={...clone(defaults),genre,levels:referenceLevel(genre)},ends=[];const ctx={config,state,genre,keys:()=>({isDown:()=>false}),move:()=>({x:0}),audio:{tone(){}},panel:{append(){}},note(){},end(phase){state.phase=phase;ends.push(phase);}};const mode=sideCombat(scene,ctx,{stageBosses:genre==='jump_shooter',exploration:genre==='metroidvania'});for(let i=0;i<6;i++){mode.update(1.3,i*1.3);mode.damage();}assert.equal(state.health,0,genre);assert.deepEqual(ends,['lost']);mode.damage();assert.deepEqual(ends,['lost']);}}
  finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});
