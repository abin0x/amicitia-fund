import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications, type PushNotificationSchema, type ActionPerformed } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { emitNotificationsChanged } from "@/lib/notifications";

const isNativeApp = Capacitor.isNativePlatform();

const getTargetRoute = (data: Record<string, string | undefined>) => {
  if (typeof data.route === "string" && data.route.length > 0) {
    return data.route;
  }

  if (typeof data.notificationId === "string" && data.notificationId.length > 0) {
    return `/notifications?id=${data.notificationId}`;
  }

  return "/notifications";
};

const getDataRecord = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, typeof item === "string" ? item : String(item ?? "")]);
  return Object.fromEntries(entries);
};

async function syncDeviceToken(userId: string, token: string) {
  const now = new Date().toISOString();
  const { data: existingToken } = await supabase
    .from("device_tokens")
    .select("id")
    .eq("token", token)
    .maybeSingle();

  const payload = {
    user_id: userId,
    token,
    platform: Capacitor.getPlatform(),
    is_active: true,
    last_seen_at: now,
    updated_at: now,
  };

  if (existingToken?.id) {
    await supabase.from("device_tokens").update(payload).eq("id", existingToken.id);
    return;
  }

  await supabase.from("device_tokens").insert(payload);
}

async function ensureLocalNotificationPermission() {
  const localPermission = await LocalNotifications.checkPermissions();
  if (localPermission.display !== "granted") {
    await LocalNotifications.requestPermissions();
  }
}

export default function PushNotificationManager() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !isNativeApp) {
      return;
    }

    let isMounted = true;

    let registrationListener: { remove: () => Promise<void> } | null = null;
    let registrationErrorListener: { remove: () => Promise<void> } | null = null;
    let receivedListener: { remove: () => Promise<void> } | null = null;
    let actionListener: { remove: () => Promise<void> } | null = null;
    let localActionListener: { remove: () => Promise<void> } | null = null;

    const setupPushNotifications = async () => {
      const permission = await PushNotifications.checkPermissions();
      if (permission.receive !== "granted") {
        const requested = await PushNotifications.requestPermissions();
        if (requested.receive !== "granted") {
          return;
        }
      }

      await ensureLocalNotificationPermission();

      registrationListener = await PushNotifications.addListener("registration", async ({ value }) => {
        if (!isMounted || !user?.id) {
          return;
        }

        await syncDeviceToken(user.id, value);
      });

      registrationErrorListener = await PushNotifications.addListener("registrationError", (error) => {
        console.error("Push registration error:", error);
      });

      receivedListener = await PushNotifications.addListener("pushNotificationReceived", async (notification: PushNotificationSchema) => {
        const title = notification.title || "New notification";
        const body = notification.body || "You have a new update.";
        const data = getDataRecord(notification.data);

        toast.info(title, {
          description: body,
        });

        emitNotificationsChanged();

        try {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: Date.now() % 2147483647,
                title,
                body,
                extra: data,
              },
            ],
          });
        } catch (error) {
          console.error("Foreground notification scheduling failed:", error);
        }
      });

      actionListener = await PushNotifications.addListener("pushNotificationActionPerformed", (event: ActionPerformed) => {
        const data = getDataRecord(event.notification.data);
        emitNotificationsChanged();
        navigate(getTargetRoute(data));
      });

      localActionListener = await LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
        const data = getDataRecord(event.notification.extra);
        emitNotificationsChanged();
        navigate(getTargetRoute(data));
      });

      await PushNotifications.register();
    };

    setupPushNotifications().catch((error) => {
      console.error("Push setup failed:", error);
    });

    return () => {
      isMounted = false;
      registrationListener?.remove().catch(() => {});
      registrationErrorListener?.remove().catch(() => {});
      receivedListener?.remove().catch(() => {});
      actionListener?.remove().catch(() => {});
      localActionListener?.remove().catch(() => {});
    };
  }, [navigate, user]);

  return null;
}
