import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncCallToGHL } from "@/lib/integrations/ghl";

// GHL → Spear inbound webhook
// Configure this URL in GHL: Settings → Integrations → Webhooks
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const contact = (body.contact ?? {}) as Record<string, string>;
  const phone: string = (body.phone as string) ?? contact.phone ?? "";
  const name: string  = (body.name  as string) ?? contact.name  ?? "";

  if (!phone) return NextResponse.json({ ok: true, note: "No phone — skipped" });

  const supabase = await createClient();

  // Find the most recent call session matching this phone number (within 24h)
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data: session } = await supabase
    .from("call_sessions")
    .select("*, agent_integrations!inner(ghl_api_key_enc)")
    .ilike("prospect_phone", `%${phone.replace(/\D/g, "").slice(-10)}%`)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!session) return NextResponse.json({ ok: true, note: "No matching session" });

  await syncCallToGHL({
    agentId:           session.agent_id,
    callSessionId:     session.id,
    prospectName:      name || "Unknown",
    prospectPhone:     phone,
    overallScore:      session.overall_score,
    discProfile:       session.disc_profile_detected,
    nepqPhaseReached:  null,
    outcome:           session.outcome ?? "unknown",
    objectionsRaised:  (session.objections_raised ?? []).map((o: Record<string, string>) => o.type ?? o.text ?? ""),
    topImprovement:    null,
    topStrength:       null,
    callDate:          session.created_at,
    siteUrl:           process.env.NEXT_PUBLIC_SITE_URL ?? "",
  });

  return NextResponse.json({ ok: true });
}
