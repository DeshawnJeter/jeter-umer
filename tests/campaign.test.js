import test from 'node:test';import assert from 'node:assert/strict';
import {createExpedition,clearRoom,advanceRoom} from '../shared/campaign.js';
import {inspectLevel} from '../agents/levels/checker.js';
test('campaign transitions preserve damaged party, MP, XP and potion inventory',()=>{
  const run=createExpedition();run.party.party[0].hp=5;run.party.party[1].mp=2;run.party.xp=10;
  assert.equal(advanceRoom(run),false);assert.equal(clearRoom(run),true);assert.equal(clearRoom(run),false);
  assert.equal(advanceRoom(run),true);assert.equal(run.room,1);assert.equal(run.party.party[0].hp,5);assert.equal(run.party.party[1].mp,2);assert.equal(run.party.xp,10);assert.equal(run.party.potions,4);
  clearRoom(run);advanceRoom(run);clearRoom(run);advanceRoom(run);assert.equal(run.phase,'won');assert.equal(advanceRoom(run),false);
});
test('campaign levels are distinct, reachable and a new expedition resets progress',()=>{
  const run=createExpedition();assert.equal(new Set(run.maps.map(map=>JSON.stringify(map))).size,3);
  for(const map of run.maps)assert.deepEqual(inspectLevel(map,'rpg').findings,[]);
  run.party.party.forEach(p=>{p.hp=0;});assert.equal(clearRoom(run),false);assert.equal(advanceRoom(run),false);
  assert.equal(createExpedition().party.party[0].hp,12);
});
