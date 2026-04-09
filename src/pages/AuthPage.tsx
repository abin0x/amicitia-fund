import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ThemeToggle from "@/components/ThemeToggle";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

export default function AuthPage() {
  const OTP_RESEND_SECONDS = 60;
  const [isLogin, setIsLogin] = useState(true);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showConfirmResetPassword, setShowConfirmResetPassword] = useState(false);
  const [signupResendTimer, setSignupResendTimer] = useState(0);
  const [resetResendTimer, setResetResendTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (signupResendTimer <= 0) return;
    const timeout = window.setTimeout(() => {
      setSignupResendTimer((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [signupResendTimer]);

  useEffect(() => {
    if (resetResendTimer <= 0) return;
    const timeout = window.setTimeout(() => {
      setResetResendTimer((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [resetResendTimer]);

  const resetOtpState = () => {
    setOtpSent(false);
    setOtp("");
    setSignupResendTimer(0);
    setLoading(false);
  };

  const resetForgotPasswordState = () => {
    setForgotPasswordMode(false);
    setForgotPasswordStep("request");
    setResetOtp("");
    setResetPassword("");
    setConfirmResetPassword("");
    setShowResetPassword(false);
    setShowConfirmResetPassword(false);
    setResetResendTimer(0);
    setLoading(false);
  };

  const ensureMemberSetup = async (userId: string) => {
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id, name")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingProfile) {
      await supabase
        .from("profiles")
        .update({
          admin_only: false,
          name: existingProfile.name || trimmedName,
          email: normalizedEmail,
          email_verified: true,
          is_blocked: false,
        })
        .eq("user_id", userId);
    } else {
      await supabase.from("profiles").insert({
        admin_only: false,
        user_id: userId,
        name: trimmedName,
        email: normalizedEmail,
        mobile_number: "",
        email_verified: true,
        is_blocked: false,
        verification_token: null,
        verification_token_expires_at: null,
      });
    }

    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingRole) {
      await supabase.from("user_roles").insert({
        user_id: userId,
        role: "member",
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error, data } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_blocked")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (profile?.is_blocked) {
      await supabase.auth.signOut();
      toast.error("Your account has been blocked. Please contact an admin.");
      setLoading(false);
      return;
    }

    toast.success("Logged in successfully!");
    navigate("/");
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { name: name.trim() },
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setOtpSent(true);
    setSignupResendTimer(OTP_RESEND_SECONDS);
    toast.success("Account created. Check your email for the OTP code.");
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp.trim(),
      type: "signup",
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      toast.error("Verification failed. Please try again.");
      setLoading(false);
      return;
    }

    await ensureMemberSetup(data.user.id);
    toast.success("Account verified successfully!");
    navigate("/");
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setForgotPasswordStep("verify");
    setResetResendTimer(OTP_RESEND_SECONDS);
    toast.success("Password reset OTP sent to your email.");
    setLoading(false);
  };

  const handleResendSignupOtp = async () => {
    if (signupResendTimer > 0) return;

    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setSignupResendTimer(OTP_RESEND_SECONDS);
    toast.success("A new signup OTP has been sent.");
    setLoading(false);
  };

  const handleResendResetOtp = async () => {
    if (resetResendTimer > 0) return;

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setResetResendTimer(OTP_RESEND_SECONDS);
    toast.success("A new password reset OTP has been sent.");
    setLoading(false);
  };

  const handleVerifyResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (resetPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    if (resetPassword !== confirmResetPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: resetOtp.trim(),
      type: "recovery",
    });

    if (verifyError) {
      toast.error(verifyError.message);
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: resetPassword,
    });

    if (updateError) {
      toast.error(updateError.message);
      setLoading(false);
      return;
    }

    toast.success("Password updated successfully. Please sign in.");
    await supabase.auth.signOut();
    resetForgotPasswordState();
    setPassword("");
    setLoading(false);
  };

  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setForgotPasswordMode(false);
    setPassword("");
    resetOtpState();
  };

  return (
    <div className="auth-canvas min-h-screen overflow-hidden px-4 py-5">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-md flex-col justify-center gap-4">
        <Card className="relative overflow-hidden rounded-[30px] border-border/70 bg-card/90 shadow-[0_24px_60px_rgba(16,24,40,0.14)] backdrop-blur-2xl">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/14 via-primary/5 to-transparent" />
          <div className="absolute left-[-14%] top-[-10%] h-32 w-32 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute right-[-18%] top-[-8%] h-32 w-32 rounded-full bg-primary/10 blur-3xl" />

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

            {!forgotPasswordMode && (
              <div className="grid grid-cols-2 rounded-[18px] border border-border/70 bg-muted/45 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setForgotPasswordMode(false);
                    setPassword("");
                    resetOtpState();
                  }}
                  className={`rounded-[14px] px-4 py-2 text-sm font-semibold transition-colors ${
                    isLogin ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setForgotPasswordMode(false);
                    setPassword("");
                    resetOtpState();
                  }}
                  className={`rounded-[14px] px-4 py-2 text-sm font-semibold transition-colors ${
                    !isLogin ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            <div>
              <CardTitle className="text-center text-[1.55rem] font-extrabold tracking-tight">
                {otpSent
                  ? "Verify Your Account"
                  : forgotPasswordMode
                    ? forgotPasswordStep === "request"
                      ? "Forgot your password"
                      : "Verify reset OTP"
                    : isLogin
                      ? "Welcome back"
                      : "Create your account"}
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="relative space-y-4 px-5 pb-5">
            <form
              onSubmit={
                otpSent
                  ? handleVerifyOtp
                  : forgotPasswordMode
                    ? forgotPasswordStep === "request"
                      ? handleForgotPassword
                      : handleVerifyResetOtp
                    : isLogin
                      ? handleLogin
                      : handleSignup
              }
              className="space-y-3.5 rounded-[24px] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(248,250,249,0.92))] p-3.5 dark:bg-[linear-gradient(180deg,rgba(18,25,41,0.82),rgba(14,20,35,0.98))]"
            >
              {!isLogin && !otpSent && !forgotPasswordMode && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    required
                    className="h-11 rounded-2xl border-border/70 bg-muted/35 px-4"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="h-11 rounded-2xl border-border/70 bg-background/75 px-4"
                />
              </div>

              {!otpSent && !forgotPasswordMode && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isLogin ? "Enter your password" : "Set a password"}
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
              )}

              {otpSent && (
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">OTP Code</Label>
                  <Input
                    id="otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    placeholder="Enter OTP code"
                    required
                    inputMode="numeric"
                    maxLength={12}
                    className="h-11 rounded-2xl border-border/70 bg-background/75 px-4"
                  />
                  <p className="text-xs text-muted-foreground">
                    Check your email inbox and enter the full OTP code.
                  </p>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {signupResendTimer > 0 ? "Resend available in" : "Didn't receive the code?"}
                      </span>
                      {signupResendTimer > 0 && (
                        <span className="inline-flex min-w-[64px] items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm">
                          {signupResendTimer}s
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleResendSignupOtp}
                      disabled={loading || signupResendTimer > 0}
                      className="font-semibold text-primary transition-opacity hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Resend OTP
                    </button>
                  </div>
                </div>
              )}

              {forgotPasswordMode && forgotPasswordStep === "request" && (
                <p className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                  Enter your member email address. We will send you a password reset OTP.
                </p>
              )}

              {forgotPasswordMode && forgotPasswordStep === "verify" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="reset-otp" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Reset OTP</Label>
                    <Input
                      id="reset-otp"
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 12))}
                      placeholder="Enter reset OTP"
                      required
                      inputMode="numeric"
                      maxLength={12}
                      className="h-11 rounded-2xl border-border/70 bg-background/75 px-4"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reset-password" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">New Password</Label>
                    <div className="relative">
                      <Input
                        id="reset-password"
                        type={showResetPassword ? "text" : "password"}
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        minLength={6}
                        className="h-11 rounded-2xl border-border/70 bg-background/75 px-4 pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showResetPassword ? "Hide password" : "Show password"}
                      >
                        {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-reset-password" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-reset-password"
                        type={showConfirmResetPassword ? "text" : "password"}
                        value={confirmResetPassword}
                        onChange={(e) => setConfirmResetPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        minLength={6}
                        className="h-11 rounded-2xl border-border/70 bg-background/75 px-4 pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmResetPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showConfirmResetPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <p className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    Enter the OTP from your recovery email, then set your new password.
                  </p>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {resetResendTimer > 0 ? "Resend available in" : "Didn't receive the code?"}
                      </span>
                      {resetResendTimer > 0 && (
                        <span className="inline-flex min-w-[64px] items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm">
                          {resetResendTimer}s
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleResendResetOtp}
                      disabled={loading || resetResendTimer > 0}
                      className="font-semibold text-primary transition-opacity hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Resend OTP
                    </button>
                  </div>
                </>
              )}

              <Button
                type="submit"
                className="h-11 w-full rounded-2xl bg-gradient-to-r from-primary to-primary/85 text-base font-semibold shadow-[0_16px_32px_rgba(20,102,76,0.22)] dark:shadow-[0_16px_32px_rgba(37,99,235,0.24)]"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : otpSent
                    ? "Verify OTP"
                    : forgotPasswordMode
                      ? forgotPasswordStep === "request"
                        ? "Send OTP"
                        : "Set New Password"
                      : isLogin
                        ? "Sign In"
                        : "Create Account"}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>

              {otpSent && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetOtpState}
                  className="h-11 w-full rounded-2xl"
                  disabled={loading}
                >
                  Back
                </Button>
              )}

              {forgotPasswordMode && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForgotPasswordState}
                  className="h-11 w-full rounded-2xl"
                  disabled={loading}
                >
                  Back to Sign In
                </Button>
              )}
            </form>

            <div className="rounded-[20px] border border-border/60 bg-muted/20 px-4 py-2.5 text-center text-sm text-muted-foreground">
              {!otpSent && !forgotPasswordMode && (
                <>
                  {isLogin ? "Need a new account?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={handleToggleMode}
                    className="font-semibold text-primary hover:underline"
                  >
                    {isLogin ? "Create one" : "Sign in"}
                  </button>
                </>
              )}
              {isLogin && !otpSent && !forgotPasswordMode && (
                <div className="mt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordMode(true);
                      setPassword("");
                      resetOtpState();
                    }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
              <div className="mt-2 text-xs">
                <a href="/admin/auth" className="font-semibold text-primary hover:underline">
                  Admin
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
