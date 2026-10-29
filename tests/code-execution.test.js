import test from 'node:test';import assert from 'node:assert/strict';
import {runCodeChecks} from '../apps/server/src/validation/code-checks.js';
import {DEFAULT_SOURCE,DEFAULT_SCENARIOS} from '../shared/code-game.js';
import {readFile} from 'node:fs/promises';
// Browser-worker tests intentionally execute generated rules in Chromium,
// never with eval, imports or a VM inside this Node test process.
test('browser-worker checks observe win/loss, terminal freeze and fresh restart',async()=>{
  const report=await runCodeChecks({source:DEFAULT_SOURCE,scenarios:DEFAULT_SCENARIOS});assert.equal(report.passed,true,report.error);assert.equal(report.browserTested,true);assert.deepEqual(report.tests.filter(t=>t.phase).map(t=>t.phase),['won','lost']);
});
test('a hanging generated rule is terminated and cannot earn acceptance',async()=>{
  const source=DEFAULT_SOURCE.replace("if(phase!=='playing')return;time+=dt;","while(true){};time+=dt;");
  const report=await runCodeChecks({source,scenarios:DEFAULT_SCENARIOS});assert.equal(report.passed,false);assert.match(report.error,/deadline/);
});
test('invented win/loss claims fail actual independent execution',async()=>{
  const cases=JSON.parse(DEFAULT_SCENARIOS);cases[0].steps=[{dt:0.1,input:{}}];
  const report=await runCodeChecks({source:DEFAULT_SOURCE,scenarios:JSON.stringify(cases)});assert.equal(report.passed,false);assert.match(report.error,/Expected won/);
});
test('original tower-defense mechanics execute without registering another fixed game template',async()=>{
  const source=await readFile('examples/custom/tower-defense.js','utf8');
  const scenarios=JSON.stringify([{name:'build towers and defend',steps:[{dt:0.1,input:{attack:true},repeat:3},{dt:0.1,input:{},repeat:290}],expect:'won'},{name:'undefended crystal falls',steps:[{dt:0.1,input:{},repeat:290}],expect:'lost'}]);
  const report=await runCodeChecks({source,scenarios});assert.equal(report.passed,true,report.error);
});

test('start failures explain the exact no-input method contract for model repairs',async()=>{
 const source=DEFAULT_SOURCE.replace("start(){phase='playing';}","start(){phase='ready';}");
 const report=await runCodeChecks({source,scenarios:DEFAULT_SCENARIOS});assert.equal(report.passed,false);assert.match(report.error,/game.start\(\) is called without keyboard input/);assert.match(report.error,/observed ready/);
});

test('invalid replays cannot hide a broken no-input Start contract',async()=>{
 const source=DEFAULT_SOURCE.replace("start(){phase='playing';}","start(){phase='ready';}"),cases=JSON.parse(DEFAULT_SCENARIOS);
 cases[1].steps=[{dt:0.1,input:{},repeat:300},{dt:0.1,input:{}}];
 const report=await runCodeChecks({source,scenarios:JSON.stringify(cases)});
 assert.equal(report.passed,false);assert.ok(report.tests.some(test=>!test.passed&&/301 steps/.test(test.error)));assert.ok(report.tests.some(test=>!test.passed&&/observed ready/.test(test.error)));
});
test('a failing win replay does not hide the independently failing loss replay',async()=>{
 const cases=JSON.parse(DEFAULT_SCENARIOS);for(const c of cases)c.steps=[{dt:0.1,input:{}}];
 const report=await runCodeChecks({source:DEFAULT_SOURCE,scenarios:JSON.stringify(cases)});assert.equal(report.passed,false);assert.equal(report.tests.filter(test=>!test.passed).length,2);assert.match(report.error,/Expected won/);assert.match(report.error,/Expected lost/);
});

test('initial inspect exceptions report initialization guidance without reflecting thrown source text',async()=>{
 const source=DEFAULT_SOURCE.replace('nodes:[{x:player.x',"nodes:[{x:(()=>{throw Error('UNTRUSTED_ERROR_CANARY')})()");
 const report=await runCodeChecks({source,scenarios:DEFAULT_SCENARIOS});assert.equal(report.passed,false);assert.match(report.error,/Initialize all arrays/);assert.ok(!report.error.includes('UNTRUSTED_ERROR_CANARY'));
});
