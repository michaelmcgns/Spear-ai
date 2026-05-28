import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Soft delete — hard deletion completed within 45 days (CCPA) / 72h (GDPR)
    const { error } = await supabase
      .from("profiles")
      .update({ data_delete_requested_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) console.error("Account deletion flag error:", error);

    // Sign out immediately
    await supabase.auth.signOut();

    return NextResponse.json({ ok: true, message: "Account scheduled for deletion within 45 days." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
