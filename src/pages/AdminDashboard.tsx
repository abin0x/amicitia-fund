import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PIE_COLORS = ["hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)"];
const DONUT_COLORS = ["hsl(160, 60%, 28%)", "hsl(38, 92%, 50%)"];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalSharesSold: 0,
    totalFundCollected: 0,
    totalPending: 0,
    thisMonthCollection: 0,
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [shareTrend, setShareTrend] = useState<any[]>([]);
  const [statusDist, setStatusDist] = useState<any[]>([]);
  const [methodDist, setMethodDist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [sharePrice, setSharePrice] = useState("4000");
  const [customEnabled, setCustomEnabled] = useState(true);
  const [minCustom, setMinCustom] = useState("1000");
  const [senderEmail, setSenderEmail] = useState("noreply@example.com");
  const [senderName, setSenderName] = useState("Amicitia");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: profiles }, { data: payments }, { data: settings }] = await Promise.all([
        supabase.from("profiles").select("user_id, admin_only"),
        supabase.from("payments").select("*"),
        supabase.from("admin_settings").select("key, value"),
      ]);

      if (payments) {
        const now = new Date();
        const approved = payments.filter((p) => p.status === "approved");
        const pending = payments.filter((p) => p.status === "pending");
        const rejected = payments.filter((p) => p.status === "rejected");
        const thisMonth = approved.filter((p) => p.month === now.getMonth() + 1 && p.year === now.getFullYear());
        const totalMembers = (profiles ?? []).filter((profile) => !profile.admin_only).length;

        setStats({
          totalMembers,
          totalSharesSold: approved.reduce((sum, p) => sum + (p.share_quantity || 0), 0),
          totalFundCollected: approved.reduce((sum, p) => sum + p.amount, 0),
          totalPending: pending.reduce((sum, p) => sum + p.amount, 0),
          thisMonthCollection: thisMonth.reduce((sum, p) => sum + p.amount, 0),
        });

        const monthMap: Record<string, number> = {};
        approved.forEach((p) => {
          const key = `${MONTHS_SHORT[p.month - 1]} ${p.year}`;
          monthMap[key] = (monthMap[key] || 0) + p.amount;
        });
        setMonthlyData(Object.entries(monthMap).map(([month, amount]) => ({ month, amount })).slice(-12));

        const shareMap: Record<string, number> = {};
        approved.filter((p) => p.share_quantity).forEach((p) => {
          const key = `${MONTHS_SHORT[p.month - 1]} ${p.year}`;
          shareMap[key] = (shareMap[key] || 0) + (p.share_quantity || 0);
        });
        setShareTrend(Object.entries(shareMap).map(([month, shares]) => ({ month, shares })).slice(-12));

        setStatusDist(
          [
            { name: "Approved", value: approved.length },
            { name: "Pending", value: pending.length },
            { name: "Rejected", value: rejected.length },
          ].filter((d) => d.value > 0),
        );

        const bankCount = payments.filter((p) => p.payment_method === "bank").length;
        const mobileCount = payments.filter((p) => p.payment_method === "mobile_banking").length;
        setMethodDist(
          [
            { name: "Bank", value: bankCount },
            { name: "Mobile", value: mobileCount },
          ].filter((d) => d.value > 0),
        );
      }

      if (settings) {
        for (const s of settings) {
          if (s.key === "share_price") setSharePrice(s.value);
          if (s.key === "custom_payment_enabled") setCustomEnabled(s.value === "true");
          if (s.key === "min_custom_amount") setMinCustom(s.value);
          if (s.key === "sender_email") setSenderEmail(s.value);
          if (s.key === "sender_name") setSenderName(s.value);
        }
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    const updates = [
      { key: "share_price", value: sharePrice },
      { key: "custom_payment_enabled", value: customEnabled ? "true" : "false" },
      { key: "min_custom_amount", value: minCustom },
      { key: "sender_email", value: senderEmail },
      { key: "sender_name", value: senderName },
    ];

    for (const u of updates) {
      const { error } = await supabase
        .from("admin_settings")
        .upsert(
          {
            key: u.key,
            value: u.value,
            updated_at: new Date().toISOString(),
            updated_by: user?.id,
          },
          { onConflict: "key" },
        );

      if (error) {
        toast.error(`Failed to save ${u.key}: ${error.message}`);
        setSavingSettings(false);
        return;
      }
    }

    toast.success("Settings saved successfully!");
    setSavingSettings(false);
  };

  const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.75rem",
    fontSize: "0.75rem",
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="overflow-hidden rounded-[28px] border border-primary/15 bg-card/90 px-5 py-5 shadow-[0_18px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-3">
                <Skeleton className="h-3 w-24 rounded-full" />
                <Skeleton className="h-9 w-40 rounded-xl" />
              </div>
              <Skeleton className="h-12 w-12 rounded-[20px]" />
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-border/70 bg-card/88 p-4 shadow-[0_16px_38px_rgba(16,24,40,0.08)] backdrop-blur-xl">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-[16px] border border-border/60 px-3 py-2.5">
                  <Skeleton className="h-3 w-20 rounded-full" />
                  <Skeleton className="mt-2 h-6 w-16 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={index} className="overflow-hidden rounded-[26px] border border-border/70 bg-card/88 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <Skeleton className="h-6 w-40 rounded-xl" />
                <Skeleton className="h-3 w-32 rounded-lg" />
              </CardHeader>
              <CardContent className="pt-0">
                <Skeleton className="h-56 w-full rounded-2xl" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={index} className="overflow-hidden rounded-[26px] border border-border/70 bg-card/88 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <Skeleton className="h-6 w-36 rounded-xl" />
                <Skeleton className="h-3 w-28 rounded-lg" />
              </CardHeader>
              <CardContent className="pt-0">
                <Skeleton className="h-52 w-full rounded-2xl" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden rounded-[28px] border border-border/70 bg-card/88 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
          <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
            <Skeleton className="h-7 w-36 rounded-xl" />
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-4 sm:p-5">
            <div className="rounded-[22px] border border-border/70 bg-background/75 p-4">
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-12 w-full rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-2xl" />
              </div>
              <Skeleton className="mt-4 h-16 w-full rounded-2xl" />
            </div>
            <div className="rounded-[22px] border border-border/70 bg-background/75 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Skeleton className="h-12 w-full rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-2xl" />
              </div>
            </div>
            <Skeleton className="h-12 w-full rounded-2xl sm:w-[180px]" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="overflow-hidden rounded-[28px] border border-primary/15 bg-[linear-gradient(135deg,hsla(var(--primary),0.16),hsla(var(--card),0.96)_45%,hsla(var(--primary),0.08))] px-5 py-5 shadow-[0_18px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl dark:border-primary/20 dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.20),rgba(20,28,48,0.96)_46%,rgba(59,130,246,0.10))]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Fund Collected</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">৳{stats.totalFundCollected.toLocaleString()}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-primary/12 bg-card/90 text-primary shadow-sm dark:border-primary/20 dark:bg-primary/10">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-border/70 bg-card/88 p-4 shadow-[0_16px_38px_rgba(16,24,40,0.08)] backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[16px] border border-primary/10 bg-primary/5 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Total Members</p>
              <p className="mt-1 text-lg font-extrabold leading-6 text-foreground">{stats.totalMembers}</p>
            </div>
            <div className="rounded-[16px] border border-success/10 bg-success/5 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Shares Sold</p>
              <p className="mt-1 text-lg font-extrabold leading-6 text-foreground">{stats.totalSharesSold}</p>
            </div>
            <div className="rounded-[16px] border border-primary/10 bg-primary/5 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">This Month</p>
              <p className="mt-1 text-lg font-extrabold leading-6 text-foreground">৳{stats.thisMonthCollection.toLocaleString()}</p>
            </div>
            <div className="rounded-[16px] border border-warning/10 bg-warning/5 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Pending</p>
              <p className="mt-1 text-lg font-extrabold leading-6 text-foreground">৳{stats.totalPending.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden rounded-[26px] border border-border/70 bg-card/88 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Monthly Fund Collection</CardTitle>
            <p className="text-xs text-muted-foreground">Approved payment totals by month</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-52 sm:h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`৳${value.toLocaleString()}`, "Collected"]} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[26px] border border-border/70 bg-card/88 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Share Sales Trend</CardTitle>
            <p className="text-xs text-muted-foreground">Approved shares sold over time</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-52 sm:h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={shareTrend} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value, "Shares"]} />
                  <Line
                    type="monotone"
                    dataKey="shares"
                    stroke="hsl(var(--success))"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "hsl(var(--success))" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {statusDist.length > 0 && (
          <Card className="overflow-hidden rounded-[26px] border border-border/70 bg-card/88 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment Status</CardTitle>
              <p className="text-xs text-muted-foreground">Current approval distribution</p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-48 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusDist} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={72} strokeWidth={0}>
                      {statusDist.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number, _name, item: any) => [value, item?.payload?.name || "Status"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {statusDist.map((item, index) => (
                  <div key={item.name} className="rounded-2xl border border-border/60 bg-muted/25 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                      <p className="text-xs text-muted-foreground">{item.name}</p>
                    </div>
                    <p className="mt-1 text-sm font-bold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {methodDist.length > 0 && (
          <Card className="overflow-hidden rounded-[26px] border border-border/70 bg-card/88 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Bank vs Mobile Banking</CardTitle>
              <p className="text-xs text-muted-foreground">How members are paying</p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-48 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={methodDist} dataKey="value" cx="50%" cy="50%" innerRadius={48} outerRadius={72} strokeWidth={0}>
                      {methodDist.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number, _name, item: any) => [value, item?.payload?.name || "Method"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {methodDist.map((item, index) => (
                  <div key={item.name} className="rounded-2xl border border-border/60 bg-muted/25 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }} />
                      <p className="text-xs text-muted-foreground">{item.name}</p>
                    </div>
                    <p className="mt-1 text-sm font-bold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="overflow-hidden rounded-[28px] border border-border/70 bg-card/88 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" /> Share Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-4 sm:p-5">
          <div className="rounded-[22px] border border-border/70 bg-background/75 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Share Price</Label>
                <Input
                  type="number"
                  min={100}
                  value={sharePrice}
                  onChange={(e) => setSharePrice(e.target.value)}
                  className="h-12 rounded-2xl border-border/70 bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Custom Amount</Label>
                <Input
                  type="number"
                  min={100}
                  value={minCustom}
                  onChange={(e) => setMinCustom(e.target.value)}
                  disabled={!customEnabled}
                  className="h-12 rounded-2xl border-border/70 bg-muted/30"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-border/60 bg-muted/25 px-4 py-3">
              <div className="pr-4">
                <Label className="text-sm font-semibold text-foreground">Enable Custom Payments</Label>
                <p className="mt-1 text-xs text-muted-foreground">Allow members to make custom amount payments</p>
              </div>
              <Switch checked={customEnabled} onCheckedChange={setCustomEnabled} />
            </div>
          </div>

          <div className="rounded-[22px] border border-border/70 bg-background/75 p-4">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-foreground">Email Settings</h3>
              <p className="mt-1 text-xs text-muted-foreground">Configure the sender information shown in outgoing emails.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sender Name</Label>
                <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Amicitia" className="h-12 rounded-2xl border-border/70 bg-muted/30" />
                <p className="text-xs text-muted-foreground">Name shown in emails</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sender Email (Display)</Label>
                <Input value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="noreply@example.com" className="h-12 rounded-2xl border-border/70 bg-muted/30" />
                <p className="text-xs text-muted-foreground">Shown in email header</p>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-border/70 bg-background/75 p-4">
            <h3 className="text-sm font-semibold text-foreground">SMTP Setup</h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Email OTP and verification delivery now use Supabase Auth SMTP settings. Configure the mailbox and app
              password securely from your Supabase dashboard instead of saving SMTP secrets inside the app.
            </p>
          </div>

          <Button onClick={handleSaveSettings} disabled={savingSettings} className="h-12 w-full rounded-2xl text-base font-semibold shadow-sm sm:w-auto sm:min-w-[180px]">
            {savingSettings ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
