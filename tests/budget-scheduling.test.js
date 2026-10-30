import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';import {mkdtemp} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {Manager} from '../apps/server/src/orchestrator/manager.js';import {Store} from '../apps/server/src/storage/store.js';import {createRuntime} from '../apps/server/src/providers/runtime.js';
import {emptyUsage,reserveUsage} from '../apps/server/src/providers/usage.js';
async function fixture(){const manager=new Manager(new Store(await mkdtemp(join(tmpdir(),'usage-scheduling-'))),{runtime:createRuntime({env:{}}),browserMode:'off'}),run={id:randomUUID(),status:'running',providerUsage:emptyUsage(),providerConfig:{maxCalls:3,maxTotalTokens:1000}};manager.controllers.set(run.id,new AbortController());return {manager,run};}
test('temporary parallel reservations wait for measured usage without cancelling paid requests',async()=>{
  const {manager,run}=await fixture();await manager.reserveCall(run,600);
  const waiting=manager.reserveCall(run,500);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(run.status,'running');assert.equal(run.providerUsage.calls,1);assert.equal(manager.usageWaiters.get(run.id).size,1);
  await manager.providerHooks(run,'ui').finish({inputTokens:100,outputTokens:50,totalTokens:150},600);await waiting;
  assert.equal(run.status,'running');assert.equal(run.providerUsage.calls,2);assert.equal(run.providerUsage.accountedTokens,150);assert.equal(run.providerUsage.reservedTokens,500);assert.equal(manager.usageWaiters.size,0);
});
test('cancelling a queued reservation consumes no extra call and releases its waiter',async()=>{
  const {manager,run}=await fixture();await manager.reserveCall(run,600);const waiting=manager.reserveCall(run,500);await new Promise(resolve=>setImmediate(resolve));
  run.status='paused';manager.controllers.get(run.id).abort();await assert.rejects(waiting,error=>error.suspended===true);
  assert.equal(run.providerUsage.calls,1);assert.equal(manager.usageWaiters.size,0);
});
test('a request that cannot fit even without pending reservations still hits the hard budget',()=>{
  const usage=emptyUsage();usage.accountedTokens=600;
  assert.throws(()=>reserveUsage(usage,{maxCalls:3,maxTotalTokens:1000},500),error=>error.budgetExhausted===true);
});
