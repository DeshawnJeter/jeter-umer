import test from 'node:test';import assert from 'node:assert/strict';import {ensureMemory,recordTests,invalidateMemory} from '../apps/server/src/memory/project.js';
test('audio changes retain independent code evidence while UI changes invalidate it',()=>{
 const run={id:'run',generation:0};const m=ensureMemory(run);m.artifacts={planner:{hash:'p',dependencies:{}},audio:{hash:'a',dependencies:{planner:'p'}},ui:{hash:'u',dependencies:{planner:'p'}},coding:{hash:'c',dependencies:{ui:'u',planner:'p'}}};
 recordTests(run,'code-worker',{passed:true});recordTests(run,'browser-smoke',{passed:true});invalidateMemory(run,['audio']);assert.equal(m.tests[0].stale,false);assert.equal(m.tests[1].stale,true);assert.equal(m.artifacts.coding.stale,undefined);
 invalidateMemory(run,['ui']);assert.equal(m.tests[0].stale,true);assert.equal(m.artifacts.coding.stale,true);
});
