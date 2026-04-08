import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, AlertTriangle, Eye } from "lucide-react";
import { getMonthOptionsForYear, getYearOptionsDesc } from "@/lib/period";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Profile = {
  user_id: string;
  name: string;
  email: string;
};

type Payment = {
  id: string;
  user_id: string;
  month: number;
  year: number;
  amount: number;
  status: string;
  payment_method: string | null;
  payment_type: string | null;
  share_quantity: number | null;
  transaction_id: string | null;
  created_at: string;
};

type MemberPending = {
  profile: Profile;
  missingMonths: { month: number; year: number }[];
  totalPending: number;
  payments: Payment[];
};

export default function AdminPendingPayments() {
  const now = new Date();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sharePrice, setSharePrice] = useState(4000);
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [searchName, setSearchName] = useState("");
  const [selectedMember, setSelectedMember] = useState<MemberPending | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: profilesData }, { data: paymentsData }, { data: settings }] = await Promise.all([
        supabase.from("profiles").select("user_id, name, email"),
        supabase.from("payments").select("id, user_id, month, year, amount, status, payment_method, payment_type, share_quantity, transaction_id, created_at"),
        supabase.from("admin_settings").select("key, value"),
      ]);
      setProfiles(profilesData || []);
      setPayments(paymentsData || []);
      const sp = settings?.find((s) => s.key === "share_price");
      if (sp) setSharePrice(parseInt(sp.value));
      setLoading(false);
    };
    fetchData();
  }, []);

  const year = parseInt(selectedYear);

  const monthsToCheck = useMemo(() => getMonthOptionsForYear(year), [year]);

  useEffect(() => {
    if (filterMonth === "all") return;
    if (!monthsToCheck.includes(parseInt(filterMonth))) {
      setFilterMonth("all");
    }
  }, [filterMonth, monthsToCheck]);

  const pendingMembers = useMemo(() => {
    const result: MemberPending[] = [];

    for (const profile of profiles) {
      const memberPayments = payments.filter((p) => p.user_id === profile.user_id);
      const approvedSet = new Set(
        memberPayments
          .filter((p) => p.status === "approved" && p.year === year)
          .map((p) => p.month),
      );

      const missing: { month: number; year: number }[] = [];
      for (const m of monthsToCheck) {
        if (!approvedSet.has(m)) {
          missing.push({ month: m, year });
        }
      }

      if (missing.length > 0) {
        const filteredMissing =
          filterMonth === "all"
            ? missing
            : missing.filter((m) => m.month === parseInt(filterMonth));

        if (filteredMissing.length > 0) {
          result.push({
            profile,
            missingMonths: filteredMissing,
            totalPending: filteredMissing.length * sharePrice,
            payments: memberPayments.filter((p) => p.year === year),
          });
        }
      }
    }

    return result;
  }, [profiles, payments, year, monthsToCheck, filterMonth, sharePrice]);

  const filtered = useMemo(() => {
    if (!searchName) return pendingMembers;
    const q = searchName.toLowerCase();
    return pendingMembers.filter(
      (m) => m.profile.name.toLowerCase().includes(q) || m.profile.email.toLowerCase().includes(q),
    );
  }, [pendingMembers, searchName]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.missingMonths.length - a.missingMonths.length),
    [filtered],
  );

  const years = getYearOptionsDesc();
  const totalMissedMonths = sorted.reduce((sum, m) => sum + m.missingMonths.length, 0);
  const totalPendingAmount = sorted.reduce((sum, m) => sum + m.totalPending, 0);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="overflow-hidden rounded-[28px] border border-destructive/15 bg-[linear-gradient(135deg,hsla(var(--destructive),0.14),hsla(var(--card),0.96)_45%,rgba(249,115,22,0.08))] px-5 py-5 shadow-[0_18px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl dark:border-destructive/20 dark:bg-[linear-gradient(135deg,rgba(220,38,38,0.16),rgba(20,28,48,0.96)_46%,rgba(249,115,22,0.10))]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Total Pending Amount</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">৳{totalPendingAmount.toLocaleString()}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-destructive/12 bg-card/90 text-destructive shadow-sm dark:border-destructive/20 dark:bg-destructive/10">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-border/70 bg-card/88 p-4 shadow-[0_16px_38px_rgba(16,24,40,0.08)] backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[16px] border border-destructive/10 bg-destructive/5 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Members with Pending</p>
              <p className="mt-1 text-lg font-extrabold leading-6 text-foreground">{sorted.length}</p>
            </div>
            <div className="rounded-[16px] border border-orange-500/10 bg-orange-500/5 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Total Missed Months</p>
              <p className="mt-1 text-lg font-extrabold leading-6 text-foreground">{totalMissedMonths}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-border/70 bg-card/88 p-4 shadow-[0_16px_38px_rgba(16,24,40,0.08)] backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[120px_160px_minmax(0,1fr)]">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-muted/25 px-4">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-muted/25 px-4">
              <SelectValue placeholder="All Months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {monthsToCheck.map((m) => (
                <SelectItem key={m} value={String(m)}>{MONTHS[m - 1]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative col-span-2 md:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search member..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="h-11 rounded-2xl border-border/70 bg-muted/25 pl-9"
            />
          </div>
        </div>
      </div>

      <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Pending Members ({sorted.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Missed Months</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Pending Amount</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((m) => (
                <TableRow key={m.profile.user_id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{m.profile.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{m.profile.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {m.missingMonths.map((mm) => (
                        <Badge
                          key={`${mm.month}-${mm.year}`}
                          variant="destructive"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {MONTHS[mm.month - 1].slice(0, 3)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-destructive border-destructive/30">
                      {m.missingMonths.length} month{m.missingMonths.length > 1 ? "s" : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-destructive">
                    ৳{m.totalPending.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedMember(m)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    All members have paid for the selected period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedMember?.profile.name || "Member"} - {selectedYear} Payment History
            </DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">{selectedMember.profile.email}</div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {monthsToCheck.map((m) => {
                  const isPaid = !selectedMember.missingMonths.some((mm) => mm.month === m);
                  const payment = selectedMember.payments.find((p) => p.month === m && p.status === "approved");
                  const pendingPayment = selectedMember.payments.find((p) => p.month === m && p.status === "pending");

                  return (
                    <div
                      key={m}
                      className={`rounded-lg p-3 text-center border ${
                        isPaid
                          ? "bg-emerald-500/10 border-emerald-500/20"
                          : pendingPayment
                            ? "bg-yellow-500/10 border-yellow-500/20"
                            : "bg-destructive/10 border-destructive/20"
                      }`}
                    >
                      <p className="text-xs font-medium">{MONTHS[m - 1].slice(0, 3)}</p>
                      <p className="mt-1 text-[10px]">
                        {isPaid ? (
                          <span className="text-emerald-600 font-semibold">Paid</span>
                        ) : pendingPayment ? (
                          <span className="text-yellow-600 font-semibold">Pending</span>
                        ) : (
                          <span className="text-destructive font-semibold">Not Paid</span>
                        )}
                      </p>
                      {payment && (
                        <p className="text-[10px] text-muted-foreground">৳{payment.amount.toLocaleString()}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedMember.payments.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Payments in {selectedYear}</p>
                  <div className="space-y-2">
                    {selectedMember.payments
                      .sort((a, b) => a.month - b.month)
                      .map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm"
                        >
                          <div>
                            <span className="font-medium">{MONTHS[p.month - 1]}</span>
                            <span className="ml-2 text-muted-foreground">৳{p.amount.toLocaleString()}</span>
                          </div>
                          <StatusBadge status={p.status as any} />
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Missing:</span>{" "}
                  <span className="font-semibold text-destructive">
                    {selectedMember.missingMonths.length} month(s)
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Pending Amount:</span>{" "}
                  <span className="font-semibold">৳{selectedMember.totalPending.toLocaleString()}</span>
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
