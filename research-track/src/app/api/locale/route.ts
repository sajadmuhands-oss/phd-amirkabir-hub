import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const locale = body.locale === "en" ? "en" : "ar";
  const response = NextResponse.json({ ok: true, locale });
  response.cookies.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
