import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check for deployments: reports DB reachability + required env
 * presence WITHOUT leaking values. Visit /api/health after deploy.
 */
export async function GET() {
  const checks: Record<string, string> = {};
  let ok = true;

  // required env (presence only)
  for (const k of ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"]) {
    if (process.env[k]) checks[k] = "set";
    else {
      checks[k] = "MISSING";
      ok = false;
    }
  }
  // optional integrations
  checks.S3 =
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ENDPOINT_URL_S3
      ? "set"
      : "not-configured";
  // note: Steadfast/Telegram/pixel tokens live in DB Settings, managed from Admin → Settings

  // database round-trip
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = (await prisma.$queryRawUnsafe(
      "SELECT count(*)::int AS n FROM \"Product\""
    )) as { n: number }[];
    checks.database = `connected (products: ${rows[0]?.n ?? 0})`;
  } catch (e) {
    ok = false;
    checks.database = `FAILED: ${e instanceof Error ? e.message.slice(0, 200) : "unknown"}`;
  }

  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
