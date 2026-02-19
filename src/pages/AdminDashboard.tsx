import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StatCard } from "@/components/StatCard";
import { Users, Wallet, Clock, TrendingUp, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
  PieChart, Pie, Cell,
} from "recharts";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PIE_COLORS = ["hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)"];
const DONUT_COLORS = ["hsl(160, 60%, 28%)", "hsl(38, 92%, 50%)"];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalMembers: 0, totalSharesSold: 0, totalFundCollected: 0, totalPending: 0, thisMonthCollection: 0,
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [shareTrend, setShareTrend] = useState<any[]>([]);
  const [statusDist, setStatusDist] = useState<any[]>([]);
  const [methodDist, setMethodDist] = useState<any[]>([]);

  // Settings
  const [sharePrice, setSharePrice] = useState("4000");
  const [customEnabled, setCustomEnabled] = useState(true);
  const [minCustom, setMinCustom] = useState("1000");
  const [senderEmail, setSenderEmail] = useState("noreply@example.com");
  const [senderName, setSenderName] = useState("Amicitia");
  const [gmailEmail, setGmailEmail] = useState("");
  const [gmailAppPassword, setGmailAppPassword] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [{ count: memberCount }, { data: payments }, { data: settings }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("payments").select("*"),
        supabase.from("admin_settings").select("key, value"),
      ]);

      if (payments) {
        const now = new Date();
        const approved = payments.filter((p) => p.status === "approved");
        const pending = payments.filter((p) => p.status === "pending");
        const rejected = payments.filter((p) => p.status === "rejected");
        const thisMonth = approved.filter(p => p.month === now.getMonth() + 1 && p.year === now.getFullYear());

        setStats({
          totalMembers: memberCount || 0,
          totalSharesSold: approved.reduce((sum, p) => sum + (p.share_quantity || 0), 0),
          totalFundCollected: approved.reduce((sum, p) => sum + p.amount, 0),
          totalPending: pending.reduce((sum, p) => sum + p.amount, 0),
          thisMonthCollection: thisMonth.reduce((sum, p) => sum + p.amount, 0),
        });

        // Monthly collection bar chart (last 12 months)
        const monthMap: Record<string, number> = {};
        approved.forEach((p) => {
          const key = `${MONTHS_SHORT[p.month - 1]} ${p.year}`;
          monthMap[key] = (monthMap[key] || 0) + p.amount;
        });
        const sortedMonths = Object.entries(monthMap)
          .map(([month, amount]) => ({ month, amount }))
          .slice(-12);
        setMonthlyData(sortedMonths);

        // Share sales trend
        const shareMap: Record<string, number> = {};
        approved.filter(p => p.share_quantity).forEach((p) => {
          const key = `${MONTHS_SHORT[p.month - 1]} ${p.year}`;
          shareMap[key] = (shareMap[key] || 0) + (p.share_quantity || 0);
        });
        setShareTrend(Object.entries(shareMap).map(([month, shares]) => ({ month, shares })).slice(-12));

        // Status distribution
        setStatusDist([
          { name: "Approved", value: approved.length },
          { name: "Pending", value: pending.length },
          { name: "Rejected", value: rejected.length },
        ].filter(d => d.value > 0));

        // Method distribution
        const bankCount = payments.filter(p => p.payment_method === "bank").length;
        const mobileCount = payments.filter(p => p.payment_method === "mobile_banking").length;
        setMethodDist([
          { name: "Bank", value: bankCount },
          { name: "Mobile", value: mobileCount },
        ].filter(d => d.value > 0));
      }

      if (settings) {
        for (const s of settings) {
          if (s.key === "share_price") setSharePrice(s.value);
          if (s.key === "custom_payment_enabled") setCustomEnabled(s.value === "true");
          if (s.key === "min_custom_amount") setMinCustom(s.value);
          if (s.key === "sender_email") setSenderEmail(s.value);
          if (s.key === "sender_name") setSenderName(s.value);
          if (s.key === "gmail_email") setGmailEmail(s.value);
          if (s.key === "gmail_app_password") setGmailAppPassword(s.value);
        }
      }
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
      { key: "gmail_email", value: gmailEmail },
      { key: "gmail_app_password", value: gmailAppPassword },
    ];
    for (const u of updates) {
      await supabase
        .from("admin_settings")
        .update({ value: u.value, updated_at: new Date().toISOString(), updated_by: user?.id })
        .eq("key", u.key);
    }
    toast.success("Settings saved successfully!");
    setSavingSettings(false);
  };

  const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.5rem",
    fontSize: "0.75rem",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Share-based investment overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Members" value={stats.totalMembers} icon={Users} variant="primary" />
        <StatCard title="Shares Sold" value={stats.totalSharesSold} icon={TrendingUp} variant="success" />
        <StatCard title="Fund Collected" value={`৳${stats.totalFundCollected.toLocaleString()}`} icon={Wallet} variant="success" />
        <StatCard title="This Month" value={`৳${stats.thisMonthCollection.toLocaleString()}`} icon={Wallet} variant="primary" />
        <StatCard title="Pending" value={`৳${stats.totalPending.toLocaleString()}`} icon={Clock} variant="warning" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Collection */}
        <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Monthly Fund Collection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`৳${value.toLocaleString()}`, "Collected"]} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Share Sales Trend */}
        <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Share Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={shareTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value, "Shares"]} />
                  <Line type="monotone" dataKey="shares" stroke="hsl(var(--success))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--success))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        {statusDist.length > 0 && (
          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg">Payment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {statusDist.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Method Distribution */}
        {methodDist.length > 0 && (
          <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg">Bank vs Mobile Banking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={methodDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {methodDist.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Settings Panel */}
      <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" /> Share Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Share Price (BDT)</Label>
              <Input type="number" min={100} value={sharePrice} onChange={(e) => setSharePrice(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Minimum Custom Amount (BDT)</Label>
              <Input type="number" min={100} value={minCustom} onChange={(e) => setMinCustom(e.target.value)} disabled={!customEnabled} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Custom Payments</Label>
              <p className="text-xs text-muted-foreground">Allow members to make custom amount payments</p>
            </div>
            <Switch checked={customEnabled} onCheckedChange={setCustomEnabled} />
          </div>
          <div className="border-t pt-4 mt-4">
            <h3 className="font-semibold mb-3">Email Settings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sender Name</Label>
                <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Amicitia" />
                <p className="text-xs text-muted-foreground">Name shown in emails</p>
              </div>
              <div className="space-y-2">
                <Label>Sender Email (Display)</Label>
                <Input value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="noreply@yourdomain.com" />
                <p className="text-xs text-muted-foreground">Shown in email header</p>
              </div>
            </div>
          </div>
          <div className="border-t pt-4 mt-4">
            <h3 className="font-semibold mb-3">Gmail SMTP Settings</h3>
            <p className="text-xs text-muted-foreground mb-3">Emails are sent using Gmail App Password. All emails will be sent from this address.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gmail Address</Label>
                <Input value={gmailEmail} onChange={(e) => setGmailEmail(e.target.value)} placeholder="your@gmail.com" type="email" />
              </div>
              <div className="space-y-2">
                <Label>Gmail App Password</Label>
                <Input value={gmailAppPassword} onChange={(e) => setGmailAppPassword(e.target.value)} placeholder="xxxx xxxx xxxx xxxx" type="password" />
              </div>
            </div>
          </div>
          <Button onClick={handleSaveSettings} disabled={savingSettings}>
            {savingSettings ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
