import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { getMonthOptionsForYear, getYearOptionsDesc, isPeriodBeforeLaunch } from "@/lib/period";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type MemberPayment = {
  name: string;
  mobile: string;
  month: number;
  year: number;
  status: string;
  amount: number;
  share: number | null;
};

export default function TransparencyPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<MemberPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const years = getYearOptionsDesc(now);
  const monthOptions = selectedYear === "all"
    ? MONTHS.map((_, i) => i + 1)
    : getMonthOptionsForYear(parseInt(selectedYear), now);

  useEffect(() => {
    if (selectedMonth === "all") return;
    if (!monthOptions.includes(parseInt(selectedMonth))) {
      setSelectedMonth("all");
    }
  }, [selectedMonth, monthOptions]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      let query = supabase.from("payments").select("user_id, month, year, status, amount, share_quantity");

      if (selectedMonth !== "all") query = query.eq("month", parseInt(selectedMonth));
      if (selectedYear !== "all") query = query.eq("year", parseInt(selectedYear));

      const { data: payments } = await query;

      if (!payments || payments.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(payments.map((p) => p.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, mobile_number").in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      const result: MemberPayment[] = payments
        .map((p) => ({
          name: (profileMap.get(p.user_id) as any)?.name || "Unknown",
          mobile: (profileMap.get(p.user_id) as any)?.mobile_number || "-",
          month: p.month,
          year: p.year,
          status: p.status,
          amount: p.amount,
          share: p.share_quantity,
        }))
        .filter((p) => !isPeriodBeforeLaunch(p.year, p.month));

      const order: Record<string, number> = { approved: 0, pending: 1, rejected: 2 };
      result.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || a.name.localeCompare(b.name));

      setData(result);
      setLoading(false);
    };
    fetchData();
  }, [selectedMonth, selectedYear]);

  const statusIcon = (s: string) => {
    if (s === "approved") return <CheckCircle className="h-3.5 w-3.5 text-success" />;
    if (s === "pending") return <Clock className="h-3.5 w-3.5 text-warning" />;
    return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  };

  const statusStyle = (s: string) => {
    if (s === "approved") return "bg-success/10 text-success border-success/20";
    if (s === "pending") return "bg-warning/10 text-warning-foreground border-warning/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  const statusLabel = (s: string) => {
    if (s === "approved") return "Approved";
    if (s === "pending") return "Pending";
    return "Rejected";
  };

  const approvedCount = data.filter((d) => d.status === "approved").length;
  const pendingCount = data.filter((d) => d.status === "pending").length;
  const totalAmount = data.filter((d) => d.status === "approved").reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {monthOptions.map((m) => <SelectItem key={m} value={String(m)}>{MONTHS[m - 1]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm bg-success/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{approvedCount}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-warning/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-warning-foreground">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-primary/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">৳{totalAmount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Collected</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-0 bg-card/90 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Member Payments ({data.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No payments found for this period</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-background">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[64px]">#</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-center">Share</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((d, i) => (
                    <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-muted-foreground font-medium">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {d.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{d.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.mobile}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {MONTHS[d.month - 1]} {d.year}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {d.share ?? "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">৳{d.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={`text-xs gap-1 ${statusStyle(d.status)}`}>
                          {statusIcon(d.status)}
                          {statusLabel(d.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
