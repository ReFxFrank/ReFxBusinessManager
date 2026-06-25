/**
 * Storage interface — abstracts where media/document bytes live.
 *
 * The default implementation writes to the local filesystem under `/uploads`
 * and serves files via the `/api/files/[...key]` route. It exposes a
 * `publicUrl(key)` that returns an absolute, internet-reachable URL based on
 * PUBLIC_BASE_URL — this is REQUIRED for Instagram publishing, which fetches
 * media from a public `image_url`/`video_url`.
 *
 * To swap to S3-compatible object storage later, implement this same interface
 * (put/get/delete/publicUrl) against your bucket and export it from here.
 */

import { promises as fs } from "fs";
import path from "path";
import { config } from "./config";

export interface StoredFile {
  /** Relative key within the storage root, e.g. "media/abc/web.jpg". */
  key: string;
  size: number;
}

export interface Storage {
  put(key: string, data: Buffer): Promise<StoredFile>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Absolute path on disk (local impl only). */
  absolutePath(key: string): string;
  /** Public, internet-reachable URL for the file (used by IG publishing). */
  publicUrl(key: string): string;
  /** Same-origin relative URL for the file (used by the app UI). */
  localUrl(key: string): string;
}

const ROOT = path.join(process.cwd(), "uploads");

class LocalStorage implements Storage {
  absolutePath(key: string): string {
    // Prevent path traversal.
    const safe = key.replace(/\.\.+/g, "").replace(/^\/+/, "");
    return path.join(ROOT, safe);
  }

  async put(key: string, data: Buffer): Promise<StoredFile> {
    const abs = this.absolutePath(key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, data);
    return { key, size: data.length };
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.absolutePath(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.absolutePath(key));
    } catch {
      // ignore missing files
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.absolutePath(key));
      return true;
    } catch {
      return false;
    }
  }

  publicUrl(key: string): string {
    return `${config.publicBaseUrl}/api/files/${encodeURI(key)}`;
  }

  localUrl(key: string): string {
    return `/api/files/${encodeURI(key)}`;
  }
}

export const storage: Storage = new LocalStorage();
