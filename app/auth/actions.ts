"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function supabaseConfigError(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || url.trim() === "") return "Supabase URL is not configured. Add NEXT_PUBLIC_SUPABASE_URL to .env.local";
  if (!key || key.trim() === "") return "Supabase anon key is not configured. Add NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local";
  return null;
}

export async function login(formData: FormData) {
  const configErr = supabaseConfigError();
  if (configErr) redirect("/login?error=" + encodeURIComponent(configErr));

  let authError: string | null = null;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email:    formData.get("email")    as string,
      password: formData.get("password") as string,
    });
    if (error) authError = error.message;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Surface DNS / network failures clearly instead of a bare "fetch failed"
    authError = msg.includes("ENOTFOUND") || msg.includes("fetch failed")
      ? "Cannot reach Supabase. Check that NEXT_PUBLIC_SUPABASE_URL is correct and the project is active."
      : msg;
  }

  if (authError) {
    redirect("/login?error=" + encodeURIComponent(authError));
  }

  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const configErr = supabaseConfigError();
  if (configErr) redirect("/signup?error=" + encodeURIComponent(configErr));

  let authError: string | null = null;

  const email    = formData.get("email")    as string;
  const password = formData.get("password") as string;
  const name     = formData.get("name")     as string | null;
  const role     = formData.get("role")     as string | null;
  const teamSize = formData.get("teamSize") as string | null;

  let emailConfirmed = false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        data: {
          full_name: name     ?? "",
          role:      role     ?? "",
          team_size: teamSize ?? "",
        },
      },
    });
    if (error) authError = error.message;
    // If Supabase auto-confirms emails, the session is live immediately
    emailConfirmed = !!data.session;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    authError = msg.includes("ENOTFOUND") || msg.includes("fetch failed")
      ? "Cannot reach Supabase. Check that NEXT_PUBLIC_SUPABASE_URL is correct and the project is active."
      : msg;
  }

  if (authError) {
    redirect("/signup?error=" + encodeURIComponent(authError));
  }

  // Auto-confirm on → session is ready → send straight to dashboard
  if (emailConfirmed) {
    redirect("/dashboard?welcome=true");
  }

  // Email confirmation required → show "check your email" screen
  redirect("/signup?success=1&email=" + encodeURIComponent(email));
}

export async function forgotPassword(formData: FormData) {
  const configErr = supabaseConfigError();
  if (configErr) redirect("/forgot-password?error=" + encodeURIComponent(configErr));

  const email = formData.get("email") as string;
  if (!email?.trim()) redirect("/forgot-password?error=" + encodeURIComponent("Email is required"));

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
    });
    if (error) redirect("/forgot-password?error=" + encodeURIComponent(error.message));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    redirect("/forgot-password?error=" + encodeURIComponent(
      msg.includes("ENOTFOUND") || msg.includes("fetch failed")
        ? "Cannot reach Supabase. Check your connection."
        : msg
    ));
  }

  redirect("/forgot-password?success=1&email=" + encodeURIComponent(email));
}

export async function resetPassword(formData: FormData) {
  const configErr = supabaseConfigError();
  if (configErr) redirect("/reset-password?error=" + encodeURIComponent(configErr));

  const password = formData.get("password") as string;
  if (!password || password.length < 6) {
    redirect("/reset-password?error=" + encodeURIComponent("Password must be at least 6 characters"));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) redirect("/reset-password?error=" + encodeURIComponent(error.message));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    redirect("/reset-password?error=" + encodeURIComponent(msg));
  }

  redirect("/dashboard");
}

export async function logout() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Supabase unreachable — just redirect
  }
  redirect("/login");
}
