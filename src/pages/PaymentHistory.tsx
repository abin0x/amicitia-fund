import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getMonthOptionsForYear, getYearOptionsDesc, isPeriodBeforeLaunch } from "@/lib/period";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PaymentHistory() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("payments")
      .select("*")
      .eq("user_id", user.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .then(({ data }) => setPayments(data || []))
      .finally(() => setLoading(false));
  }, [user]);

  const years = getYearOptionsDesc();
  const monthOptions = filterYear === "all"
    ? MONTH_NAMES.map((_, i) => i + 1)
    : getMonthOptionsForYear(parseInt(filterYear));

  useEffect(() => {
    if (filterMonth === "all") return;
    if (!monthOptions.includes(parseInt(filterMonth))) {
      setFilterMonth("all");
    }
  }, [filterMonth, monthOptions]);

  const filtered = payments.filter((p) => {
    if (isPeriodBeforeLaunch(p.year, p.month)) return false;
    if (filterMonth !== "all" && p.month !== parseInt(filterMonth)) return false;
    if (filterYear !== "all" && p.year !== parseInt(filterYear)) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>

        <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
          <CardHeader>
            <Skeleton className="h-6 w-40 rounded-xl" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="grid grid-cols-7 gap-3">
                  {Array.from({ length: 7 }).map((__, cellIndex) => (
                    <Skeleton key={cellIndex} className="h-10 w-full rounded-lg" />
                  ))}
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
      <div className="grid grid-cols-2 gap-3">
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Month" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {monthOptions.map((m) => (
              <SelectItem key={m} value={String(m)}>{MONTH_NAMES[m - 1]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">All Payments ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No payments found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{MONTHS[p.month - 1]} {p.year}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {p.payment_type || "share"}{p.share_quantity ? ` (${p.share_quantity})` : ""}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {p.payment_method === "mobile_banking" ? "Mobile" : "Bank"}
                      </Badge>
                    </TableCell>
                    <TableCell>৳{p.amount.toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.transaction_id || p.extracted_transaction_id || "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={p.status as any} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(p.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
