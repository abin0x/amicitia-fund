import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOOTSTRAP_ADMIN_EMAIL = "4819abin@gmail.com";
const BOOTSTRAP_ADMIN_PASSWORD = "Abin#4819!2026";
const BOOTSTRAP_ADMIN_NAME = "Bootstrap Admin";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("Authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // One-time bootstrap path for first admin setup.
    if (body?.bootstrap === true) {
      let userId: string | null = null;
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("user_id")
        .eq("email", BOOTSTRAP_ADMIN_EMAIL)
        .maybeSingle();

      if (existingProfile?.user_id) {
        userId = existingProfile.user_id;
        const { error: updateErr } = await adminClient.auth.admin.updateUserById(userId, {
          password: BOOTSTRAP_ADMIN_PASSWORD,
          email_confirm: true,
          user_metadata: { name: BOOTSTRAP_ADMIN_NAME },
        });
        if (updateErr) {
          return new Response(JSON.stringify({ error: updateErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email: BOOTSTRAP_ADMIN_EMAIL,
          password: BOOTSTRAP_ADMIN_PASSWORD,
          email_confirm: true,
          user_metadata: { name: BOOTSTRAP_ADMIN_NAME },
        });

        if (createError) {
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = newUser.user.id;
      }

      await adminClient.from("profiles").upsert(
        {
          admin_only: true,
          user_id: userId,
          name: BOOTSTRAP_ADMIN_NAME,
          email: BOOTSTRAP_ADMIN_EMAIL,
          mobile_number: "",
          email_verified: true,
          is_blocked: false,
        },
        { onConflict: "user_id" },
      );

      await adminClient.from("user_roles").upsert(
        {
          user_id: userId,
          role: "admin",
        },
        { onConflict: "user_id" },
      );

      return new Response(JSON.stringify({
        success: true,
        user_id: userId,
        email: BOOTSTRAP_ADMIN_EMAIL,
        password: BOOTSTRAP_ADMIN_PASSWORD,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller is an admin
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (callerRole?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can create admin accounts" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, name } = body;
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const displayName = String(name ?? "").trim();

    // Create user with service role (auto-confirms)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { name: displayName, admin_only: true },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("profiles").upsert(
      {
        admin_only: true,
        user_id: newUser.user.id,
        name: displayName,
        email: normalizedEmail,
        mobile_number: "",
        email_verified: true,
        is_blocked: false,
      },
      { onConflict: "user_id" },
    );

    await adminClient.from("user_roles").upsert(
      {
        user_id: newUser.user.id,
        role: "admin",
      },
      { onConflict: "user_id" },
    );

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
