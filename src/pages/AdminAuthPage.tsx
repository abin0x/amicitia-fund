import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ThemeToggle from "@/components/ThemeToggle";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

export default function AdminAuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .single();

    if (roleData?.role !== "admin") {
      await supabase.auth.signOut();
      toast.error("Access denied. This login is for administrators only.");
      setLoading(false);
      return;
    }

    toast.success("Welcome back, Admin!");
    navigate("/admin");
    setLoading(false);
  };

  return (
    <div className="auth-canvas min-h-screen overflow-hidden px-4 py-5">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-md flex-col justify-center gap-4">
        <Card className="relative overflow-hidden rounded-[30px] border-border/70 bg-card/90 shadow-[0_24px_60px_rgba(16,24,40,0.14)] backdrop-blur-2xl">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-destructive/14 via-destructive/5 to-transparent" />
          <div className="absolute left-[-14%] top-[-10%] h-32 w-32 rounded-full bg-destructive/10 blur-3xl" />
          <div className="absolute right-[-18%] top-[-8%] h-32 w-32 rounded-full bg-destructive/10 blur-3xl" />

          <CardHeader className="relative space-y-2 px-5 pb-3 pt-1">
            <div className="flex justify-end">
              <ThemeToggle className="h-10 w-10 rounded-2xl border-border/70 bg-card/80 shadow-sm" />
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex min-h-[92px] w-full items-center justify-center px-4">
                <img src="/amicitia-logo.png" alt="Amicitia logo" className="theme-logo h-20 w-auto max-w-full object-contain" />
              </div>
              <div className="mt-3 min-w-0" />
            </div>

            <div>
              <CardTitle className="text-center text-[1.55rem] font-extrabold tracking-tight">
                Admin Portal Login
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="relative space-y-4 px-5 pb-5">
            <form
              onSubmit={handleLogin}
              className="space-y-3.5 rounded-[24px] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(248,250,249,0.92))] p-3.5 dark:bg-[linear-gradient(180deg,rgba(18,25,41,0.82),rgba(14,20,35,0.98))]"
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  className="h-11 rounded-2xl border-border/70 bg-background/75 px-4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    minLength={6}
                    className="h-11 rounded-2xl border-border/70 bg-background/75 px-4 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="h-11 w-full rounded-2xl bg-gradient-to-r from-destructive to-destructive/85 text-base font-semibold shadow-[0_16px_32px_rgba(153,27,27,0.18)]"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Enter Admin Panel"}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>

            <div className="rounded-[20px] border border-border/60 bg-muted/20 px-4 py-2.5 text-center text-sm text-muted-foreground">
              Need member access?{" "}
              <a href="/auth" className="font-semibold text-primary hover:underline">
                Member login
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
