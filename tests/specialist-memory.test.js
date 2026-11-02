import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {activeRoles,dependenciesFor,EXTENSION_SPECS,extensionDefaults} from '../shared/specialists.js';
import {validateArtifact,defaults,clone} from '../shared/contracts/index.js';
import {Manager} from '../apps/server/src/orchestrator/manager.js';
import {Store} from '../apps/server/src/storage/store.js';
import {createRuntime} from './fixtures/legacy-provider.js';
import {compileAssembly} from '../apps/server/src/integration/assembly.js';
import {runProjectRules} from '../apps/server/src/specialists/rules-tests.js';
import {newCampaign,beginBattle,battleAction} from '../shared/turn-combat.js';
import {runPair} from '../apps/server/src/runners/harness.js';
import {ART_THEMES} from '../shared/art-catalog.js';
import {hudFor} from '../shared/player-ui.js';
import {acceptMemory} from '../apps/server/src/memory/project.js';
const temporary=()=>mkdtemp(join(tmpdir(),'specialist-memory-'));
async function build(genre='rpg',runtime=createRuntime({env:{}})){
  const manager=new Manager(new Store(await temporary()),{runtime});await manager.initialize();
  const run=await manager.create({title:'Memory Party',prompt:'A small original adventure with the supported mechanics.',genre,theme:'forest',difficulty:'beginner',music:false});await manager.jobs.get(run.id);
  assert.equal(run.status,'awaiting_plan',run.error);await manager.act(run.id,'approve_plan',{planHash:run.planHash});await manager.jobs.get(run.id);assert.equal(run.status,'awaiting_review',run.error);return {manager,run};
}
test('router activates applicable jobs and its dependency graph is acyclic',()=>{
  for(const genre of ['collector','rpg','front_battle','stealth','run_gun','jump_shooter','metroidvania']){
    const roles=activeRoles(genre),done=new Set();
    for(let n=0;n<roles.length;n++)for(const role of roles)if(dependenciesFor(role,genre).every(parent=>done.has(parent)))done.add(role);
    assert.equal(done.size,roles.length);assert.equal(roles.includes('combat'),['rpg','front_battle'].includes(genre));assert.equal(roles.includes('progression'),roles.includes('combat'));assert.equal(roles.includes('enemies'),['stealth','run_gun','jump_shooter','metroidvania'].includes(genre));
    assert.ok(dependenciesFor('qa',genre).includes('integration'));assert.ok(dependenciesFor('implementation',genre).includes('levels'));
  }
});
test('all new contracts reject code/path fields and unsafe runtime assembly',()=>{
  for(const role of Object.keys(EXTENSION_SPECS))assert.ok(validateArtifact(role,{...extensionDefaults(role),path:'../../.env'}).length);
  assert.throws(()=>compileAssembly({genre:'rpg',implementation:{runtime:'../../.env',version:1,modules:[]}}));
  assert.throws(()=>compileAssembly({genre:'collector',implementation:{runtime:'collector',version:1,modules:['eval()']}}));
});
test('combat and inventory settings change actual rules rather than only agent descriptions',()=>{
  const c=newCampaign('beginner',{combat:{attackPower:5,spellPower:8,spellCost:3,enemyDamage:1},progression:{startingPotions:1,potionHealing:3,xpPerEncounter:15,levelTwoAt:30,levelHeal:2}});
  assert.equal(c.potions,1);let battle=beginBattle(c);battleAction(battle,'attack');assert.equal(battle.phase,'won');assert.equal(c.xp,15);
  battle=beginBattle(c,2);battleAction(battle,'guard');battleAction(battle,'spell');assert.equal(c.party[1].mp,3);assert.equal(battle.enemies[0].hp,7);
  const config={...clone(defaults),genre:'rpg',combat:extensionDefaults('combat'),progression:extensionDefaults('progression')};
  assert.equal(runProjectRules(config).passed,false,'A collector HUD must fail RPG QA');config.ui.hud=hudFor('rpg');assert.equal(runProjectRules(config).passed,true);
});
test('a complete RPG retains checked handoffs, human specification and scoped QA evidence across restart/revision',async()=>{
  const {manager,run}=await build();assert.deepEqual(Object.keys(run.results).sort(),activeRoles('rpg').sort());
  assert.equal(run.memory.specification.source,'human-plan-approval');assert.equal(run.memory.handoffs.length,activeRoles('rpg').length);
  const qa=run.memory.tests.find(record=>record.kind==='qa-rules');assert.equal(qa.evidence.passed,true);assert.equal(qa.evidence.browserTested,false);assert.equal(qa.evidence.humanApproved,false);
  for(const role of activeRoles('rpg'))for(const parent of dependenciesFor(role,'rpg'))assert.equal(run.memory.artifacts[role].dependencies[parent],run.memory.artifacts[parent].hash);
  const folder=join(manager.store.folder(run.id),'builds','0');assert.match(await readFile(join(folder,'assembly.js'),'utf8'),/turn-combat/);
  const restored=new Manager(manager.store,{runtime:createRuntime({env:{}})});await restored.initialize();const saved=restored.get(run.id);assert.equal(saved.memory.handoffs.length,run.memory.handoffs.length);
  const count=saved.memory.handoffs.length;await restored.act(saved.id,'revise',{difficulty:'experienced'});await restored.jobs.get(saved.id);assert.equal(saved.status,'awaiting_plan');assert.ok(saved.memory.tests.every(record=>record.stale));assert.ok(saved.memory.handoffs.length>count);assert.equal(saved.planApproval,null);
});
test('read-only memory tools cannot access another project, mutate accepted context or write approvals',async()=>{
  const source={dependencies:[{role:'planner',hash:'checked',artifact:{title:'Keep'}}],decisions:[]};
  await runPair({role:'gameplay',brief:{prompt:'A game',difficulty:'beginner'},context:{memory:source},directory:await temporary(),worker:async({tools})=>{assert.equal(tools.write_memory,undefined);const copy=tools.read_project_memory();copy[0].artifact.title='Tampered';assert.throws(()=>tools.read_project_memory('../../.env'));return tools.propose_artifact(clone(defaults.gameplay));},checker:async({tools})=>{assert.equal(tools.read_project_memory()[0].artifact.title,'Keep');return {verdict:'pass',findings:[],evidence:['Read immutable scoped memory']};}});
  assert.equal(source.dependencies[0].artifact.title,'Keep');
});
test('an in-flight proposal cannot be accepted after its dependency hash changes',async()=>{
  const manager=new Manager(new Store(await temporary()),{runtime:createRuntime({env:{}})});await manager.initialize();
  const run=await manager.create({title:'Stale fixture',prompt:'Collect stars',difficulty:'beginner'});await manager.jobs.get(run.id);assert.equal(run.status,'awaiting_plan');run.status='running';
  let started,release;const ready=new Promise(resolve=>{started=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  manager.router=async()=>({worker:async()=>{started();await gate;return {artifact:clone(defaults.gameplay)};},checker:async()=>({verdict:'pass',findings:[],evidence:['Synthetic fixture checker']})});
  const job=manager.execute(run,'gameplay');await ready;
  run.results.planner.artifact.objective='A revised checked dependency';acceptMemory(run,'planner',run.results.planner,[]);release();await job;
  assert.equal(run.results.gameplay,undefined);assert.equal(run.memory.workspaces.gameplay.stage,'stale');assert.ok(run.events.some(event=>event.message.includes('stale in-flight contribution discarded')));
});
test('simulated OpenAI runs exercise every RPG worker/checker schema and preserve real/deterministic review separation',async()=>{
  const calls=[];const runtime=createRuntime({env:{GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'SYNTHETIC_SPECIALIST_TEST',OPENAI_MAX_CALLS:'40',OPENAI_MAX_TOTAL_TOKENS:'256000'},fetchImpl:async(_,options)=>{
    const body=JSON.parse(options.body),[role,stage]=body.text.format.name.split('_'),data=JSON.parse(body.input[0].content[0].text);calls.push({role,stage});
    let artifact=clone(data.artifactReference);
    if(stage==='worker'&&role==='planner')Object.assign(artifact,{title:data.brief.title,difficulty:data.brief.difficulty});
    if(stage==='worker'&&role==='ui')Object.assign(artifact,{title:data.brief.title,theme:data.brief.theme,hud:data.hudReference,playerColor:ART_THEMES.forest.playerColor,backgroundColor:ART_THEMES.forest.backgroundColor});
    const value=stage==='checker'?{review:{verdict:'pass',findings:[],evidence:['Static fixture comparison'],question:null}}:{kind:'artifact',artifact,question:null,summary:'Synthetic checked specialist contribution'};
    return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}],usage:{input_tokens:100,output_tokens:50,total_tokens:150}}));
  }});
  const {run}=await build('rpg',runtime);assert.equal(calls.length,activeRoles('rpg').length*2);
  for(const role of activeRoles('rpg')){assert.equal(calls.filter(call=>call.role===role).length,2);assert.deepEqual(run.results[role].report.reviewSources,['openai','deterministic']);}
});
