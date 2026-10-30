import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// This exercises the delivered page and real audio graph, not a source-only replay.
export async function runTowerDefensePlaytest({url,reportFolder}){
  const origin=new URL(url).origin;
  if(new URL(url).hostname!=='127.0.0.1')throw Error('Use a local playtest preview');
  const report={scope:'tower-defense-player-playtest',passed:false,listeningTested:false,tests:[]};
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true,args:['--mute-audio'],env:Object.fromEntries(Object.entries(process.env).filter(([key,value])=>typeof value==='string'&&!/^(OPENAI_|AWS_|GH_|GITHUB_|CODEX_)/.test(key)))});
  let page;const errors=[],securityErrors=[];
  const assert=(condition,message)=>{if(!condition)throw Error(message);};
  try{
    const context=await browser.newContext({viewport:{width:1100,height:1000},serviceWorkers:'block'});
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    page=await context.newPage();page.setDefaultTimeout(7000);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(/violates.*Content Security Policy/.test(message.text()))securityErrors.push(message.text());});
    await page.addInitScript(()=>{
      window.__outputTaps=[];const connect=AudioNode.prototype.connect;
      AudioNode.prototype.connect=function(...args){
        const result=Reflect.apply(connect,this,args);
        if(args[0]===this.context.destination){const tap=this.context.createAnalyser();tap.fftSize=2048;Reflect.apply(connect,this,[tap]);window.__outputTaps.push(tap);}
        return result;
      };
    });
    await page.goto(url);await page.waitForFunction(()=>window.gameState?.().ready);
    const state=()=>page.evaluate(()=>window.gameState());
    const resources=s=>{
      const label=s.codeSnapshot.nodes.find(node=>node.label.includes('Coins:'))?.label||'';
      return {health:s.health,score:s.score,coins:Number(label.match(/Coins:\s*(\d+)/)?.[1]),towers:s.codeSnapshot.nodes.filter(node=>node.label==='Tower').length,invaders:s.codeSnapshot.nodes.filter(node=>node.label==='Invader').length};
    };
    const wait=async(predicate,message,timeout=7000)=>{
      const end=Date.now()+timeout;let s;
      do{s=await state();if(predicate(s))return s;await new Promise(yes=>setTimeout(yes,35));}while(Date.now()<end);
      throw Error(message+'; last state '+JSON.stringify({phase:s.phase,...resources(s),audio:s.audio}));
    };
    const click=name=>page.getByRole('button',{name,exact:true}).click();
    const rms=()=>page.evaluate(()=>Math.max(0,...window.__outputTaps.map(tap=>{const samples=new Float32Array(tap.fftSize);tap.getFloatTimeDomainData(samples);return Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/samples.length);})));
    const waitRms=async(audible)=>{
      const end=Date.now()+6000;let maximum=0,value;
      do{value=await rms();maximum=Math.max(maximum,value);if(audible?value>0.00001:value<0.000001)return maximum;await new Promise(yes=>setTimeout(yes,35));}while(Date.now()<end);
      throw Error('Audio output did not become '+(audible?'nonzero':'silent')+'; RMS '+value);
    };
    const slider=async(id,steps)=>{const control=page.locator('#'+id);await control.press('Home');for(let i=0;i<steps;i++)await control.press('ArrowRight');};
    const restart=async(menu=false)=>{await click(menu?'Restart game':'Restart');const s=await wait(s=>s.ready&&s.phase==='ready'&&s.codeSnapshot?.phase==='ready','Restart did not return ready');const r=resources(s);assert(r.health===3&&r.coins===6&&r.score===0&&r.towers===0&&r.invaders===0,'Restart retained resources/entities');assert(!s.audio.playing,'Restart left music playing');return s;};
    const initial=await state();assert(await page.evaluate(()=>window.__outputTaps.length)===0,'Audio graph was created before Start');assert(initial.phase==='ready'&&resources(initial).coins===6&&!initial.audio.started,'Initial resources or audio gesture gate incorrect');
    await click('Start game');await wait(s=>s.audio.scheduledNotes>0,'Music scheduler produced no notes');
    const musicRms=await waitRms(true);assert((await state()).audio.clockSource==='timeout','Music must use a scheduler allowed by the preview policy');
    report.tests.push({name:'music schedules notes and produces real nonzero output after Start',passed:true,rms:musicRms});
    await click('Pause / settings');const paused=JSON.stringify((await state()).codeSnapshot);await page.waitForTimeout(800);
    assert(JSON.stringify((await state()).codeSnapshot)===paused,'Pause changed rules/resources');await waitRms(false);
    await slider('volume',12);await slider('musicVolume',7);await slider('sfxVolume',13);
    await page.locator('#musicMuted').check();await page.getByRole('button',{name:'Change attack control',exact:true}).click();await page.keyboard.press('KeyK');
    assert((await page.locator('#binding-error').innerText()).includes('already assigned'),'Duplicate key mapping was accepted');
    await page.keyboard.press('KeyL');assert((await page.getByRole('button',{name:'Change attack control',exact:true}).innerText())==='L','Attack remap failed');
    await click('Resume game');await page.waitForTimeout(300);let s=await state();
    assert(s.audio.musicGain===0&&s.audio.sfxGain>0,'Music mute affected SFX routing');await waitRms(false);
    report.tests.push({name:'pause freezes rules; remapping, duplicate-key guard and independent audio settings work',passed:true});
    await restart();await click('Start game');
    await page.keyboard.down('KeyJ');await page.waitForTimeout(150);await page.keyboard.up('KeyJ');assert(resources(await state()).towers===0,'Old attack binding still builds');
    for(let count=1;count<=3;count++){
      await page.keyboard.down('KeyL');await page.waitForTimeout(180);await page.keyboard.up('KeyL');
      s=await wait(s=>resources(s).towers===count,'One press must build exactly one tower');
      let r=resources(s);assert(r.coins===6-2*count+r.score,'Build price or kill reward was incorrect');await page.waitForTimeout(120);
    }
    await page.keyboard.press('KeyL');await page.waitForTimeout(150);assert(resources(await state()).towers===3,'Built beyond the three allowed sites');
    await wait(s=>s.audio.scheduledEffects>0,'Tower kills produced no SFX');const sfxRms=await waitRms(true);
    report.tests.push({name:'one tower per press, three-site cap, 2-coin cost, 1-coin rewards and nonzero SFX output while music is muted',passed:true,sfxRms});
    await click('Pause / settings');await page.locator('#musicMuted').uncheck();await page.locator('#sfxMuted').check();await click('Resume game');
    await wait(s=>s.audio.sfxGain===0&&s.audio.musicGain>0,'SFX mute affected music');await waitRms(true);
    await page.getByRole('button',{name:'Mute all',exact:true}).click();await page.waitForTimeout(250);await waitRms(false);await page.getByRole('button',{name:'Unmute all',exact:true}).click();
    await waitRms(true);report.tests.push({name:'SFX mute and master mute preserve independent music control',passed:true});
    const won=await wait(s=>s.phase==='won','Building early did not win',15000),win=resources(won);
    assert(win.score===6&&win.coins===6&&win.health===3,'Victory resources incorrect');const frozenWin=JSON.stringify(won.codeSnapshot);await page.keyboard.press('KeyL');await page.waitForTimeout(300);assert(JSON.stringify((await state()).codeSnapshot)===frozenWin,'Win state did not freeze');
    report.tests.push({name:'all six invaders defeated, coins correct, health preserved and victory freezes',passed:true,...win});
    const ready=await restart();assert(ready.audio.ownedNodes===won.audio.ownedNodes&&ready.audio.sequenceCount===won.audio.sequenceCount,'Restart allocated another music graph');assert(ready.audio.volume===0.12&&ready.audio.musicVolume===0.35&&ready.audio.sfxVolume===0.65,'Restart lost audio preferences');
    await click('Start game');const lossStart=Date.now();await wait(s=>resources(s).invaders===2,'First pair did not spawn');await wait(s=>resources(s).invaders===4,'Second pair did not spawn',5000);await wait(s=>resources(s).invaders===6,'Third pair did not spawn',5000);
    const damaged=await wait(s=>s.health===1,'Arriving invaders did not remove exactly one health each',15000);assert(resources(damaged).coins===6&&damaged.score===0,'Arrivals awarded kill coins');
    const lost=await wait(s=>s.phase==='lost','Undefended crystal did not lose',6000),loss=resources(lost),wallSeconds=(Date.now()-lossStart)/1000;
    assert(wallSeconds<=25&&loss.health===0&&loss.score===0&&loss.coins===6,'Loss timing or resources incorrect');const frozenLoss=JSON.stringify(lost.codeSnapshot);await page.keyboard.press('KeyL');await page.waitForTimeout(300);assert(JSON.stringify((await state()).codeSnapshot)===frozenLoss,'Loss state did not freeze');
    report.tests.push({name:'three timed pairs, one-health arrivals, no arrival rewards and reachable frozen loss within 25 wall seconds',passed:true,wallSeconds,...loss});
    await click('Pause / settings');await restart(true);await click('Start game');await wait(s=>s.audio.playing&&s.audio.scheduledNotes>lost.audio.scheduledNotes,'Music did not restart');await restart();
    assert(!errors.length,'Browser script errors: '+errors.join('; '));assert(!securityErrors.length,'Preview policy violations: '+securityErrors.join('; '));
    report.tests.push({name:'restart from menu and endings resets all resources, preserves controls/settings and restarts music without script or policy errors',passed:true});report.passed=true;
    if(reportFolder){await mkdir(reportFolder,{recursive:true});await page.screenshot({path:resolve(reportFolder,'tower-defense-playtest.png'),fullPage:true});}
  }catch(error){report.error=String(error.message).slice(0,2500);if(reportFolder&&page)try{await mkdir(reportFolder,{recursive:true});await page.screenshot({path:resolve(reportFolder,'tower-defense-failure.png'),fullPage:true});}catch{}}
  finally{await browser.close();if(reportFolder){await mkdir(reportFolder,{recursive:true});await writeFile(resolve(reportFolder,'tower-defense-playtest.json'),JSON.stringify(report,null,2));}}
  return report;
}
