import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Filesystem doc store. Swap for S3/R2 in prod by implementing the same interface.
export interface DocStore {
  load(id: string): Promise<Uint8Array | null>;
  save(id: string, data: Uint8Array): Promise<void>;
  remove(id: string): Promise<void>;
}

class FsDocStore implements DocStore {
  constructor(private dir: string) {}
  private p(id: string) { return path.join(this.dir, `${id}.ydoc`); }

  async load(id: string) {
    try {
      const buf = await fs.readFile(this.p(id));
      return new Uint8Array(buf);
    } catch (e: any) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }
  async save(id: string, data: Uint8Array) {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.p(id), data);
  }
  async remove(id: string) {
    try { await fs.unlink(this.p(id)); } catch (e: any) { if (e.code !== 'ENOENT') throw e; }
  }
}

export const docStore: DocStore = new FsDocStore(config.docStorageDir);
