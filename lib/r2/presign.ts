/**
 * Minimal S3 Signature V4 presigned URL generator — no external dependencies.
 * Works for Cloudflare R2 (S3-compatible) and any AWS S3 bucket.
 */

import { createHmac, createHash } from "crypto";

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function signingKey(secret: string, date: string, region: string, service: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), service), "aws4_request");
}

/** Encode URI component, but NOT "/" for object keys. */
function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

interface PresignOptions {
  /** e.g. https://{ACCOUNT_ID}.r2.cloudflarestorage.com */
  endpoint: string;
  bucket: string;
  key: string;
  method: "PUT" | "GET";
  contentType?: string; // required for PUT, ignored for GET
  accessKeyId: string;
  secretAccessKey: string;
  /** Defaults to "auto" — correct for R2 */
  region?: string;
  /** Seconds until the URL expires. Default 3600. */
  expiresIn?: number;
}

export function presignS3Url({
  endpoint,
  bucket,
  key,
  method,
  contentType = "application/octet-stream",
  accessKeyId,
  secretAccessKey,
  region = "auto",
  expiresIn = 3600,
}: PresignOptions): string {
  const now = new Date();
  // e.g. 20260529T142300Z
  const amzDate = now.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const dateShort = amzDate.slice(0, 8);

  const host = new URL(endpoint).hostname;
  const credentialScope = `${dateShort}/${region}/s3/aws4_request`;
  const credential = `${accessKeyId}/${credentialScope}`;

  // The signed headers depend on the method
  const signedHeadersList = method === "PUT" ? ["content-type", "host"] : ["host"];
  const signedHeadersStr = signedHeadersList.join(";");

  // Build canonical query string (must be sorted lexicographically)
  const queryEntries: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", credential],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresIn)],
    ["X-Amz-SignedHeaders", signedHeadersStr],
  ];
  queryEntries.sort(([a], [b]) => a < b ? -1 : 1);
  const canonicalQueryString = queryEntries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  // Canonical headers (must end with \n, values trimmed, sorted)
  const canonicalHeaders = method === "PUT"
    ? `content-type:${contentType}\nhost:${host}\n`
    : `host:${host}\n`;

  // Canonical request
  const canonicalRequest = [
    method,
    `/${encodeKey(key)}`,           // canonical URI — no bucket in path for virtual-hosted style
    canonicalQueryString,
    canonicalHeaders,
    signedHeadersStr,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256hex(canonicalRequest),
  ].join("\n");

  const signature = hmac(signingKey(secretAccessKey, dateShort, region, "s3"), stringToSign)
    .toString("hex");

  // R2 endpoint: bucket is part of the URL path, not the hostname
  const url = `${endpoint}/${bucket}/${encodeKey(key)}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  return url;
}
