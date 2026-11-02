import test from 'node:test';import assert from 'node:assert/strict';
import {createExpedition,clearRoom,advanceRoom} from '../shared/campaign.js';
import {beginBattle,battleAction} from '../shared/turn-combat.js';
import {inspectLevel} from '../agents/levels/checker.js';
test('seeded dungeon generation is repeatable, varied and reachable across 200 seeds',()=>{
  const maps=new Set();
  for(let seed=0;seed<200;seed++){
    const run=createExpedition({rooms:5,seed,randomized:true});
    assert.deepEqual(run,createExpedition({rooms:5,seed,randomized:true}));
    for(const map of run.maps)assert.deepEqual(inspectLevel(map,'rpg').findings,[]);
    maps.add(JSON.stringify(run.maps));
  }
  assert.equal(maps.size,200);
});
test('default five-room runs have a winning combat path; death and restart reset progression',()=>{
  for(const difficulty of ['beginner','experienced'])for(let seed=0;seed<50;seed++){
    const run=createExpedition({difficulty,rooms:5,seed,randomized:true});
    for(let room=0;room<5;room++){
      const battle=beginBattle(run.party,run.maps[room].enemy);
      for(let turn=0;turn<60&&battle.phase==='player';turn++){
        const actor=run.party.party[battle.actor];
        const action=actor.hp<=actor.maxHp-5&&run.party.potions?'potion':actor.mp>=run.party.rules.spellCost?'spell':'attack';
        assert.equal(battleAction(battle,action),true);
      }
      assert.equal(battle.phase,'won');clearRoom(run);advanceRoom(run);
    }
    assert.equal(run.phase,'won');
  }
  const dead=createExpedition({rooms:5,randomized:true});dead.party.party.forEach(p=>{p.hp=0;});
  assert.equal(advanceRoom(dead),false);const fresh=createExpedition({rooms:5,randomized:true,seed:2});assert.equal(fresh.room,0);assert.equal(fresh.party.xp,0);assert.equal(fresh.party.potions,3);
});
