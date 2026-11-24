import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME, verifyPasscode } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { passcode?: string };
    const passcode = typeof body.passcode === "string" ? body.passcode : "";

    if (!passcode.trim()) {
      return NextResponse.json({ error: "กรุณากรอกรหัสผ่าน" }, { status: 400 });
    }

    const ok = await verifyPasscode(passcode);
    if (!ok) {
      return NextResponse.json(
        { error: "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง" },
        { status: 401 }
      );
    }

    const token = await createSessionToken();
    const response = NextResponse.json({ ok: true });
    // Session cookie (no maxAge/expires) so closing the browser requires passcode again next time
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "ไม่สามารถตรวจสอบรหัสผ่านได้" }, { status: 500 });
  }
}
