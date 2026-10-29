import { mkdir, cp, writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { ART_MANIFEST } from '../../../../shared/art-catalog.js';
export async function buildGame(folder, config) {
  await mkdir(folder, { recursive: true });
  await cp(resolve('templates/browser-game'), folder, { recursive: true });
  await cp(resolve('shared/game-types.js'), resolve(folder, 'rules.js'));
  await cp(resolve('shared/art-catalog.js'), resolve(folder, 'art-catalog.js'));
  await writeFile(resolve(folder, 'assets-manifest.json'), JSON.stringify({ ...ART_MANIFEST, theme: config.ui.theme || 'space' }, null, 2));
  await mkdir(resolve(folder, 'vendor'), { recursive: true });
  await cp(resolve('node_modules/phaser/dist/phaser.min.js'), resolve(folder, 'vendor/phaser.min.js'));
  await cp(resolve('node_modules/tone/build/Tone.js'), resolve(folder, 'vendor/Tone.js'));
  await cp(resolve('node_modules/phaser/LICENSE.md'), resolve(folder, 'vendor/Phaser-LICENSE.md'));
  await cp(resolve('node_modules/tone/LICENSE.md'), resolve(folder, 'vendor/Tone-LICENSE.md'));
  await writeFile(resolve(folder, 'config.json'), JSON.stringify(config, null, 2));
  // Hash every delivered asset, not only configuration, so approval refers to exact bytes.
  return hashBuild(folder);
}
export async function hashBuild(folder) {
  const hash = createHash('sha256');
  async function walk(prefix = '') {
    const entries = await readdir(resolve(folder, prefix), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const file = prefix + entry.name;
      if (entry.isDirectory()) await walk(file + '/');
      else if (entry.isFile()) { const bytes = await readFile(resolve(folder, file)); hash.update(JSON.stringify([file, bytes.length])); hash.update(bytes); }
      else throw new Error('Build assets must be regular files; symbolic links are not allowed');
    }
  }
  await walk();
  return hash.digest('hex');
}
