import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, FileDown, FileText, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { getMonthOptionsForYear, getYearOptionsDesc, isPeriodBeforeLaunch } from "@/lib/period";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { toast } from "sonner";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type ReportData = {
  totalCollected: number;
  totalApproved: number;
  totalPending: number;
  totalRejected: number;
  totalShares: number;
  bankCount: number;
  mobileCount: number;
  bankAmount: number;
  mobileAmount: number;
  payments: any[];
};

const getSafeReportFileName = (title: string, extension: "pdf" | "csv") =>
  `report-${title.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "")}.${extension}`;

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to convert file"));
        return;
      }
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(blob);
  });

const triggerBrowserDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const REPORTS_DIRECTORY = "Amicitia";

const ensureNativeDocumentsAccess = async () => {
  const current = await Filesystem.checkPermissions();
  if (current.publicStorage === "granted") {
    return;
  }

  const requested = await Filesystem.requestPermissions();
  if (requested.publicStorage !== "granted") {
    throw new Error("Storage permission is required to save reports.");
  }
};

const saveBlobToNativeDocuments = async (blob: Blob, fileName: string) => {
  await ensureNativeDocumentsAccess();

  const base64Data = await blobToBase64(blob);
  const targetPath = `${REPORTS_DIRECTORY}/${fileName}`;

  await Filesystem.mkdir({
    path: REPORTS_DIRECTORY,
    directory: Directory.Documents,
    recursive: true,
  }).catch(() => {});

  const savedFile = await Filesystem.writeFile({
    path: targetPath,
    data: base64Data,
    directory: Directory.Documents,
    recursive: true,
  });

  return {
    uri: savedFile.uri,
    displayPath: `Documents/${REPORTS_DIRECTORY}/${fileName}`,
  };
};

export default function AdminReports() {
  const now = new Date();
  const launchDate = new Date(2025, 10, 1);
  const [reportType, setReportType] = useState<"monthly" | "yearly" | "custom">("monthly");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const years = getYearOptionsDesc();
  const monthOptions = getMonthOptionsForYear(parseInt(year));

  useEffect(() => {
    if (!monthOptions.includes(parseInt(month))) {
      setMonth(String(monthOptions[0] ?? 11));
    }
  }, [year, month, monthOptions]);

  const generateReport = async () => {
    setLoading(true);
    const { data: payments } = await supabase.from("payments").select("*");
    if (!payments) {
      setLoading(false);
      return;
    }

    const userIds = [...new Set(payments.map((p) => p.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, name, mobile_number").in("user_id", userIds);
    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

    const launchFiltered = payments.filter((p) => !isPeriodBeforeLaunch(p.year, p.month));
    let filtered = launchFiltered;
    if (reportType === "monthly") {
      filtered = launchFiltered.filter((p) => p.month === parseInt(month) && p.year === parseInt(year));
    } else if (reportType === "yearly") {
      filtered = launchFiltered.filter((p) => p.year === parseInt(year));
    } else if (startDate && endDate) {
      filtered = launchFiltered.filter((p) => {
        const d = new Date(p.created_at);
        return d >= startDate && d <= endDate;
      });
    }

    const enriched = filtered.map((p) => ({
      ...p,
      member_name: (profileMap.get(p.user_id) as any)?.name || "-",
      member_mobile: (profileMap.get(p.user_id) as any)?.mobile_number || "-",
    }));

    const finalPayments = statusFilter === "all" ? enriched : enriched.filter((p) => p.status === statusFilter);

    const approved = enriched.filter((p) => p.status === "approved");
    const pending = enriched.filter((p) => p.status === "pending");
    const rejected = enriched.filter((p) => p.status === "rejected");
    const bank = enriched.filter((p) => p.payment_method === "bank");
    const mobile = enriched.filter((p) => p.payment_method === "mobile_banking");

    setReport({
      totalCollected: approved.reduce((s, p) => s + p.amount, 0),
      totalApproved: approved.length,
      totalPending: pending.length,
      totalRejected: rejected.length,
      totalShares: approved.reduce((s, p) => s + (p.share_quantity || 0), 0),
      bankCount: bank.length,
      mobileCount: mobile.length,
      bankAmount: bank.filter((p) => p.status === "approved").reduce((s, p) => s + p.amount, 0),
      mobileAmount: mobile.filter((p) => p.status === "approved").reduce((s, p) => s + p.amount, 0),
      payments: finalPayments,
    });
    setLoading(false);
  };

  const getTitle = () => {
    if (reportType === "monthly") return `${MONTHS[parseInt(month) - 1]} ${year} Report`;
    if (reportType === "yearly") return `${year} Annual Report`;
    if (startDate && endDate) return `${format(startDate, "dd MMM yyyy")} - ${format(endDate, "dd MMM yyyy")}`;
    return "Custom Report";
  };

  const exportCSV = () => {
    if (!report) return;
    const headers = ["SL", "Name", "Mobile", "Month", "No of Shares", "Amount (BDT)", "Payment Method", "Status"];
    const rows = report.payments.map((p: any, i: number) => [
      i + 1,
      p.member_name,
      p.member_mobile,
      `${MONTHS[p.month - 1]} ${p.year}`,
      p.share_quantity || "",
      p.amount,
      p.payment_method === "mobile_banking" ? "Mobile Banking" : "Bank",
      p.status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const fileName = getSafeReportFileName(getTitle(), "csv");

    if (Capacitor.isNativePlatform()) {
      void saveBlobToNativeDocuments(blob, fileName)
        .then(({ displayPath }) => {
          toast.success(`CSV saved to ${displayPath}`);
        })
        .catch((error) => {
          console.error("CSV export error:", error);
          toast.error(error instanceof Error ? error.message : "Failed to save CSV.");
        });
      return;
    }

    triggerBrowserDownload(blob, fileName);
    toast.success("CSV downloaded successfully.");
  };

  const exportPDF = async () => {
    if (!report) return;
    setExportingPdf(true);

    try {
      const escapeHtml = (value: unknown) =>
        String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

      const reportNode = document.createElement("div");
      reportNode.style.position = "fixed";
      reportNode.style.left = "-10000px";
      reportNode.style.top = "0";
      reportNode.style.width = "1400px";
      reportNode.style.background = "#ffffff";
      reportNode.style.color = "#0f172a";
      reportNode.style.padding = "56px";
      reportNode.style.fontFamily = "\"AmicitiaBangla\", \"Noto Sans Bengali\", \"Hind Siliguri\", \"SolaimanLipi\", Arial, sans-serif";

      const rowsHtml = report.payments
        .map((p: any, i: number) => {
          const status =
            p.status === "approved"
              ? "অনুমোদিত (Approved)"
              : p.status === "pending"
                ? "অপেক্ষমাণ (Pending)"
                : "প্রত্যাখ্যাত (Rejected)";
          const method = p.payment_method === "mobile_banking" ? "মোবাইল (Mobile)" : "ব্যাংক (Bank)";
          return `
            <tr>
              <td style="padding:14px 12px;border:1px solid #d7dee8;">${i + 1}</td>
              <td style="padding:14px 12px;border:1px solid #d7dee8;">${escapeHtml(p.member_name)}</td>
              <td style="padding:14px 12px;border:1px solid #d7dee8;">${escapeHtml(p.member_mobile)}</td>
              <td style="padding:14px 12px;border:1px solid #d7dee8;">${MONTHS[p.month - 1]} ${p.year}</td>
              <td style="padding:14px 12px;border:1px solid #d7dee8;">${p.share_quantity || "N/A"}</td>
              <td style="padding:14px 12px;border:1px solid #d7dee8;">৳${Number(p.amount || 0).toLocaleString()}</td>
              <td style="padding:14px 12px;border:1px solid #d7dee8;">${method}</td>
              <td style="padding:14px 12px;border:1px solid #d7dee8;">${status}</td>
            </tr>`;
        })
        .join("");

      reportNode.innerHTML = `
        <style>
          @font-face {
            font-family: 'AmicitiaBangla';
            src: url('/fonts/NotoSansBengali.ttf') format('truetype');
            font-weight: 400 800;
            font-style: normal;
          }
          .amicitia-title {
            font-family: 'AmicitiaBangla', 'Noto Sans Bengali', 'Hind Siliguri', 'SolaimanLipi', Arial, sans-serif;
            letter-spacing: 0;
            line-height: 1.25;
          }
        </style>
        <div style="text-align:center;margin-bottom:34px;">
          <div style="width:94px;height:94px;border-radius:50%;background:#e8f5ef;border:2px solid #1f6f52;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
            <svg width="58" height="58" viewBox="0 0 24 24" fill="none" aria-label="Bank Logo" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 9L12 4L21 9" stroke="#1f6f52" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M5 10V18" stroke="#1f6f52" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M9 10V18" stroke="#1f6f52" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M15 10V18" stroke="#1f6f52" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M19 10V18" stroke="#1f6f52" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M4 20H20" stroke="#1f6f52" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </div>
          <h1 class="amicitia-title" style="margin:0;font-size:42px;font-weight:800;">অ্যামিসিটিয়া (Amicitia) ইনভেস্টমেন্ট রিপোর্ট</h1>
          <p style="margin:10px 0 0;font-size:24px;color:#334155;">${escapeHtml(getTitle())}</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:28px;">
          <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;padding:14px 16px;">
            <p style="margin:0;color:#065f46;font-size:16px;">মোট তহবিল / Total Collected</p>
            <p style="margin:6px 0 0;font-size:30px;font-weight:800;">৳${report.totalCollected.toLocaleString()}</p>
          </div>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px 16px;">
            <p style="margin:0;color:#1e3a8a;font-size:16px;">শেয়ার / Shares</p>
            <p style="margin:6px 0 0;font-size:30px;font-weight:800;">${report.totalShares}</p>
          </div>
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px 16px;">
            <p style="margin:0;color:#92400e;font-size:16px;">অপেক্ষমাণ / Pending</p>
            <p style="margin:6px 0 0;font-size:30px;font-weight:800;">${report.totalPending}</p>
          </div>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 16px;">
            <p style="margin:0;color:#991b1b;font-size:16px;">প্রত্যাখ্যাত / Rejected</p>
            <p style="margin:6px 0 0;font-size:30px;font-weight:800;">${report.totalRejected}</p>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:26px;margin-bottom:34px;">
          <thead>
            <tr style="background:#1f6f52;color:#fff;">
              <th style="padding:14px;border:1px solid #d1d5db;text-align:left;">বিবরণ / Item</th>
              <th style="padding:14px;border:1px solid #d1d5db;text-align:left;">মান / Value</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="padding:12px;border:1px solid #d1d5db;">মোট তহবিল সংগ্রহিত / Total Collected</td><td style="padding:12px;border:1px solid #d1d5db;">৳${report.totalCollected.toLocaleString()}</td></tr>
            <tr><td style="padding:12px;border:1px solid #d1d5db;">মোট শেয়ার বিক্রি / Total Shares Sold</td><td style="padding:12px;border:1px solid #d1d5db;">${report.totalShares}</td></tr>
            <tr><td style="padding:12px;border:1px solid #d1d5db;">অনুমোদিত পেমেন্ট / Approved Payments</td><td style="padding:12px;border:1px solid #d1d5db;">${report.totalApproved}</td></tr>
            <tr><td style="padding:12px;border:1px solid #d1d5db;">অপেক্ষমাণ পেমেন্ট / Pending Payments</td><td style="padding:12px;border:1px solid #d1d5db;">${report.totalPending}</td></tr>
            <tr><td style="padding:12px;border:1px solid #d1d5db;">প্রত্যাখ্যাত পেমেন্ট / Rejected Payments</td><td style="padding:12px;border:1px solid #d1d5db;">${report.totalRejected}</td></tr>
            <tr><td style="padding:12px;border:1px solid #d1d5db;">ব্যাংক ট্রান্সফার / Bank Transfer</td><td style="padding:12px;border:1px solid #d1d5db;">${report.bankCount} (৳${report.bankAmount.toLocaleString()})</td></tr>
            <tr><td style="padding:12px;border:1px solid #d1d5db;">মোবাইল ব্যাংকিং / Mobile Banking</td><td style="padding:12px;border:1px solid #d1d5db;">${report.mobileCount} (৳${report.mobileAmount.toLocaleString()})</td></tr>
          </tbody>
        </table>
        <h2 style="margin:0 0 12px;font-size:28px;font-weight:700;">বিস্তারিত পেমেন্ট তালিকা / Detailed Payment List</h2>
        <table style="width:100%;border-collapse:collapse;font-size:22px;">
          <thead>
            <tr style="background:#1f6f52;color:#fff;">
              <th style="padding:12px;border:1px solid #d7dee8;text-align:left;">ক্রম / SL</th>
              <th style="padding:12px;border:1px solid #d7dee8;text-align:left;">নাম / Name</th>
              <th style="padding:12px;border:1px solid #d7dee8;text-align:left;">মোবাইল / Mobile</th>
              <th style="padding:12px;border:1px solid #d7dee8;text-align:left;">মাস / Month</th>
              <th style="padding:12px;border:1px solid #d7dee8;text-align:left;">শেয়ার / Shares</th>
              <th style="padding:12px;border:1px solid #d7dee8;text-align:left;">পরিমাণ / Amount</th>
              <th style="padding:12px;border:1px solid #d7dee8;text-align:left;">মাধ্যম / Method</th>
              <th style="padding:12px;border:1px solid #d7dee8;text-align:left;">স্ট্যাটাস / Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>`;

      document.body.appendChild(reportNode);
      if (document.fonts?.ready) await document.fonts.ready;
      const imageNodes = Array.from(reportNode.querySelectorAll("img"));
      await Promise.all(
        imageNodes.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) resolve(true);
              else {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(true);
              }
            }),
        ),
      );

      const canvas = await html2canvas(reportNode, {
        scale: 2.2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      document.body.removeChild(reportNode);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a3");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const contentHeight = pageHeight - margin * 2;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= contentHeight;

      while (heightLeft > 0) {
        position = margin - (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
        heightLeft -= contentHeight;
      }

      const fileName = getSafeReportFileName(getTitle(), "pdf");
      const pdfBlob = pdf.output("blob");

      if (Capacitor.isNativePlatform()) {
        const { displayPath } = await saveBlobToNativeDocuments(pdfBlob, fileName);
        toast.success(`PDF saved to ${displayPath}`);
      } else {
        triggerBrowserDownload(pdfBlob, fileName);
        toast.success("PDF downloaded successfully.");
      }
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to export PDF. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[28px] border border-border/70 bg-card/88 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
          <CardTitle className="text-lg">Generate Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-4 sm:p-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Report Type</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as any)}>
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

            {(reportType === "monthly" || reportType === "yearly") && (
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-muted/25">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {reportType === "monthly" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-muted/25">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((m) => <SelectItem key={m} value={String(m)}>{MONTHS[m - 1]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status Filter</Label>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
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
            </div>
          )}

          {reportType === "custom" && (
            <div className="grid grid-cols-2 gap-4">
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
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} disabled={(date) => date < launchDate || date > now} className="pointer-events-auto p-3" />
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
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} disabled={(date) => date < launchDate || date > now} className="pointer-events-auto p-3" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          <Button onClick={generateReport} disabled={loading} className="h-12 rounded-2xl px-5 text-base font-semibold">
            {loading ? "Generating..." : "Generate Report"}
          </Button>
        </CardContent>
      </Card>

      {report && (
        <Card className="overflow-hidden rounded-[28px] border border-border/70 bg-card/88 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-4">
            <CardTitle className="text-lg">{getTitle()}</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportCSV} className="rounded-2xl">
                <FileText className="mr-1.5 h-4 w-4" /> CSV
              </Button>
              <Button size="sm" variant="outline" onClick={exportPDF} disabled={exportingPdf} className="rounded-2xl">
                {exportingPdf ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />}
                {Capacitor.isNativePlatform() ? "Save PDF" : "PDF"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-4">
                <p className="text-xs text-muted-foreground">Fund Collected</p>
                <p className="mt-1 text-lg font-bold">৳{report.totalCollected.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-success/10 to-success/5 p-4">
                <p className="text-xs text-muted-foreground">Shares Sold</p>
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
                <p className="mb-1 text-xs text-muted-foreground">Bank Transfers</p>
                <p className="font-bold">{report.bankCount} payments</p>
                <p className="text-sm text-muted-foreground">৳{report.bankAmount.toLocaleString()} collected</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-4">
                <p className="mb-1 text-xs text-muted-foreground">Mobile Banking</p>
                <p className="font-bold">{report.mobileCount} payments</p>
                <p className="text-sm text-muted-foreground">৳{report.mobileAmount.toLocaleString()} collected</p>
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
