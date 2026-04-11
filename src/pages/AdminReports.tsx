import { useEffect, useMemo, useState } from "react";
import { format, subDays, subMonths } from "date-fns";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { CalendarIcon, FileDown, FileText, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getMonthOptionsForYear, getYearOptionsDesc, isPeriodBeforeLaunch } from "@/lib/period";
import {
  getSafeReportFileName,
  isNativePlatform,
  saveBlobToNativeDownloads,
  triggerBrowserDownload,
} from "@/lib/report-export";
import { toast } from "sonner";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
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

type ReportType = "monthly" | "yearly" | "custom";
type StatusFilter = "all" | "pending" | "approved" | "rejected";
type MethodFilter = "all" | "bank" | "mobile_banking";
type Preset = "none" | "this_month" | "last_month" | "this_year" | "last_year" | "last_30_days" | "pending_only" | "approved_only" | "rejected_only" | "top_contributors";

type EnrichedPayment = {
  id: string;
  user_id: string;
  amount: number;
  month: number;
  year: number;
  status: string;
  payment_method: string | null;
  payment_type: string | null;
  share_quantity: number | null;
  created_at: string;
  member_name: string;
  member_email: string;
  member_mobile: string;
};

type ReportData = {
  title: string;
  totalCollected: number;
  totalApproved: number;
  totalPending: number;
  totalRejected: number;
  totalShares: number;
  bankCount: number;
  mobileCount: number;
  bankAmount: number;
  mobileAmount: number;
  payments: EnrichedPayment[];
};

const buildCsvBlob = (report: ReportData) => {
  const headers = ["SL", "Name", "Email", "Mobile", "Period", "Shares", "Amount", "Method", "Status"];
  const rows = report.payments.map((payment, index) => [
    index + 1,
    payment.member_name,
    payment.member_email,
    payment.member_mobile,
    `${MONTHS[payment.month - 1]} ${payment.year}`,
    payment.share_quantity ?? "",
    payment.amount,
    payment.payment_method === "mobile_banking" ? "Mobile Banking" : "Bank",
    payment.status,
  ]);

  const csv = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
  return new Blob([csv], { type: "text/csv" });
};

const buildPdfBlob = async (report: ReportData) => {
  const logoSrc = await getReportPdfLogoDataUrl();
  const reportNode = document.createElement("div");
  reportNode.style.position = "fixed";
  reportNode.style.left = "-10000px";
  reportNode.style.top = "0";
  reportNode.style.width = isNativePlatform ? "1080px" : "1360px";
  reportNode.style.background = "#ffffff";
  reportNode.style.color = "#0f172a";
  reportNode.style.padding = "48px";
  const generatedAt = format(new Date(), "dd MMM yyyy, hh:mm a");
  const collectionShare = report.payments.length > 0
    ? Math.round((report.totalApproved / report.payments.length) * 100)
    : 0;
  const statusPill = (status: string) => {
    if (status === "approved") {
      return "background:#dcfce7;color:#166534;border:1px solid #86efac;";
    }
    if (status === "pending") {
      return "background:#fef3c7;color:#92400e;border:1px solid #fcd34d;";
    }
    return "background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;";
  };
  const averageTicket = report.totalApproved > 0
    ? Math.round(report.totalCollected / report.totalApproved)
    : 0;
  reportNode.innerHTML = `
    <div style="font-family:Arial,sans-serif;">
      <div style="position:relative;border:1px solid #d7dee8;border-radius:10px;background:#ffffff;padding:26px 30px 28px 42px;box-shadow:0 24px 48px rgba(15,23,42,0.10);overflow:hidden;">
        <div style="position:absolute;left:0;top:0;height:132px;width:18px;background:#546db4;"></div>
        <div style="position:absolute;right:0;bottom:0;height:160px;width:18px;background:#59c69a;"></div>
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;">
          <div>
            <p style="margin:0;font-size:12px;color:#94a3b8;">Amicitia Admin Report</p>
            <h1 style="margin:8px 0 0;font-size:34px;line-height:1.15;font-weight:800;color:#111827;">${report.title}</h1>
            <div style="margin-top:10px;height:4px;width:72px;border-radius:999px;background:linear-gradient(90deg,#5fd3c8,#7dd3fc);"></div>
            <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:#64748b;">Generated on ${generatedAt}</p>
          </div>
          <div style="display:flex;align-items:center;justify-content:center;min-width:300px;min-height:180px;border:1px solid #e5e7eb;border-radius:14px;background:#ffffff;">
            <img src="${logoSrc}" alt="Amicitia logo" style="height:168px;width:auto;object-fit:contain;" />
          </div>
        </div>
      </div>
      <div style="margin-top:22px;">
        <p style="margin:0 0 14px;font-size:14px;font-weight:800;letter-spacing:0.03em;text-transform:uppercase;color:#111827;">Summary</p>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">
          <div style="border-radius:16px;padding:16px 18px;background:linear-gradient(135deg,#eef2ff,#ddd6fe);box-shadow:0 10px 24px rgba(99,102,241,0.10);">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
              <div>
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0f172a;">Total Collected</p>
                <p style="margin:8px 0 0;font-size:20px;font-weight:800;color:#111827;">BDT ${report.totalCollected.toLocaleString()}</p>
              </div>
              <p style="margin:0;font-size:30px;font-weight:800;color:#64748b;">${report.totalApproved}</p>
            </div>
            <p style="margin:12px 0 0;font-size:11px;color:#6b7280;">Generated ${generatedAt}</p>
          </div>
          <div style="border-radius:16px;padding:16px 18px;background:linear-gradient(135deg,#dcfce7,#d1fae5);box-shadow:0 10px 24px rgba(16,185,129,0.10);">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
              <div>
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0f172a;">Total Shares</p>
                <p style="margin:8px 0 0;font-size:20px;font-weight:800;color:#111827;">${report.totalShares}</p>
              </div>
              <p style="margin:0;font-size:30px;font-weight:800;color:#111827;">${collectionShare}%</p>
            </div>
            <p style="margin:12px 0 0;font-size:11px;color:#6b7280;">Approval ratio across ${report.payments.length} entries</p>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:14px;">
          <div style="border-radius:12px;background:#f3f4f6;padding:14px 16px;">
            <p style="margin:0;font-size:12px;color:#6b7280;">Approved Payments</p>
            <p style="margin:8px 0 0;font-size:22px;font-weight:800;color:#111827;">${report.totalApproved}</p>
          </div>
          <div style="border-radius:12px;background:#f3f4f6;padding:14px 16px;">
            <p style="margin:0;font-size:12px;color:#6b7280;">Pending / Rejected</p>
            <p style="margin:8px 0 0;font-size:22px;font-weight:800;color:#111827;">${report.totalPending} / ${report.totalRejected}</p>
          </div>
          <div style="border-radius:12px;background:#f3f4f6;padding:14px 16px;">
            <p style="margin:0;font-size:12px;color:#6b7280;">Entries / Average</p>
            <p style="margin:8px 0 0;font-size:22px;font-weight:800;color:#111827;">${report.payments.length} / ৳${averageTicket.toLocaleString()}</p>
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
            ${report.payments.map((payment, index) => `
              <tr style="border-bottom:1px solid #d6deea;background:${index % 2 === 0 ? "#ffffff" : "#fbfcfd"};">
                <td style="padding:12px 10px;border-right:1px solid #d6deea;color:#111827;">${index + 1}</td>
                <td style="padding:12px 10px;border-right:1px solid #d6deea;color:#111827;font-weight:700;">${payment.member_name}</td>
                <td style="padding:12px 10px;border-right:1px solid #d6deea;color:#374151;">${payment.member_mobile}</td>
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
      <p style="margin:18px 0 0;font-size:10px;line-height:1.5;color:#9ca3af;">This report is generated from the current Amicitia payment records and is intended for review, reporting, and internal tracking purposes.</p>
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

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", isNativePlatform ? "a4" : "a3");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const usableHeight = pageHeight - margin * 2;

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

  return pdf.output("blob");
};

export default function AdminReports() {
  const now = new Date();
  const [reportType, setReportType] = useState<ReportType>("monthly");
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [memberSearch, setMemberSearch] = useState("");
  const [preset, setPreset] = useState<Preset>("none");
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const years = getYearOptionsDesc(now);
  const monthOptions = useMemo(() => getMonthOptionsForYear(parseInt(year), now), [year, now]);

  useEffect(() => {
    if (!monthOptions.includes(parseInt(month))) {
      setMonth(String(monthOptions[0] ?? now.getMonth() + 1));
    }
  }, [month, monthOptions, now]);

  const applyPreset = (value: Preset) => {
    setPreset(value);
    const current = new Date();
    const lastMonth = subMonths(current, 1);
    const lastYear = current.getFullYear() - 1;

    if (value === "this_month") {
      setReportType("monthly");
      setYear(String(current.getFullYear()));
      setMonth(String(current.getMonth() + 1));
      setMethodFilter("all");
      setStatusFilter("all");
      return;
    }

    if (value === "last_month") {
      setReportType("monthly");
      setYear(String(lastMonth.getFullYear()));
      setMonth(String(lastMonth.getMonth() + 1));
      setMethodFilter("all");
      setStatusFilter("all");
      return;
    }

    if (value === "this_year") {
      setReportType("yearly");
      setYear(String(current.getFullYear()));
      setMethodFilter("all");
      setStatusFilter("all");
      return;
    }

    if (value === "last_year") {
      setReportType("yearly");
      setYear(String(lastYear));
      setMethodFilter("all");
      setStatusFilter("all");
      return;
    }

    if (value === "last_30_days") {
      setReportType("custom");
      setStartDate(subDays(current, 29));
      setEndDate(current);
      setMethodFilter("all");
      setStatusFilter("all");
      return;
    }

    if (value === "pending_only") {
      setReportType("yearly");
      setYear(String(current.getFullYear()));
      setMethodFilter("all");
      setStatusFilter("pending");
      return;
    }

    if (value === "approved_only") {
      setReportType("yearly");
      setYear(String(current.getFullYear()));
      setMethodFilter("all");
      setStatusFilter("approved");
      return;
    }

    if (value === "rejected_only") {
      setReportType("yearly");
      setYear(String(current.getFullYear()));
      setMethodFilter("all");
      setStatusFilter("rejected");
      return;
    }

    if (value === "top_contributors") {
      setReportType("yearly");
      setYear(String(current.getFullYear()));
      setMethodFilter("all");
      setStatusFilter("approved");
      return;
    }

    if (value === "none") {
      setReportType("monthly");
      setYear(String(current.getFullYear()));
      setMonth(String(current.getMonth() + 1));
      setStartDate(undefined);
      setEndDate(undefined);
      setMethodFilter("all");
      setStatusFilter("all");
    }
  };

  const resetFilters = () => {
    setPreset("none");
    setReportType("monthly");
    setMonth(String(now.getMonth() + 1));
    setYear(String(now.getFullYear()));
    setStartDate(undefined);
    setEndDate(undefined);
    setStatusFilter("all");
    setMethodFilter("all");
    setMemberSearch("");
    setReport(null);
  };

  const generateReport = async () => {
    setLoading(true);
    const { data: payments } = await supabase.from("payments").select("*");
    if (!payments) {
      setLoading(false);
      return;
    }

    const userIds = [...new Set(payments.map((payment) => payment.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, email, mobile_number")
      .in("user_id", userIds);
    const profileMap = new Map(profiles?.map((profile) => [profile.user_id, profile]) || []);

    let filtered = payments
      .filter((payment) => !isPeriodBeforeLaunch(payment.year, payment.month))
      .map((payment) => {
        const profile = profileMap.get(payment.user_id) as any;
        return {
          ...payment,
          member_name: profile?.name || "-",
          member_email: profile?.email || "-",
          member_mobile: profile?.mobile_number || "-",
        } as EnrichedPayment;
      });

    if (reportType === "monthly") {
      filtered = filtered.filter((payment) => payment.month === parseInt(month) && payment.year === parseInt(year));
    } else if (reportType === "yearly") {
      filtered = filtered.filter((payment) => payment.year === parseInt(year));
    } else if (startDate && endDate) {
      filtered = filtered.filter((payment) => {
        const createdAt = new Date(payment.created_at);
        return createdAt >= startDate && createdAt <= endDate;
      });
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((payment) => payment.status === statusFilter);
    }

    if (methodFilter !== "all") {
      filtered = filtered.filter((payment) => payment.payment_method === methodFilter);
    }

    if (memberSearch.trim()) {
      const query = memberSearch.trim().toLowerCase();
      const memberExists = payments.some((payment) => {
        const profile = profileMap.get(payment.user_id) as { name?: string; email?: string; mobile_number?: string } | undefined;
        const memberName = (profile?.name || "").toLowerCase();
        const memberEmail = (profile?.email || "").toLowerCase();
        const memberMobile = (profile?.mobile_number || "").toLowerCase();

        return memberName.includes(query) || memberEmail.includes(query) || memberMobile.includes(query);
      });

      if (!memberExists) {
        toast.error("No user found with that name, email, or mobile number.");
        setReport(null);
        setLoading(false);
        return;
      }

      filtered = filtered.filter((payment) =>
        payment.member_name.toLowerCase().includes(query) ||
        payment.member_email.toLowerCase().includes(query) ||
        payment.member_mobile.toLowerCase().includes(query),
      );

      if (filtered.length === 0) {
        toast.error("This user has no payments for the selected filters.");
        setReport(null);
        setLoading(false);
        return;
      }
    }

    if (preset === "top_contributors") {
      filtered = [...filtered].sort((a, b) => b.amount - a.amount);
    } else {
      filtered = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    const approved = filtered.filter((payment) => payment.status === "approved");
    const pending = filtered.filter((payment) => payment.status === "pending");
    const rejected = filtered.filter((payment) => payment.status === "rejected");
    const bank = filtered.filter((payment) => payment.payment_method === "bank");
    const mobile = filtered.filter((payment) => payment.payment_method === "mobile_banking");

    setReport({
      title: reportType === "monthly"
        ? `${MONTHS[parseInt(month) - 1]} ${year} Report`
        : reportType === "yearly"
          ? `${year} Annual Report`
          : `${startDate ? format(startDate, "dd MMM yyyy") : ""} - ${endDate ? format(endDate, "dd MMM yyyy") : ""}`,
      totalCollected: approved.reduce((sum, payment) => sum + payment.amount, 0),
      totalApproved: approved.length,
      totalPending: pending.length,
      totalRejected: rejected.length,
      totalShares: approved.reduce((sum, payment) => sum + (payment.share_quantity || 0), 0),
      bankCount: bank.length,
      mobileCount: mobile.length,
      bankAmount: bank.filter((payment) => payment.status === "approved").reduce((sum, payment) => sum + payment.amount, 0),
      mobileAmount: mobile.filter((payment) => payment.status === "approved").reduce((sum, payment) => sum + payment.amount, 0),
      payments: filtered,
    });

    setLoading(false);
  };

  const exportCsv = async () => {
    if (!report) return;
    const blob = buildCsvBlob(report);
    const fileName = getSafeReportFileName(report.title, "csv");

    if (isNativePlatform) {
      const { displayPath } = await saveBlobToNativeDownloads(blob, fileName, "text/csv");
      toast.success(`CSV saved to ${displayPath}`);
      return;
    }

    triggerBrowserDownload(blob, fileName);
    toast.success("CSV downloaded successfully.");
  };

  const exportPdf = async () => {
    if (!report) return;
    setExportingPdf(true);
    try {
      const blob = await buildPdfBlob(report);
      const fileName = getSafeReportFileName(report.title, "pdf");

      if (isNativePlatform) {
        const { displayPath } = await saveBlobToNativeDownloads(blob, fileName, "application/pdf");
        toast.success(`PDF saved to ${displayPath}`);
      } else {
        triggerBrowserDownload(blob, fileName);
        toast.success("PDF downloaded successfully.");
      }
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to export PDF.");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[28px] border border-border/70 bg-card/88 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Admin Reports</p>
            <CardTitle className="mt-1 text-xl font-bold tracking-tight">Generate Report</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Build monthly, yearly, or custom-range reports with member and payment filters.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-4 sm:p-5">
          <div className="rounded-[24px] border border-primary/20 bg-primary/[0.06] p-4 shadow-[0_12px_30px_rgba(20,102,76,0.08)]">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-primary/80">Member Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/70" />
                <Input
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Search by name, email, or mobile"
                  className="h-12 rounded-2xl border-primary/20 bg-background pl-10 shadow-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-border/70 bg-background/55 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick Preset</Label>
                <Select value={preset} onValueChange={(value) => applyPreset(value as Preset)}>
                  <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-muted/25">
                    <SelectValue placeholder="Select preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="this_year">This Year</SelectItem>
                    <SelectItem value="last_year">Last Year</SelectItem>
                    <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                    <SelectItem value="pending_only">Pending Only</SelectItem>
                    <SelectItem value="approved_only">Approved Only</SelectItem>
                    <SelectItem value="rejected_only">Rejected Only</SelectItem>
                    <SelectItem value="top_contributors">Top Contributors</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Report Type</Label>
                <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                  <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-muted/25">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment Method</Label>
                <Select value={methodFilter} onValueChange={(value) => setMethodFilter(value as MethodFilter)}>
                  <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-muted/25">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="mobile_banking">Mobile Banking</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                  <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-muted/25">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(reportType === "monthly" || reportType === "yearly") && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Year</Label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-muted/25">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {reportType === "monthly" && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Month</Label>
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-muted/25">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {MONTHS[value - 1]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {reportType === "custom" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("h-11 w-full justify-start rounded-2xl border-border/70 bg-muted/25 text-left font-normal", !startDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "dd/MM/yy") : "Start"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={startDate} onSelect={setStartDate} className="pointer-events-auto p-3" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("h-11 w-full justify-start rounded-2xl border-border/70 bg-muted/25 text-left font-normal", !endDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "dd/MM/yy") : "End"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={endDate} onSelect={setEndDate} className="pointer-events-auto p-3" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-3 rounded-[20px] border border-border/70 bg-muted/10 p-4">
              <Button type="button" variant="outline" onClick={resetFilters} className="h-12 rounded-2xl px-6 text-base font-semibold">
                Reset
              </Button>
              <Button onClick={generateReport} disabled={loading} className="h-12 rounded-2xl px-6 text-base font-semibold">
                {loading ? "Generating..." : "Generate Report"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {report && (
        <Card className="overflow-hidden rounded-[28px] border border-border/70 bg-card/88 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-4">
            <CardTitle className="text-lg">{report.title}</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportCsv} className="rounded-2xl">
                <FileText className="mr-1.5 h-4 w-4" /> CSV
              </Button>
              <Button size="sm" variant="outline" onClick={exportPdf} disabled={exportingPdf} className="rounded-2xl">
                {exportingPdf ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />}
                {isNativePlatform ? "Save PDF" : "PDF"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-4">
                <p className="text-xs text-muted-foreground">Collected</p>
                <p className="mt-1 text-lg font-bold">BDT {report.totalCollected.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-success/10 to-success/5 p-4">
                <p className="text-xs text-muted-foreground">Shares</p>
                <p className="mt-1 text-lg font-bold">{report.totalShares}</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-warning/10 to-warning/5 p-4">
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="mt-1 text-lg font-bold">{report.totalPending}</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-destructive/10 to-destructive/5 p-4">
                <p className="text-xs text-muted-foreground">Rejected</p>
                <p className="mt-1 text-lg font-bold">{report.totalRejected}</p>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-muted/50 p-4">
                <p className="mb-1 text-xs text-muted-foreground">Bank</p>
                <p className="font-bold">{report.bankCount} payments</p>
                <p className="text-sm text-muted-foreground">BDT {report.bankAmount.toLocaleString()} collected</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-4">
                <p className="mb-1 text-xs text-muted-foreground">Mobile Banking</p>
                <p className="font-bold">{report.mobileCount} payments</p>
                <p className="text-sm text-muted-foreground">BDT {report.mobileAmount.toLocaleString()} collected</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Total payments: <Badge variant="secondary">{report.payments.length}</Badge> -
              Approved: <Badge variant="default">{report.totalApproved}</Badge> -
              Pending: <Badge variant="outline">{report.totalPending}</Badge> -
              Rejected: <Badge variant="destructive">{report.totalRejected}</Badge>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
