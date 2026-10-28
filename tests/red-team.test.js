import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, validateCatalog, runSuite } from '../red-team/suite.js';

test('red-team catalog is valid and includes explicit model and human gaps', async () => {
  const catalog = await loadCatalog(); validateCatalog(catalog);
  assert.equal(catalog.length, 17); assert.equal(catalog.filter(c => c.automation === 'local').length, 11);
  assert.equal(catalog.filter(c => c.automation === 'model-required').length, 5);
  assert.equal(catalog.filter(c => c.automation === 'manual-required').length, 1);
  assert.throws(() => validateCatalog([...catalog, catalog[0]]), /duplicate/);
  assert.throws(() => validateCatalog([{ ...catalog[0], driver: 'constructor' }]), /Unknown local driver/);
});
test('suite never executes model or manual payloads as local probes', async () => {
  const catalog = await loadCatalog(); const cases = catalog.filter(c => c.automation !== 'local');
  const report = await runSuite(cases, { executors: {} });
  assert.equal(report.overall, 'incomplete'); assert.equal(report.summary.pass, 0); assert.equal(report.summary.not_tested, 6);
  assert.ok(report.results.every(result => result.evidence.length === 0));
});
test('suite reports observed failures instead of trusting success wording', async () => {
  const entry = (await loadCatalog())[0];
  const report = await runSuite([entry], { executors: { artifactFields: async () => ({ passed: false, observed: { claim: 'Everything passed', acceptedUnexpectedField: true }, evidence: ['Contract accepted the injected field'] }) } });
  assert.equal(report.overall, 'fail'); assert.equal(report.summary.fail, 1); assert.equal(report.results[0].status, 'fail');
});
test('probe execution errors cannot turn into a passing defense', async () => {
  const entry = (await loadCatalog())[0];
  const report = await runSuite([entry], { executors: { artifactFields: async () => { throw new Error('Synthetic fixture unavailable'); } } });
  assert.equal(report.overall, 'fail'); assert.match(report.results[0].observed.error, /Synthetic fixture/);
  assert.match(report.results[0].limits[0], /execution errors/);
});
