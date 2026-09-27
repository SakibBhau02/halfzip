import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, s3Bucket } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Private-bucket image proxy: /api/img/<key> streams the S3 object
 * with long cache. Lets next/image + browsers display private objects
 * without exposing credentials or making the bucket public.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { key: string[] } }
) {
  const key = (params.key ?? []).join("/");
  if (!key || key.includes("..")) {
    return NextResponse.json({ error: "Bad key" }, { status: 400 });
  }
  try {
    const out = await s3Client().send(
      new GetObjectCommand({ Bucket: s3Bucket(), Key: key })
    );
    const bytes = await out.Body!.transformToByteArray();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": out.ContentType ?? "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
