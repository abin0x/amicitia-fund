import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { role, viewMode, toggleViewMode } = useAuth();
  const navigate = useNavigate();

  const handleViewModeToggle = () => {
    const nextMode = viewMode === "admin" ? "member" : "admin";
    toggleViewMode();
    navigate(nextMode === "admin" ? "/admin" : "/", { replace: true });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b flex items-center justify-between px-4 bg-card">
            <SidebarTrigger />
            {role === "admin" && (
              <div className="flex items-center gap-3">
                <Badge variant={viewMode === "admin" ? "default" : "secondary"} className="text-xs">
                  Viewing as: {viewMode === "admin" ? "Admin" : "Member"}
                </Badge>
                <Button size="sm" variant="outline" onClick={handleViewModeToggle}>
                  <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" />
                  Switch to {viewMode === "admin" ? "Member" : "Admin"} View
                </Button>
              </div>
            )}
          </header>
          <div className="flex-1 p-6 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
