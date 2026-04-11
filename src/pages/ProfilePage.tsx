import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ThemeToggle from "@/components/ThemeToggle";
import { COLOR_THEMES, FONT_SCALES, getStoredAppearance, updateAppearanceSettings, type ColorTheme, type FontScale } from "@/lib/appearance";
import { toast } from "sonner";
import { CalendarDays, FileDown, FileText, Loader2, LogOut, Pencil, RotateCcw, UserRound } from "lucide-react";
import { format, subDays, subMonths } from "date-fns";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Badge } from "@/components/ui/badge";
import { getSafeReportFileName, isNativePlatform, saveBlobToNativeDownloads, triggerBrowserDownload } from "@/lib/report-export";

type ReportPreset =
  | "custom"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "last_30_days"
  | "approved_only"
  | "pending_only"
  | "share_only"
  | "custom_only";

type PaymentStatusFilter = "all" | "approved" | "pending" | "rejected";
type PaymentTypeFilter = "all" | "share" | "custom";
type PaymentMethodFilter = "all" | "bank" | "mobile_banking";

type PaymentRecord = {
  id: string;
  amount: number;
  month: number;
  year: number;
  status: "approved" | "pending" | "rejected";
  created_at: string;
  payment_method: "bank" | "mobile_banking" | null;
  payment_type: "share" | "custom" | null;
  share_quantity: number | null;
};

type ReportSummary = {
  title: string;
  totalAmount: number;
  approved: number;
  pending: number;
  rejected: number;
  shares: number;
  payments: PaymentRecord[];
};

const toDateInputValue = (date: Date) => format(date, "yyyy-MM-dd");
const startOfDay = (value: string) => new Date(`${value}T00:00:00`);
const endOfDay = (value: string) => new Date(`${value}T23:59:59`);
const REPORT_PDF_LOGO_SRC = `${window.location.origin}/Download/Whisk_a465b97bea474818dec4581bfbfd66d8dr-removebg-preview.png`;

const getReportPdfLogoDataUrl = async () => {
  try {
    const response = await fetch(REPORT_PDF_LOGO_SRC);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error("Failed to read logo file."));
      };
      reader.onerror = () => reject(reader.error || new Error("Failed to load logo file."));
      reader.readAsDataURL(blob);
    });
  } catch {
    return REPORT_PDF_LOGO_SRC;
  }
};

export default function ProfilePage() {
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [reportPreset, setReportPreset] = useState<ReportPreset>("this_month");
  const [useDateFilter, setUseDateFilter] = useState(true);
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [reportStatus, setReportStatus] = useState<PaymentStatusFilter>("all");
  const [reportType, setReportType] = useState<PaymentTypeFilter>("all");
  const [reportMethod, setReportMethod] = useState<PaymentMethodFilter>("all");
  const [reportLoading, setReportLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [colorTheme, setColorTheme] = useState<ColorTheme>(getStoredAppearance().colorTheme);
  const [fontScale, setFontScale] = useState<FontScale>(getStoredAppearance().fontScale);

  const applyPreset = (preset: ReportPreset) => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = subMonths(now, 1);
    const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastYear = now.getFullYear() - 1;

    setReportPreset(preset);
    setUseDateFilter(true);

    if (preset === "this_month") {
      setReportStartDate(toDateInputValue(thisMonthStart));
      setReportEndDate(toDateInputValue(now));
      setReportStatus("all");
      setReportType("all");
      setReportMethod("all");
      return;
    }

    if (preset === "last_month") {
      setReportStartDate(toDateInputValue(lastMonthStart));
      setReportEndDate(toDateInputValue(lastMonthEnd));
      setReportStatus("all");
      setReportType("all");
      setReportMethod("all");
      return;
    }

    if (preset === "this_year") {
      setReportStartDate(toDateInputValue(new Date(now.getFullYear(), 0, 1)));
      setReportEndDate(toDateInputValue(now));
      setReportStatus("all");
      setReportType("all");
      setReportMethod("all");
      return;
    }

    if (preset === "last_year") {
      setReportStartDate(toDateInputValue(new Date(lastYear, 0, 1)));
      setReportEndDate(toDateInputValue(new Date(lastYear, 11, 31)));
      setReportStatus("all");
      setReportType("all");
      setReportMethod("all");
      return;
    }

    if (preset === "last_30_days") {
      setReportStartDate(toDateInputValue(subDays(now, 29)));
      setReportEndDate(toDateInputValue(now));
      setReportStatus("all");
      setReportType("all");
      setReportMethod("all");
      return;
    }

    if (preset === "approved_only") {
      setReportStartDate(toDateInputValue(thisMonthStart));
      setReportEndDate(toDateInputValue(now));
      setReportStatus("approved");
      setReportType("all");
      setReportMethod("all");
      return;
    }

    if (preset === "pending_only") {
      setReportStartDate(toDateInputValue(thisMonthStart));
      setReportEndDate(toDateInputValue(now));
      setReportStatus("pending");
      setReportType("all");
      setReportMethod("all");
      return;
    }

    if (preset === "share_only") {
      setReportStartDate(toDateInputValue(new Date(now.getFullYear(), 0, 1)));
      setReportEndDate(toDateInputValue(now));
      setReportStatus("all");
      setReportType("share");
      setReportMethod("all");
      return;
    }

    if (preset === "custom_only") {
      setReportStartDate(toDateInputValue(new Date(now.getFullYear(), 0, 1)));
      setReportEndDate(toDateInputValue(now));
      setReportStatus("all");
      setReportType("custom");
      setReportMethod("all");
      return;
    }

    setReportStartDate(toDateInputValue(thisMonthStart));
    setReportEndDate(toDateInputValue(now));
  };

  useEffect(() => {
    applyPreset("this_month");
  }, []);

  useEffect(() => {
    setReportSummary(null);
  }, [reportPreset, useDateFilter, reportStartDate, reportEndDate, reportStatus, reportType, reportMethod]);

  useEffect(() => {
    if (!user) return;

    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name, email, mobile_number")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setName(data.name || "");
        setMobile((data as { mobile_number?: string }).mobile_number || "");
        setEmail(data.email || user.email || "");
      }

      setLoading(false);
    };

    fetch();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!mobile.trim() || !/^01\d{9}$/.test(mobile.trim())) {
      toast.error("Please enter a valid mobile number (01XXXXXXXXX)");
      return;
    }

    setSaving(true);

    const profilePayload = {
      user_id: user.id,
      name: name.trim(),
      email: email.trim() || user.email || "",
      mobile_number: mobile.trim(),
      email_verified: true,
      is_blocked: false,
    };

    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .update({ name: name.trim(), mobile_number: mobile.trim() } as any)
      .eq("user_id", user.id)
      .select("user_id")
      .maybeSingle();

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    if (!updatedProfile) {
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "user_id" });

      if (upsertError) {
        toast.error(upsertError.message);
        setSaving(false);
        return;
      }
    }

    toast.success("Profile updated successfully!");
    setIsEditProfileOpen(false);
    setSaving(false);
    navigate("/", { replace: true });
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate("/auth", { replace: true });
    setSigningOut(false);
  };

  const handleColorThemeChange = (nextTheme: ColorTheme) => {
    setColorTheme(nextTheme);
    updateAppearanceSettings({ colorTheme: nextTheme, fontScale });
  };

  const handleFontScaleChange = (nextScale: FontScale) => {
    setFontScale(nextScale);
    updateAppearanceSettings({ colorTheme, fontScale: nextScale });
  };

  const resetReportFilters = () => {
    applyPreset("this_month");
    setReportSummary(null);
  };

  const generateMyReport = async () => {
    if (!user) return;
    if (useDateFilter && (!reportStartDate || !reportEndDate)) {
      toast.error("Please select both start and end dates.");
      return;
    }

    if (useDateFilter && reportStartDate > reportEndDate) {
      toast.error("Start date cannot be after end date.");
      return;
    }

    setReportLoading(true);

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setReportLoading(false);
      return;
    }

    const payments = (data || []) as PaymentRecord[];
    const rangeStart = useDateFilter ? startOfDay(reportStartDate) : null;
    const rangeEnd = useDateFilter ? endOfDay(reportEndDate) : null;
    const isMonthlyPreset = reportPreset === "this_month" || reportPreset === "last_month";
    const isYearlyPreset = reportPreset === "this_year" || reportPreset === "last_year";

    const filtered = payments.filter((payment) => {
      const createdAt = new Date(payment.created_at);
      const paymentPeriodDate = new Date(payment.year, Math.max(payment.month - 1, 0), 1);

      if (useDateFilter) {
        if (isMonthlyPreset && rangeStart) {
          if (
            payment.month !== rangeStart.getMonth() + 1 ||
            payment.year !== rangeStart.getFullYear()
          ) return false;
        } else if (isYearlyPreset && rangeStart) {
          if (payment.year !== rangeStart.getFullYear()) return false;
        } else if (rangeStart && rangeEnd) {
          const inCreatedAtRange = createdAt >= rangeStart && createdAt <= rangeEnd;
          const inPaymentPeriodRange = paymentPeriodDate >= new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
            && paymentPeriodDate <= new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);

          if (!inCreatedAtRange && !inPaymentPeriodRange) return false;
        }
      }

      if (reportStatus !== "all" && payment.status !== reportStatus) return false;
      if (reportType !== "all" && (payment.payment_type || "share") !== reportType) return false;
      if (reportMethod !== "all" && payment.payment_method !== reportMethod) return false;
      return true;
    });

    const approved = filtered.filter((payment) => payment.status === "approved");
    const pending = filtered.filter((payment) => payment.status === "pending");
    const rejected = filtered.filter((payment) => payment.status === "rejected");

    const titleParts = [
      useDateFilter ? `${format(startOfDay(reportStartDate), "dd MMM yyyy")} - ${format(endOfDay(reportEndDate), "dd MMM yyyy")}` : "All Time",
      reportStatus !== "all" ? reportStatus : null,
      reportType !== "all" ? reportType : null,
      reportMethod !== "all" ? (reportMethod === "mobile_banking" ? "mobile banking" : reportMethod) : null,
    ].filter(Boolean);

    setReportSummary({
      title: `${titleParts.join(" | ")} My Report`,
      totalAmount: approved.reduce((sum, payment) => sum + payment.amount, 0),
      approved: approved.length,
      pending: pending.length,
      rejected: rejected.length,
      shares: approved.reduce((sum, payment) => sum + (payment.share_quantity || 0), 0),
      payments: filtered,
    });

    setReportLoading(false);
  };

  const exportMyCsv = async () => {
    if (!reportSummary) return;
    const headers = ["SL", "Period", "Amount", "Shares", "Method", "Type", "Status", "Submitted"];
    const rows = reportSummary.payments.map((payment, index) => [
      index + 1,
      `${MONTHS[payment.month - 1]} ${payment.year}`,
      payment.amount,
      payment.share_quantity || "",
      payment.payment_method === "mobile_banking" ? "Mobile Banking" : "Bank",
      payment.payment_type || "share",
      payment.status,
      format(new Date(payment.created_at), "dd MMM yyyy"),
    ]);
    const csv = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const fileName = getSafeReportFileName(reportSummary.title, "csv");

    if (isNativePlatform) {
      const { displayPath } = await saveBlobToNativeDownloads(blob, fileName, "text/csv");
      toast.success(`CSV saved to ${displayPath}`);
      return;
    }

    triggerBrowserDownload(blob, fileName);
    toast.success("CSV downloaded successfully.");
  };

  const exportMyPdf = async () => {
    if (!reportSummary) return;
    setPdfLoading(true);

    try {
      const logoSrc = await getReportPdfLogoDataUrl();
      const reportNode = document.createElement("div");
      reportNode.style.position = "fixed";
      reportNode.style.left = "-10000px";
      reportNode.style.top = "0";
      reportNode.style.width = isNativePlatform ? "980px" : "1200px";
      reportNode.style.background = "#ffffff";
      reportNode.style.color = "#0f172a";
      reportNode.style.padding = "40px";
      const generatedAt = format(new Date(), "dd MMM yyyy, hh:mm a");
      const filteredRange = reportSummary.title.replace(/\s+My Report$/, "");
      const approvalRate = reportSummary.payments.length > 0
        ? Math.round((reportSummary.approved / reportSummary.payments.length) * 100)
        : 0;
      const statusPill = (status: PaymentRecord["status"]) => {
        if (status === "approved") {
          return "background:#dcfce7;color:#166534;border:1px solid #86efac;";
        }
        if (status === "pending") {
          return "background:#fef3c7;color:#92400e;border:1px solid #fcd34d;";
        }
        return "background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;";
      };
      reportNode.innerHTML = `
        <div style="font-family:Arial,sans-serif;">
          <div style="position:relative;border:1px solid #d7dee8;border-radius:10px;background:#ffffff;padding:26px 30px 28px 42px;box-shadow:0 24px 48px rgba(15,23,42,0.10);overflow:hidden;">
            <div style="position:absolute;left:0;top:0;height:132px;width:18px;background:#7a88d6;"></div>
            <div style="position:absolute;left:0;bottom:48px;height:120px;width:18px;background:#d8defc;"></div>
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;">
              <div>
                <p style="margin:0;font-size:12px;color:#94a3b8;">Amicitia Member Report</p>
                <h1 style="margin:8px 0 0;font-size:34px;line-height:1.15;font-weight:800;color:#111827;">${filteredRange}</h1>
                <div style="margin-top:10px;height:4px;width:72px;border-radius:999px;background:linear-gradient(90deg,#8b5cf6,#60a5fa);"></div>
                <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:#64748b;">Generated on ${generatedAt}</p>
              </div>
              <div style="display:flex;align-items:center;justify-content:center;min-width:300px;min-height:180px;border:1px solid #e5e7eb;border-radius:14px;background:#ffffff;">
                <img src="${logoSrc}" alt="Amicitia logo" style="height:168px;width:auto;object-fit:contain;" />
              </div>
            </div>
          </div>
          <div style="margin-top:22px;">
            <p style="margin:0 0 14px;font-size:14px;font-weight:800;letter-spacing:0.03em;text-transform:uppercase;color:#111827;">Summary</p>
            <div style="display:grid;grid-template-columns:1.18fr 0.82fr;gap:16px;">
              <div style="border-radius:16px;padding:18px 20px;background:linear-gradient(135deg,#5f74bf,#4963af);color:#ffffff;box-shadow:0 12px 28px rgba(68,93,169,0.18);min-height:138px;">
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.82);">Total Shares</p>
                <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-top:18px;">
                  <p style="margin:0;font-size:20px;font-weight:800;">BDT ${reportSummary.totalAmount.toLocaleString()}</p>
                  <p style="margin:0;font-size:34px;font-weight:800;line-height:1;">${reportSummary.shares}</p>
                </div>
                <div style="margin-top:18px;display:grid;gap:8px;font-size:12px;color:rgba(255,255,255,0.92);">
                  <div style="display:flex;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.18);padding-top:8px;"><span>Approved</span><strong>${reportSummary.approved}</strong></div>
                  <div style="display:flex;justify-content:space-between;"><span>Average</span><strong>BDT ${reportSummary.approved > 0 ? Math.round(reportSummary.totalAmount / reportSummary.approved).toLocaleString() : "0"}</strong></div>
                </div>
              </div>
              <div style="display:grid;align-content:start;gap:10px;">
                <div style="border-radius:12px;background:#f3f4f6;padding:16px 18px;min-height:64px;">
                  <p style="margin:0;font-size:12px;color:#6b7280;">Approval Rate</p>
                  <p style="margin:10px 0 0;font-size:22px;font-weight:800;color:#111827;">${approvalRate}%</p>
                </div>
                <div style="border-radius:12px;background:#f3f4f6;padding:16px 18px;min-height:64px;">
                  <p style="margin:0;font-size:12px;color:#6b7280;">Pending / Rejected</p>
                  <p style="margin:10px 0 0;font-size:22px;font-weight:800;color:#111827;">${reportSummary.pending} / ${reportSummary.rejected}</p>
                </div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px;">
              <div style="border-radius:12px;background:#f3f4f6;padding:14px 16px;">
                <p style="margin:0 0 10px;font-size:13px;font-weight:800;color:#111827;">Member</p>
                <div style="display:grid;gap:8px;font-size:12px;color:#374151;">
                  <div style="display:flex;justify-content:space-between;border-bottom:1px solid #d1d5db;padding-bottom:6px;"><span>Name</span><strong>${name || "Member"}</strong></div>
                  <div style="display:flex;justify-content:space-between;border-bottom:1px solid #d1d5db;padding-bottom:6px;"><span>Email</span><strong>${email}</strong></div>
                  <div style="display:flex;justify-content:space-between;"><span>Mobile</span><strong>${mobile || "-"}</strong></div>
                </div>
              </div>
              <div style="border-radius:12px;background:#f3f4f6;padding:14px 16px;">
                <p style="margin:0 0 10px;font-size:13px;font-weight:800;color:#111827;">Range</p>
                <div style="display:grid;gap:8px;font-size:12px;color:#374151;">
                  <div style="display:flex;justify-content:space-between;border-bottom:1px solid #d1d5db;padding-bottom:6px;"><span>Filter</span><strong>${filteredRange}</strong></div>
                  <div style="display:flex;justify-content:space-between;border-bottom:1px solid #d1d5db;padding-bottom:6px;"><span>Total Entries</span><strong>${reportSummary.payments.length}</strong></div>
                  <div style="display:flex;justify-content:space-between;"><span>Status Mix</span><strong>${reportSummary.approved}/${reportSummary.pending}/${reportSummary.rejected}</strong></div>
                </div>
              </div>
            </div>
          </div>
          <div style="margin:22px 0 12px;">
            <p style="margin:0;font-size:16px;font-weight:800;letter-spacing:0.01em;color:#111827;">বিস্তারিত পেমেন্ট তালিকা / Detailed Payment List</p>
          </div>
          <div style="overflow:hidden;border:1px solid #d6deea;border-radius:6px;">
            <table style="width:100%;border-collapse:collapse;font-size:12.5px;background:#ffffff;">
              <thead>
                <tr style="background:#247657;color:#ffffff;">
                  <th style="padding:12px 10px;border-right:1px solid rgba(255,255,255,0.24);text-align:left;font-weight:800;">ক্রম /<br />SL</th>
                  <th style="padding:12px 10px;border-right:1px solid rgba(255,255,255,0.24);text-align:left;font-weight:800;">নাম / Name</th>
                  <th style="padding:12px 10px;border-right:1px solid rgba(255,255,255,0.24);text-align:left;font-weight:800;">মোবাইল / Mobile</th>
                  <th style="padding:12px 10px;border-right:1px solid rgba(255,255,255,0.24);text-align:left;font-weight:800;">মাস / Month</th>
                  <th style="padding:12px 10px;border-right:1px solid rgba(255,255,255,0.24);text-align:left;font-weight:800;">শেয়ার / Shares</th>
                  <th style="padding:12px 10px;border-right:1px solid rgba(255,255,255,0.24);text-align:left;font-weight:800;">পরিমাণ / Amount</th>
                  <th style="padding:12px 10px;border-right:1px solid rgba(255,255,255,0.24);text-align:left;font-weight:800;">মাধ্যম / Method</th>
                  <th style="padding:12px 10px;text-align:left;font-weight:800;">স্ট্যাটাস / Status</th>
                </tr>
              </thead>
              <tbody>
                ${reportSummary.payments.map((payment, index) => `
                  <tr style="border-bottom:1px solid #d6deea;background:${index % 2 === 0 ? "#ffffff" : "#fbfcfd"};">
                    <td style="padding:12px 10px;border-right:1px solid #d6deea;color:#111827;">${index + 1}</td>
                    <td style="padding:12px 10px;border-right:1px solid #d6deea;color:#111827;font-weight:700;">${name || "Member"}</td>
                    <td style="padding:12px 10px;border-right:1px solid #d6deea;color:#374151;">${mobile || "-"}</td>
                    <td style="padding:12px 10px;border-right:1px solid #d6deea;color:#374151;">${MONTHS[payment.month - 1]} ${payment.year}</td>
                    <td style="padding:12px 10px;border-right:1px solid #d6deea;color:#374151;">${payment.share_quantity || 0}</td>
                    <td style="padding:12px 10px;border-right:1px solid #d6deea;color:#111827;font-weight:700;">৳${payment.amount.toLocaleString()}</td>
                    <td style="padding:12px 10px;border-right:1px solid #d6deea;color:#374151;">${payment.payment_method === "mobile_banking" ? "মোবাইল ব্যাংকিং (Mobile Banking)" : "ব্যাংক (Bank)"}</td>
                    <td style="padding:12px 10px;color:#374151;">${payment.status === "approved" ? "অনুমোদিত (Approved)" : payment.status === "pending" ? "অপেক্ষমাণ (Pending)" : "প্রত্যাখ্যাত (Rejected)"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          <p style="margin:18px 0 0;font-size:10px;line-height:1.5;color:#9ca3af;">This report is generated from your filtered Amicitia payment history and is intended for your personal review and record keeping.</p>
        </div>
      `;

      document.body.appendChild(reportNode);
      let canvas: HTMLCanvasElement;
      try {
        const images = Array.from(reportNode.querySelectorAll("img"));
        await Promise.all(images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        }));

        canvas = await html2canvas(reportNode, {
          scale: isNativePlatform ? 1.2 : 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });
      } finally {
        document.body.removeChild(reportNode);
      }

      const pdf = new jsPDF("p", "mm", isNativePlatform ? "a4" : "a3");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const usableHeight = pageHeight - margin * 2;
      const imgData = canvas.toDataURL("image/png");

      let remainingHeight = imgHeight;
      let position = margin;
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      remainingHeight -= usableHeight;

      while (remainingHeight > 0) {
        position = margin - (imgHeight - remainingHeight);
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
        remainingHeight -= usableHeight;
      }

      const blob = pdf.output("blob");
      const fileName = getSafeReportFileName(reportSummary.title, "pdf");

      if (isNativePlatform) {
        const { displayPath } = await saveBlobToNativeDownloads(blob, fileName, "application/pdf");
        toast.success(`PDF saved to ${displayPath}`);
      } else {
        triggerBrowserDownload(blob, fileName);
        toast.success("PDF downloaded successfully.");
      }
    } catch (error) {
      console.error("Member PDF export error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to export PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card className="overflow-hidden rounded-[30px] border border-border/70 bg-card/95 shadow-[0_18px_42px_rgba(16,24,40,0.08)]">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary text-primary-foreground shadow-[0_16px_28px_rgba(20,102,76,0.20)]">
                  <UserRound className="h-8 w-8" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Account</p>
                  <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-foreground">{name || "Member"}</h1>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{email || "No email"}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditProfileOpen(true)}
                className="h-11 rounded-2xl border-border/70 bg-card/70 px-4 text-sm font-semibold"
              >
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[22px] border border-border/70 bg-background/70 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Appearance</p>
                <p className="text-xs text-muted-foreground">Dark or light mode</p>
              </div>
              <ThemeToggle className="h-11 w-11 rounded-2xl border-border/70 bg-card/80 shadow-sm" />
            </div>
            <div className="rounded-[24px] border border-border/70 bg-background/60 p-4">
              <div className="pb-3">
                <CardTitle className="text-lg font-bold">Display</CardTitle>
                <CardDescription>Choose your preferred app color and text size.</CardDescription>
              </div>

              <div className="space-y-4">
              <div className="space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Color Theme</p>
                <div className="grid grid-cols-5 gap-2">
                  {COLOR_THEMES.map((theme) => (
                    <button
                      key={theme.value}
                      type="button"
                      onClick={() => handleColorThemeChange(theme.value)}
                      className={`flex items-center justify-center rounded-2xl border p-2.5 transition-colors ${
                        colorTheme === theme.value
                          ? "border-primary bg-primary/8"
                          : "border-border/70 bg-background/70 hover:bg-muted/40"
                      }`}
                      aria-label={`Select ${theme.label} theme`}
                      title={theme.label}
                    >
                      <span
                        className="h-6 w-6 rounded-full border border-black/10 shadow-sm"
                        style={{ backgroundColor: theme.preview }}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              </div>
 
                <div className="space-y-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Font Size</p>
                  <div className="grid grid-cols-3 gap-2">
                    {FONT_SCALES.map((scale) => (
                      <button
                        key={scale.value}
                        type="button"
                        onClick={() => handleFontScaleChange(scale.value)}
                        className={`rounded-2xl border px-3 py-2.5 text-center text-sm font-medium transition-colors ${
                          fontScale === scale.value
                            ? "border-primary bg-primary/8 text-primary"
                            : "border-border/70 bg-background/70 text-foreground hover:bg-muted/40"
                        }`}
                      >
                        {scale.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleSignOut}
                className="h-11 min-w-[180px] rounded-2xl border-border/70 bg-card/70 px-6 text-sm font-semibold"
                disabled={saving || signingOut}
              >
                {signingOut ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging out...
                  </>
                ) : (
                  <>
                    <LogOut className="mr-2 h-4 w-4" /> Logout
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="rounded-[28px] border border-border/70 bg-card/95 p-0 shadow-[0_20px_50px_rgba(16,24,40,0.18)] sm:max-w-xl">
          <form onSubmit={handleSave}>
            <DialogHeader className="border-b border-border/70 px-6 py-5">
              <DialogTitle className="text-xl font-bold tracking-tight">Personal Information</DialogTitle>
              <DialogDescription>Update your visible member details here.</DialogDescription>
            </DialogHeader>

            <div className="space-y-5 px-6 py-5">
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Full Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  maxLength={100}
                  className="h-12 rounded-2xl border-border/70 bg-background/80"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Email Address</Label>
                <Input
                  value={email}
                  disabled
                  className="h-12 rounded-2xl border-border/70 bg-muted/30 text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mobile Number *</Label>
                <Input
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, "").slice(0, 11))}
                  placeholder="01XXXXXXXXX"
                  maxLength={11}
                  className="h-12 rounded-2xl border-border/70 bg-background/80"
                />
                <p className="text-xs text-muted-foreground">Bangladeshi mobile number only.</p>
              </div>
            </div>

            <DialogFooter className="border-t border-border/70 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditProfileOpen(false)}
                className="h-11 rounded-2xl px-5"
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-11 rounded-2xl px-5 text-base font-semibold shadow-[0_16px_30px_rgba(20,102,76,0.16)]"
                disabled={saving || signingOut}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="rounded-[30px] border border-border/70 bg-card/95 shadow-[0_16px_36px_rgba(16,24,40,0.08)]">
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-lg font-bold">My Reports</CardTitle>
          </div>
          <Button
            type="button"
            variant={useDateFilter ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setReportPreset("custom");
              setUseDateFilter((prev) => !prev);
            }}
            aria-label={useDateFilter ? "Disable date filter" : "Enable date filter"}
            title={useDateFilter ? "Date filter on" : "Date filter off"}
            className="h-10 w-10 rounded-full p-0"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-[24px] border border-border/70 bg-background/60 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Quick Preset</Label>
                <Select value={reportPreset} onValueChange={(value) => applyPreset(value as ReportPreset)}>
                  <SelectTrigger className="h-12 rounded-2xl border-border/70 bg-background/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="this_year">This Year</SelectItem>
                    <SelectItem value="last_year">Last Year</SelectItem>
                    <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                    <SelectItem value="approved_only">Approved Only</SelectItem>
                    <SelectItem value="pending_only">Pending Only</SelectItem>
                    <SelectItem value="share_only">Share Payments</SelectItem>
                    <SelectItem value="custom_only">Custom Payments</SelectItem>
                    <SelectItem value="custom">Custom Setup</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Payment Method</Label>
                <Select
                  value={reportMethod}
                  onValueChange={(value) => {
                    setReportPreset("custom");
                    setReportMethod(value as PaymentMethodFilter);
                  }}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-border/70 bg-background/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</Label>
                <Select
                  value={reportStatus}
                  onValueChange={(value) => {
                    setReportPreset("custom");
                    setReportStatus(value as PaymentStatusFilter);
                  }}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-border/70 bg-background/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Payment Type</Label>
                <Select
                  value={reportType}
                  onValueChange={(value) => {
                    setReportPreset("custom");
                    setReportType(value as PaymentTypeFilter);
                  }}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-border/70 bg-background/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="share">Share</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>

            <div className="mt-3 space-y-2">
              {useDateFilter && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">From Date</Label>
                    <Input
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => {
                        setReportPreset("custom");
                        setReportStartDate(e.target.value);
                      }}
                      className="h-12 rounded-2xl border-border/70 bg-background/80"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">To Date</Label>
                    <Input
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => {
                        setReportPreset("custom");
                        setReportEndDate(e.target.value);
                      }}
                      className="h-12 rounded-2xl border-border/70 bg-background/80"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Actions</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={resetReportFilters} className="h-12 rounded-2xl px-3">
                  <RotateCcw className="mr-2 h-4 w-4" /> Reset
                </Button>
                <Button type="button" onClick={generateMyReport} disabled={reportLoading} className="h-12 rounded-2xl px-3">
                  {reportLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preview</> : "Preview"}
                </Button>
              </div>
            </div>

          </div>

          {reportSummary && (
            <>
              <div className="overflow-hidden rounded-[22px] border border-border/70 bg-background/60">
                <div className="grid grid-cols-2 gap-px bg-border/60 sm:grid-cols-5">
                  <div className="bg-background/90 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Collected</p>
                    <p className="mt-1.5 text-base font-bold text-foreground sm:text-lg">BDT {reportSummary.totalAmount.toLocaleString()}</p>
                  </div>
                  <div className="bg-background/90 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Approved</p>
                    <p className="mt-1.5 text-base font-bold text-foreground sm:text-lg">{reportSummary.approved}</p>
                  </div>
                  <div className="bg-background/90 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pending</p>
                    <p className="mt-1.5 text-base font-bold text-foreground sm:text-lg">{reportSummary.pending}</p>
                  </div>
                  <div className="bg-background/90 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Rejected</p>
                    <p className="mt-1.5 text-base font-bold text-foreground sm:text-lg">{reportSummary.rejected}</p>
                  </div>
                  <div className="bg-background/90 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Shares</p>
                    <p className="mt-1.5 text-base font-bold text-foreground sm:text-lg">{reportSummary.shares}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-[22px] border border-border/70 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {reportSummary.title} <Badge variant="secondary" className="ml-2">{reportSummary.payments.length} payments</Badge>
                </p>
                <div className="flex w-full items-center justify-between gap-3 sm:w-[220px]">
                  <Button type="button" variant="outline" onClick={exportMyCsv} className="h-11 rounded-2xl px-4">
                    <FileText className="mr-2 h-4 w-4" /> CSV
                  </Button>
                  <Button type="button" variant="outline" onClick={exportMyPdf} disabled={pdfLoading} className="h-11 rounded-2xl px-4">
                    {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                    PDF
                  </Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background/50">
                <div className="flex flex-col gap-1 border-b border-border/70 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">Preview</p>
                    <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em]">
                      {reportSummary.payments.length} items
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Only the filtered payments below will be exported.</p>
                </div>
                {reportSummary.payments.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">No payments matched your filters.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                      <thead className="bg-muted/40">
                        <tr className="border-b border-border/70">
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Period</th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Type</th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Method</th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Date</th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Status</th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Amount</th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Payment ID</th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Shares</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportSummary.payments.slice(0, 6).map((payment, index) => (
                          <tr key={payment.id} className={index !== 5 ? "border-b border-border/60" : ""}>
                            <td className="px-4 py-3 text-sm font-medium text-foreground">
                              {MONTHS[payment.month - 1]} {payment.year}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {(payment.payment_type || "share") === "share" ? "Share" : "Custom"}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {payment.payment_method === "mobile_banking" ? "Mobile Banking" : "Bank"}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {format(new Date(payment.created_at), "dd MMM yyyy")}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className={
                                  payment.status === "approved"
                                    ? "rounded-full border-emerald-500/30 bg-emerald-500/[0.08] capitalize text-emerald-700 dark:text-emerald-300"
                                    : payment.status === "pending"
                                      ? "rounded-full border-amber-500/30 bg-amber-500/[0.08] capitalize text-amber-700 dark:text-amber-300"
                                      : "rounded-full border-rose-500/30 bg-rose-500/[0.08] capitalize text-rose-700 dark:text-rose-300"
                                }
                              >
                                {payment.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-foreground">
                              BDT {payment.amount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              #{payment.id.slice(0, 8)}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {payment.share_quantity ? `${payment.share_quantity}` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {reportSummary.payments.length > 6 && (
                  <div className="border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
                    Showing first 6 payments in preview. Export will include all {reportSummary.payments.length} filtered payments.
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <div className="mt-4 rounded-2xl bg-muted/20 px-4 py-3 text-center text-sm font-medium text-muted-foreground">
        Developed by{" "}
        <a
          href="https://www.facebook.com/orh.bd"
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          Obaidur Rahman Humayun
        </a>{" "}
        &{" "}
        <a
          href="https://www.facebook.com/abin0x"
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          Mahmudul Hasan Abin
        </a>
      </div>
    </div>
  );
}
