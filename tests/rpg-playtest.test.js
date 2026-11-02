import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {newCampaign,beginBattle,battleAction} from '../shared/turn-combat.js';
import {defaultSettings,remap} from '../shared/player-ui.js';
import {defaults,clone} from '../shared/contracts/index.js';
import {buildGame} from '../apps/server/src/integration/build.js';

test('RPG rejects non-integer/prototype targets without changing shared objects or spending a turn',()=>{
  const battle=beginBattle(newCampaign(),1),before=structuredClone(battle),prototype=Object.getOwnPropertyDescriptors(Array.prototype);
  for(const target of ['__proto__','constructor','0',null,NaN,-1,0.5,2]){
    assert.equal(battleAction(battle,'attack',target),false);
    assert.deepEqual(battle,before);
  }
  assert.deepEqual(Object.getOwnPropertyDescriptors(Array.prototype),prototype);
});

test('RPG potions and MP are bounded, invalid actions preserve turn state, and fallen members are skipped',()=>{
  const campaign=newCampaign(),battle=beginBattle(campaign,2);
  assert.equal(battleAction(battle,'potion'),false);assert.equal(campaign.potions,3);assert.equal(battle.round,0);
  for(let n=0;n<3;n++){
    const actor=campaign.party[battle.actor];actor.hp=actor.maxHp-1;
    assert.equal(battleAction(battle,'potion'),true);
    assert.ok(actor.hp<=actor.maxHp);assert.equal(campaign.potions,2-n);
  }
  let before=structuredClone(campaign),round=battle.round,actor=battle.actor;
  assert.equal(battleAction(battle,'potion'),false);assert.deepEqual(campaign,before);assert.equal(battle.round,round);assert.equal(battle.actor,actor);
  campaign.party[1].mp=0;battle.actor=1;before=structuredClone(campaign);
  assert.equal(battleAction(battle,'spell'),false);assert.deepEqual(campaign,before);assert.equal(battle.round,round);
  campaign.party[0].hp=0;battle.actor=1;
  assert.equal(battleAction(battle,'guard'),true);assert.equal(battle.actor,1);
});

test('exported RPG refreshes remapped battle labels without spending resources and silences rejected actions',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'rpg-ui-playtest-'));await buildGame(folder,clone(defaults));
  const {rpgMode}=await import(pathToFileURL(join(folder,'genres/rpg-core.js')).href);
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.textContent='';this.disabled=false;}
    append(...nodes){this.children.push(...nodes);}
    replaceChildren(...nodes){this.children=[...nodes];}
    setAttribute(){}
  }
  const previousDocument=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
  try{
    const panel=new Element('section'),state={phase:'playing'},tones=[],ui={settings:defaultSettings()};
    const scene={add:{image(){return {setScale(){return this;},setDepth(){return this;},destroy(){}};}}};
    const ctx={state,config:clone(defaults),panel,keys:()=>ui,audio:{tone:note=>tones.push(note)},end:phase=>{state.phase=phase;},button(label,callback){const b=new Element('button');b.textContent=label;b.onclick=()=>{if(state.phase==='playing'&&!b.disabled)callback();};panel.append(b);return b;}};
    const mode=rpgMode(scene,ctx,{frontView:true});mode.start();
    const labels=()=>panel.children.filter(node=>node.tag==='button').map(node=>node.textContent);
    const click=label=>{const button=panel.children.find(node=>node.textContent===label);assert.ok(button,label);assert.equal(button.disabled,false,label);button.onclick();};
    assert.ok(labels().includes('Attack (J)'));const before=structuredClone(state);
    ui.settings=remap(ui.settings,'attack','KeyL');ui.settings=remap(ui.settings,'ability','KeyI');ui.settings=remap(ui.settings,'interact','KeyO');mode.refreshControls();
    assert.deepEqual(state,before);assert.ok(labels().includes('Attack (L)'));assert.ok(labels().includes('Spell · 2 MP (I)'));assert.ok(labels().includes('Potion (O)'));
    mode.action('ability');mode.action('interact');mode.action('left');assert.equal(tones.length,0);assert.equal(state.health,20);assert.equal(state.mana,6);
    click('Attack (L)');assert.equal(state.health,18);assert.equal(tones.length,1);
    click('Spell · 2 MP (I)');assert.equal(state.mana,4);assert.equal(state.score,1);assert.equal(tones.length,2);
    mode.action('attack');assert.equal(state.score,1);assert.equal(tones.length,2);
    assert.ok(panel.children.some(node=>node.textContent==='Party level 1 · XP 10 · Potions 3'));
  }finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});
