import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
};

const variantStyles = {
  default: "bg-card shadow-md hover:shadow-lg transition-shadow",
  primary: "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 shadow-md hover:shadow-lg transition-shadow",
  success: "bg-gradient-to-br from-success/10 to-success/5 border-success/20 shadow-md hover:shadow-lg transition-shadow",
  warning: "bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20 shadow-md hover:shadow-lg transition-shadow",
  destructive: "bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 shadow-md hover:shadow-lg transition-shadow",
};

const iconVariant = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
};

export function StatCard({ title, value, icon: Icon, description, variant = "default" }: StatCardProps) {
  return (
    <Card className={`${variantStyles[variant]} border-0 rounded-xl`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${iconVariant[variant]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
