import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  Copy,
} from "lucide-react";
import { clampToValidPeriod, getMonthOptionsForYear, getYearOptionsDesc, isPeriodAfterNow, isPeriodBeforeLaunch } from "@/lib/period";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function StepHeader({ step, title }: { step: number; title: string }) {
  return (
    <CardHeader className="pb-4">
      <CardTitle className="flex items-center gap-3 text-sm font-semibold text-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-primary text-xs font-bold text-primary-foreground shadow-sm">
          {step}
        </span>
        <span>{title}</span>
      </CardTitle>
    </CardHeader>
  );
}

function DetailRow({ label, value, copyable = false }: { label: string; value: string; copyable?: boolean }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex max-w-[68%] items-center justify-end gap-2">
        <p className="text-right text-sm font-medium text-foreground break-all">{value}</p>
        {copyable && (
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Copy ${label}`}
            title={`Copy ${label}`}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function SubmitPayment() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const now = new Date();
  const initialMonth = parseInt(searchParams.get("month") || String(now.getMonth() + 1));
  const initialYear = parseInt(searchParams.get("year") || String(now.getFullYear()));
  const initialPeriod = clampToValidPeriod(initialYear, initialMonth, now);
  const [month, setMonth] = useState(String(initialPeriod.month));
  const [year, setYear] = useState(String(initialPeriod.year));
  const [paymentType, setPaymentType] = useState<"share" | "custom">("share");
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "mobile_banking">("bank");
  const [shareQuantity, setShareQuantity] = useState(1);
  const [customAmount, setCustomAmount] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [sharePrice, setSharePrice] = useState(4000);
  const [customEnabled, setCustomEnabled] = useState(true);
  const [minCustom, setMinCustom] = useState(1000);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from("admin_settings").select("key, value");
      if (data) {
        for (const s of data) {
          if (s.key === "share_price") setSharePrice(parseInt(s.value));
          if (s.key === "custom_payment_enabled") setCustomEnabled(s.value === "true");
          if (s.key === "min_custom_amount") setMinCustom(parseInt(s.value));
        }
      }
    };
    fetchSettings();
  }, []);

  const totalAmount = paymentType === "share"
    ? shareQuantity * sharePrice
    : parseInt(customAmount) || 0;

  const checkDuplicate = async (txId: string) => {
    if (!txId || txId.length < 4) { setDuplicateError(null); return false; }
    setCheckingDuplicate(true);
    const { data } = await supabase
      .from("payments")
      .select("id, status")
      .or(`transaction_id.eq.${txId},extracted_transaction_id.eq.${txId}`)
      .limit(1);
    setCheckingDuplicate(false);
    if (data && data.length > 0) {
      const status = data[0].status;
      const msg = status === "approved"
        ? "This Transaction ID has already been used for an approved payment."
        : status === "pending"
          ? "A payment with this Transaction ID has already been submitted."
          : "This Transaction ID has been used before.";
      setDuplicateError(msg);
      return true;
    }
    setDuplicateError(null);
    return false;
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (transactionId.trim().length >= 4) checkDuplicate(transactionId.trim());
      else setDuplicateError(null);
    }, 500);
    return () => clearTimeout(timer);
  }, [transactionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (paymentType === "custom" && totalAmount < minCustom) {
      toast.error(`Custom payment must be at least ৳${minCustom.toLocaleString()}`);
      return;
    }
    if (totalAmount <= 0) { toast.error("Amount must be greater than 0"); return; }

    const txId = transactionId.trim();
    if (!txId) { toast.error("Please enter your Transaction ID"); return; }
    if (isPeriodBeforeLaunch(parseInt(year), parseInt(month))) {
      toast.error("Payment period cannot be earlier than November 2025.");
      return;
    }
    if (isPeriodAfterNow(parseInt(year), parseInt(month), now)) {
      toast.error("Payment period cannot be in the future.");
      return;
    }

    const { data: existingMonthPayment } = await supabase
      .from("payments")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("month", parseInt(month))
      .eq("year", parseInt(year))
      .in("status", ["approved", "pending"])
      .limit(1);

    if (existingMonthPayment && existingMonthPayment.length > 0) {
      const s = existingMonthPayment[0].status;
      toast.error(s === "approved"
        ? `Payment for ${MONTHS[parseInt(month) - 1]} ${year} has already been approved.`
        : `A payment for ${MONTHS[parseInt(month) - 1]} ${year} has already been submitted.`);
      return;
    }

    const isDuplicate = await checkDuplicate(txId);
    if (isDuplicate) { toast.error("Duplicate Transaction ID!"); return; }

    setSubmitting(true);

    const { error } = await supabase.from("payments").insert({
      user_id: user.id,
      amount: totalAmount,
      month: parseInt(month),
      year: parseInt(year),
      transaction_id: txId,
      share_quantity: paymentType === "share" ? shareQuantity : null,
      share_price: paymentType === "share" ? sharePrice : null,
      payment_type: paymentType,
      payment_method: paymentMethod,
    });

    if (error) {
      if (error.code === "23505") toast.error("Payment for this month has already been made.");
      else toast.error(error.message);
    } else {
      toast.success("Payment submitted successfully!");
      const { data: insertedPayments } = await supabase
        .from("payments").select("id").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(1);
      if (insertedPayments?.[0]) {
        supabase.functions.invoke("send-email", {
          body: { type: "submission", paymentId: insertedPayments[0].id },
        }).catch(() => {});
      }
      setTransactionId("");
      setShareQuantity(1);
      setCustomAmount("");
      setDuplicateError(null);
    }
    setSubmitting(false);
  };

  const years = getYearOptionsDesc();
  const monthOptions = getMonthOptionsForYear(parseInt(year));

  useEffect(() => {
    if (!monthOptions.includes(parseInt(month))) {
      setMonth(String(monthOptions[0] ?? new Date().getMonth() + 1));
    }
  }, [year, month, monthOptions]);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="overflow-hidden rounded-[28px] border border-border/70 bg-card/90 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
          <StepHeader step={1} title="Payment Type & Amount" />
          <CardContent className="space-y-4 pt-0">
            <RadioGroup
              value={paymentType}
              onValueChange={(v) => setPaymentType(v as "share" | "custom")}
              className="grid grid-cols-2 gap-3"
            >
              <label
                htmlFor="share"
                className={`rounded-[16px] border px-3 py-2.5 transition-all ${paymentType === "share" ? "border-primary bg-primary/5 shadow-sm" : "border-border/70 bg-background/70"}`}
              >
                <div className="flex items-center gap-2.5">
                  <RadioGroupItem value="share" id="share" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-5 text-foreground">Buy Shares</p>
                  </div>
                </div>
              </label>

              {customEnabled && (
                <label
                  htmlFor="custom"
                  className={`rounded-[16px] border px-3 py-2.5 transition-all ${paymentType === "custom" ? "border-primary bg-primary/5 shadow-sm" : "border-border/70 bg-background/70"}`}
                >
                  <div className="flex items-center gap-2.5">
                    <RadioGroupItem value="custom" id="custom" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-5 text-foreground">Custom Amount</p>
                    </div>
                  </div>
                </label>
              )}
            </RadioGroup>

            {paymentType === "share" ? (
              <div className="space-y-4 rounded-[24px] border border-border/60 bg-muted/30 p-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Number of Shares (৳{sharePrice.toLocaleString()} each)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={shareQuantity === 0 ? "" : shareQuantity}
                    onChange={(e) => {
                      const v = e.target.value;
                      setShareQuantity(v === "" ? 0 : Math.max(1, parseInt(v) || 0));
                    }}
                    onBlur={() => {
                      if (shareQuantity < 1) setShareQuantity(1);
                    }}
                    className="h-12 rounded-2xl border-border/70 bg-background/90 text-base font-semibold"
                  />
                </div>

                <div className="rounded-[22px] border border-primary/15 bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Amount</p>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <p className="text-2xl font-extrabold tracking-tight text-primary">৳{totalAmount.toLocaleString()}</p>
                    <span className="rounded-full border border-border/60 bg-card/90 px-2.5 py-1 text-[11px] font-medium text-primary shadow-sm">
                      {shareQuantity} {shareQuantity === 1 ? "share" : "shares"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 rounded-[24px] border border-border/60 bg-muted/30 p-4">
                <Label className="text-xs font-medium text-muted-foreground">
                  Amount (minimum ৳{minCustom.toLocaleString()})
                </Label>
                <Input
                  type="number"
                  min={minCustom}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={`৳${minCustom.toLocaleString()}`}
                  className="h-12 rounded-2xl border-border/70 bg-background/90 text-base font-semibold"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[28px] border border-border/70 bg-card/90 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
          <StepHeader step={2} title="Payment Method" />
          <CardContent className="space-y-4 pt-0">
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as "bank" | "mobile_banking")}
              className="grid grid-cols-2 gap-3"
            >
              <label
                htmlFor="bank"
                className={`rounded-2xl border p-4 transition-all ${paymentMethod === "bank" ? "border-primary bg-primary/5 shadow-sm" : "border-border/70 bg-background/70"}`}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="bank" id="bank" className="mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Bank</p>
                  </div>
                </div>
              </label>

              <label
                htmlFor="mobile_banking"
                className={`rounded-2xl border p-4 transition-all ${paymentMethod === "mobile_banking" ? "border-primary bg-primary/5 shadow-sm" : "border-border/70 bg-background/70"}`}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="mobile_banking" id="mobile_banking" className="mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Mobile Banking</p>
                  </div>
                </div>
              </label>
            </RadioGroup>

            <div className="rounded-2xl border border-border/70 bg-muted/35 px-4 py-3">
              <p className="mb-2 text-sm font-semibold text-foreground">
                {paymentMethod === "bank" ? "Bank Account Details" : "Mobile Banking Details"}
              </p>

              {paymentMethod === "bank" ? (
                <div className="divide-y divide-border/60">
                  <DetailRow label="Savings A/C No" value="37070311184340" copyable />
                  <DetailRow label="Name" value="AMICITIA" />
                  <DetailRow label="Bank" value="Bangladesh Krishi Bank" />
                  <DetailRow label="Branch" value="Bishwamvarpur Branch" />
                  <DetailRow label="Routing No" value="03590019" />
                  <DetailRow label="Swift Code" value="BKBABDDH" />
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  <DetailRow label="bKash" value="01714769344" copyable />
                  <DetailRow label="Type" value="Send Money / Payment" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[28px] border border-border/70 bg-card/90 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
          <StepHeader step={3} title="Period & Transaction Proof" />
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  Month
                </Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="h-12 rounded-2xl border-border/70 bg-background/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((m) => (
                      <SelectItem key={m} value={String(m)}>{MONTHS[m - 1]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  Year
                </Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="h-12 rounded-2xl border-border/70 bg-background/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Transaction ID *</Label>
              <div className="relative">
                <Input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="Enter your Transaction ID"
                  className={`h-12 rounded-2xl border-border/70 bg-background/80 pr-10 ${duplicateError ? "border-destructive" : ""}`}
                />
                {checkingDuplicate && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
                {!checkingDuplicate && transactionId.trim().length >= 4 && !duplicateError && (
                  <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success" />
                )}
              </div>
            </div>

            {duplicateError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{duplicateError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="h-12 w-full rounded-2xl text-base font-semibold shadow-lg hover:shadow-xl"
          disabled={submitting || !!duplicateError || checkingDuplicate}
        >
          {submitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
          ) : (
            `Submit Payment - ৳${totalAmount.toLocaleString()}`
          )}
        </Button>
      </form>
    </div>
  );
}
