import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, LogOut, UserRound } from "lucide-react";

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name, email, mobile_number")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setName(data.name || "");
        setMobile((data as any).mobile_number || "");
        setEmail(data.email || user.email || "");
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!mobile.trim() || !/^01\d{9}$/.test(mobile.trim())) {
      toast.error("Please enter a valid mobile number (01XXXXXXXXX)");
      return;
    }
    setSaving(true);
    const profilePayload = {
      user_id: user.id,
      name: name.trim(),
      email: email.trim() || user.email || "",
      mobile_number: mobile.trim(),
      email_verified: true,
      is_blocked: false,
    };

    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .update({ name: name.trim(), mobile_number: mobile.trim() } as any)
      .eq("user_id", user.id)
      .select("user_id")
      .maybeSingle();

    if (error) {
      toast.error(error.message);
    } else if (!updatedProfile) {
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "user_id" });

      if (upsertError) {
        toast.error(upsertError.message);
        setSaving(false);
        return;
      }

      toast.success("Profile updated successfully!");
      navigate("/", { replace: true });
    } else {
      toast.success("Profile updated successfully!");
      navigate("/", { replace: true });
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate("/auth", { replace: true });
    setSigningOut(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Card className="overflow-hidden rounded-[28px] border border-border/70 bg-card/88 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
        <CardHeader className="border-b border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(20,102,76,0.10),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.55),rgba(248,251,250,0.92))] pb-5 dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_38%),linear-gradient(180deg,rgba(17,24,39,0.72),rgba(18,25,41,0.95))]">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-primary text-primary-foreground shadow-[0_16px_28px_rgba(20,102,76,0.22)] dark:shadow-[0_16px_28px_rgba(37,99,235,0.28)]">
              <UserRound className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-xl font-extrabold tracking-tight">Personal Information</CardTitle>
              <CardDescription className="mt-1 text-sm leading-6">
                {name || "Member"} · {mobile || "No mobile added yet"}
              </CardDescription>
              <div className="mt-4 inline-flex rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary dark:border-primary/20 dark:bg-primary/10">
                {email || "Member Profile"}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-4 sm:p-5">
          <form onSubmit={handleSave} className="space-y-5">
            <div className="rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(244,248,246,0.95))] p-4 shadow-sm dark:bg-[linear-gradient(180deg,rgba(18,25,41,0.98),rgba(15,23,38,0.98))]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Full Name *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    maxLength={100}
                    className="h-12 rounded-2xl border-border/70 bg-card/80"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mobile Number *</Label>
                  <Input
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, "").slice(0, 11))}
                    placeholder="01XXXXXXXXX"
                    maxLength={11}
                    className="h-12 rounded-2xl border-border/70 bg-card/80"
                  />
                  <p className="text-xs text-muted-foreground">Bangladeshi mobile number (11 digits)</p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-primary/12 bg-primary/5 p-3 dark:border-primary/20 dark:bg-primary/10">
              <Button
                type="submit"
                className="h-12 w-full rounded-2xl text-base font-semibold shadow-[0_16px_32px_rgba(20,102,76,0.16)]"
                disabled={saving || signingOut}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Profile"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="px-1">
        <Button
          type="button"
          variant="outline"
          onClick={handleSignOut}
          className="h-12 w-full rounded-2xl border-border/70 bg-card/70 text-base font-semibold"
          disabled={saving || signingOut}
        >
          {signingOut ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging out...
            </>
          ) : (
            <>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
