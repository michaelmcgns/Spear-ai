// Manager: invite an agent to the org via email
// POST /api/manager/invite  { email: string, role?: "agent" | "manager" }

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Must be manager/owner
  const { data: myMembership } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .single();

  if (!myMembership) {
    return NextResponse.json({ error: "Not a manager" }, { status: 403 });
  }

  const body = await req.json();
  const email: string = (body.email ?? "").toLowerCase().trim();
  const role: string  = body.role ?? "agent";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!["agent", "manager"].includes(role)) {
    return NextResponse.json({ error: "Role must be agent or manager" }, { status: 400 });
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("org_members")
    .select("id, invite_accepted")
    .eq("org_id", myMembership.org_id)
    .eq("invite_email", email)
    .maybeSingle();

  if (existing?.invite_accepted) {
    return NextResponse.json({ error: "This agent is already in your team" }, { status: 409 });
  }

  // Generate secure invite token
  const token = crypto.randomBytes(32).toString("hex");

  if (existing) {
    // Re-send: update the token
    await supabase
      .from("org_members")
      .update({ invite_token: token, role })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("org_members")
      .insert({
        org_id:      myMembership.org_id,
        role,
        invite_email: email,
        invite_token: token,
        invited_by:   user.id,
      });
  }

  // Send invite email via Supabase Auth (service role)
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/join?token=${token}`;

  // Use Supabase's invite-by-email so they get a magic link that also creates their account
  const { error: inviteErr } = await serviceSupabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteUrl,
    data: { invite_token: token, org_id: myMembership.org_id },
  });

  if (inviteErr) {
    // Non-fatal: user may already exist. The join link still works.
    console.error("Supabase invite error (non-fatal):", inviteErr.message);
  }

  return NextResponse.json({
    success: true,
    invite_url: inviteUrl, // Return so manager can also share manually
  });
}
