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
import { Loader2, TrendingUp, Building2, Smartphone, AlertTriangle, CheckCircle2, Receipt, CalendarDays, Banknote } from "lucide-react";
import { clampToValidPeriod, getMonthOptionsForYear, getYearOptionsDesc, isPeriodAfterNow, isPeriodBeforeLaunch } from "@/lib/period";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

  // Duplicate check
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

    // Check existing month payment
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

    // Final duplicate check
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
      toast.success("Payment submitted successfully! 🎉");
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
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" />
          Submit Payment
        </h1>
        <p className="text-muted-foreground text-sm">Purchase shares or make a custom contribution</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1: Payment Type */}
        <Card className="shadow-md border-0 bg-card/90 backdrop-blur overflow-hidden">
          <CardHeader className="pb-3 bg-primary/5 border-b border-primary/10">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
              Payment Type & Amount
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <RadioGroup
              value={paymentType}
              onValueChange={(v) => setPaymentType(v as "share" | "custom")}
              className="flex gap-3"
            >
              <label htmlFor="share" className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentType === "share" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                <RadioGroupItem value="share" id="share" />
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Buy Shares</span>
              </label>
              {customEnabled && (
                <label htmlFor="custom" className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentType === "custom" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                  <RadioGroupItem value="custom" id="custom" />
                  <Banknote className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Custom Amount</span>
                </label>
              )}
            </RadioGroup>

            {paymentType === "share" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Number of Shares (৳{sharePrice.toLocaleString()} each)</Label>
                  <Input
                    type="number" min={1}
                    value={shareQuantity === 0 ? "" : shareQuantity}
                    onChange={(e) => { const v = e.target.value; setShareQuantity(v === "" ? 0 : Math.max(1, parseInt(v) || 0)); }}
                    onBlur={() => { if (shareQuantity < 1) setShareQuantity(1); }}
                  />
                </div>
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
                  <span className="text-xl font-bold text-primary">৳{totalAmount.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Amount (minimum ৳{minCustom.toLocaleString()})</Label>
                <Input type="number" min={minCustom} value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} placeholder={`৳${minCustom.toLocaleString()}`} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Payment Method */}
        <Card className="shadow-md border-0 bg-card/90 backdrop-blur overflow-hidden">
          <CardHeader className="pb-3 bg-primary/5 border-b border-primary/10">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">2</span>
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as "bank" | "mobile_banking")}
              className="grid grid-cols-2 gap-3"
            >
              <label htmlFor="bank" className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === "bank" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                <RadioGroupItem value="bank" id="bank" />
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Bank</span>
              </label>
              <label htmlFor="mobile_banking" className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === "mobile_banking" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                <RadioGroupItem value="mobile_banking" id="mobile_banking" />
                <Smartphone className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Mobile Banking</span>
              </label>
            </RadioGroup>

            <div className="bg-muted/50 rounded-xl p-3 space-y-1">
              {paymentMethod === "bank" ? (
                <>
                  <p className="text-xs font-semibold flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-primary" /> Bank Account Details</p>
                  <p className="text-xs text-muted-foreground">Savings A/C No: <span className="font-medium text-foreground">3707031118434০</span></p>
                  <p className="text-xs text-muted-foreground">Name: <span className="font-medium text-foreground">AMICITIA</span></p>
                  <p className="text-xs text-muted-foreground">Bank: <span className="font-medium text-foreground">Bangladesh Krishi Bank</span></p>
                  <p className="text-xs text-muted-foreground">Branch: <span className="font-medium text-foreground">Bishwamvarpur Branch</span></p>
                  <p className="text-xs text-muted-foreground">Routing No: <span className="font-medium text-foreground">03590019</span></p>
                  <p className="text-xs text-muted-foreground">Swift Code: <span className="font-medium text-foreground">BKBABDDH</span></p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5 text-primary" /> Mobile Banking Details</p>
                  <p className="text-xs text-muted-foreground">bKash: <span className="font-medium text-foreground">01714769344</span></p>
                  <p className="text-xs text-muted-foreground">Type: <span className="font-medium text-foreground">Send Money / Payment</span></p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Period & Transaction Proof */}
        <Card className="shadow-md border-0 bg-card/90 backdrop-blur overflow-hidden">
          <CardHeader className="pb-3 bg-primary/5 border-b border-primary/10">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">3</span>
              Period & Transaction Proof
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((m) => <SelectItem key={m} value={String(m)}>{MONTHS[m - 1]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Transaction ID */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Transaction ID *</Label>
              <div className="relative">
                <Input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="Enter your Transaction ID"
                  className={duplicateError ? "border-destructive pr-10" : "pr-10"}
                />
                {checkingDuplicate && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                {!checkingDuplicate && transactionId.trim().length >= 4 && !duplicateError && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
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
          className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all rounded-xl"
          disabled={submitting || !!duplicateError || checkingDuplicate}
        >
          {submitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
          ) : (
            `Submit Payment — ৳${totalAmount.toLocaleString()}`
          )}
        </Button>
      </form>
    </div>
  );
}
