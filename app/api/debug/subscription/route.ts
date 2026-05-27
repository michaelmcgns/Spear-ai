import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

// TEMPORARY DEBUG ENDPOINT — remove before going live with real customers
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in", authError });
  }

  // Read all subscription rows for this user (bypasses RLS to see raw state)
  const db = createServiceClient();
  const { data: rows, error: dbError } = await db
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    userId: user.id,
    email:  user.email,
    rowCount: rows?.length ?? 0,
    rows,
    dbError,
    serviceRoleSet: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    stripePriceAgent: process.env.STRIPE_PRICE_AGENT ?? "NOT SET",
  });
}
