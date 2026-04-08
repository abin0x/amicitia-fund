import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

type StatCardProps = {
  className?: string;
  title: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
};

const variantStyles = {
  default:
    "border border-slate-200/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] shadow-[0_18px_42px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(15,23,42,0.12)] dark:border-slate-800/80 dark:bg-[linear-gradient(145deg,rgba(15,23,42,0.96),rgba(17,24,39,0.94))]",
  primary:
    "border border-emerald-500/18 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.20),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.98),rgba(236,253,245,0.96))] shadow-[0_18px_42px_rgba(16,185,129,0.16)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_52px_rgba(16,185,129,0.22)] dark:border-emerald-400/20 dark:bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_28%),linear-gradient(145deg,rgba(15,23,42,0.98),rgba(6,78,59,0.34))]",
  success:
    "border border-sky-500/18 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.98),rgba(239,246,255,0.96))] shadow-[0_18px_42px_rgba(14,165,233,0.14)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_52px_rgba(14,165,233,0.20)] dark:border-sky-400/20 dark:bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_28%),linear-gradient(145deg,rgba(15,23,42,0.98),rgba(12,74,110,0.34))]",
  warning:
    "border border-amber-500/18 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.98),rgba(255,251,235,0.96))] shadow-[0_18px_42px_rgba(245,158,11,0.14)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_52px_rgba(245,158,11,0.20)] dark:border-amber-400/20 dark:bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_28%),linear-gradient(145deg,rgba(15,23,42,0.98),rgba(120,53,15,0.34))]",
  destructive:
    "border border-rose-500/18 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.18),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.98),rgba(255,241,242,0.96))] shadow-[0_18px_42px_rgba(244,63,94,0.14)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_52px_rgba(244,63,94,0.20)] dark:border-rose-400/20 dark:bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.16),transparent_28%),linear-gradient(145deg,rgba(15,23,42,0.98),rgba(127,29,29,0.34))]",
};

const iconVariant = {
  default: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  primary: "bg-emerald-500/14 text-emerald-700 dark:text-emerald-300",
  success: "bg-sky-500/14 text-sky-700 dark:text-sky-300",
  warning: "bg-amber-500/14 text-amber-700 dark:text-amber-300",
  destructive: "bg-rose-500/14 text-rose-700 dark:text-rose-300",
};

export function StatCard({ className = "", title, value, icon: Icon, description, variant = "default" }: StatCardProps) {
  return (
    <Card className={`${variantStyles[variant]} ${className} rounded-[28px] overflow-hidden backdrop-blur-xl`}>
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
            <p className="text-[1.95rem] font-black leading-none tracking-tight text-foreground md:text-[2.1rem]">{value}</p>
            {description && <p className="pt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
          </div>
          {Icon && (
            <div className={`rounded-[20px] p-3.5 shadow-sm ${iconVariant[variant]}`}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
