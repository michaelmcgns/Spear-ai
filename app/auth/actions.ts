"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  let authError: string | null = null;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    });
    if (error) authError = error.message;
  } catch {
    authError = "fetch failed";
  }

  if (authError) {
    redirect("/login?error=" + encodeURIComponent(authError));
  }

  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  let authError: string | null = null;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });
    if (error) authError = error.message;
  } catch {
    authError = "fetch failed";
  }

  if (authError) {
    redirect("/signup?error=" + encodeURIComponent(authError));
  }

  redirect(
    "/login?message=" +
      encodeURIComponent("Check your email to confirm your account")
  );
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
