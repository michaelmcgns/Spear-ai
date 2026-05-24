import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateGHLKey, saveGHLCredentials } from "@/lib/integrations/ghl";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { apiKey, locationId } = await req.json();
  if (!apiKey?.trim() || !locationId?.trim()) {
    return NextResponse.json({ error: "API key and Location ID are required" }, { status: 400 });
  }

  const valid = await validateGHLKey(apiKey.trim());
  if (!valid) {
    return NextResponse.json({ error: "Invalid API key — check your GHL settings" }, { status: 422 });
  }

  await saveGHLCredentials(user.id, apiKey.trim(), locationId.trim());
  return NextResponse.json({ success: true });
}
