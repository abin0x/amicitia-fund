import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Clock3,
  CreditCard,
  FileBarChart,
  History,
  Home,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

type NavItem = {
  label: string;
  to: string;
  icon: typeof Home;
  end?: boolean;
};

const memberTabs: NavItem[] = [
  { label: "Home", to: "/", icon: Home, end: true },
  { label: "History", to: "/payment-history", icon: History },
  { label: "Transparency", to: "/transparency", icon: Sparkles },
  { label: "Profile", to: "/profile", icon: UserRound },
];

const adminTabs: NavItem[] = [
  { label: "Home", to: "/admin", icon: ShieldCheck, end: true },
  { label: "Pending", to: "/admin/pending", icon: Clock3 },
  { label: "Members", to: "/admin/members", icon: Users },
  { label: "Reports", to: "/admin/reports", icon: FileBarChart },
];

export function MobileBottomNav() {
  const { role, viewMode, canAccessMemberView } = useAuth();
  const isAdminView = role === "admin" && viewMode === "admin";
  const forceAdminOnly = role === "admin" && !canAccessMemberView;
  const tabs = isAdminView || forceAdminOnly ? adminTabs : memberTabs;
  const action = isAdminView || forceAdminOnly
    ? { to: "/admin/payments", label: "Payments", icon: BarChart3 }
    : { to: "/submit-payment", label: "Pay", icon: CreditCard };

  return (
    <div className="md:hidden">
      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-1 pt-2">
        <div className="mx-auto max-w-md rounded-[28px] border border-border/70 bg-card/88 px-2 pb-2 pt-3 shadow-[0_-8px_40px_rgba(17,24,39,0.12)] backdrop-blur-2xl">
          <div className="grid grid-cols-5 items-end gap-1">
            {tabs.slice(0, 2).map((item) => (
              <BottomNavItem key={item.to} {...item} />
            ))}

            <BottomNavItem to={action.to} label={action.label} icon={action.icon} />

            {tabs.slice(2).map((item) => (
              <BottomNavItem key={item.to} {...item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BottomNavItem({ label, to, icon: Icon, end }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className="flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium text-muted-foreground transition-colors"
      activeClassName="bg-primary/10 text-primary"
    >
      {({ isActive }: { isActive?: boolean }) => (
        <>
          <Icon className={cn("h-[18px] w-[18px]", isActive && "scale-110")} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}
