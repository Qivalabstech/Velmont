import "server-only";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { newId } from "@/db/schema";
import { UPLOAD_DIR } from "./env";

const MAX_BYTES = 10 * 1024 * 1024;
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/** Saves an uploaded product photo as an optimised WebP and returns its public URL. */
export async function saveImage(file: File): Promise<string> {
  if (!OK_TYPES.includes(file.type)) throw new Error(`${file.name}: use a JPG, PNG, WebP or AVIF image.`);
  if (file.size > MAX_BYTES) throw new Error(`${file.name}: keep images under 10 MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const out = await sharp(buf).rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 }).toBuffer();
  const name = `${newId()}.webp`;
  const dir = path.resolve(UPLOAD_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), out);
  return `/media/${name}`;
}

export async function deleteImage(url: string) {
  if (!url.startsWith("/media/")) return; // bundled images in /public are never deleted
  const name = path.basename(url);
  try { await unlink(path.join(path.resolve(UPLOAD_DIR), name)); } catch {}
}
