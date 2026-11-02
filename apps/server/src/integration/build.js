import { mkdir, cp, writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { ART_MANIFEST } from '../../../../shared/art-catalog.js';
import { composeScore } from '../../../../shared/music.js';
import {compileAssembly} from './assembly.js';
import {lifecycleFor,humanChecksFor} from '../../../../shared/lifecycle.js';
export async function buildGame(folder, config) {
  await mkdir(folder, { recursive: true });
  if(config.genre==='custom'){if(!config.coding)throw Error('Missing independently checked game code');const {checkCode}=await import('../runners/code-workspace.js');const report=checkCode(config.coding);if(report.verdict!=='pass')throw Error(report.findings.join('; '));await mkdir(resolve(folder,'generated'),{recursive:true});await writeFile(resolve(folder,'generated','rules.js'),config.coding.source);}
  await cp(resolve('templates/browser-game'), folder, { recursive: true });
  await writeFile(resolve(folder,'assembly.js'),compileAssembly(config));
  await writeFile(resolve(folder,'lifecycle.json'),JSON.stringify({...lifecycleFor(config.genre),requiredHumanChecks:humanChecksFor(config.genre)},null,2));
  await cp(resolve('shared/game-types.js'), resolve(folder, 'rules.js'));
  await cp(resolve('shared/art-catalog.js'), resolve(folder, 'art-catalog.js'));
  await cp(resolve('shared/music.js'), resolve(folder, 'score.js'));
  await cp(resolve('shared/player-ui.js'), resolve(folder, 'player-ui.js'));
  for(const file of ['code-game.js','campaign.js','advanced-games.js','extra-game-types.js','turn-combat.js','stealth-rules.js','lifecycle.js','enemy-behavior.js','game-events.js','vfx-policy.js'])await cp(resolve('shared',file),resolve(folder,file));
  await writeFile(resolve(folder, 'music-score.json'), JSON.stringify(config.audio.score || composeScore(), null, 2));
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
