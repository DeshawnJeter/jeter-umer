import {gameplaySnapshot} from './whole-game-acceptance.js';
export async function checkHud(page,state,assert,requireInGameHud=true){
 const overlay=page.locator('#in-game-hud'),present=await overlay.count()>0;
 if(requireInGameHud)assert(present&&await overlay.isVisible(),'In-game HUD is missing');
 if(present){const box=await overlay.boundingBox(),canvas=await page.locator('canvas').first().boundingBox();assert(box&&canvas&&box.x>=canvas.x&&box.y>=canvas.y&&box.x+box.width<=canvas.x+canvas.width+1&&box.y+box.height<=canvas.y+canvas.height+1,'In-game HUD is outside the play area');}
 const inGame=async(stat,text)=>{if(!present&&!requireInGameHud)return;const badge=overlay.locator(`[data-stat="${stat}"] strong`);assert(await badge.count()===1&&await badge.innerText()===text,'In-game '+stat+' disagrees with gameplay');};
 for(const [field,max]of [['health','maxHealth'],['mana','maxMana']]){
  const meter=page.locator('#meter-'+field);if(!await meter.count())continue;
  const limit=state[max]??(field==='health'?3:1);
  assert(await page.locator('#value-'+field).innerText()===`${Math.max(0,state[field])} / ${limit}`,'HUD '+field+' text disagrees with gameplay');
  assert(Number(await meter.getAttribute('value'))===Math.max(0,state[field]),'HUD '+field+' meter disagrees with gameplay');
  await inGame(field,`${Math.max(0,state[field])} / ${limit}`);
 }
 if(await page.locator('#value-stars').count()){assert(await page.locator('#value-stars').innerText()===`${state.score} / ${state.required}`,'HUD collection count disagrees with gameplay');await inGame('stars',`${state.score} / ${state.required}`);}
 if(state.genre==='custom'){await inGame('progress',String(state.score));if(state.codeSnapshot?.remaining!==undefined)await inGame('time',`${Math.ceil(state.remaining)}s`);if(state.codeSnapshot?.maxMana>0)await inGame('mana',`${state.mana} / ${state.maxMana}`);}
 if(['collector','maze','platformer','survival','stealth'].includes(state.genre))await inGame('time',`${Math.ceil(state.remaining)}s`);
 if(['rpg','front_battle','campaign','roguelike'].includes(state.genre))await inGame('score',`${state.score} / ${state.required}`);
}
export async function checkBrowserControls({page,state,advance,click,assert,config,report,requireInGameHud=true}){
 const initial=await state();await checkHud(page,initial,assert,requireInGameHud);report.tests.push({name:'HUD matches live resources',passed:true});if(await page.locator('#in-game-hud').count())report.tests.push({name:'in-game HUD matches live resources',passed:true});
 assert(initial.audio?.started===true,'Start did not initialize audio after its gesture');
 if(config.audio.music)assert(initial.audio.music,'Requested music did not initialize its playback source');
 const original={volume:initial.audio.volume,musicVolume:initial.audio.musicVolume,sfxVolume:initial.audio.sfxVolume,muted:initial.audio.muted,musicMuted:initial.audio.musicMuted,sfxMuted:initial.audio.sfxMuted};
 await click('Pause / settings');const paused=gameplaySnapshot(await state());
 await page.keyboard.down('ArrowRight');await page.keyboard.press('KeyJ');await advance(1000);await page.keyboard.up('ArrowRight');
 assert((await state()).phase==='paused'&&JSON.stringify(gameplaySnapshot(await state()))===JSON.stringify(paused),'Pause changed gameplay resources, enemies or position');
 report.tests.push({name:'pause freezes gameplay',passed:true});
 const slider=async(id,value)=>{await page.locator('#'+id).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},value);await advance(100);};
 const toggle=async(id,value)=>{await page.locator('#'+id).setChecked(value,{force:true});await advance(100);};
 await slider('volume',0.12);await slider('sfxVolume',0.4);await toggle('muted',false);await toggle('sfxMuted',true);
 if(config.audio.music){await slider('musicVolume',0.5);await toggle('musicMuted',false);}
 const action=config.genre==='front_battle'?'attack':'right';
 await click('Change '+action+' control');await page.keyboard.press('KeyL');await advance(40);
 assert(await page.locator('#binding-error').innerText()==='Control updated.','Control remapping failed');
 assert((await page.getByRole('button',{name:'Change '+action+' control',exact:true}).innerText())==='L','Remapped control label is stale');
 await click('Reset controls');await click('Resume game');await advance(100);
 let audio=(await state()).audio;assert(audio.volume===0.12&&audio.sfxVolume===0.4&&audio.sfxGain===0,'SFX mute or master volume did not reach playback');
 if(config.audio.music)assert(audio.musicVolume===0.5&&audio.musicGain>0,'SFX mute incorrectly silenced music');
 await click('Pause / settings');await toggle('sfxMuted',false);if(config.audio.music)await toggle('musicMuted',true);await click('Resume game');await advance(100);
 audio=(await state()).audio;assert(Math.abs(audio.sfxGain-0.048)<0.0001,'SFX volume did not reach its playback gain');
 if(config.audio.music)assert(audio.musicGain===0,'Music mute did not silence its playback gain');
 await click('Pause / settings');const beforeRestore=gameplaySnapshot(await state());
 for(const key of ['volume','sfxVolume',...(config.audio.music?['musicVolume']:[])])await slider(key,original[key]);
 for(const key of ['muted','sfxMuted',...(config.audio.music?['musicMuted']:[])])await toggle(key,original[key]);
 assert(JSON.stringify(gameplaySnapshot(await state()))===JSON.stringify(beforeRestore),'Settings changed gameplay resources');
 await click('Resume game');
 report.tests.push({name:'settings and control remapping',passed:true},{name:'audio controls reach playback',passed:true});
}
