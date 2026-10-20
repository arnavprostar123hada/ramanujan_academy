import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import Index from "./pages/Index";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import ParentPortal from "./pages/ParentPortal";
import TeacherDashboard from "./pages/TeacherDashboard";
import EnquiryPortal from "./pages/EnquiryPortal";
import NotFound from "./pages/NotFound";
import OnlineStudentPortal from "./pages/OnlineStudentPortal";
import AIPaperChecker from "./pages/AIPaperChecker";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

const queryClient = new QueryClient();
const AppRouter = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppErrorBoundary>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppRouter>
          <div className="app-shell">
          <div className="app-orb app-orb-one" aria-hidden="true" />
          <div className="app-orb app-orb-two" aria-hidden="true" />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard mode="admin" />} />
            <Route path="/owner" element={<AdminLogin mode="owner" />} />
            <Route path="/owner/dashboard" element={<AdminDashboard mode="owner" />} />
            <Route path="/parent" element={<ParentPortal />} />
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/enquiry" element={<EnquiryPortal />} />
            <Route path="/ai" element={<OnlineStudentPortal />} />
            <Route path="/admin/ai-paper-checker" element={<AIPaperChecker />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </div>
        </AppRouter>
      </TooltipProvider>
    </AppErrorBoundary>
  </QueryClientProvider>
);

export default App;
