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
import { Search, AlertTriangle, UserX, CalendarX, Eye } from "lucide-react";
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

  // Determine which months to check for selected year
  const monthsToCheck = useMemo(() => {
    return getMonthOptionsForYear(year);
  }, [year]);

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
          .map((p) => p.month)
      );

      const missing: { month: number; year: number }[] = [];
      for (const m of monthsToCheck) {
        if (!approvedSet.has(m)) {
          missing.push({ month: m, year });
        }
      }

      if (missing.length > 0) {
        // Filter by selected month if set
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
      (m) =>
        m.profile.name.toLowerCase().includes(q) ||
        m.profile.email.toLowerCase().includes(q)
    );
  }, [pendingMembers, searchName]);

  // Sort by most missing months first
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.missingMonths.length - a.missingMonths.length),
    [filtered]
  );

  const years = getYearOptionsDesc();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pending Payments</h1>
        <p className="text-muted-foreground">
          Track members who haven't paid for specific months
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-destructive/10 to-destructive/5">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/15">
                <UserX className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sorted.length}</p>
                <p className="text-xs text-muted-foreground">Members with Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-orange-500/10 to-orange-500/5">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/15">
                <CalendarX className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {sorted.reduce((sum, m) => sum + m.missingMonths.length, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Total Missed Months</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/15">
                <AlertTriangle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  ৳{sorted.reduce((sum, m) => sum + m.totalPending, 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total Pending Amount</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[120px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="All Months" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {monthsToCheck.map((m) => (
              <SelectItem key={m} value={String(m)}>{MONTHS[m - 1]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search member..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="pl-9 h-9 w-[200px]"
          />
        </div>
      </div>

      {/* Table */}
      <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">
            Pending Members ({sorted.length})
          </CardTitle>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedMember(m)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    🎉 All members have paid for the selected period!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Member Detail Dialog */}
      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedMember?.profile.name || "Member"} — {selectedYear} Payment History
            </DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {selectedMember.profile.email}
              </div>

              {/* Month-by-month status */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {monthsToCheck.map((m) => {
                  const isPaid = !selectedMember.missingMonths.some((mm) => mm.month === m);
                  const payment = selectedMember.payments.find(
                    (p) => p.month === m && p.status === "approved"
                  );
                  const pendingPayment = selectedMember.payments.find(
                    (p) => p.month === m && p.status === "pending"
                  );

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
                      <p className="text-[10px] mt-1">
                        {isPaid ? (
                          <span className="text-emerald-600 font-semibold">Paid</span>
                        ) : pendingPayment ? (
                          <span className="text-yellow-600 font-semibold">Pending</span>
                        ) : (
                          <span className="text-destructive font-semibold">Not Paid</span>
                        )}
                      </p>
                      {payment && (
                        <p className="text-[10px] text-muted-foreground">
                          ৳{payment.amount.toLocaleString()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Payment history for the year */}
              {selectedMember.payments.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Payments in {selectedYear}</p>
                  <div className="space-y-2">
                    {selectedMember.payments
                      .sort((a, b) => a.month - b.month)
                      .map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2"
                        >
                          <div>
                            <span className="font-medium">
                              {MONTHS[p.month - 1]}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              ৳{p.amount.toLocaleString()}
                            </span>
                          </div>
                          <StatusBadge status={p.status as any} />
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Missing:</span>{" "}
                  <span className="font-semibold text-destructive">
                    {selectedMember.missingMonths.length} month(s)
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Pending Amount:</span>{" "}
                  <span className="font-semibold">
                    ৳{selectedMember.totalPending.toLocaleString()}
                  </span>
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
