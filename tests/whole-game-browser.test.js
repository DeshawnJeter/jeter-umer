import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {defaults,clone} from '../shared/contracts/index.js';
import {buildGame,hashBuild} from '../apps/server/src/integration/build.js';
import {runBrowserSmoke} from '../apps/server/src/validation/browser-smoke.js';
import {hudFor} from '../shared/player-ui.js';
import {modulesFor} from '../apps/server/src/specialists/jobs.js';
import {DEFAULT_SOURCE,DEFAULT_SCENARIOS} from '../shared/code-game.js';
async function fixture(change=async()=>{},options={}){
 const folder=await mkdtemp(join(tmpdir(),'whole-game-browser-')),config={...clone(defaults),genre:'collector'};
 try{await buildGame(folder,config);await change(folder);return await runBrowserSmoke({folder,config,buildHash:await hashBuild(folder),...options});}finally{await rm(folder,{recursive:true,force:true});}
}
test('delivered collector completes win/loss, music settings and restart while retaining human approval',async()=>{
 const report=await fixture();assert.equal(report.passed,true,report.error);assert.equal(report.fullPlaythrough,true);assert.equal(report.humanApproved,false);assert.equal(report.listeningTested,false);assert.ok(report.acceptance.manualChecks.length);
});
test('a delivered HUD with valid code but false collection values fails whole-game acceptance',async()=>{
 const report=await fixture(async folder=>{const file=join(folder,'interface.js'),source=await readFile(file,'utf8');const mutant=source.replace('`${this.state.score} / ${this.state.required}`',"'999 / 999'");assert.notEqual(mutant,source);await writeFile(file,mutant);});assert.equal(report.passed,false);assert.match(report.error,/HUD collection count/);
});
test('settings that update their labels without updating actual audio fail whole-game acceptance',async()=>{
 const report=await fixture(async folder=>{const file=join(folder,'interface.js'),source=await readFile(file,'utf8');const mutant=source.replace('Object.assign(this.audio, { volume, muted, musicVolume, sfxVolume, musicMuted, sfxMuted });','');assert.notEqual(mutant,source);await writeFile(file,mutant);});assert.equal(report.passed,false);assert.match(report.error,/SFX mute or master volume/);
});
test('custom browser acceptance executes saved independent requirements against delivered rules',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'whole-custom-browser-')),config={...clone(defaults),genre:'custom',coding:{source:DEFAULT_SOURCE,scenarios:DEFAULT_SCENARIOS}};config.ui.hud=hudFor('custom');config.implementation={runtime:'custom',version:1,modules:modulesFor('custom')};
 try{await buildGame(folder,config);const report=await runBrowserSmoke({folder,config,buildHash:await hashBuild(folder),acceptanceCases:[{name:'Independent score requirement',steps:[{dt:0.1,repeat:5,actions:['attack']}],assertions:[{field:'score',op:'eq',value:999}]}]});assert.equal(report.passed,false);assert.match(report.error,/score eq 999 failed/);assert.ok(report.tests.some(t=>t.name==='isolated rules: Independent: Independent score requirement'&&!t.passed));}finally{await rm(folder,{recursive:true,force:true});}
});
