import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ART_THEMES, ART_MANIFEST, themeOf } from '../shared/art-catalog.js';
import { defaults, clone, validateArtifact, validateBrief } from '../shared/contracts/index.js';
import { work } from '../agents/ui/agent.js';
import { check } from '../agents/ui/checker.js';
import { buildGame, hashBuild } from '../apps/server/src/integration/build.js';
test('theme identifiers cannot select files, URLs or prototype members', () => {
  for (const theme of ['constructor', '__proto__', '../.env', 'https://example.invalid/asset']) {
    assert.throws(() => themeOf(theme)); assert.throws(() => validateBrief({ prompt: 'Explore', theme }));
    assert.ok(validateArtifact('ui', { ...defaults.ui, theme }).length);
  }
});
test('every theme gives a checked high-contrast palette and preserves human choice', async () => {
  for (const theme of Object.keys(ART_THEMES)) {
    const request = { brief: { theme }, context: { plan: { title: 'Themed game' } } };
    const { artifact } = await work(request); assert.deepEqual(validateArtifact('ui', artifact), []);
    assert.equal((await check({ ...request, artifact })).verdict, 'pass');
    const wrong = { ...artifact, theme: theme === 'space' ? 'forest' : 'space' };
    assert.equal((await check({ ...request, artifact: wrong })).verdict, 'fail');
  }
});
test('downloadable builds include licensed local artwork and detect catalog tampering', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'art-export-')); const config = clone(defaults); config.ui.theme = 'forest';
  await buildGame(folder, config);
  const manifest = JSON.parse(await readFile(join(folder, 'assets-manifest.json'), 'utf8'));
  assert.equal(manifest.theme, 'forest'); assert.equal(manifest.externalAssets, false); assert.deepEqual(manifest.assets, ART_MANIFEST.assets);
  assert.match(await readFile(join(folder, 'ASSETS-LICENSE.txt'), 'utf8'), /MIT License/);
  assert.match(await readFile(join(folder, 'art.js'), 'utf8'), /createArt/);
  const hash = await hashBuild(folder); await writeFile(join(folder, 'art-catalog.js'), 'changed'); assert.notEqual(await hashBuild(folder), hash);
});
