import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Landmark } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      // Check email_verified before allowing login
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      // Check if email is verified and not blocked
      const { data: profile } = await supabase
        .from("profiles")
        .select("email_verified, is_blocked")
        .eq("user_id", data.user.id)
        .single();

      if (profile?.is_blocked) {
        await supabase.auth.signOut();
        toast.error("Your account has been blocked. Please contact an admin.");
        setLoading(false);
        return;
      }

      if (!profile?.email_verified) {
        // Send verification email again
        const { error: resendError, data: resendData } = await supabase.functions.invoke("send-verification-email", {
          body: { userId: data.user.id, redirectUrl: window.location.origin },
        });
        if (resendError || (resendData as any)?.error) {
          toast.error((resendData as any)?.error || resendError?.message || "Failed to send verification email");
        }
        await supabase.auth.signOut();
        toast.error("Your email is not verified. A new verification email has been sent.");
        setLoading(false);
        return;
      }

      toast.success("Logged in successfully!");
      navigate("/");
    } else {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      // Send custom verification email via Brevo
      if (signUpData.user) {
        // Small delay for profile trigger to complete
        await new Promise((r) => setTimeout(r, 1500));
        const { error: verifyEmailError, data: verifyEmailData } = await supabase.functions.invoke("send-verification-email", {
          body: { userId: signUpData.user.id, redirectUrl: window.location.origin },
        });
        if (verifyEmailError || (verifyEmailData as any)?.error) {
          toast.error((verifyEmailData as any)?.error || verifyEmailError?.message || "Failed to send verification email");
          setLoading(false);
          return;
        }
      }

      toast.success("Account created! Check your email to verify your account.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
            <Landmark className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {isLogin ? "Welcome Back" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Sign in to your Amicitia account"
              : "Join Amicitia fund management"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  required={!isLogin}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary font-medium hover:underline"
            >
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </div>
          <div className="mt-2 text-center text-sm">
            <a href="/admin/auth" className="text-muted-foreground hover:text-primary hover:underline">
              Admin Login →
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
