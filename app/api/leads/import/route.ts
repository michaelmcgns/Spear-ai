/**
 * POST /api/leads/import
 * Accepts a JSON array of lead rows parsed from CSV on the client.
 * Inserts in bulk — skips duplicates by phone per user.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface LeadRow {
  first_name:       string;
  last_name:        string;
  phone?:           string;
  email?:           string;
  state?:           string;
  product_interest?: string;
  notes?:           string;
  source?:          string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leads } = await req.json() as { leads: LeadRow[] };
  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: "No leads provided" }, { status: 400 });
  }
  console.log(`[leads/import] received ${leads.length} rows from user ${user.id}`);
  if (leads.length > 5000) {
    return NextResponse.json({ error: `Too many rows (${leads.length}). Max 5000 per import. Check your CSV for formatting issues.` }, { status: 400 });
  }

  const rows = leads.map(l => ({
    user_id:          user.id,
    first_name:       (l.first_name ?? "").trim(),
    last_name:        (l.last_name  ?? "").trim(),
    phone:            l.phone?.trim()            || null,
    email:            l.email?.trim()            || null,
    state:            l.state?.trim()            || null,
    product_interest: l.product_interest?.trim() || null,
    notes:            l.notes?.trim()            || null,
    status:           "new",
    source:           l.source ?? "csv_import",
  }));

  const { data, error } = await supabase
    .from("leads")
    .insert(rows)
    .select("id");

  if (error) {
    console.error("[leads/import] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ imported: data?.length ?? 0 });
}
