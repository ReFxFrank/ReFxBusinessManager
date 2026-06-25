import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await destroySession();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url, { status: 303 });
}
