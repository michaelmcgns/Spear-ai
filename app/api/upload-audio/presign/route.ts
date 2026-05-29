import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

// Returns a signed upload URL so the browser can upload directly to Supabase Storage
// This bypasses Vercel's 4.5 MB serverless body-size limit entirely.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { fileName, contentType } = await req.json() as { fileName: string; contentType: string };
    if (!fileName) return NextResponse.json({ error: "fileName required" }, { status: 400 });

    // Scope the upload path to the user's folder for RLS enforcement
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${Date.now()}-${safeName}`;

    const db = createServiceClient();
    const { data, error } = await db.storage
      .from("audio-uploads")
      .createSignedUploadUrl(path);

    if (error) {
      console.error("[upload-audio/presign] storage error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token:     data.token,
      path,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
