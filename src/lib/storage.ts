/**
 * S3-compatible object storage (Neon storage / AWS S3).
 * Configured via env: AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID,
 * AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET.
 * When unconfigured, callers should fall back to local disk.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_ENDPOINT_URL_S3 &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
}

export function s3Bucket(): string {
  return process.env.S3_BUCKET || "assets";
}

let _client: S3Client | null = null;

export function s3Client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: process.env.AWS_REGION || "us-east-2",
      endpoint: process.env.AWS_ENDPOINT_URL_S3,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      },
      forcePathStyle: true,
    });
  }
  return _client;
}

/** Upload a buffer and return the object key. */
export async function s3Upload(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3Client().send(
    new PutObjectCommand({
      Bucket: s3Bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

/** Short-lived view URL for a private object. */
export async function s3SignedViewUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  return getSignedUrl(
    s3Client(),
    new GetObjectCommand({ Bucket: s3Bucket(), Key: key }),
    { expiresIn }
  );
}

/** Public-style URL for an object (works if bucket/key is public). */
export function s3PublicUrl(key: string): string {
  const base = (process.env.AWS_ENDPOINT_URL_S3 ?? "").replace(/\/$/, "");
  return `${base}/${s3Bucket()}/${key}`;
}
/**
 * Extract the S3 object key from a stored URL.
 * Handles /api/img/<key> proxy URLs and full S3 URLs.
 * Returns null for local (/uploads/…) URLs.
 * Env-free so it works in client components too.
 */
export function s3KeyFromUrl(url: string): string | null {
  if (url.startsWith("/api/img/")) {
    return url.slice("/api/img/".length) || null;
  }
  if (url.startsWith("http")) {
    const m = /\/assets\/(.+)$/.exec(url);
    if (m) return m[1];
  }
  return null;
}

/** Delete an object (best-effort, never throws). */
export async function s3Delete(key: string): Promise<boolean> {
  try {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await s3Client().send(
      new DeleteObjectCommand({ Bucket: s3Bucket(), Key: key })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Display URL for a stored image URL.
 * S3 (private bucket) URLs become same-origin /api/img/<key> proxy URLs
 * so next/image + browsers can render them. Local URLs pass through.
 * Env-free so it works in client components too.
 */
export function displayUrl(storedUrl: string): string {
  if (storedUrl.startsWith("/api/img/")) return storedUrl;
  const key = s3KeyFromUrl(storedUrl);
  if (key) return `/api/img/${key}`;
  return storedUrl;
}
