import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {clone,defaults,validateArtifact} from '../shared/contracts/index.js';
import {referenceLevel} from '../shared/game-types.js';
import {hudFor} from '../shared/player-ui.js';
import {components,DEFAULT_SOURCE,DEFAULT_SCENARIOS} from '../shared/code-game.js';
import {newCampaign,beginBattle,battleAction} from '../shared/turn-combat.js';
import {newEnemyBrain,stepEnemy} from '../shared/enemy-behavior.js';
import {createGameEvents} from '../shared/game-events.js';
import {route} from '../apps/server/src/router/index.js';
import {buildGame} from '../apps/server/src/integration/build.js';
import {compileAssembly} from '../apps/server/src/integration/assembly.js';
import {runCodeChecks} from '../apps/server/src/validation/code-checks.js';
import {runProjectRules} from '../apps/server/src/specialists/rules-tests.js';
import {createRuntime} from '../apps/server/src/providers/runtime.js';
import {runPair} from '../apps/server/src/runners/harness.js';
import {namedStoryPlaces,requestedBattleBackdrop} from '../shared/explicit-intent.js';
const brief={title:'Independent fixture',genre:'collector',difficulty:'beginner',theme:'forest',music:true,prompt:'Collect every star, then reach the portal.'};
const plan={...clone(defaults.planner),title:brief.title};
const review=async(role,artifact,extra={})=>(await route(role)).checker({artifact,brief,...extra,context:{plan,decisions:{},...extra.context}});
const valid=(role,artifact)=>assert.deepEqual(validateArtifact(role,artifact),[],`${role}: fault must be schema-valid`);
let shipped;
async function moduleFor(name){shipped??=(async()=>{const dir=await mkdtemp(join(tmpdir(),'independent-agent-'));await buildGame(dir,clone(defaults));return dir;})();return import(pathToFileURL(join(await shipped,name)).href);}
function reachable(level){const seen=new Set([`${level.spawn.x},${level.spawn.y}`]),queue=[level.spawn],walls=new Set(level.walls.map(p=>`${p.x},${p.y}`));for(const p of queue)for(const [x,y]of [[p.x-1,p.y],[p.x+1,p.y],[p.x,p.y-1],[p.x,p.y+1]]){const k=`${x},${y}`;if(x>=0&&x<15&&y>=0&&y<10&&!walls.has(k)&&!seen.has(k)){seen.add(k);queue.push({x,y});}}return seen.has(`${level.exit.x},${level.exit.y}`);}

test('planner: a schema-valid plan for the wrong goal is rejected',async()=>{
 const wrong={...plan,objective:'Survive until the timer expires.'};valid('planner',wrong);assert.equal((await review('planner',wrong)).verdict,'fail');
 const right={...plan,objective:'Collect every star, then reach the portal.'};assert.equal((await review('planner',right)).verdict,'pass');
});
test('gameplay: beginner timing and nondefault movement have observable effects',async()=>{
 const wrong={speed:140,timeLimit:20};valid('gameplay',wrong);assert.equal((await review('gameplay',wrong)).verdict,'fail');
 const actor={x:100,y:100};components.move(actor,1,0,140,0.1);assert.equal(actor.x,114);assert.equal(actor.y,100);
});
test('levels: schema-valid walls can trap an exit and must fail independent reachability',async()=>{
 const level=referenceLevel('collector');assert.equal(reachable(level),true);
 level.walls=[{x:12,y:8},{x:14,y:8},{x:13,y:7},{x:13,y:9}];valid('levels',level);assert.equal(reachable(level),false);assert.equal((await review('levels',level)).verdict,'fail');
});
test('ui: the delivered HUD follows changed health and MP rather than stale labels',async()=>{
 const {PlayerInterface}=await moduleFor('interface.js'),elements=new Map(),previous=globalThis.document;
 const element=key=>{if(!elements.has(key))elements.set(key,{dataset:{},textContent:'',max:0,value:0});return elements.get(key);};globalThis.document={querySelector:element};
 try{const state={phase:'playing',health:17,maxHealth:20,mana:3,maxMana:6,objective:'Mage turn'},ui=new PlayerInterface({state,genre:'rpg'});ui.hud=hudFor('rpg');ui.render();assert.equal(element('#value-health').textContent,'17 / 20');assert.equal(element('#meter-mana').value,3);state.health=0;state.mana=0;ui.render();assert.equal(element('#meter-health').value,0);assert.equal(element('#value-mana').textContent,'0 / 6');}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
 const wrong={...clone(defaults.ui),title:brief.title,hud:hudFor('collector')};valid('ui',wrong);assert.equal((await review('ui',wrong,{brief:{...brief,genre:'rpg'}})).verdict,'fail');
});
test('story: a valid intro cannot silently drop an explicit saved village name',async()=>{
 const artifact={intro:'Collect stars and reach the portal.',victory:'You won!',defeat:'Try again.'};valid('story',artifact);
 const context={decisions:{'story.direction':'The village is Moonbrook. Mention it in the intro.'}};
 assert.equal((await review('story',artifact,{context})).verdict,'fail');
 assert.equal((await review('story',{...artifact,intro:'Help Moonbrook collect stars and reach the portal.'},{context})).verdict,'pass');
});
test('audio: requested music cannot receive a schema-valid muted or zero-volume default',async()=>{
 for(const artifact of [{...clone(defaults.audio),music:true,enabled:false},{...clone(defaults.audio),music:true,volume:0}]){valid('audio',artifact);assert.equal((await review('audio',artifact)).verdict,'fail');}
 const {GameAudio}=await moduleFor('audio.js');
 class Node{constructor(){this.gain={value:0,rampTo(v){this.value=v;}};}connect(){return this;}toDestination(){return this;}dispose(){}triggerAttackRelease(){}}
 const sequences=[],transport={state:'stopped',bpm:{value:0},start(){this.state='started';},stop(){this.state='stopped';}};
 class Sequence{constructor(callback,notes){Object.assign(this,{callback,notes});sequences.push(this);}start(){return this;}dispose(){}}
 const Tone={Gain:Node,Limiter:Node,Synth:Node,FMSynth:Node,MembraneSynth:Node,Sequence,start:async()=>{},getTransport:()=>transport};
 const audio=new GameAudio({...clone(defaults.audio),enabled:true,music:true,volume:0.17},{Tone,AudioContextCtor:null});
 await audio.start();audio.setPlaying(true);assert.equal(audio.inspect().muted,false);assert.ok(audio.inspect().musicGain>0);
 for(const seq of sequences)seq.callback(0,seq.notes.find(note=>note!=='R'));assert.ok(audio.inspect().scheduledNotes>0);
 audio.sfxMuted=true;audio.update();assert.ok(audio.inspect().musicGain>0);audio.musicMuted=true;audio.update();assert.equal(audio.inspect().musicGain,0);
 audio.musicMuted=false;audio.setPlaying(false);assert.equal(audio.inspect().musicGain,0);audio.dispose();assert.equal(audio.inspect().ownedNodes,0);
});
test('combat: exact nondefault spell damage and MP cost reach the trusted battle runtime',()=>{
 const combat={attackPower:5,spellPower:8,spellCost:3,enemyDamage:3};valid('combat',combat);
 const campaign=newCampaign('beginner',{combat}),battle=beginBattle(campaign,2);battle.actor=1;assert.equal(battleAction(battle,'spell'),true);assert.equal(campaign.party[1].mp,3);assert.equal(battle.enemies[0].hp,7);assert.equal(campaign.party[0].hp,9);
 battle.actor=1;campaign.party[1].mp=0;const round=battle.round,hp=battle.enemies[0].hp;assert.equal(battleAction(battle,'spell'),false);assert.equal(battle.round,round);assert.equal(battle.enemies[0].hp,hp);
});
test('progression: potions, XP and level-up use proposed values without duplicate rewards',()=>{
 const progression={startingPotions:2,potionHealing:3,xpPerEncounter:15,levelTwoAt:30,levelHeal:2};valid('progression',progression);
 const campaign=newCampaign('beginner',{progression,combat:{enemyDamage:1}}),first=beginBattle(campaign);campaign.party[0].hp=5;
 assert.equal(battleAction(first,'potion'),true);assert.equal(campaign.potions,1);assert.equal(campaign.party[0].hp,7);
 first.enemies[0].hp=1;battleAction(first,'attack');assert.equal(campaign.xp,15);assert.equal(campaign.level,1);assert.equal(battleAction(first,'attack'),false);assert.equal(campaign.xp,15);
 const second=beginBattle(campaign);second.enemies[0].hp=1;const health=campaign.party[0].hp;battleAction(second,'attack');assert.equal(campaign.xp,30);assert.equal(campaign.level,2);assert.equal(campaign.party[0].hp,health+2);assert.equal(campaign.potions,1);
});
test('enemies: nondefault windup delays attacks and walls cancel them',()=>{
 const settings={...clone(defaults.enemies),telegraphMs:1000,attackCooldown:2.5},brain=newEnemyBrain('sentry');valid('enemies',settings);brain.idle=0;brain.cooldown=0;
 const input={dt:0.1,position:{x:0,y:0},target:{x:100,y:0},health:3,settings};assert.equal(stepEnemy(brain,input).telegraph,true);
 for(let i=0;i<9;i++)assert.equal(stepEnemy(brain,input).fired,false);assert.equal(stepEnemy(brain,input).fired,true);assert.equal(brain.cooldown,2.5);
 const blocked=newEnemyBrain('sentry');blocked.idle=0;blocked.cooldown=0;stepEnemy(blocked,input);assert.equal(stepEnemy(blocked,{...input,lineOfSight:false}).fired,false);assert.equal(blocked.windup,0);
});
test('art: an explicit battle setting is checked and the delivered renderer uses its palette',async()=>{
 const requested={...brief,genre:'rpg',prompt:'Use a ruins battle background.'},wrong={...clone(defaults.art),battleBackdrop:'space'};valid('art',wrong);assert.equal((await review('art',wrong,{brief:requested})).verdict,'fail');
 const {createBattleBackdrop}=await moduleFor('battle-backdrop.js'),colors=[];const graphics={setDepth(){return this;},fillStyle(c){colors.push(c);},fillRect(){},fillTriangle(){},fillCircle(){},lineStyle(){},lineBetween(){}};
 createBattleBackdrop({add:{graphics:()=>graphics}},'forest','ruins');assert.equal(colors[0],0x161c29);
});
test('implementation: valid module names cannot omit the required failure-state implementation',async()=>{
 const artifact={runtime:'collector',version:1,modules:['movement','hud','settings','audio','game-events','vfx']};valid('implementation',artifact);assert.equal((await review('implementation',artifact)).verdict,'fail');assert.throws(()=>compileAssembly({genre:'collector',implementation:artifact}),/capabilities/);
});
test('integration: a ready claim cannot replace the exact independently computed dependency identity',async()=>{
 const context={memory:{dependencies:[{role:'planner',hash:'checked-upstream',artifact:{planReference:{}}}]}},artifact={status:'ready',manifestHash:'0'.repeat(64)};valid('integration',artifact);assert.equal((await review('integration',artifact,{context})).verdict,'fail');
 artifact.manifestHash=createHash('sha256').update(JSON.stringify([['planner','checked-upstream']])).digest('hex');assert.equal((await review('integration',artifact,{context})).verdict,'pass');
});
test('qa: self-declared passing evidence cannot hide a level that cannot be completed',async()=>{
 const config=clone(defaults);config.genre='collector';config.levels={...referenceLevel(),walls:[{x:12,y:8},{x:14,y:8},{x:13,y:7},{x:13,y:9}]};assert.equal(runProjectRules(config).passed,false);
 const context={memory:{dependencies:Object.entries(config).filter(([role])=>['planner','gameplay','levels','ui','story','audio'].includes(role)).map(([role,artifact])=>({role,hash:'fixture-'+role,artifact}))}},artifact={scope:'rules-and-static',passed:true,evidenceHash:'0'.repeat(64)};valid('qa',artifact);assert.equal((await review('qa',artifact,{context})).verdict,'fail');
});
test('vfx: schema-valid excessive bursts are rejected and actual effects respect pool and reduced-effects limits',async()=>{
 const wrong={...clone(defaults.vfx),maxParticles:4,particlesPerBurst:5};valid('vfx',wrong);assert.equal((await review('vfx',wrong)).verdict,'fail');
 const {GameVfx}=await moduleFor('vfx.js'),bus=createGameEvents(),settings={reducedEffects:false};let allocated=0;
 const node=()=>({setDepth(){return this;},setVisible(){return this;},setAlpha(){return this;},setFillStyle(){return this;},setPosition(){return this;},destroy(){}}),scene={add:{circle:()=>{allocated++;return node();}},cameras:{main:{shake(){}}}},effects=new GameVfx(scene,bus,{...wrong,particlesPerBurst:4},()=>settings);
 for(let i=0;i<100;i++)bus.emit('damage_taken',{x:10,y:10});assert.ok(allocated<=4);settings.reducedEffects=true;effects.update(0.1);assert.equal(effects.inspect().active,0);effects.dispose();assert.equal(effects.inspect().allocated,0);
});
test('coding: independent held-key expectations catch self-passing but incorrect controls',async()=>{
 const cases=[{name:'holding J is one press',steps:[{dt:0.1,actions:['attack'],repeat:5}],assertions:[{field:'score',op:'eq',value:1},{field:'phase',op:'eq',value:'playing'}]}];
 const report=await runCodeChecks({source:DEFAULT_SOURCE,scenarios:DEFAULT_SCENARIOS},undefined,{acceptanceCases:cases});assert.equal(report.passed,true,report.error);
 const wrong=DEFAULT_SOURCE.replace("api.pressed(buttons,'attack',!!input.attack)",'input.attack');assert.notEqual(wrong,DEFAULT_SOURCE);valid('coding',{source:wrong,scenarios:DEFAULT_SCENARIOS});
 const mutant=await runCodeChecks({source:wrong,scenarios:DEFAULT_SCENARIOS},undefined,{acceptanceCases:cases});assert.equal(mutant.passed,false);assert.ok(mutant.tests.some(t=>t.phase==='won'&&t.passed));assert.ok(mutant.tests.some(t=>t.name.startsWith('Independent:')&&!t.passed));
 let modelReviews=0;
 await assert.rejects(runPair({role:'coding',brief:{...brief,genre:'custom'},directory:await mkdtemp(join(tmpdir(),'independent-block-')),worker:async()=>({artifact:{source:wrong,scenarios:DEFAULT_SCENARIOS},summary:'Self-passing wrong-control fixture'}),verifyProposal:artifact=>runCodeChecks(artifact,undefined,{acceptanceCases:cases}),checker:async()=>{modelReviews++;return {verdict:'pass',findings:[],evidence:['Synthetic overconfident review']};}}),/exhausted.*score eq 1/);
 assert.equal(modelReviews,0,'Independent behavior failures must block paid/model review and acceptance');
});

test('known human facts are narrow and current backdrop revisions override the original request',async()=>{
 assert.deepEqual(namedStoryPlaces({decisions:{'story.direction':'Use a hopeful tone.'}}),[]);
 const artifact={intro:'Collect stars and reach the portal.',victory:'Won!',defeat:'Lost!'};
 assert.equal((await review('story',artifact,{context:{decisions:{'story.direction':'Use a hopeful tone.'}}})).verdict,'pass');
 const requested={genre:'rpg',prompt:'Battle background: ruins.'},context={changeRequest:{request:'Use a cavern battle backdrop.'}};
 assert.equal(requestedBattleBackdrop(requested,context),'cavern');
 assert.equal(requestedBattleBackdrop(requested,{changeRequest:{request:'Change the music.'}}),'ruins');
 assert.equal(requestedBattleBackdrop({prompt:'Avoid a ruins battle background.'}),null);
 assert.equal(requestedBattleBackdrop({prompt:'Battle background: ruins, with a forest overworld.'}),'ruins');
 const {artifact:art}=await(await route('art')).worker({brief:requested,context});assert.equal(art.battleBackdrop,'cavern');
 assert.equal((await review('art',{...art,battleBackdrop:'ruins'},{brief:requested,context})).verdict,'fail');
 assert.equal((await review('audio',{...clone(defaults.audio),enabled:false,music:false,volume:0},{brief:{...brief,music:false}})).verdict,'pass');
});

test('an overconfident native model checker cannot override independent story, art or music findings',async()=>{
 for(const [role,artifact,requestBrief,context]of [
  ['audio',{...clone(defaults.audio),music:true,enabled:false},brief,{}],
  ['story',{intro:'Collect stars.',victory:'Won!',defeat:'Lost!'},brief,{decisions:{'story.direction':'The village is Moonbrook.'}}],
  ['art',{...clone(defaults.art),battleBackdrop:'space'},{...brief,genre:'rpg',prompt:'Battle background: ruins.'},{}]
 ]){
  let calls=0;const runtime=createRuntime({env:{GAME_BUILDER_PROVIDER:'anthropic',ANTHROPIC_API_KEY:'SYNTHETIC_INDEPENDENT_REVIEW'},fetchImpl:async()=>{calls++;return new Response(JSON.stringify({type:'message',role:'assistant',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({review:{verdict:'pass',findings:[],evidence:['Synthetic model missed the semantic error'],question:null}})}],usage:{input_tokens:100,output_tokens:50}}));}});
  const result=await(await runtime.route(role,{})).checker({instructions:'Review the proposal.',task:{role},brief:requestBrief,context:{plan,decisions:{},...context},artifact});assert.equal(result.verdict,'fail',role);assert.ok(result.findings.length);assert.equal(calls,1);
 }
});
