/**
 * One-time setup: sets the correct CORS policy on the R2 bucket so that
 * browsers at spearai.live (and localhost) can PUT files directly.
 *
 * Call this once: POST /api/upload-audio/fix-r2-cors
 * Requires: R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_KEY env vars.
 */

import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function makeS3(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
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
    return NextResponse.json({ error: "R2 env vars not configured" }, { status: 500 });
  }

  const s3 = makeS3();

  // Set permissive CORS policy — presigned URLs are already auth'd via signature,
  // so opening CORS widely is safe and necessary for direct browser uploads.
  const corsConfig = {
    CORSRules: [
      {
        AllowedOrigins: ["*"],
        AllowedMethods: ["GET", "PUT", "HEAD"],
        AllowedHeaders: ["*"],
        ExposeHeaders: ["ETag", "Content-Type"],
        MaxAgeSeconds: 86400,
      },
    ],
  };

  try {
    await s3.send(new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: corsConfig,
    }));

    // Read back to confirm
    const result = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));

    return NextResponse.json({
      ok: true,
      message: "CORS policy set successfully",
      rules: result.CORSRules,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fix-r2-cors] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Also allow GET so we can check the current CORS policy
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bucket = process.env.R2_BUCKET;
  if (!process.env.R2_ENDPOINT || !bucket || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_KEY) {
    return NextResponse.json({ error: "R2 env vars not configured" }, { status: 500 });
  }

  const s3 = makeS3();

  try {
    const result = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
    return NextResponse.json({ rules: result.CORSRules });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
