import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Soft-delete flag — hard deletion scheduled within 72 hours (GDPR) / 45 days (CCPA)
    const { error } = await supabase
      .from("profiles")
      .update({ data_delete_requested_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      console.error("Deletion request update error:", error);
    }

    return NextResponse.json({ ok: true, scheduledPurgeHours: 72 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
