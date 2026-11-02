import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {mkdtemp,readFile,rm,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve,sep,extname} from 'node:path';
import {defaults,clone} from '../shared/contracts/index.js';import {hudFor} from '../shared/player-ui.js';import {referenceLevel} from '../shared/game-types.js';import {DEFAULT_SOURCE,DEFAULT_SCENARIOS} from '../shared/code-game.js';
import {modulesFor} from '../apps/server/src/specialists/jobs.js';import {buildGame} from '../apps/server/src/integration/build.js';import {browserEnvironment} from '../apps/server/src/validation/browser-environment.js';
async function fixture(genre,run,source){
 const folder=await mkdtemp(join(tmpdir(),'in-game-hud-'));let browser,server;
 try{
  const config={...clone(defaults),genre};config.ui.hud=hudFor(genre);config.levels=referenceLevel(genre);config.implementation={runtime:genre,version:1,modules:modulesFor(genre)};if(genre==='custom')config.coding={source,scenarios:DEFAULT_SCENARIOS};await buildGame(folder,config);
  server=createServer(async(req,res)=>{try{const path=resolve(folder,new URL(req.url,'http://localhost').pathname.slice(1)||'index.html');if(!path.startsWith(folder+sep))throw Error('Outside fixture');const bytes=await readFile(path);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json'})[extname(path)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}});await new Promise(yes=>server.listen(0,'127.0.0.1',yes));
  const {chromium}=await import('playwright');browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true,args:['--mute-audio','--disable-background-networking'],env:browserEnvironment()});const page=await browser.newPage({viewport:{width:1000,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.gameState?.().ready);await page.clock.pauseAt(await page.evaluate(()=>Date.now())+500);
  const state=()=>page.evaluate(()=>window.gameState()),advance=ms=>page.clock.runFor(ms),click=async name=>{await page.getByRole('button',{name,exact:true}).click({force:true});await advance(50);};
  const pump=async predicate=>{for(let i=0;i<60;i++){await advance(50);const s=await state();if(predicate(s))return s;}throw Error('Fixture state did not settle');};
  const text=id=>page.locator(`#in-game-hud [data-stat="${id}"] strong`).innerText();
  await run({page,state,advance,click,pump,text});assert.deepEqual(errors,[]);
 }finally{await browser?.close();if(server)await new Promise(yes=>server.close(yes));if(folder.startsWith(join(tmpdir(),'in-game-hud-')))await rm(folder,{recursive:true,force:true,maxRetries:3});}
}
async function fits(page){
 const bounds=await page.evaluate(()=>{const canvas=document.querySelector('canvas').getBoundingClientRect(),hud=document.querySelector('#in-game-hud').getBoundingClientRect();return {left:hud.left-canvas.left,right:canvas.right-hud.right,top:hud.top-canvas.top,bottom:canvas.bottom-hud.bottom,height:hud.height,overflow:document.documentElement.scrollWidth>innerWidth,clipped:[...document.querySelectorAll('.play-stat strong')].some(el=>el.scrollWidth>el.clientWidth+1)};});
 assert.ok(bounds.left>=0&&bounds.right>=0&&bounds.top>=0&&bounds.bottom>=0,JSON.stringify(bounds));assert.ok(bounds.height<=60,JSON.stringify(bounds));assert.equal(bounds.clipped,false);assert.equal(bounds.overflow,false);
 assert.equal(await page.locator('[data-play-stats]').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
}
test('RPG overlay and external HP/MP track real battle actions, pause, mobile layout and restart',async()=>fixture('front_battle',async({page,state,advance,click,text})=>{
 assert.equal(await text('health'),'20 / 20');assert.equal(await text('mana'),'6 / 6');assert.equal(await text('score'),'0 / 3');assert.equal(await page.locator('#in-game-hud [data-stat="time"]').count(),0);
 await click('Start game');await click('Guard / next party member');await click('Spell · 2 MP (K)');const changed=await state();assert.ok(changed.health<20);assert.equal(changed.mana,4);assert.equal(changed.score,1);
 assert.equal(await text('health'),await page.locator('#value-health').innerText());assert.equal(await text('mana'),'4 / 6');assert.equal(await text('score'),'1 / 3');
 await click('Pause game');const paused=await state();await page.keyboard.press('KeyJ');await advance(1000);assert.equal((await state()).phase,'paused');assert.equal((await state()).health,paused.health);assert.equal(await text('mana'),'4 / 6');await click('Resume game');
 await fits(page);await page.setViewportSize({width:360,height:800});await advance(100);await fits(page);
 await click('Restart');await advance(100);assert.equal(await text('health'),'20 / 20');assert.equal(await text('mana'),'6 / 6');assert.equal(await text('score'),'0 / 3');assert.equal(await page.locator('#in-game-hud').count(),1);
}));
test('custom worker timer/MP/score reach both real HUD state and responsive overlay without independent counters',async()=>{
 const source=DEFAULT_SOURCE.replace('remaining:Math.max(0,10-time),timeLimit:10,','remaining:Math.max(0,10-time),timeLimit:10,mana:Math.max(0,4-score*2),maxMana:4,');assert.notEqual(source,DEFAULT_SOURCE);
 await fixture('custom',async({page,state,advance,click,pump,text})=>{
  assert.equal(await text('time'),'10s');assert.equal(await text('mana'),'4 / 4');await click('Start game');
  for(let score=1;score<=2;score++){await page.locator('#game').focus();await page.keyboard.down('KeyJ');await pump(s=>s.score===score);await page.keyboard.up('KeyJ');await advance(100);}
  const s=await state();assert.equal(await text('progress'),'2');assert.equal(await page.locator('#value-progress').innerText(),'2');assert.equal(await text('mana'),'0 / 4');assert.equal(await text('time'),`${Math.ceil(s.codeSnapshot.remaining)}s`);assert.equal(s.remaining,s.codeSnapshot.remaining);
  await click('Pause game');const before=await state();await advance(1200);assert.deepEqual((await state()).codeSnapshot,before.codeSnapshot);assert.equal(await text('time'),`${Math.ceil(before.remaining)}s`);await click('Resume game');
  await fits(page);await mkdir('.local/in-game-hud',{recursive:true});await page.locator('#game').screenshot({path:'.local/in-game-hud/desktop.png'});await page.setViewportSize({width:360,height:800});await advance(100);await fits(page);await page.locator('#game').screenshot({path:'.local/in-game-hud/mobile.png'});
  await click('Restart');await pump(s=>s.phase==='ready'&&s.codeSnapshot?.score===0);assert.equal(await text('progress'),'0');assert.equal(await text('mana'),'4 / 4');assert.equal(await text('time'),'10s');
 },source);
});
test('legacy custom output cannot turn the unused framework clock into a fake countdown or MP display',async()=>{
 const source=DEFAULT_SOURCE.replace('remaining:Math.max(0,10-time),timeLimit:10,','');assert.notEqual(source,DEFAULT_SOURCE);
 await fixture('custom',async({page,text,click})=>{await click('Start game');assert.equal(await text('progress'),'0');assert.equal(await page.locator('#in-game-hud [data-stat="time"]').count(),0);assert.equal(await page.locator('#in-game-hud [data-stat="mana"]').count(),0);},source);
});
