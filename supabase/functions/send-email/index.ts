import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailRequest {
  type: "submission" | "approved" | "rejected";
  paymentId: string;
  adminNote?: string;
}

async function sendGmailEmail(gmailEmail: string, fromName: string, appPassword: string, to: string[], subject: string, html: string) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: gmailEmail,
      pass: appPassword,
    },
  });

  for (const recipient of to) {
    await transporter.sendMail({
      from: `${fromName} <${gmailEmail}>`,
      to: recipient,
      subject,
      html,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all settings
    const { data: senderSettings } = await supabase
      .from("admin_settings")
      .select("key, value")
      .in("key", ["sender_email", "sender_name", "gmail_email", "gmail_app_password"]);

    let FROM_NAME = "Amicitia";
    let gmailEmail = "";
    let gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD") || "";

    if (senderSettings) {
      for (const s of senderSettings) {
        if (s.key === "sender_name" && s.value) FROM_NAME = s.value;
        if (s.key === "gmail_email" && s.value) gmailEmail = s.value;
        if (s.key === "gmail_app_password" && s.value) gmailAppPassword = s.value;
      }
    }

    if (!gmailEmail) throw new Error("Gmail email is not configured in admin settings");
    if (!gmailAppPassword) throw new Error("Gmail App Password is not configured");

    const { type, paymentId, adminNote } = (await req.json()) as EmailRequest;

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error("Payment not found");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("user_id", payment.user_id)
      .single();

    if (!profile?.email) {
      throw new Error("User profile/email not found");
    }

    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const period = `${months[payment.month - 1]} ${payment.year}`;
    const amount = `৳${payment.amount.toLocaleString()}`;
    const method = payment.payment_method === "mobile_banking" ? "Mobile Banking" : "Bank Transfer";

    let subject = "";
    let html = "";

    const header = (title: string, color: string) => `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:${color};color:white;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="margin:0;font-size:22px;">${title}</h1>
        </div>
        <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
    `;
    const footer = `
          <p style="color:#6b7280;font-size:12px;margin-top:24px;text-align:center;">${FROM_NAME}</p>
        </div>
      </div>
    `;

    const detailsTable = `
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Period</td><td style="padding:8px;font-weight:600;border-bottom:1px solid #e5e7eb;">${period}</td></tr>
        <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Amount</td><td style="padding:8px;font-weight:600;border-bottom:1px solid #e5e7eb;">${amount}</td></tr>
        <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Method</td><td style="padding:8px;font-weight:600;border-bottom:1px solid #e5e7eb;">${method}</td></tr>
        ${payment.share_quantity ? `<tr><td style="padding:8px;color:#6b7280;">Shares</td><td style="padding:8px;font-weight:600;">${payment.share_quantity}</td></tr>` : ""}
      </table>
    `;

    if (type === "submission") {
      subject = `Payment Submitted — ${amount} for ${period}`;
      html = `
        ${header("Payment Submitted", "#3b82f6")}
        <p>Hi <strong>${profile.name || "Member"}</strong>,</p>
        <p>Your payment has been submitted successfully and is pending review.</p>
        ${detailsTable}
        <p style="color:#6b7280;font-size:14px;">You'll receive an email once your payment is reviewed.</p>
        ${footer}
      `;
    } else if (type === "approved") {
      subject = `Payment Approved ✅ — ${amount} for ${period}`;
      html = `
        ${header("Payment Approved", "#22c55e")}
        <p>Hi <strong>${profile.name || "Member"}</strong>,</p>
        <p>Great news! Your payment has been <strong style="color:#22c55e;">approved</strong>.</p>
        ${detailsTable}
        ${adminNote ? `<p style="background:#f0fdf4;padding:12px;border-radius:8px;font-size:14px;"><strong>Admin Note:</strong> ${adminNote}</p>` : ""}
        ${footer}
      `;
    } else if (type === "rejected") {
      subject = `Payment Rejected ❌ — ${amount} for ${period}`;
      html = `
        ${header("Payment Rejected", "#ef4444")}
        <p>Hi <strong>${profile.name || "Member"}</strong>,</p>
        <p>Unfortunately, your payment has been <strong style="color:#ef4444;">rejected</strong>.</p>
        ${detailsTable}
        ${adminNote ? `<p style="background:#fef2f2;padding:12px;border-radius:8px;font-size:14px;"><strong>Reason:</strong> ${adminNote}</p>` : ""}
        <p style="color:#6b7280;font-size:14px;">Please contact an admin or resubmit with correct details.</p>
        ${footer}
      `;
    }

    // Send to member
    await sendGmailEmail(gmailEmail, FROM_NAME, gmailAppPassword, [profile.email], subject, html);

    // Notify admins on new submission
    if (type === "submission") {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminRoles?.length) {
        const { data: adminProfiles } = await supabase
          .from("profiles")
          .select("name, email")
          .in("user_id", adminRoles.map((r) => r.user_id));

        const adminEmails = adminProfiles
          ?.filter((p) => p.email)
          .map((p) => p.email) || [];

        if (adminEmails.length > 0) {
          const adminSubject = `New Payment Submitted — ${profile.name || profile.email} — ${amount}`;
          const adminHtml = `
            ${header("New Payment Received", "#8b5cf6")}
            <p>A new payment has been submitted and requires your review.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Member</td><td style="padding:8px;font-weight:600;border-bottom:1px solid #e5e7eb;">${profile.name} (${profile.email})</td></tr>
              <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Period</td><td style="padding:8px;font-weight:600;border-bottom:1px solid #e5e7eb;">${period}</td></tr>
              <tr><td style="padding:8px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Amount</td><td style="padding:8px;font-weight:600;border-bottom:1px solid #e5e7eb;">${amount}</td></tr>
              <tr><td style="padding:8px;color:#6b7280;">Method</td><td style="padding:8px;font-weight:600;">${method}</td></tr>
            </table>
            <p style="color:#6b7280;font-size:14px;">Log in to the admin panel to review this payment.</p>
            ${footer}
          `;

          await sendGmailEmail(gmailEmail, FROM_NAME, gmailAppPassword, adminEmails, adminSubject, adminHtml);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
