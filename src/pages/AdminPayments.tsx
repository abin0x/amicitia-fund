import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, Eye, Search } from "lucide-react";
import { getMonthOptionsForYear, getYearOptionsDesc, isPeriodBeforeLaunch } from "@/lib/period";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Payment = {
  id: string;
  user_id: string;
  amount: number;
  transaction_id: string | null;
  extracted_transaction_id: string | null;
  screenshot_url: string | null;
  month: number;
  year: number;
  status: string;
  created_at: string;
  verified_at: string | null;
  share_quantity: number | null;
  share_price: number | null;
  payment_type: string | null;
  payment_method: string | null;
  admin_note: string | null;
  profiles?: { name: string; email: string } | null;
};

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [editTxId, setEditTxId] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [methodFilter, setMethodFilter] = useState<"all" | "bank" | "mobile_banking">("all");
  const [monthFilter, setMonthFilter] = useState<string>(String(new Date().getMonth() + 1));
  const [yearFilter, setYearFilter] = useState<string>(String(new Date().getFullYear()));
  const [searchName, setSearchName] = useState("");
  const [viewImage, setViewImage] = useState<string | null>(null);

  const fetchPayments = async () => {
    const { data } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(p => p.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, email").in("user_id", userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      setPayments(data.map(p => ({ ...p, profiles: profileMap.get(p.user_id) || null })) as Payment[]);
      return;
    }
    setPayments((data as Payment[]) || []);
  };

  useEffect(() => { fetchPayments(); }, []);

  const handleAction = async (id: string, status: "approved" | "rejected" | "pending") => {
    const updateData: Record<string, unknown> = {
      status, verified_at: new Date().toISOString(), admin_note: adminNote.trim() || null,
    };
    if (editTxId.trim()) updateData.transaction_id = editTxId.trim();

    const { error } = await supabase.from("payments").update(updateData).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Payment ${status}`);

      // Send email notification (fire and forget)
      supabase.functions.invoke("send-email", {
        body: { type: status, paymentId: id, adminNote: adminNote.trim() || undefined },
      }).catch(() => {});

      setSelected(null);
      setAdminNote("");
      fetchPayments();
    }
  };

  const now = new Date();
  const yearOptions = getYearOptionsDesc(now);
  const monthOptions = yearFilter === "all"
    ? MONTHS.map((_, i) => i + 1)
    : getMonthOptionsForYear(Number(yearFilter), now);

  useEffect(() => {
    if (monthFilter === "all") return;
    if (!monthOptions.includes(Number(monthFilter))) {
      setMonthFilter("all");
    }
  }, [monthFilter, monthOptions]);

  const filtered = payments.filter((p) => {
    if (isPeriodBeforeLaunch(p.year, p.month)) return false;
    if (filter !== "all" && p.status !== filter) return false;
    if (methodFilter !== "all" && p.payment_method !== methodFilter) return false;
    if (monthFilter !== "all" && p.month !== Number(monthFilter)) return false;
    if (yearFilter !== "all" && p.year !== Number(yearFilter)) return false;
    if (searchName && !p.profiles?.name?.toLowerCase().includes(searchName.toLowerCase()) && !p.profiles?.email?.toLowerCase().includes(searchName.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manage Payments</h1>
        <p className="text-muted-foreground">Review and approve member payments</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex gap-2">
          {(["all", "pending", "approved", "rejected"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">{f}</Button>
          ))}
        </div>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {monthOptions.map((m) => (
              <SelectItem key={m} value={String(m)}>{MONTHS[m - 1]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {yearOptions.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={(v) => setMethodFilter(v as any)}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Method" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="bank">Bank</SelectItem>
            <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
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

      <Card className="shadow-lg border-0 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Payments ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Transaction ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{p.profiles?.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{p.profiles?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{MONTHS[p.month - 1]} {p.year}</TableCell>
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
                    {p.transaction_id || "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={p.status as any} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setSelected(p);
                      setEditTxId(p.transaction_id || p.extracted_transaction_id || "");
                      setAdminNote(p.admin_note || "");
                    }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No payments found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setAdminNote(""); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Payment Details</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Member</p><p className="font-medium">{selected.profiles?.name || "—"}</p></div>
                <div><p className="text-muted-foreground">Email</p><p className="font-medium">{selected.profiles?.email}</p></div>
                <div><p className="text-muted-foreground">Period</p><p className="font-medium">{MONTHS[selected.month - 1]} {selected.year}</p></div>
                <div><p className="text-muted-foreground">Amount</p><p className="font-medium">৳{selected.amount.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Type</p><p className="font-medium capitalize">{selected.payment_type || "share"}</p></div>
                <div><p className="text-muted-foreground">Method</p><p className="font-medium">{selected.payment_method === "mobile_banking" ? "Mobile Banking" : "Bank Transfer"}</p></div>
                {selected.share_quantity && (
                  <div><p className="text-muted-foreground">Shares</p><p className="font-medium">{selected.share_quantity} × ৳{(selected.share_price || 4000).toLocaleString()}</p></div>
                )}
                <div><p className="text-muted-foreground">Transaction ID</p><p className="font-mono text-xs">{selected.transaction_id || "—"}</p></div>
                <div><p className="text-muted-foreground">Status</p><StatusBadge status={selected.status as any} /></div>
                {selected.verified_at && <div><p className="text-muted-foreground">Verified</p><p className="text-xs">{new Date(selected.verified_at).toLocaleString()}</p></div>}
              </div>
              {selected.screenshot_url && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Screenshot</p>
                  <a href={selected.screenshot_url} target="_blank" rel="noopener noreferrer">
                    <img src={selected.screenshot_url} alt="Payment screenshot" className="rounded-lg border w-full cursor-zoom-in hover:opacity-90 transition-opacity" />
                  </a>
                  <p className="text-xs text-muted-foreground mt-1 text-center">Click to view full size</p>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Edit Transaction ID (optional)</Label>
                <Input value={editTxId} onChange={(e) => setEditTxId(e.target.value)} placeholder="Transaction ID" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Admin Note (optional)</Label>
                <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Reason for rejection or notes..." rows={2} />
              </div>
              {selected.admin_note && selected.admin_note !== adminNote && (
                <p className="text-xs text-muted-foreground">Previous note: {selected.admin_note}</p>
              )}
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => handleAction(selected.id, "approved")} disabled={selected.status === "approved"}>
                  <CheckCircle className="mr-2 h-4 w-4" /> Approve
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => handleAction(selected.id, "pending" as any)} disabled={selected.status === "pending"}>
                  Pending
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleAction(selected.id, "rejected")} disabled={selected.status === "rejected"}>
                  <XCircle className="mr-2 h-4 w-4" /> Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full image viewer */}
      <Dialog open={!!viewImage} onOpenChange={() => setViewImage(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] p-2">
          <DialogHeader><DialogTitle>Screenshot</DialogTitle></DialogHeader>
          {viewImage && <img src={viewImage} alt="Payment screenshot" className="w-full h-auto rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
