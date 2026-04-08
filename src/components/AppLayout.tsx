import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, ChevronRight, Sparkles, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { role, viewMode, canAccessMemberView, toggleViewMode } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleViewModeToggle = () => {
    const nextMode = viewMode === "admin" ? "member" : "admin";
    toggleViewMode();
    navigate(nextMode === "admin" ? "/admin" : "/", { replace: true });
  };

  return (
    <SidebarProvider>
      <div className="app-shell min-h-screen w-full">
        <AppSidebar />
        <main className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/50 bg-background/70 backdrop-blur-2xl">
            <div className="mx-auto w-full max-w-6xl px-4 pb-4 pt-4 md:px-6">
              <div className="flex items-start justify-between gap-4 rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_24%),linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-4 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)] dark:border-slate-800/80 dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_24%),linear-gradient(145deg,rgba(15,23,42,0.96),rgba(17,24,39,0.94))] md:px-5">
                <div className="flex items-center gap-3">
                  <div className="md:hidden">
                    <img src="/amicitia-logo.png" alt="Amicitia logo" className="theme-logo h-10 w-auto max-w-[170px] object-contain" />
                  </div>
                  <div className="hidden md:block">
                    <SidebarTrigger className="mt-1 rounded-2xl border border-border/70 bg-card/80 shadow-sm" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {role === "admin" && canAccessMemberView && (
                        <Badge
                          variant="secondary"
                          className="shrink-0 rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[10px] font-semibold text-primary"
                        >
                          {viewMode === "admin" ? "Admin view" : "Member view"}
                        </Badge>
                      )}
                      {!isMobile && (
                        <Badge className="rounded-full border border-slate-200/70 bg-white/75 px-3 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
                          <Sparkles className="mr-1 h-3 w-3" />
                          Live local mode
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                  <ThemeToggle className="h-11 w-11 rounded-2xl border-border/70 bg-card/80 shadow-sm" />
                  {role === "admin" && !canAccessMemberView && (
                    <Button
                      size={isMobile ? "icon" : "sm"}
                      variant="outline"
                      onClick={() => navigate("/profile")}
                      className="h-11 rounded-2xl border-border/70 bg-card/80 px-3 shadow-sm"
                    >
                      <UserRound className="h-4 w-4" />
                      {!isMobile && <span className="ml-2">Profile</span>}
                    </Button>
                  )}
                  {role === "admin" && canAccessMemberView && (
                    <Button
                      size={isMobile ? "icon" : "sm"}
                      variant="outline"
                      onClick={handleViewModeToggle}
                      className="h-11 rounded-2xl border-border/70 bg-card/80 px-3 shadow-sm"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                      {!isMobile && (
                        <>
                          <span className="ml-2">Switch to {viewMode === "admin" ? "Member" : "Admin"}</span>
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-6xl flex-1 px-4 pb-28 pt-5 md:px-6 md:pb-8 md:pt-6">
            <div className="w-full">{children}</div>
          </div>
        </main>
        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
