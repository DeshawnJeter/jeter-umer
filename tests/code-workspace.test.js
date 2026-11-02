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
