import {createServer} from 'node:http';
import {readFile,mkdir,access} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {gridPath} from '../../../../shared/stealth-rules.js';
import {lifecycleFor} from '../../../../shared/lifecycle.js';
import {runCodeChecks} from './code-checks.js';
let queue=Promise.resolve();
export async function assertBrowserInstalled(){const {chromium}=await import('playwright');const paths=process.platform==='win32'?['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe']:[chromium.executablePath()];for(const path of paths)try{await access(path);return;}catch{/* Try the next standard installation. */}throw Error('Browser QA needs an installed Edge browser on Windows or Playwright Chromium on other systems. Install it before using paid model runs, or explicitly configure manual-only browser QA.');}
export function runBrowserSmoke(options){const job=queue.catch(()=>{}).then(()=>execute(options));queue=job.catch(()=>{});return job;}
async function execute({folder,config,buildHash,reportFolder,signal}){
  const report={scope:'browser-smoke',buildHash,passed:false,tests:[],browserTested:false,fullPlaythrough:false,listeningTested:false,humanApproved:false,virtualTime:true};
  let browser,server,page,timedOut=false;const errors=[];
  const deadline=setTimeout(()=>{timedOut=true;browser?.close().catch(()=>{});},60000);deadline.unref();
  const abort=()=>browser?.close().catch(()=>{});signal?.addEventListener('abort',abort,{once:true});
  try{
    if(signal?.aborted)throw Error('Browser checks cancelled');
    const root=resolve(folder);
    server=createServer(async(req,res)=>{try{const relative=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).slice(1)||'index.html',path=resolve(root,relative);if(!path.startsWith(root+sep)||relative.split(/[\\/]/).some(part=>part.startsWith('.')))throw Error('Outside build');const types={'.js':'text/javascript','.json':'application/json','.html':'text/html'};res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(path));}catch{res.writeHead(404);res.end('Not found');}});
    await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
    const origin=`http://127.0.0.1:${server.address().port}`;
    const {chromium}=await import('playwright');
    browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true,args:['--mute-audio','--disable-background-networking'],env:Object.fromEntries(Object.entries(process.env).filter(([key,value])=>typeof value==='string'&&!/^(OPENAI_|AWS_|GH_|GITHUB_|CODEX_)/.test(key)))});
    const context=await browser.newContext({viewport:{width:1000,height:900},reducedMotion:'no-preference',serviceWorkers:'block'});
    await context.route('**/*',route=>{const url=new URL(route.request().url());return url.origin===origin?route.continue():route.abort();});
    page=await context.newPage();report.browserTested=true;page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message.slice(0,300)));
    await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.goto(origin,{waitUntil:'load'});await page.waitForFunction(()=>window.gameState?.().ready,undefined,{timeout:12000});
    await page.clock.pauseAt(await page.evaluate(()=>Date.now())+1000);
    const state=()=>page.evaluate(()=>window.gameState());
    const advance=async milliseconds=>{if(signal?.aborted||timedOut)throw Error('Browser checks interrupted');await page.clock.runFor(milliseconds);};
    const click=async name=>{const button=page.getByRole('button',{name,exact:true});if(!await button.isVisible()||!await button.isEnabled())throw Error('Control unavailable: '+name);await button.click({force:true});await advance(40);};
    const assert=(condition,message)=>{if(!condition)throw Error(message);};
    const observedModes=new Set();
    const collect=s=>{for(const enemy of s.enemyStates||[])observedModes.add(enemy.mode);};
    const drive=async(targetFor,steps=80)=>{
      for(let i=0;i<steps;i++){const s=await state();collect(s);if(s.phase!=='playing')return s;const target=targetFor(s);if(!target)return s;
        if(Math.hypot(target.x-s.x,target.y-s.y)<24){await advance(250);continue;}
        let next=target;if(!['run_gun','jump_shooter','metroidvania','platformer'].includes(config.genre)){const path=gridPath(s.roomMap||config.levels,{x:s.x,y:s.y},target);if(path===null)throw Error('Input replay target is unreachable');next=path[0]||target;
          // A tile path assumes centered turns. Align before crossing a corner
          // so the player's collision body cannot snag a neighboring wall.
          const cx=Math.floor(s.x/48)*48+24,cy=Math.floor(s.y/48)*48+24;
          if(path.length&&Math.abs(next.x-cx)>1&&Math.abs(s.y-cy)>3)next={x:s.x,y:cy};
          else if(path.length&&Math.abs(next.y-cy)>1&&Math.abs(s.x-cx)>3)next={x:cx,y:s.y};
        }
        const dx=next.x-s.x,dy=next.y-s.y,key=['run_gun','jump_shooter','metroidvania','platformer'].includes(config.genre)?(dx<0?'ArrowLeft':'ArrowRight'):Math.abs(dx)>Math.abs(dy)?(dx<0?'ArrowLeft':'ArrowRight'):(dy<0?'ArrowUp':'ArrowDown');
        await page.keyboard.down(key);await advance(Math.min(200,Math.max(40,Math.max(Math.abs(dx),Math.abs(dy))/config.gameplay.speed*1000)));await page.keyboard.up(key);
      }return state();
    };
    report.tests.push({name:'build boot',passed:!!await page.locator('canvas').count()});
    await click('Start game');assert((await state()).phase==='playing','Start did not enter gameplay');
    await click('Pause / settings');const paused=await state();await advance(1000);const frozen=await state();assert(frozen.phase==='paused'&&frozen.health===paused.health&&frozen.x===paused.x&&frozen.y===paused.y&&frozen.remaining===paused.remaining,'Pause changed gameplay state');report.tests.push({name:'pause freezes gameplay',passed:true});await click('Resume game');
    if(config.genre==='custom'){
      assert(await page.locator('#stat-progress .stat-label').textContent()==='Score'&&await page.locator('#value-progress').innerText()===String((await state()).score),'Custom HUD must show score rather than a stage counter');
      report.tests.push({name:'custom HUD uses actual game score',passed:true});
      const rules=await runCodeChecks(config.coding,signal);assert(rules.passed,rules.error||'Generated rule replays failed');
      report.tests.push(...rules.tests.map(test=>({...test,name:'isolated rules: '+test.name})));report.codeSourceHash=rules.sourceHash;
      await click('Restart');await page.waitForFunction(()=>window.gameState?.().ready);assert((await state()).phase==='ready','Custom preview did not reset');
      assert(!errors.length,'Custom preview script errors: '+errors.join('; '));report.tests.push({name:'custom preview restart and no script errors',passed:true});report.passed=report.tests.every(test=>test.passed);
      if(reportFolder){await mkdir(reportFolder,{recursive:true});await page.screenshot({path:resolve(reportFolder,'browser-smoke.png'),fullPage:true});}return report;
    }
    if(['run_gun','jump_shooter','metroidvania'].includes(config.genre)){
      await page.keyboard.down('KeyJ');await advance(650);await page.keyboard.up('KeyJ');const shots=await state();assert((shots.events||[]).some(event=>event.type==='player_shot'&&event.x>shots.x+30),'Projectiles did not publish moving trail events');
      if(config.genre==='jump_shooter'){await advance(500);const beforePower=await state();await page.keyboard.press('KeyK');await advance(40);assert((await state()).mana===beforePower.mana-2,'Powered shot did not spend weapon energy');}
      report.tests.push({name:'projectile trails and applicable weapon energy',passed:true});await click('Restart');await click('Start game');
    }
    const rules=lifecycleFor(config.genre),initial=await state();
    if(['rpg','front_battle','campaign','roguelike'].includes(config.genre)){
      if(['rpg','campaign','roguelike'].includes(config.genre)){const p=(await state()).roomMap?.stars[0]||config.levels.stars[0];await drive(()=>({x:p.x*48+24,y:p.y*48+24}),80);}
      assert(await page.getByRole('button',{name:'Guard / next party member',exact:true}).count(),'No reachable battle controls');
      await click('Guard / next party member');const beforeSpell=await state(),cost=config.combat?.spellCost??2;await click(`Spell · ${cost} MP (K)`);const afterSpell=await state();assert(afterSpell.mana===beforeSpell.mana-cost,'Spell did not spend the configured MP');assert((afterSpell.events||[]).some(event=>event.type==='spell_cast'),'Spell did not publish its presentation event');report.tests.push({name:'spell resource and VFX event',passed:true});
      assert(afterSpell.presentation==='battle','Encounter did not use a separate battle presentation');
      if(['campaign','roguelike'].includes(config.genre)){
        const rooms=config.genre==='roguelike'?5:3;
        for(let room=0;room<rooms;room++){
          if(room){const p=(await state()).roomMap.stars[0];await drive(()=>({x:p.x*48+24,y:p.y*48+24}),100);}
          for(let turn=0;turn<60&&!await page.getByRole('button',{name:'Return to exploration',exact:true}).count();turn++){
            const s=await state();assert(s.phase==='playing','Party failed during campaign completion probe');
            const potion=page.getByRole('button',{name:/^Potion \(/}),spell=page.getByRole('button',{name:/^Spell ·/});
            if(s.party.some(p=>p.hp>0&&p.hp<=p.maxHp-5)&&await potion.isEnabled())await potion.click({force:true});
            else if(await spell.isEnabled())await spell.click({force:true});else await page.getByRole('button',{name:/^Attack \(/}).click({force:true});
            await advance(40);
          }
          await click('Return to exploration');const beforeExit=await state();assert(beforeExit.presentation==='overworld','Battle backdrop did not return to overworld');
          const exit=beforeExit.roomMap.exit;await drive(s=>s.room===room?{x:exit.x*48+24,y:exit.y*48+24}:null,140);
          const afterExit=await state();assert(afterExit.health===beforeExit.health&&afterExit.mana===beforeExit.mana&&afterExit.potions===beforeExit.potions,'Level transition reset party resources');
          assert(room===rooms-1?afterExit.phase==='won':afterExit.room===room+1,'Exit did not advance the campaign');
        }
        report.tests.push({name:'all level exits, battle backgrounds and persistent party resources',passed:true,rooms});
      }
      await click('Restart');await click('Start game');if(['rpg','campaign','roguelike'].includes(config.genre)){const p=(await state()).roomMap?.stars[0]||config.levels.stars[0];await drive(()=>({x:p.x*48+24,y:p.y*48+24}),80);}
      for(let i=0;i<100&&(await state()).phase==='playing';i++){await click('Guard / next party member');}
    }else if(config.genre==='stealth'){
      const before=await state();await advance(1800);const after=await state();collect(after);
      assert((after.enemyStates||[]).some((enemy,index)=>enemy.x!==before.enemyStates?.[index]?.x||enemy.y!==before.enemyStates?.[index]?.y),'Patrols did not move');
      await drive(s=>(s.enemyStates||[])[0],100);await advance(12000);collect(await state());
      assert([...observedModes].some(mode=>['investigate','chase','attack'].includes(mode)),'Guards did not react to the input replay');assert((await state()).health<initial.health,'Guard attacks did not damage the player');
      report.tests.push({name:'stealth patrol reaction and damage',passed:true,modes:[...observedModes]});
    }else if(rules.health){
      await advance(500);await drive(s=>(s.enemyStates||[])[0],100);await advance(14000);
    }else await advance(config.gameplay.timeLimit*1000+500);
    let lost=await state();
    if(lost.phase==='playing'&&rules.timer&&!rules.surviveTimer){await advance((lost.remaining+1)*1000);lost=await state();}
    assert(lost.phase==='lost','Input replay did not demonstrate the required failure state');report.tests.push({name:'reachable failure state',passed:true,reason:lost.failureReason||'Health/time loss'});
    assert(lost.vfx&&lost.vfx.active<=lost.vfx.limit&&lost.vfx.allocated<=lost.vfx.limit,'VFX exceeded its resource limit');report.tests.push({name:'bounded VFX resources',passed:true});
    await click('Pause / settings');await page.getByRole('checkbox',{name:'Reduced effects',exact:true}).check({force:true});await advance(40);const reduced=await state();assert(reduced.vfx.reduced&&reduced.vfx.active===0&&reduced.health===lost.health&&reduced.mana===lost.mana,'Reduced effects changed gameplay or left effects active');await click('Resume game');report.tests.push({name:'reduced effects leaves gameplay unchanged',passed:true});
    await page.keyboard.down('ArrowRight');await advance(1000);await page.keyboard.up('ArrowRight');const terminal=await state();assert(terminal.phase==='lost'&&terminal.health===lost.health&&terminal.x===lost.x&&terminal.y===lost.y,'Terminal gameplay did not freeze');report.tests.push({name:'terminal state freezes gameplay',passed:true});
    await click('Restart');const reset=await state();assert(reset.phase==='ready'&&reset.score===0&&reset.health===initial.health&&reset.remaining===config.gameplay.timeLimit,'Restart did not reset resources');assert(reset.vfx.allocated===0,'Restart retained old VFX resources');report.tests.push({name:'restart resets gameplay',passed:true});
    assert(!errors.length,'Browser JavaScript errors: '+errors.join('; '));report.tests.push({name:'no browser script errors',passed:true});report.passed=report.tests.every(item=>item.passed);
    if(reportFolder){await mkdir(reportFolder,{recursive:true});await page.screenshot({path:resolve(reportFolder,'browser-smoke.png'),fullPage:true});}
  }catch(error){report.error=timedOut?'Browser check time budget exhausted':String(error.message).slice(0,600);report.tests.push({name:'browser smoke execution',passed:false,error:report.error});if(reportFolder&&page&&!page.isClosed())try{await mkdir(reportFolder,{recursive:true});await page.screenshot({path:resolve(reportFolder,'browser-failure.png'),fullPage:true,timeout:3000});}catch{/* The error report remains available if the browser already closed. */}}
  finally{clearTimeout(deadline);signal?.removeEventListener('abort',abort);await browser?.close().catch(()=>{});if(server)await new Promise(resolve=>server.close(resolve));}
  return report;
}
