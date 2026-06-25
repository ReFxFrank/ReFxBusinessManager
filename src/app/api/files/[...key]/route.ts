import { type NextRequest } from "next/server";
import { storage } from "@/lib/storage";
import { mimeFromPath } from "@/lib/mime";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const fileKey = key.map(decodeURIComponent).join("/");

  if (!(await storage.exists(fileKey))) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const data = await storage.get(fileKey);
    const contentType = mimeFromPath(fileKey);
    return new Response(data as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(data.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Error reading file", { status: 500 });
  }
}
