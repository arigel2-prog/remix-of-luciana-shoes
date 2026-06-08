import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "./pages/Dashboard";
import Catalog from "./pages/Catalog";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Orders from "./pages/Orders";
import NewOrder from "./pages/NewOrder";
import OrderDetail from "./pages/OrderDetail";
import StyleDetail from "./pages/StyleDetail";
import Collections from "./pages/Collections";
import FactoryCrossCheck from "./pages/FactoryCrossCheck";
import Finance from "./pages/Finance";
import Analytics from "./pages/Analytics";
import WholesaleLogin from "./pages/WholesaleLogin";
import WholesaleDashboard from "./pages/WholesaleDashboard";
import AdminLogin from "./pages/AdminLogin";
import Team from "./pages/Team";
import AcceptInvite from "./pages/AcceptInvite";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";



const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
          <Route path="/catalog/:id" element={<ProtectedRoute><StyleDetail /></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
          <Route path="/clients/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/orders/new" element={<ProtectedRoute><NewOrder /></ProtectedRoute>} />
          <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
          <Route path="/collections" element={<ProtectedRoute><Collections /></ProtectedRoute>} />
          <Route path="/factory-check" element={<ProtectedRoute><FactoryCrossCheck /></ProtectedRoute>} />
          <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/wholesale/login" element={<WholesaleLogin />} />
          <Route path="/wholesale" element={<WholesaleDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
