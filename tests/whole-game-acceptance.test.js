import test from 'node:test';import assert from 'node:assert/strict';
import {inspectWholeGame,gameplaySnapshot} from '../apps/server/src/validation/whole-game-acceptance.js';
import {passingBrowserReport} from './fixtures/browser-report.js';
test('whole-game gate rejects empty, partial, duplicated, stale and non-browser passing claims',()=>{
 const good=passingBrowserReport('current');assert.equal(inspectWholeGame(good,'current').passed,true);
 for(const report of [{...good,tests:[]},{...good,browserTested:false},{...good,buildHash:'old'},{...good,tests:good.tests.slice(1)},{...good,tests:[...good.tests,good.tests[0]]},{...good,tests:good.tests.map((t,i)=>i? t:{...t,passed:'true'})}])assert.equal(inspectWholeGame(report,'current').passed,false);
 assert.equal(inspectWholeGame({...good,fullPlaythrough:true,tests:good.tests.filter(t=>t.name!=='reachable victory state')},'current').fullPlaythrough,false);
});
test('whole-game coverage explicitly leaves unsupported automatic victory to human playtesting',()=>{
 const report=passingBrowserReport('build','stealth'),coverage=inspectWholeGame(report,'build','stealth');assert.equal(coverage.passed,true);assert.equal(coverage.automatedVictory,false);assert.equal(coverage.fullPlaythrough,false);assert.match(coverage.manualChecks[0],/through to victory/);
 const complete=inspectWholeGame(passingBrowserReport('build','rpg'),'build','rpg');assert.equal(complete.fullPlaythrough,true);assert.ok(complete.manualChecks.length,'Human judgement remains required after an automated playthrough');
});
test('custom whole-game checks require both terminal replays and every independent project requirement',()=>{
 const report=passingBrowserReport('build','custom'),cases=[{name:'Coins pay for a tower'}];
 assert.equal(inspectWholeGame(report,'build','custom',cases).passed,false);
 report.tests.push({name:'isolated rules: win',passed:true,phase:'won'},{name:'isolated rules: loss',passed:true,phase:'lost'});assert.equal(inspectWholeGame(report,'build','custom',cases).passed,false);
 report.tests.push({name:'isolated rules: Independent: Coins pay for a tower',passed:true});const coverage=inspectWholeGame(report,'build','custom',cases);assert.equal(coverage.passed,true);assert.equal(coverage.fullPlaythrough,false,'Isolated rules are not a delivered UI playthrough');
});
test('freeze comparisons include resources and enemies while excluding presentation activity',()=>{
 const state={health:4,mana:3,potions:2,party:[{hp:4,mp:3}],enemyStates:[{x:10,mode:'chase'}],audio:{scheduledNotes:1},events:[]};const snapshot=gameplaySnapshot(state);state.audio.scheduledNotes++;state.events.push({type:'visual'});assert.deepEqual(gameplaySnapshot(state),snapshot);state.party[0].mp--;assert.notDeepEqual(gameplaySnapshot(state),snapshot);assert.equal(snapshot.party[0].mp,3);
});
