import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ThemeToggle from "@/components/ThemeToggle";
import { COLOR_THEMES, FONT_SCALES, getStoredAppearance, updateAppearanceSettings, type ColorTheme, type FontScale } from "@/lib/appearance";
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
  const [colorTheme, setColorTheme] = useState<ColorTheme>(getStoredAppearance().colorTheme);
  const [fontScale, setFontScale] = useState<FontScale>(getStoredAppearance().fontScale);

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
      setSaving(false);
      return;
    }

    if (!updatedProfile) {
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "user_id" });

      if (upsertError) {
        toast.error(upsertError.message);
        setSaving(false);
        return;
      }
    }

    toast.success("Profile updated successfully!");
    setSaving(false);
    navigate("/", { replace: true });
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate("/auth", { replace: true });
    setSigningOut(false);
  };

  const handleColorThemeChange = (nextTheme: ColorTheme) => {
    setColorTheme(nextTheme);
    updateAppearanceSettings({ colorTheme: nextTheme, fontScale });
  };

  const handleFontScaleChange = (nextScale: FontScale) => {
    setFontScale(nextScale);
    updateAppearanceSettings({ colorTheme, fontScale: nextScale });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card className="overflow-hidden rounded-[30px] border border-border/70 bg-card/95 shadow-[0_18px_42px_rgba(16,24,40,0.08)]">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary text-primary-foreground shadow-[0_16px_28px_rgba(20,102,76,0.20)]">
                <UserRound className="h-8 w-8" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Account</p>
                <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-foreground">{name || "Member"}</h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">{email || "No email"}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[22px] border border-border/70 bg-background/70 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Appearance</p>
                <p className="text-xs text-muted-foreground">Dark or light mode</p>
              </div>
              <ThemeToggle className="h-11 w-11 rounded-2xl border-border/70 bg-card/80 shadow-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSave} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="rounded-[30px] border border-border/70 bg-card/95 shadow-[0_16px_36px_rgba(16,24,40,0.08)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-bold tracking-tight">Personal Information</CardTitle>
            <CardDescription>Update your visible member details here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Full Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                maxLength={100}
                className="h-12 rounded-2xl border-border/70 bg-background/80"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Email Address</Label>
              <Input
                value={email}
                disabled
                className="h-12 rounded-2xl border-border/70 bg-muted/30 text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mobile Number *</Label>
              <Input
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, "").slice(0, 11))}
                placeholder="01XXXXXXXXX"
                maxLength={11}
                className="h-12 rounded-2xl border-border/70 bg-background/80"
              />
              <p className="text-xs text-muted-foreground">Bangladeshi mobile number only.</p>
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-2xl text-base font-semibold shadow-[0_16px_30px_rgba(20,102,76,0.16)]"
              disabled={saving || signingOut}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-[30px] border border-border/70 bg-card/95 shadow-[0_16px_36px_rgba(16,24,40,0.08)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold">Display</CardTitle>
              <CardDescription>Choose your preferred app color and text size.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Color Theme</p>
                <div className="grid grid-cols-5 gap-2">
                  {COLOR_THEMES.map((theme) => (
                    <button
                      key={theme.value}
                      type="button"
                      onClick={() => handleColorThemeChange(theme.value)}
                      className={`flex items-center justify-center rounded-2xl border p-2.5 transition-colors ${
                        colorTheme === theme.value
                          ? "border-primary bg-primary/8"
                          : "border-border/70 bg-background/70 hover:bg-muted/40"
                      }`}
                      aria-label={`Select ${theme.label} theme`}
                      title={theme.label}
                    >
                      <span
                        className="h-6 w-6 rounded-full border border-black/10 shadow-sm"
                        style={{ backgroundColor: theme.preview }}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Font Size</p>
                <div className="grid grid-cols-3 gap-2">
                  {FONT_SCALES.map((scale) => (
                    <button
                      key={scale.value}
                      type="button"
                      onClick={() => handleFontScaleChange(scale.value)}
                      className={`rounded-2xl border px-3 py-2.5 text-center text-sm font-medium transition-colors ${
                        fontScale === scale.value
                          ? "border-primary bg-primary/8 text-primary"
                          : "border-border/70 bg-background/70 text-foreground hover:bg-muted/40"
                      }`}
                    >
                      {scale.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              className="h-11 min-w-[180px] rounded-2xl border-border/70 bg-card/70 px-6 text-sm font-semibold"
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
      </form>
    </div>
  );
}
