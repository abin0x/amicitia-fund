import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BellRing, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getNotificationRoute, markNotificationAsRead, subscribeToNotificationsChanged, type AppNotification } from "@/lib/notifications";
import { toast } from "sonner";

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const selectedId = searchParams.get("id");

  const fetchNotifications = async (showSpinner = true) => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    if (showSpinner) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setNotifications(data || []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchNotifications().catch(console.error);
  }, [user]);

  useEffect(() => subscribeToNotificationsChanged(() => {
    fetchNotifications(false).catch(console.error);
  }), [user]);

  const selectedNotification = useMemo(() => {
    if (!notifications.length) {
      return null;
    }

    if (selectedId) {
      return notifications.find((item) => item.id === selectedId) || notifications[0];
    }

    return notifications[0];
  }, [notifications, selectedId]);

  useEffect(() => {
    if (!selectedNotification || selectedNotification.is_read) {
      return;
    }

    markNotificationAsRead(selectedNotification.id).catch(console.error);
  }, [selectedNotification]);

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  const deleteNotification = async (notificationId: string) => {
    setDeletingId(notificationId);
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (error) {
      toast.error(error.message);
      setDeletingId(null);
      return;
    }

    setNotifications((current) => current.filter((item) => item.id !== notificationId));
    setSwipedId((current) => (current === notificationId ? null : current));

    if (selectedId === notificationId) {
      setSearchParams({});
    }

    toast.success("Notification deleted");
    setDeletingId(null);
  };

  const clearAllNotifications = async () => {
    if (!user || notifications.length === 0) {
      return;
    }

    setClearingAll(true);
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      toast.error(error.message);
      setClearingAll(false);
      return;
    }

    setNotifications([]);
    setSearchParams({});
    setSwipedId(null);
    toast.success("All notifications cleared");
    setClearingAll(false);
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Card className="overflow-hidden rounded-[26px] border border-border/70 bg-card/92 shadow-[0_12px_34px_rgba(16,24,40,0.08)]">
          <CardHeader className="pb-3">
            <Skeleton className="h-7 w-44 rounded-xl" />
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[26px] border border-border/70 bg-card/92 shadow-[0_12px_34px_rgba(16,24,40,0.08)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-[1.1rem] font-bold">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <BellRing className="h-5 w-5" />
                </span>
                Notifications
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="min-w-9 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-center text-xs">
                {unreadCount}
              </Badge>
              <Button
                variant="outline"
                className="h-10 rounded-2xl border-border/70 px-3 text-xs"
                onClick={clearAllNotifications}
                disabled={clearingAll || notifications.length === 0}
              >
                {clearingAll ? "Clearing..." : "Clear all"}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-2xl border-border/70"
                onClick={() => fetchNotifications(false)}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
          {!selectedNotification && (
            <div className="rounded-[22px] border border-dashed border-border/70 bg-muted/15 px-5 py-10 text-center">
              <BellRing className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-4 text-base font-semibold">No notifications yet</p>
            </div>
          )}

          {notifications.length > 0 && (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const active = notification.id === selectedNotification?.id;
                return (
                  <SwipeNotificationItem
                    key={notification.id}
                    notification={notification}
                    active={active}
                    deleting={deletingId === notification.id}
                    swiped={swipedId === notification.id}
                    onSwipeOpen={() => setSwipedId(notification.id)}
                    onSwipeClose={() => setSwipedId((current) => (current === notification.id ? null : current))}
                    onDelete={() => deleteNotification(notification.id)}
                    onOpen={() => {
                      setSearchParams({ id: notification.id });
                      if (!notification.is_read) {
                        markNotificationAsRead(notification.id).catch(console.error);
                      }
                      navigate(getNotificationRoute(notification));
                    }}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SwipeNotificationItem({
  notification,
  active,
  deleting,
  swiped,
  onSwipeOpen,
  onSwipeClose,
  onDelete,
  onOpen,
}: {
  notification: AppNotification;
  active: boolean;
  deleting: boolean;
  swiped: boolean;
  onSwipeOpen: () => void;
  onSwipeClose: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchCurrentX, setTouchCurrentX] = useState<number | null>(null);

  const translateX = touchStartX !== null && touchCurrentX !== null
    ? Math.max(Math.min(touchCurrentX - touchStartX, 96), -96)
    : swiped
      ? 0
      : 0;

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.touches[0]?.clientX ?? null);
    setTouchCurrentX(event.touches[0]?.clientX ?? null);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;
    setTouchCurrentX(event.touches[0]?.clientX ?? null);
  };

  const handleTouchEnd = () => {
    if (touchStartX !== null && touchCurrentX !== null) {
      const delta = touchCurrentX - touchStartX;
      if (delta <= -60 || delta >= 60) {
        onSwipeOpen();
        onDelete();
      } else {
        onSwipeClose();
      }
    }

    setTouchStartX(null);
    setTouchCurrentX(null);
  };

  return (
    <div className="relative overflow-hidden rounded-[20px]">
      <div
        className={`relative rounded-[20px] border p-3.5 text-left transition-transform duration-200 ${
          active
            ? "border-primary/20 bg-primary/5 shadow-sm"
            : "border-border/70 bg-background/70 hover:bg-muted/15"
        } ${deleting ? "opacity-60" : ""}`}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={() => {
            if (swiped) {
              onSwipeClose();
              return;
            }
            onOpen();
          }}
          className="w-full text-left"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {notification.is_read ? (
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground/80" />
                ) : (
                  <Clock3 className="h-4 w-4 text-primary" />
                )}
                <p className="truncate text-sm font-semibold">{notification.title}</p>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                {notification.message}
              </p>
            </div>
            {!notification.is_read && (
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
            )}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>{formatDateTime(notification.created_at)}</span>
            <span>{notification.kind.replace(/_/g, " ")}</span>
          </div>
        </button>
      </div>
    </div>
  );
}
