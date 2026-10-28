import { mkdir, writeFile, readFile, rename, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
export class Store {
  constructor(root = '.local/runs') { this.root = resolve(root); }
  folder(id) { if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid run ID'); return resolve(this.root, id); }
  async save(run) {
    const folder = this.folder(run.id); await mkdir(folder, { recursive: true });
    const temp = resolve(folder, 'state.tmp');
    await writeFile(temp, JSON.stringify(run, null, 2)); await rename(temp, resolve(folder, 'state.json'));
  }
  async load(id) { return JSON.parse(await readFile(resolve(this.folder(id), 'state.json'), 'utf8')); }
  async list() {
    await mkdir(this.root, { recursive: true }); const runs = [];
    for (const name of await readdir(this.root)) { try { runs.push(await this.load(name)); } catch { /* Ignore incomplete, unrelated directories. */ } }
    return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
