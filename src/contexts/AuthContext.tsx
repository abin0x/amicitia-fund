import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type ViewMode = "admin" | "member";

type AuthContextType = {
  user: User | null;
  role: "admin" | "member" | null;
  viewMode: ViewMode;
  canAccessMemberView: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  toggleViewMode: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  viewMode: "member",
  canAccessMemberView: true,
  loading: true,
  signOut: async () => {},
  toggleViewMode: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "member" | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("member");
  const [canAccessMemberView, setCanAccessMemberView] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (currentUser: User) => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id)
        .single();
      const r = (data?.role as "admin" | "member") ?? "member";
      const memberAccess = !(currentUser.user_metadata as Record<string, unknown> | undefined)?.admin_only;
      setRole(r);
      setCanAccessMemberView(memberAccess);
      setViewMode(r === "admin" ? "admin" : "member");
    } catch {
      setRole("member");
      setViewMode("member");
      setCanAccessMemberView(true);
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          setTimeout(async () => {
            if (mounted) {
              await fetchRole(u);
              setLoading(false);
            }
          }, 0);
        } else {
          setRole(null);
          setViewMode("member");
          setCanAccessMemberView(true);
          setLoading(false);
        }
      }
    );

    const timeout = setTimeout(() => {
      if (mounted && loading) {
        setLoading(false);
      }
    }, 5000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setViewMode("member");
    setCanAccessMemberView(true);
  };

  const toggleViewMode = () => {
    if (role !== "admin" || !canAccessMemberView) return;
    setViewMode((prev) => (prev === "admin" ? "member" : "admin"));
  };

  return (
    <AuthContext.Provider value={{ user, role, viewMode, canAccessMemberView, loading, signOut, toggleViewMode }}>
      {children}
    </AuthContext.Provider>
  );
}
