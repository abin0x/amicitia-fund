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
  Landmark,
  UserCircle,
  FileBarChart,
  AlertCircle,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const memberItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Submit Payment", url: "/submit-payment", icon: CreditCard },
  { title: "Payment History", url: "/payment-history", icon: History },
  { title: "Profile", url: "/profile", icon: UserCircle },
  { title: "Transparency", url: "/transparency", icon: Eye },
];

const adminItems = [
  { title: "Admin Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Manage Payments", url: "/admin/payments", icon: ClipboardCheck },
  { title: "Pending Payments", url: "/admin/pending", icon: AlertCircle },
  { title: "Members", url: "/admin/members", icon: Users },
  { title: "Reports", url: "/admin/reports", icon: FileBarChart },
];

export function AppSidebar() {
  const { viewMode, signOut, user } = useAuth();

  return (
    <Sidebar className="border-r-0">
      <div className="px-4 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
          <Landmark className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        <div className="overflow-hidden">
          <h2 className="text-sm font-bold text-sidebar-foreground truncate">Amicitia</h2>
          <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
        </div>
      </div>

      <SidebarContent>
        {(viewMode === "member") && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[11px] uppercase tracking-wider">
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
                        className="hover:bg-sidebar-accent/60"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
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
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/40 text-[11px] uppercase tracking-wider">
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
                        className="hover:bg-sidebar-accent/60"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
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
          className="h-11 w-full justify-between rounded-lg border-sidebar-border/60 bg-sidebar-accent/30 px-3 text-sidebar-foreground shadow-sm transition-all hover:border-sidebar-primary/40 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
          onClick={signOut}
        >
          <span className="flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            <span className="font-medium">Sign Out</span>
          </span>
          <span className="text-[10px] uppercase tracking-wide text-sidebar-foreground/60">Secure</span>
        </Button>
        <div className="mt-3 text-center text-[11px] leading-4 text-sidebar-foreground/50">
          <p>&copy; Amicitia. All rights reserved.</p>
          <p>Developed by Obaidur Rahman Humayun</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

