import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runCodeChecks} from '../apps/server/src/validation/code-checks.js';

test('corrected tower-defense fixture starts, wins after three taps, loses, freezes and restarts',async()=>{
  const config=JSON.parse(await readFile('examples/custom/moonwood-crystal-guard.json','utf8'));
  const source=await readFile('examples/custom/moonwood-crystal-guard.js','utf8');
  const report=await runCodeChecks({source,scenarios:config.coding.scenarios});
  assert.equal(report.passed,true,report.error);
  assert.deepEqual(report.tests.filter(test=>test.phase).map(test=>test.phase),['won','lost']);
});
