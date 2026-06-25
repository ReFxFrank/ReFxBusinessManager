/**
 * Media processing.
 *
 *  * Images: `sharp` produces a web-optimized variant (max 1600px, mozjpeg) and
 *    a square-ish thumbnail (400px). Width/height captured for the gallery.
 *  * Videos: stored as-is. A poster frame + duration are extracted with
 *    `ffmpeg`/`ffprobe` IF they are installed (system dependency — see README).
 *    If ffmpeg is missing we degrade gracefully: the video still uploads, just
 *    without a generated poster (a placeholder is shown in the UI).
 */

import sharp from "sharp";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { storage } from "./storage";
import { config } from "./config";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export interface ProcessedMedia {
  type: "image" | "video";
  filePath: string;
  webPath: string | null;
  thumbnailPath: string | null;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  duration: number | null;
}

function keyFor(id: string, name: string) {
  return `media/${id}/${name}`;
}

export async function processImage(
  id: string,
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<ProcessedMedia> {
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const original = sharp(buffer, { failOn: "none" });
  const meta = await original.metadata();

  // Web-optimized variant
  const webBuffer = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  // Thumbnail
  const thumbBuffer = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: 400, height: 400, fit: "cover" })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();

  const origKey = keyFor(id, `original.${ext}`);
  const webKey = keyFor(id, "web.jpg");
  const thumbKey = keyFor(id, "thumb.jpg");

  await storage.put(origKey, buffer);
  await storage.put(webKey, webBuffer);
  await storage.put(thumbKey, thumbBuffer);

  return {
    type: "image",
    filePath: origKey,
    webPath: webKey,
    thumbnailPath: thumbKey,
    mimeType,
    fileSize: buffer.length,
    width: meta.width ?? null,
    height: meta.height ?? null,
    duration: null,
  };
}

/** Returns true if ffmpeg + ffprobe are available on the host. */
export async function hasFfmpeg(): Promise<boolean> {
  return (await which("ffmpeg")) && (await which("ffprobe"));
}

export async function processVideo(
  id: string,
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<ProcessedMedia> {
  const ext = path.extname(originalName).replace(".", "") || "mp4";
  const fileKey = keyFor(id, `original.${ext}`);
  await storage.put(fileKey, buffer);

  let thumbnailPath: string | null = null;
  let duration: number | null = null;
  let width: number | null = null;
  let height: number | null = null;

  if (await hasFfmpeg()) {
    const tmp = path.join(os.tmpdir(), `refx-${id}.${ext}`);
    const posterTmp = path.join(os.tmpdir(), `refx-${id}-poster.jpg`);
    try {
      await fs.writeFile(tmp, buffer);
      const probe = await ffprobe(tmp);
      duration = probe.duration;
      width = probe.width;
      height = probe.height;

      // grab a poster frame ~1s in
      await runCmd("ffmpeg", [
        "-y",
        "-ss",
        "1",
        "-i",
        tmp,
        "-frames:v",
        "1",
        "-vf",
        "scale=400:-1",
        posterTmp,
      ]);
      const posterBuf = await fs.readFile(posterTmp);
      const thumbKey = keyFor(id, "poster.jpg");
      await storage.put(thumbKey, posterBuf);
      thumbnailPath = thumbKey;
    } catch {
      // ignore — degrade to no poster
    } finally {
      await fs.unlink(tmp).catch(() => {});
      await fs.unlink(posterTmp).catch(() => {});
    }
  }

  return {
    type: "video",
    filePath: fileKey,
    webPath: null,
    thumbnailPath,
    mimeType,
    fileSize: buffer.length,
    width,
    height,
    duration,
  };
}

export async function processUpload(
  id: string,
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<ProcessedMedia> {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    if (buffer.length > config.media.maxImageBytes) {
      throw new Error(
        `Image exceeds the ${Math.round(config.media.maxImageBytes / 1024 / 1024)}MB limit.`,
      );
    }
    return processImage(id, buffer, mimeType, originalName);
  }
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) {
    if (buffer.length > config.media.maxVideoBytes) {
      throw new Error(
        `Video exceeds the ${Math.round(config.media.maxVideoBytes / 1024 / 1024)}MB limit.`,
      );
    }
    return processVideo(id, buffer, mimeType, originalName);
  }
  throw new Error(`Unsupported file type: ${mimeType}`);
}

export async function deleteMediaFiles(paths: (string | null)[]) {
  for (const p of paths) {
    if (p) await storage.delete(p);
  }
}

// --- ffmpeg helpers --------------------------------------------------------

function which(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("which", [cmd]);
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

function runCmd(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 200)}`)),
    );
    proc.on("error", reject);
  });
}

async function ffprobe(file: string): Promise<{ duration: number | null; width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      file,
    ]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("close", () => {
      try {
        const json = JSON.parse(out);
        const v = (json.streams || []).find((s: { codec_type: string }) => s.codec_type === "video");
        resolve({
          duration: json.format?.duration ? Number(json.format.duration) : null,
          width: v?.width ?? null,
          height: v?.height ?? null,
        });
      } catch {
        resolve({ duration: null, width: null, height: null });
      }
    });
    proc.on("error", () => resolve({ duration: null, width: null, height: null }));
  });
}
