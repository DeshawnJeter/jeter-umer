import { mkdir, cp, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
export async function buildGame(folder, config) {
  await mkdir(folder, { recursive: true });
  await cp(resolve('templates/browser-game'), folder, { recursive: true });
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
  for (const file of ['index.html', 'game.js', 'audio.js', 'config.json', 'vendor/phaser.min.js', 'vendor/Tone.js', 'vendor/Phaser-LICENSE.md', 'vendor/Tone-LICENSE.md']) { hash.update(file); hash.update(await readFile(resolve(folder, file))); }
  return hash.digest('hex');
}
