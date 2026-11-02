import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.local'].includes(e.name)) continue;
    const file = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...await walk(file));
    else if (file.endsWith('.js')) out.push(file);
  }
  return out;
}
for (const file of await walk('.')) { const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (result.status) { console.error(result.stderr); process.exit(1); } }
console.log('JavaScript syntax checks passed');
