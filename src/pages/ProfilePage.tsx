import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, User } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim(), mobile_number: mobile.trim() } as any)
      .eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile updated successfully!");
      navigate("/", { replace: true });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Update your personal information</p>
      </div>

      <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Personal Information</CardTitle>
              <CardDescription>Set your name and mobile number</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} disabled className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Mobile Number *</Label>
              <Input
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, "").slice(0, 11))}
                placeholder="01XXXXXXXXX"
                maxLength={11}
              />
              <p className="text-xs text-muted-foreground">Bangladeshi mobile number (11 digits)</p>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
