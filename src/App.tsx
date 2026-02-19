import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ProfileGuard from "@/components/ProfileGuard";
import AppLayout from "@/components/AppLayout";
import ViewModeRedirect from "@/components/ViewModeRedirect";
import AuthPage from "./pages/AuthPage";
import AdminAuthPage from "./pages/AdminAuthPage";
import MemberDashboard from "./pages/MemberDashboard";
import SubmitPayment from "./pages/SubmitPayment";
import PaymentHistory from "./pages/PaymentHistory";
import ProfilePage from "./pages/ProfilePage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminPayments from "./pages/AdminPayments";
import AdminMembers from "./pages/AdminMembers";
import AdminReports from "./pages/AdminReports";
import AdminPendingPayments from "./pages/AdminPendingPayments";
import TransparencyPage from "./pages/TransparencyPage";
import NotFound from "./pages/NotFound";
import VerifyEmailPage from "./pages/VerifyEmailPage";

const queryClient = new QueryClient();

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>
      <ProfileGuard>{children}</ProfileGuard>
    </AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/admin/auth" element={<AdminAuthPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/" element={<ProtectedPage><ViewModeRedirect><MemberDashboard /></ViewModeRedirect></ProtectedPage>} />
            <Route path="/profile" element={<ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>} />
            <Route path="/submit-payment" element={<ProtectedPage><SubmitPayment /></ProtectedPage>} />
            <Route path="/payment-history" element={<ProtectedPage><PaymentHistory /></ProtectedPage>} />
            <Route path="/admin" element={<ProtectedPage><AdminDashboard /></ProtectedPage>} />
            <Route path="/admin/payments" element={<ProtectedPage><AdminPayments /></ProtectedPage>} />
            <Route path="/admin/members" element={<ProtectedPage><AdminMembers /></ProtectedPage>} />
            <Route path="/admin/reports" element={<ProtectedPage><AdminReports /></ProtectedPage>} />
            <Route path="/admin/pending" element={<ProtectedPage><AdminPendingPayments /></ProtectedPage>} />
            <Route path="/transparency" element={<ProtectedPage><TransparencyPage /></ProtectedPage>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
