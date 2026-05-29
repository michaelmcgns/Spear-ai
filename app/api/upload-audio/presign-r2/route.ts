/**
 * Returns two presigned R2 URLs for a single upload:
 *  - putUrl:  browser PUTs the file directly to R2 (bypasses Vercel, no size limit)
 *  - getUrl:  passed to AssemblyAI so it can download the file for transcription
 *
 * Uses the official AWS SDK v3 (S3-compatible) to generate signatures — R2 is
 * fully S3-compatible with endpoint = https://{ACCOUNT_ID}.r2.cloudflarestorage.com
 *
 * Required Vercel env vars:
 *   R2_ENDPOINT        https://{ACCOUNT_ID}.r2.cloudflarestorage.com
 *   R2_BUCKET          bucket name, e.g. spear-audio
 *   R2_ACCESS_KEY_ID   R2 API token Access Key ID
 *   R2_SECRET_KEY      R2 API token Secret Access Key
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function makeS3(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    // R2 uses path-style URLs: https://ACCOUNT_ID.r2.cloudflarestorage.com/BUCKET/KEY
    // Virtual-hosted style (BUCKET.ACCOUNT_ID.r2...) has no TLS cert → "Failed to fetch"
    forcePathStyle: true,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_KEY     ?? "",
    },
  });
}

export async function POST(req: NextRequest) {
  // Auth gate
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bucket = process.env.R2_BUCKET;
  if (!process.env.R2_ENDPOINT || !bucket || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_KEY) {
    return NextResponse.json({ error: "R2 storage not configured" }, { status: 500 });
  }

  const { contentType, fileName } = await req.json() as {
    contentType?: string;
    fileName?: string;
  };

  const safeFileName = (fileName ?? "recording").replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectKey    = `uploads/${user.id}/${Date.now()}-${safeFileName}`;
  const mime         = contentType || "application/octet-stream";

  const s3 = makeS3();

  // Presigned PUT — browser uploads directly here (valid for 1 hour)
  const putUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: mime }),
    { expiresIn: 3600 }
  );

  // Presigned GET — AssemblyAI downloads from here (valid for 2 hours)
  const getUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
    { expiresIn: 7200 }
  );

  return NextResponse.json({ putUrl, getUrl, objectKey });
}
