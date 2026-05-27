import { NextRequest, NextResponse } from "next/server";

/** POST /api/onboarding-view/unlock
 *  Body: { password: string }
 *  Returns 200 + { token } on success, 401 on wrong password.
 *  The token is just the password itself — the data endpoint validates it the
 *  same way. No JWT needed for this internal read-only surface.
 */
export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  const expected = process.env.ONBOARDING_VIEW_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { error: "ONBOARDING_VIEW_PASSWORD env var is not set." },
      { status: 500 },
    );
  }

  if (!password || password !== expected) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
