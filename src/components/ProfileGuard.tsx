import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!user) { setChecking(false); return; }
    const check = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name, mobile_number")
        .eq("user_id", user.id)
        .single();
      const isComplete = !!(data?.name?.trim() && (data as any)?.mobile_number?.trim());
      setComplete(isComplete);
      setChecking(false);
      if (!isComplete && location.pathname !== "/profile") {
        navigate("/profile");
      }
    };
    check();
  }, [user, location.pathname]);

  if (checking) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
