/**
 * Returns two presigned R2 URLs for a single upload:
 *  - putUrl:  browser PUTs the file directly to R2 (bypasses Vercel, no size limit)
 *  - getUrl:  passed to AssemblyAI so it can download the file for transcription
 *
 * Required env vars:
 *   R2_ENDPOINT        https://{ACCOUNT_ID}.r2.cloudflarestorage.com
 *   R2_BUCKET          your bucket name, e.g. spear-audio
 *   R2_ACCESS_KEY_ID   R2 API token Access Key ID
 *   R2_SECRET_KEY      R2 API token Secret Access Key
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { presignS3Url } from "@/lib/r2/presign";

export async function POST(req: NextRequest) {
  // Auth gate — must be logged in to generate upload URLs
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const endpoint  = process.env.R2_ENDPOINT;
  const bucket    = process.env.R2_BUCKET;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_KEY;

  if (!endpoint || !bucket || !accessKey || !secretKey) {
    return NextResponse.json({ error: "R2 storage not configured" }, { status: 500 });
  }

  const { contentType, fileName } = await req.json() as {
    contentType?: string;
    fileName?: string;
  };

  const safeFileName = (fileName ?? "recording").replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectKey    = `uploads/${user.id}/${Date.now()}-${safeFileName}`;
  const mime         = contentType || "application/octet-stream";

  // presigned PUT — browser uploads directly here (valid for 1 hour)
  const putUrl = presignS3Url({
    endpoint, bucket, key: objectKey, method: "PUT",
    contentType: mime, accessKeyId: accessKey, secretAccessKey: secretKey,
    expiresIn: 3600,
  });

  // presigned GET — AssemblyAI downloads from here (valid for 2 hours)
  const getUrl = presignS3Url({
    endpoint, bucket, key: objectKey, method: "GET",
    accessKeyId: accessKey, secretAccessKey: secretKey,
    expiresIn: 7200,
  });

  return NextResponse.json({ putUrl, getUrl, objectKey });
}
