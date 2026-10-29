import { mkdir, writeFile, readFile, rename, readdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
export class Store {
  constructor(root = process.env.GAME_BUILDER_RUNS_DIR || '.local/runs', { renameFile = rename, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) { this.root = resolve(root); this.renameFile = renameFile; this.pause = pause; }
  folder(id) { if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid run ID'); return resolve(this.root, id); }
  async save(run) {
    const folder = this.folder(run.id); await mkdir(folder, { recursive: true });
    const temp = resolve(folder, `state-${randomUUID()}.tmp`);
    try {
      await writeFile(temp, JSON.stringify(run, null, 2));
      for (let attempt = 0; ; attempt++) {
        try { await this.renameFile(temp, resolve(folder, 'state.json')); break; }
        catch (error) {
          // Antivirus/indexing can briefly lock a destination on Windows. Retrying
          // only the atomic replacement never repeats a paid model request.
          if (!['EPERM','EACCES','EBUSY'].includes(error.code) || attempt >= 4) throw error;
          await this.pause(25 * 2 ** attempt);
        }
      }
    } finally { await unlink(temp).catch(() => {}); }
  }
  async load(id) { return JSON.parse(await readFile(resolve(this.folder(id), 'state.json'), 'utf8')); }
  async list() {
    await mkdir(this.root, { recursive: true }); const runs = [];
    for (const name of await readdir(this.root)) { try { runs.push(await this.load(name)); } catch { /* Ignore incomplete, unrelated directories. */ } }
    return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
