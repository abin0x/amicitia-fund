import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  CreditCard,
  History,
  Users,
  ClipboardCheck,
  LogOut,
  UserCircle,
  FileBarChart,
  AlertCircle,
  Eye,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const memberItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Submit Payment", url: "/submit-payment", icon: CreditCard },
  { title: "Payment History", url: "/payment-history", icon: History },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Profile", url: "/profile", icon: UserCircle },
  { title: "Transparency", url: "/transparency", icon: Eye },
];

const adminItems = [
  { title: "Admin Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Manage Payments", url: "/admin/payments", icon: ClipboardCheck },
  { title: "Pending Payments", url: "/admin/pending", icon: AlertCircle },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Members", url: "/admin/members", icon: Users },
  { title: "Reports", url: "/admin/reports", icon: FileBarChart },
];

export function AppSidebar() {
  const { viewMode, signOut, user } = useAuth();

  return (
    <Sidebar className="hidden border-r-0 md:flex md:w-[290px]">
      <div className="px-5 py-6 flex items-center gap-3">
        <img src="/amicitia-logo.png" alt="Amicitia logo" className="theme-logo h-12 w-auto max-w-[180px] object-contain" />
        <div className="min-w-0 overflow-hidden">
          <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
        </div>
      </div>

      <SidebarContent className="px-3">
        {(viewMode === "member") && (
          <SidebarGroup className="mt-2">
            <SidebarGroupLabel className="px-3 text-sidebar-foreground/40 text-[11px] uppercase tracking-[0.22em]">
              Member
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {memberItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="flex items-center rounded-2xl px-3 py-3 text-sm hover:bg-sidebar-accent/70"
                        activeClassName="bg-white/10 text-white font-semibold shadow-sm"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {viewMode === "admin" && (
          <SidebarGroup className="mt-2">
            <SidebarGroupLabel className="px-3 text-sidebar-foreground/40 text-[11px] uppercase tracking-[0.22em]">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className="flex items-center rounded-2xl px-3 py-3 text-sm hover:bg-sidebar-accent/70"
                        activeClassName="bg-white/10 text-white font-semibold shadow-sm"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Button
          variant="outline"
          className="h-12 w-full justify-between rounded-2xl border-sidebar-border/70 bg-white/10 px-4 text-sidebar-foreground shadow-sm transition-all hover:border-sidebar-primary/40 hover:bg-white/15 hover:text-sidebar-foreground"
          onClick={signOut}
        >
          <span className="flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            <span className="font-medium">Sign Out</span>
          </span>
          <span className="text-[10px] uppercase tracking-wide text-sidebar-foreground/60">Secure</span>
        </Button>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-[11px] leading-4 text-sidebar-foreground/60">
          <p>&copy; Amicitia. All rights reserved.</p>
          <p>Developed by Obaidur Rahman Humayun</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

