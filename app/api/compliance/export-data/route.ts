import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [profileRes, consentRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("consent_log").select("*").eq("agent_id", user.id),
    ]);

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      user: { id: user.id, email: user.email },
      profile: profileRes.data ?? null,
      consentLog: consentRes.data ?? [],
    };

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="spear-data-export.json"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
