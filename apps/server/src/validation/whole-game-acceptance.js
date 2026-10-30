const common=['build boot','Start enters gameplay','HUD matches live resources','in-game HUD matches live resources','pause freezes gameplay','settings and control remapping','audio controls reach playback','restart resets gameplay','no browser script errors'];
const rpg=['rpg','front_battle','campaign','roguelike'];
export function requiresInGameHud(run){return !(run.restoredFrom?.legacyHud===true&&typeof run.restoredFrom.buildHash==='string'&&run.restoredFrom.buildHash.length>0&&run.generation===0&&run.build?.sha256===run.restoredFrom.buildHash);}
export function requiredBrowserChecks(genre='collector',{inGameHud=true}={}){
 const checks=common.filter(name=>inGameHud||name!=='in-game HUD matches live resources');
 if(genre==='custom')return [...checks,'custom HUD uses actual game score','custom preview restart and no script errors'];
 checks.push('reachable failure state','terminal state freezes gameplay','bounded VFX resources','reduced effects leaves gameplay unchanged');
 if(rpg.includes(genre))checks.push('spell resource and VFX event','potion inventory and healing','battle pause preserves resources');
 if(['collector','maze'].includes(genre)||rpg.includes(genre))checks.push('reachable victory state','victory freezes gameplay');
 if(['campaign','roguelike'].includes(genre))checks.push('all level exits, battle backgrounds and persistent party resources');
 if(genre==='stealth')checks.push('stealth patrol reaction and damage');
 if(['run_gun','jump_shooter','metroidvania'].includes(genre))checks.push('projectile trails and applicable weapon energy');
 if(genre==='platformer')checks.push('platform movement and jump');
 return checks;
}
// Derive coverage from executed checks, never from a worker's completion claim.
export function inspectWholeGame(report,buildHash,genre='collector',acceptanceCases=[],options={}){
 const findings=[],tests=Array.isArray(report?.tests)?report.tests:[];
 if(report?.passed!==true||report?.browserTested!==true||report?.buildHash!==buildHash)findings.push('Current build needs a passing executed browser report');
 const names=new Set();for(const test of tests){if(typeof test?.name!=='string'||names.has(test.name)||test.passed!==true)findings.push('Invalid, duplicate or failed browser check');names.add(test?.name);}
 for(const name of requiredBrowserChecks(genre,options))if(!names.has(name))findings.push('Missing whole-game check: '+name);
 if(genre==='custom'){
  for(const phase of ['won','lost'])if(!tests.some(t=>t.name?.startsWith('isolated rules: ')&&t.phase===phase&&t.passed===true))findings.push('Missing isolated custom '+phase+' replay');
  for(const c of acceptanceCases)if(!names.has('isolated rules: Independent: '+c.name))findings.push('Missing project acceptance replay: '+c.name);
 }
 const victory=tests.some(t=>t.name==='reachable victory state'&&t.passed===true);
 return {version:1,passed:findings.length===0,findings,automatedVictory:victory,fullPlaythrough:findings.length===0&&victory,manualChecks:[...(!victory?['Play the delivered game through to victory; automatic browser victory coverage is unavailable for this build.']:[]),...(genre==='custom'?['Verify custom win/loss outcomes and controls in the delivered preview; isolated rule replays do not exercise its UI.']:[]),'Confirm every requested mechanic, difficulty balance, visual quality and music by playing this exact build.']};
}

// Presentation effects/audio may advance while paused. Gameplay resources may not.
export function gameplaySnapshot(state){
 const keys=['health','maxHealth','mana','maxMana','score','required','remaining','x','y','potions','party','room','progress','abilities','alert','presentation','codeSnapshot','enemyStates'];
 return Object.fromEntries(keys.filter(key=>state[key]!==undefined).map(key=>[key,structuredClone(state[key])]));
}
