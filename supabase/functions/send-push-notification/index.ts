import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { JWT } from "npm:google-auth-library@9.15.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type StatusType = "approved" | "rejected" | "pending";
type EventType = "payment_submitted" | "payment_status";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const buildMemberStatusContent = (
  status: StatusType,
  amount: number,
  month: number,
  year: number,
  adminNote?: string | null,
) => {
  const period = `${monthNames[month - 1]} ${year}`;
  const amountLabel = `৳${amount.toLocaleString()}`;

  if (status === "approved") {
    return {
      title: "Payment Approved",
      message: `Your payment for ${period} has been approved. Amount: ${amountLabel}.${adminNote ? ` Note: ${adminNote}` : ""}`,
    };
  }

  if (status === "rejected") {
    return {
      title: "Payment Rejected",
      message: `Your payment for ${period} has been rejected. Amount: ${amountLabel}.${adminNote ? ` Reason: ${adminNote}` : ""}`,
    };
  }

  return {
    title: "Payment Marked Pending",
    message: `Your payment for ${period} is now pending review again. Amount: ${amountLabel}.${adminNote ? ` Note: ${adminNote}` : ""}`,
  };
};

const buildAdminSubmissionContent = (memberName: string, amount: number, month: number, year: number) => {
  const period = `${monthNames[month - 1]} ${year}`;
  const amountLabel = `৳${amount.toLocaleString()}`;

  return {
    title: "New Payment Submitted",
    message: `${memberName} submitted a payment for ${period}. Amount: ${amountLabel}. Review it from the admin panel.`,
  };
};

const getGoogleAccessToken = async () => {
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
  const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Firebase service account credentials are not configured");
  }

  const jwtClient = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });

  const tokens = await jwtClient.authorize();
  if (!tokens.access_token) {
    throw new Error("Failed to authorize Firebase messaging request");
  }

  return tokens.access_token;
};

const sendFirebaseMessage = async (
  accessToken: string,
  projectId: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
) => {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
        android: {
          priority: "high",
          notification: {
            channel_id: "payment-status-updates",
            click_action: "FCM_PLUGIN_ACTIVITY",
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();

    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    const callerRole = roleData?.role;
    const { paymentId, status, adminNote, eventType = "payment_status" } = await req.json();

    if (!paymentId || !eventType) {
      return new Response(JSON.stringify({ error: "paymentId and eventType are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (eventType === "payment_status" && callerRole !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can send payment status notifications" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .select("id, user_id, amount, month, year")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notificationJobs: Array<{
      userId: string;
      title: string;
      message: string;
      data: Record<string, string>;
    }> = [];

    if (eventType === "payment_status") {
      const content = buildMemberStatusContent(status as StatusType, payment.amount, payment.month, payment.year, adminNote);
      notificationJobs.push({
        userId: payment.user_id,
        title: content.title,
        message: content.message,
        data: {
          paymentId: payment.id,
          route: "/notifications",
          status: String(status),
        },
      });
    } else {
      if (payment.user_id !== caller.id) {
        return new Response(JSON.stringify({ error: "You can only notify admins for your own payment submission" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: callerProfile } = await adminClient
        .from("profiles")
        .select("name")
        .eq("user_id", caller.id)
        .maybeSingle();

      const memberName = callerProfile?.name?.trim() || caller.email || "A member";
      const content = buildAdminSubmissionContent(memberName, payment.amount, payment.month, payment.year);

      const { data: adminUsers } = await adminClient
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      for (const admin of adminUsers || []) {
        notificationJobs.push({
          userId: admin.user_id,
          title: content.title,
          message: content.message,
          data: {
            paymentId: payment.id,
            route: "/admin/payments",
            status: "pending",
          },
        });
      }
    }

    let accessToken: string | null = null;
    if (projectId) {
      try {
        accessToken = await getGoogleAccessToken();
      } catch (error) {
        console.error("Failed to get Firebase access token:", error);
      }
    }

    const invalidTokenIds: string[] = [];

    for (const job of notificationJobs) {
      if (!projectId || !accessToken) {
        continue;
      }

      const { data: deviceTokens } = await adminClient
        .from("device_tokens")
        .select("id, token")
        .eq("user_id", job.userId)
        .eq("is_active", true);

      for (const device of deviceTokens || []) {
        try {
          await sendFirebaseMessage(accessToken, projectId, device.token, job.title, job.message, job.data);
        } catch (error) {
          console.error("send-push-notification delivery error:", error);
          invalidTokenIds.push(device.id);
        }
      }
    }

    if (invalidTokenIds.length > 0) {
      await adminClient
        .from("device_tokens")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("id", invalidTokenIds);
    }

    return new Response(JSON.stringify({
      success: true,
      pushSent: !!projectId && !!accessToken,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-push-notification error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
