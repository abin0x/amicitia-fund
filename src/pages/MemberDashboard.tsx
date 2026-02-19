import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Wallet, Clock, CheckCircle, TrendingUp, CalendarX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LAUNCH_YEAR = 2025;
const LAUNCH_MONTH = 11;

export default function MemberDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = new Date();
  const currentYear = now.getFullYear();
  const availableYears = Array.from({ length: currentYear - LAUNCH_YEAR + 1 }, (_, i) => currentYear - i);
  const [stats, setStats] = useState({ totalShares: 0, totalInvestment: 0, approved: 0, pending: 0, lastStatus: "" });
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [monthStatuses, setMonthStatuses] = useState<Record<number, "paid" | "pending" | "unpaid">>({});

  const getMonthRangeForYear = (year: number) => {
    const startMonth = year === LAUNCH_YEAR ? LAUNCH_MONTH : 1;
    const endMonth = year === currentYear ? now.getMonth() + 1 : 12;
    return { startMonth, endMonth };
  };

  const { startMonth, endMonth } = getMonthRangeForYear(selectedYear);
  const monthsToShow = MONTHS.map((month, idx) => ({ month, value: idx + 1 }))
    .filter(({ value }) => value >= startMonth && value <= endMonth);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!payments) return;

      const approved = payments.filter((p) => p.status === "approved");
      const pending = payments.filter((p) => p.status === "pending");

      setStats({
        totalShares: approved.reduce((sum, p) => sum + (p.share_quantity || 0), 0),
        totalInvestment: approved.reduce((sum, p) => sum + p.amount, 0),
        approved: approved.length,
        pending: pending.length,
        lastStatus: payments[0]?.status || "No payments",
      });
      setRecentPayments(payments.slice(0, 5));

      // Build growth chart data from approved payments, sorted by date
      const sorted = [...approved].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      let cumulative = 0;
      const growth = sorted.map((p) => {
        cumulative += p.amount;
        return {
          date: `${MONTHS[p.month - 1]} ${p.year}`,
          investment: cumulative,
        };
      });
      setChartData(growth);
    };
    fetchData();
  }, [user]);

  // Fetch payment statuses for selected year
  useEffect(() => {
    if (!user) return;
    const fetchYearStatus = async () => {
      const { data: payments } = await supabase
        .from("payments")
        .select("month, status")
        .eq("user_id", user.id)
        .eq("year", selectedYear);

      const { startMonth, endMonth } = getMonthRangeForYear(selectedYear);
      const statuses: Record<number, "paid" | "pending" | "unpaid"> = {};

      for (let m = startMonth; m <= endMonth; m++) {
        const monthPayments = (payments || []).filter((p) => p.month === m);
        if (monthPayments.some((p) => p.status === "approved")) {
          statuses[m] = "paid";
        } else if (monthPayments.some((p) => p.status === "pending")) {
          statuses[m] = "pending";
        } else {
          statuses[m] = "unpaid";
        }
      }
      setMonthStatuses(statuses);
    };
    fetchYearStatus();
  }, [user, selectedYear]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Your investment overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Investment" value={`৳${stats.totalInvestment.toLocaleString()}`} icon={Wallet} variant="primary" />
        <StatCard title="Total Shares" value={stats.totalShares} icon={TrendingUp} variant="success" />
        <StatCard title="Pending Payments" value={stats.pending} icon={Clock} variant="warning" />
        <StatCard title="Last Payment" value={stats.lastStatus || "—"} icon={CheckCircle} />
      </div>

      {/* Investment Growth Chart */}
      {chartData.length > 1 && (
        <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Investment Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                    formatter={(value: number) => [`৳${value.toLocaleString()}`, "Total Investment"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="investment"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      

      {/* Payment Status / Unpaid Months */}
      <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarX className="h-5 w-5 text-destructive" />
            Payment Status
          </CardTitle>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {monthsToShow.map(({ month, value: m }) => {
              const status = monthStatuses[m];
              if (!status) return null;
              const styles = {
                paid: "border-success/40 bg-success/10",
                pending: "border-warning/40 bg-warning/10",
                unpaid: "border-destructive/40 bg-destructive/10",
              };
              const labels = { paid: "Paid", pending: "Pending", unpaid: "Unpaid" };
              const textColors = {
                paid: "text-success",
                pending: "text-warning-foreground",
                unpaid: "text-destructive",
              };
              return (
                <div
                  key={m}
                  className={`rounded-lg border p-3 text-center ${styles[status]} ${status === "unpaid" ? "cursor-pointer hover:ring-2 hover:ring-destructive/50 transition-all" : ""}`}
                  onClick={status === "unpaid" ? () => navigate(`/submit-payment?month=${m}&year=${selectedYear}`) : undefined}
                  title={status === "unpaid" ? "Click to pay" : undefined}
                >
                  <p className="text-xs font-medium">{month}</p>
                  <p className={`text-[11px] font-semibold mt-1 ${textColors[status]}`}>{labels[status]}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

<Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {recentPayments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No payments yet. Submit your first payment!</p>
          ) : (
            <div className="space-y-3">
              {recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">
                      {MONTHS[p.month - 1]} {p.year}
                      {p.payment_type === "share" && p.share_quantity && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({p.share_quantity} {p.share_quantity === 1 ? "share" : "shares"})
                        </span>
                      )}
                      {p.payment_type === "custom" && (
                        <span className="ml-2 text-xs text-muted-foreground">(custom)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.payment_method === "mobile_banking" ? "Mobile Banking" : "Bank"} • TxID: {p.transaction_id || p.extracted_transaction_id || "N/A"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">৳{p.amount.toLocaleString()}</span>
                    <StatusBadge status={p.status as "pending" | "approved" | "rejected"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



