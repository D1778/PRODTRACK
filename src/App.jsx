import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute, { GuestRoute } from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import DashboardHome from "./pages/DashboardHome";
import Products from "./pages/Products";
import ProductForm from "./pages/ProductForm";
import Stock from "./pages/Stock";
import History from "./pages/History";
import Alerts from "./pages/Alerts";
import Profile from "./pages/Profile";
import Billing from "./pages/Billing";
import StaffManagement from "./pages/StaffManagement";
import NotFound from "./pages/NotFound";
import Logbook from "./pages/Logbook";

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />

            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
              <Route index element={<DashboardHome />} />
              <Route path="billing" element={<Billing />} />
              <Route path="products" element={<Products />} />
              <Route path="add-product" element={<ProductForm />} />
              <Route path="products/:id/edit" element={<ProductForm />} />
              <Route path="stock" element={<Stock />} />
              <Route path="history" element={<History />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="profile" element={<Profile />} />
              <Route path="staff" element={<ProtectedRoute roles={["owner"]}><StaffManagement /></ProtectedRoute>} />
              <Route path="logbook" element={<ProtectedRoute roles={["owner"]}><Logbook /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </ToastProvider>
  );
}
