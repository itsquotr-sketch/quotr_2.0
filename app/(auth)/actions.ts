"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

const signupSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required"),
  organisation_name: z
    .string()
    .trim()
    .min(1, "Organisation name is required"),
  email: z.email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function signup(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    full_name: formData.get("full_name"),
    organisation_name: formData.get("organisation_name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { full_name, organisation_name, email, password } = parsed.data;
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    return { error: authError.message };
  }

  if (!authData.user) {
    return { error: "Unable to create account. Please try again." };
  }

  try {
    const admin = createAdminClient();

    const { data: org, error: orgError } = await admin
      .from("organisations")
      .insert({ name: organisation_name })
      .select("id")
      .single();

    if (orgError || !org) {
      return {
        error: orgError?.message ?? "Failed to create organisation.",
      };
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: authData.user.id,
      org_id: org.id,
      full_name,
      role: "owner",
    });

    if (profileError) {
      return { error: profileError.message };
    }
  } catch {
    return {
      error:
        "Server configuration error. Ensure SUPABASE_SERVICE_ROLE_KEY is set.",
    };
  }

  if (!authData.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return {
        error:
          "Account created. Please check your email to confirm before signing in.",
      };
    }
  }

  redirect("/app/dashboard");
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/app/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
