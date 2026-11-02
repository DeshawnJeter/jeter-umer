import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rename, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../apps/server/src/storage/store.js';
const root = () => mkdtemp(join(tmpdir(),'state-recovery-'));
test('transient state-file locks retry the atomic write without repeating application work', async () => {
  const dir=await root(),delays=[];let attempts=0;
  const store=new Store(dir,{renameFile:async(...args)=>{attempts++;if(attempts<3)throw Object.assign(new Error('Synthetic file lock'),{code:attempts===1?'EPERM':'EBUSY'});return rename(...args);},pause:async ms=>{delays.push(ms);}});
  const state={id:randomUUID(),status:'awaiting_review',providerUsage:{calls:12}};await store.save(state);
  assert.deepEqual(await store.load(state.id),state);assert.equal(attempts,3);assert.deepEqual(delays,[25,50]);assert.deepEqual(await readdir(store.folder(state.id)),['state.json']);
});
test('permanent state write failure preserves the previous snapshot and removes its temporary file', async () => {
  const dir=await root(),state={id:randomUUID(),status:'paused'};await new Store(dir).save(state);let attempts=0;
  const store=new Store(dir,{renameFile:async()=>{attempts++;throw Object.assign(new Error('Synthetic disk error'),{code:'EIO'});},pause:async()=>{throw new Error('Must not retry');}});
  await assert.rejects(store.save({...state,status:'running'}),/disk error/);assert.equal(attempts,1);assert.deepEqual(await store.load(state.id),state);assert.deepEqual(await readdir(store.folder(state.id)),['state.json']);
});
test('persistent file locks exhaust a bounded replacement budget', async () => {
  let attempts=0;const delays=[],store=new Store(await root(),{renameFile:async()=>{attempts++;throw Object.assign(new Error('Still locked'),{code:'EACCES'});},pause:async ms=>{delays.push(ms);}});
  await assert.rejects(store.save({id:randomUUID()}),/Still locked/);assert.equal(attempts,5);assert.deepEqual(delays,[25,50,100,200]);
});
