import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {checkCode,codeWorkspace} from '../apps/server/src/runners/code-workspace.js';
import {DEFAULT_SOURCE,DEFAULT_SCENARIOS,inspectSnapshot} from '../shared/code-game.js';
test('code workspace accepts original JS, exposes components and confines writes to owned source',async()=>{
  const workspace=codeWorkspace(await mkdtemp(join(tmpdir(),'code-workspace-'))),artifact={source:DEFAULT_SOURCE,scenarios:DEFAULT_SCENARIOS};
  assert.equal((await workspace.apply(artifact)).verdict,'pass');assert.equal(await workspace.read(),DEFAULT_SOURCE);assert.ok((await workspace.search('update')).length);assert.match(workspace.catalog(),/createGame/);
  await assert.rejects(workspace.read('../../.env'));assert.equal(workspace.exec,undefined);
});
test('syntax and capability checks reject code before server execution and require win/loss evidence',()=>{
  for(const source of ['export function createGame( {','import x from "node:fs"; export function createGame(){}','export function createGame(){fetch("https://example.com")}','export function createGame(){return import("./private.js")}'])assert.equal(checkCode({source,scenarios:DEFAULT_SCENARIOS}).verdict,'fail');
  assert.equal(checkCode({source:DEFAULT_SOURCE,scenarios:'[]'}).verdict,'fail');
  assert.throws(()=>inspectSnapshot({phase:'won',health:Infinity}));
});

test('drafts survive syntax rejection and patch mismatches return recoverable feedback without mutation',async()=>{
 const w=codeWorkspace(await mkdtemp(join(tmpdir(),'draft-repair-'))),broken='export function createGame(api){';
 await w.stage(broken);assert.equal(await w.read(),broken);
 const mismatch=await w.patch({path:'generated/rules.js',find:'not present',replacement:'x'});
 assert.equal(mismatch.verdict,'fail');assert.equal(await w.read(),broken);assert.match(mismatch.findings[0],/read_source/);
 const partial=await w.patch({path:'generated/rules.js',find:broken,replacement:'export function createGame(api){\n'});
 assert.equal(partial.verdict,'fail');assert.equal(await w.read(),'export function createGame(api){\n');
 const repaired=await w.patch({path:'generated/rules.js',find:await w.read(),replacement:DEFAULT_SOURCE});
 assert.equal(repaired.verdict,'pass');assert.equal(await w.read(),DEFAULT_SOURCE);
 await assert.rejects(w.stage('x'.repeat(6001)));await assert.rejects(w.patch({path:'../../.env',find:'',replacement:'x'}));assert.equal(await w.read(),DEFAULT_SOURCE);
});

test('repair diagnostics name replay limits, action mappings and unavailable API methods',()=>{
 const cases=JSON.parse(DEFAULT_SCENARIOS);cases[1].steps=[{dt:0.1,input:{},repeat:300},{dt:0.1,input:{}}];
 assert.match(checkCode({source:DEFAULT_SOURCE,scenarios:JSON.stringify(cases)}).findings[0],/301 steps.*300 total/);
 cases[1].steps=[{dt:0.1,input:{j:true}}];assert.match(checkCode({source:DEFAULT_SOURCE,scenarios:JSON.stringify(cases)}).findings[0],/J maps to attack/);
 const source=DEFAULT_SOURCE.replace('time+=dt;','time+=dt;api.musicStart();');assert.match(checkCode({source,scenarios:DEFAULT_SCENARIOS}).findings[0],/Unavailable api method: musicStart/);
});

test('snapshot findings identify the exact initialization or render limit defect',()=>{
 const snapshot={phase:'ready',health:3,maxHealth:3,score:0,objective:'Test',nodes:[]};assert.throws(()=>inspectSnapshot({...snapshot,health:undefined}),/health before Start/);assert.throws(()=>inspectSnapshot({...snapshot,nodes:Array.from({length:65},()=>({}))}),/65 nodes.*64/);assert.throws(()=>inspectSnapshot({...snapshot,score:undefined}),/score before Start/);
});

test('oversized patches remove only parsed comments while preserving literal tokens and ASI',async()=>{
 const {compactComments}=await import('../apps/server/src/runners/code-workspace.js');const {tokenizer,parse}=await import('acorn');
 const source=`export function example(){return/*line\ncomment*/1;} const text='/* literal */'; const template=\`literal // text\`;`;
 const compacted=compactComments(source);const tokens=text=>Array.from(tokenizer(text,{ecmaVersion:'latest',sourceType:'module'}),token=>text.slice(token.start,token.end));assert.deepEqual(tokens(source),tokens(compacted));assert.equal(parse(compacted,{ecmaVersion:'latest',sourceType:'module'}).body[0].declaration.body.body[0].argument,null);
 const w=codeWorkspace(await mkdtemp(join(tmpdir(),'comment-fit-')));await w.stage(DEFAULT_SOURCE+'/*'+'x'.repeat(5000)+'*/');const report=await w.patch({path:'generated/rules.js',find:'score=0',replacement:'score=0/*'+'y'.repeat(1000)+'*/'});assert.equal(report.verdict,'pass');assert.ok((await w.read()).length<=6000);assert.ok(report.evidence.some(line=>line.includes('executable tokens')));
 const before=await w.read(),rejected=await w.patch({path:'generated/rules.js',find:'score=0',replacement:'score=0'+ ' '.repeat(7000)});assert.equal(rejected.verdict,'fail');assert.equal(await w.read(),before);
});
