// Serves product photos uploaded from the admin panel.
import { readFile, stat } from "fs/promises";
import path from "path";
import { UPLOAD_DIR } from "@/lib/env";

export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const name = parts.join("/");
  if (!/^[\w-]+\.(webp|jpg|jpeg|png|avif)$/.test(name)) return new Response("Not found", { status: 404 });
  const file = path.join(path.resolve(UPLOAD_DIR), name);
  try {
    await stat(file);
    const buf = await readFile(file);
    const type = name.endsWith(".webp") ? "image/webp" : name.endsWith(".png") ? "image/png" : name.endsWith(".avif") ? "image/avif" : "image/jpeg";
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
