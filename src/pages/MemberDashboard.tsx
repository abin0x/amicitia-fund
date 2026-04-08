import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { CalendarX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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
  const [memberName, setMemberName] = useState("Member");
  const [stats, setStats] = useState({
    totalShares: 0,
    totalInvestment: 0,
    approved: 0,
    pending: 0,
    lastStatus: "",
  });
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [monthStatuses, setMonthStatuses] = useState<Record<number, "paid" | "pending" | "unpaid">>({});
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(true);

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
      setLoading(true);
      const [{ data: payments }, { data: profile }] = await Promise.all([
        supabase
          .from("payments")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("name")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      const resolvedName =
        profile?.name ||
        user.user_metadata?.name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "Member";
      setMemberName(resolvedName);

      if (!payments) return;

      const approved = payments.filter((payment) => payment.status === "approved");
      const pending = payments.filter((payment) => payment.status === "pending");

      setStats({
        totalShares: approved.reduce((sum, payment) => sum + (payment.share_quantity || 0), 0),
        totalInvestment: approved.reduce((sum, payment) => sum + payment.amount, 0),
        approved: approved.length,
        pending: pending.length,
        lastStatus: payments[0]?.status || "No payments",
      });
      setRecentPayments(payments.slice(0, 5));

      const sorted = [...approved].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      let cumulative = 0;
      const growth = sorted.map((payment) => {
        cumulative += payment.amount;
        return {
          date: `${MONTHS[payment.month - 1]} ${payment.year}`,
          investment: cumulative,
        };
      });
      setChartData(growth);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchYearStatus = async () => {
      setStatusLoading(true);
      const { data: payments } = await supabase
        .from("payments")
        .select("month, status")
        .eq("user_id", user.id)
        .eq("year", selectedYear);

      const { startMonth: yearStart, endMonth: yearEnd } = getMonthRangeForYear(selectedYear);
      const statuses: Record<number, "paid" | "pending" | "unpaid"> = {};

      for (let month = yearStart; month <= yearEnd; month += 1) {
        const monthPayments = (payments || []).filter((payment) => payment.month === month);
        if (monthPayments.some((payment) => payment.status === "approved")) {
          statuses[month] = "paid";
        } else if (monthPayments.some((payment) => payment.status === "pending")) {
          statuses[month] = "pending";
        } else {
          statuses[month] = "unpaid";
        }
      }

      setMonthStatuses(statuses);
      setStatusLoading(false);
    };

    fetchYearStatus();
  }, [user, selectedYear]);

  const topCards = [
    {
      title: "Total Investment",
      value: `৳${stats.totalInvestment.toLocaleString()}`,
      tone: "border-emerald-200/80 bg-emerald-50/88 dark:border-emerald-500/20 dark:bg-emerald-500/10",
    },
    {
      title: "Total Shares",
      value: stats.totalShares,
      tone: "border-sky-200/80 bg-sky-50/88 dark:border-sky-500/20 dark:bg-sky-500/10",
    },
    {
      title: "Pending Payments",
      value: stats.pending,
      tone: "border-amber-200/80 bg-amber-50/88 dark:border-amber-500/20 dark:bg-amber-500/10",
    },
    {
      title: "Last Payment",
      value: stats.lastStatus || "No payments",
      tone: "border-rose-200/80 bg-rose-50/88 dark:border-rose-500/20 dark:bg-rose-500/10",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-card/90 p-5 shadow-sm dark:border-slate-800 md:p-6">
          <div className="mb-4 rounded-[20px] border border-border/70 bg-background/80 px-4 py-3 shadow-sm md:mb-5 md:px-5">
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="mt-3 h-7 w-52 rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-[18px] border border-border/70 px-4 py-3.5 shadow-sm">
                <Skeleton className="h-3 w-24 rounded-full" />
                <Skeleton className="mt-4 h-8 w-20 rounded-xl" />
              </div>
            ))}
          </div>
        </div>

        <Card className="border-0 bg-card/80 shadow-lg backdrop-blur">
          <CardHeader>
            <Skeleton className="h-6 w-40 rounded-xl" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full rounded-2xl" />
          </CardContent>
        </Card>

        <Card className="border-0 bg-card/80 shadow-lg backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <Skeleton className="h-6 w-36 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-card/80 shadow-lg backdrop-blur">
          <CardHeader>
            <Skeleton className="h-6 w-36 rounded-xl" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between rounded-lg border-b px-3 py-3 last:border-0">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32 rounded-lg" />
                    <Skeleton className="h-3 w-40 rounded-lg" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-16 rounded-lg" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2f7_62%,#e2f7ef_100%)] p-5 shadow-sm dark:border-slate-800 dark:bg-[linear-gradient(135deg,#0f172a_0%,#172033_58%,#123327_100%)] md:p-6">
        <div className="mb-4 rounded-[20px] border border-emerald-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(236,253,245,0.94))] px-4 py-3 shadow-sm backdrop-blur-sm dark:border-emerald-500/20 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.72),rgba(6,78,59,0.54))] md:mb-5 md:px-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-300">
            Welcome
          </p>
          <p className="mt-1 text-lg font-black tracking-tight text-emerald-950 dark:text-white md:text-xl">
            {memberName}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {topCards.map((card) => (
            <div
              key={card.title}
              className={`min-w-0 rounded-[18px] border px-4 py-3.5 shadow-sm backdrop-blur-sm ${card.tone}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300 md:text-[11px]">
                {card.title}
              </p>
              <p className="mt-3 text-[1.2rem] font-black leading-none tracking-tight text-slate-950 dark:text-white md:text-[1.55rem]">
                {card.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {chartData.length > 1 && (
        <Card className="border-0 bg-card/80 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Investment Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `৳${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                    }}
                    formatter={(value: number) => [`৳${value.toLocaleString()}`, "Total Investment"]}
                  />
                  <Line
                    activeDot={{ r: 6 }}
                    dataKey="investment"
                    dot={{ fill: "hsl(var(--primary))", r: 4, strokeWidth: 2 }}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    type="monotone"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 bg-card/80 shadow-lg backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarX className="h-5 w-5 text-destructive" />
            Payment Status
          </CardTitle>
          <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {Array.from({ length: Math.max(monthsToShow.length, 6) }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {monthsToShow.map(({ month, value }) => {
              const status = monthStatuses[value];
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
                  key={value}
                  className={`rounded-lg border p-3 text-center ${styles[status]} ${status === "unpaid" ? "cursor-pointer transition-all hover:ring-2 hover:ring-destructive/50" : ""}`}
                  onClick={status === "unpaid" ? () => navigate(`/submit-payment?month=${value}&year=${selectedYear}`) : undefined}
                  title={status === "unpaid" ? "Click to pay" : undefined}
                >
                  <p className="text-xs font-medium">{month}</p>
                  <p className={`mt-1 text-[11px] font-semibold ${textColors[status]}`}>{labels[status]}</p>
                </div>
              );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 bg-card/80 shadow-lg backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet. Submit your first payment!</p>
          ) : (
            <div className="space-y-3">
              {recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-lg border-b px-3 py-3 transition-colors hover:bg-muted/50 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {MONTHS[payment.month - 1]} {payment.year}
                      {payment.payment_type === "share" && payment.share_quantity && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({payment.share_quantity} {payment.share_quantity === 1 ? "share" : "shares"})
                        </span>
                      )}
                      {payment.payment_type === "custom" && (
                        <span className="ml-2 text-xs text-muted-foreground">(custom)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payment.payment_method === "mobile_banking" ? "Mobile Banking" : "Bank"} • TxID:{" "}
                      {payment.transaction_id || payment.extracted_transaction_id || "N/A"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">৳{payment.amount.toLocaleString()}</span>
                    <StatusBadge status={payment.status as "pending" | "approved" | "rejected"} />
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
