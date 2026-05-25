import { createClient } from "@supabase/supabase-js";

// Service role client — bypasses RLS. Server-side only. Never expose to browser.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    console.warn("[Supabase] SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key. Webhook writes may fail RLS.");
    return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
