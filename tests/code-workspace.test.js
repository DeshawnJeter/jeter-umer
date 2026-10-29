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
