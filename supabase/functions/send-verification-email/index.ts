import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { userId, redirectUrl } = await req.json();
    if (!userId) throw new Error("userId is required");

    // Get profile
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("name, email, email_verified")
      .eq("user_id", userId)
      .single();

    if (profileErr || !profile) throw new Error("Profile not found");
    if (profile.email_verified) {
      return new Response(JSON.stringify({ success: true, already_verified: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from("profiles")
      .update({ verification_token: token, verification_token_expires_at: expiresAt })
      .eq("user_id", userId);

    // Get all settings
    const { data: settings } = await supabase
      .from("admin_settings")
      .select("key, value")
      .in("key", ["sender_email", "sender_name", "gmail_email", "gmail_app_password"]);

    let fromName = "Amicitia";
    let gmailEmail = "";
    let gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD") || "";

    if (settings) {
      for (const s of settings) {
        if (s.key === "sender_name" && s.value) fromName = s.value;
        if (s.key === "gmail_email" && s.value) gmailEmail = s.value;
        if (s.key === "gmail_app_password" && s.value) gmailAppPassword = s.value;
      }
    }

    if (!gmailEmail) throw new Error("Gmail email is not configured in admin settings");
    if (!gmailAppPassword) throw new Error("Gmail App Password is not configured");

    const verifyLink = `${redirectUrl || "https://amicitia.lovable.app"}/verify-email?token=${token}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:#3b82f6;color:white;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="margin:0;font-size:22px;">Email Verification</h1>
        </div>
        <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <p>Hi <strong>${profile.name || "Member"}</strong>,</p>
          <p>Welcome to <strong>${fromName}</strong>! Please verify your email address to activate your account.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${verifyLink}" style="background:#3b82f6;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Verify Email</a>
          </div>
          <p style="color:#6b7280;font-size:13px;">This link expires in 24 hours. If you didn't create an account, please ignore this email.</p>
          <p style="color:#6b7280;font-size:12px;margin-top:24px;text-align:center;">${fromName}</p>
        </div>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: gmailEmail,
        pass: gmailAppPassword,
      },
    });

    await transporter.sendMail({
      from: `${fromName} <${gmailEmail}>`,
      to: profile.email,
      subject: `Verify your email — ${fromName}`,
      html: html,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-verification-email error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
