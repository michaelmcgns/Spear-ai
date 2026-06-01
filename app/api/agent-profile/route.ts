import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("agent_profiles")
    .select("product_focus, agency_name")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ profile: data ?? { product_focus: "life_insurance", agency_name: "" } });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { product_focus?: string; agency_name?: string };

  const { error } = await supabase
    .from("agent_profiles")
    .upsert({
      user_id:       user.id,
      product_focus: body.product_focus ?? "life_insurance",
      agency_name:   body.agency_name ?? "",
      updated_at:    new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
