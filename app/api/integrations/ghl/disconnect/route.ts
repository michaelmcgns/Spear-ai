import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { removeGHLCredentials } from "@/lib/integrations/ghl";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await removeGHLCredentials(user.id);
  return NextResponse.json({ success: true });
}
