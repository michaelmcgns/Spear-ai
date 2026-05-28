import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("agent_integrations")
    .select("ghl_api_key_enc, ghl_location_id, ghl_connected_at, ghl_last_sync_at")
    .eq("agent_id", user.id)
    .single();

  if (!data?.ghl_api_key_enc) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected:  true,
    locationId: data.ghl_location_id ?? "",
    lastSync:   data.ghl_last_sync_at,
    connectedAt: data.ghl_connected_at,
  });
}
