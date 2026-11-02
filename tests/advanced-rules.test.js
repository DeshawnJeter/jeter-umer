import test from 'node:test';import assert from 'node:assert/strict';
import {newCampaign,beginBattle,battleAction} from '../shared/turn-combat.js';
import {canSee,encodeCheckpoint,decodeCheckpoint} from '../shared/advanced-games.js';
import {defaultSettings,upgradeSettings,validSettings} from '../shared/player-ui.js';
test('RPG turns spend MP/items only on valid actions and do not resurrect defeated enemies',()=>{
  const c=newCampaign(),b=beginBattle(c);const before=structuredClone(b);assert.equal(battleAction(b,'spell'),false);assert.deepEqual(c,before.campaign);
  assert.equal(battleAction(b,'attack',99),false);assert.equal(b.round,0);
  battleAction(b,'guard');assert.equal(b.actor,1);const mp=c.party[1].mp;battleAction(b,'spell');assert.equal(c.party[1].mp,mp-2);assert.equal(b.phase,'won');
  const finished=structuredClone(b);assert.equal(battleAction(b,'attack'),false);assert.deepEqual(b,finished);
});
test('RPG campaign progression, potions, loss and encounter rewards are bounded',()=>{
  const c=newCampaign();c.party[0].hp=3;let b=beginBattle(c);battleAction(b,'potion');assert.equal(c.potions,2);assert.ok(c.party[0].hp<=c.party[0].maxHp);
  for(let encounter=0;encounter<3;encounter++){b=beginBattle(c,encounter);for(let n=0;n<50&&b.phase==='player';n++){c.party.forEach(p=>{p.hp=p.maxHp;});battleAction(b,'attack');}assert.equal(b.phase,'won');}
  assert.equal(c.level,2);assert.equal(c.encounters,3);assert.equal(c.xp,30);
  const doomed=newCampaign('experienced');doomed.party.forEach(p=>p.hp=1);b=beginBattle(doomed,2);for(let i=0;i<5&&b.phase==='player';i++)battleAction(b,'guard');assert.equal(b.phase,'lost');
});
test('stealth visibility respects range, facing and blocking walls',()=>{
  const from={x:24,y:24},to={x:168,y:24};assert.equal(canSee(from,to,new Set()),true);assert.equal(canSee(from,to,new Set(['1,0'])),false);assert.equal(canSee(from,{x:-48,y:24},new Set()),false);assert.equal(canSee(from,{x:600,y:24},new Set()),false);
});
test('checkpoint codes reject path/code payloads, invalid rooms and impossible ability gates',()=>{
  const valid={version:1,room:2,doubleJump:true,dash:true};assert.deepEqual(decodeCheckpoint(encodeCheckpoint(valid)),valid);
  for(const value of [{...valid,room:99},{...valid,dash:'true'},{...valid,doubleJump:false},{...valid,path:'../../.env'}])assert.throws(()=>encodeCheckpoint(value));
  for(const text of ['execute()',JSON.stringify({version:1,room:2,doubleJump:true,dash:false}),'x'.repeat(201)])assert.throws(()=>decodeCheckpoint(text));
});
test('old saved controls migrate without losing existing remaps or introducing duplicate bindings',()=>{
  const legacy=defaultSettings();legacy.version=1;for(const action of ['attack','ability','interact'])delete legacy.bindings[action];legacy.bindings.left=['KeyJ'];legacy.bindings.right=['KeyK'];
  assert.equal(validSettings(legacy),true);const next=upgradeSettings(legacy);assert.equal(next.version,2);assert.deepEqual(next.bindings.left,['KeyJ']);assert.deepEqual(next.bindings.right,['KeyK']);assert.equal(validSettings(next),true);assert.equal(legacy.version,1);
});
