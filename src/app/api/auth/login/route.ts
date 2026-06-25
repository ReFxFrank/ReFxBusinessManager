import { NextResponse, type NextRequest } from "next/server";
import { checkPassword, createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const from = String(form.get("from") ?? "/");

  if (!checkPassword(password)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "1");
    if (from) url.searchParams.set("from", from);
    return NextResponse.redirect(url, { status: 303 });
  }

  await createSession();
  const url = req.nextUrl.clone();
  url.pathname = from.startsWith("/") ? from : "/";
  url.search = "";
  return NextResponse.redirect(url, { status: 303 });
}
