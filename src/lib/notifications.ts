import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AppNotification = Tables<"notifications">;

export const NOTIFICATIONS_CHANGED_EVENT = "amicitia-notifications-changed";

export const emitNotificationsChanged = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }
};

export const subscribeToNotificationsChanged = (callback: () => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, callback);
  return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, callback);
};

export const getNotificationRoute = (notification: Pick<AppNotification, "id" | "data">) => {
  const data = notification.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const route = data.route;
    if (typeof route === "string" && route.length > 0) {
      return route;
    }
  }

  return `/notifications?id=${notification.id}`;
};

export const markNotificationAsRead = async (notificationId: string) => {
  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("is_read", false);

  if (!error) {
    emitNotificationsChanged();
  }
};
