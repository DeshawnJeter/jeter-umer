import test from 'node:test';import assert from 'node:assert/strict';import {DEFAULT_SOURCE,DEFAULT_SCENARIOS} from '../shared/code-game.js';import {runCodeChecks} from '../apps/server/src/validation/code-checks.js';import {validateAcceptanceCases} from '../shared/acceptance-cases.js';
test('independent expectations reject a self-passing game whose required score behavior is missing',async()=>{
 const cases=[{name:'one attack must award two points',steps:[{dt:0.1,actions:['attack'],repeat:1}],assertions:[{field:'score',op:'eq',value:2}]}];
 const report=await runCodeChecks({source:DEFAULT_SOURCE,scenarios:DEFAULT_SCENARIOS},undefined,{acceptanceCases:cases});assert.equal(report.passed,false);assert.ok(report.tests.some(t=>t.name.startsWith('Independent:')&&!t.passed));assert.ok(report.tests.some(t=>t.phase==='won'&&t.passed));
 assert.throws(()=>validateAcceptanceCases([{...cases[0],steps:[{dt:0.1,actions:['fetch'],repeat:1}]}]),/input/);
});
test('visible-label checks observe actual render nodes rather than source text or agent claims',async()=>{
 const cases=[{name:'existing player label',steps:[{dt:0,actions:[],repeat:1}],assertions:[{field:'label',op:'eq',value:'Player'}]},{name:'missing label',steps:[{dt:0,actions:[],repeat:1}],assertions:[{field:'label',op:'eq',value:'Not visible'}]}];
 const report=await runCodeChecks({source:DEFAULT_SOURCE,scenarios:DEFAULT_SCENARIOS},undefined,{acceptanceCases:cases});assert.equal(report.passed,false);assert.equal(report.tests.find(t=>t.name==='Independent: existing player label').passed,true);assert.equal(report.tests.find(t=>t.name==='Independent: missing label').passed,false);
 assert.throws(()=>validateAcceptanceCases([{...cases[0],assertions:[{field:'label',op:'gte',value:'Player'}]}]),/assertion/);
});
