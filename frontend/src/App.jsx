import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from './components/layout/Layout';
import UserProfiles from './pages/UserProfiles';
import RolesProfiles from './pages/RolesManagement';
import CRMPage from './pages/CRMPage';
import InventoryManagement from './pages/InventoryManagement';
import TaskView from './pages/TaskView';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import Admin from './pages/Admin';
import EmployeeDetail from './pages/EmployeeDetail';
import LeaveRequestCard from './pages/LeaveRequestCard';
import HierarchyAssignment from './pages/HierarchyAssignment';
import OrderSummary from "./pages/OrderSummary";
import AlertsManagement from './pages/AlertsManagement';
import SiteManagement from './pages/SiteManagement';
import GeneratorsUtilities from './pages/GeneratorManagement';
import EnergyReports from './pages/GenratorReports';
import CompaniesPage from './components/superadmin/CompaniesManagement';
import GlobalReports from './components/superadmin/GlobalReports';
import EmployeeDashboard from './components/hr/EmployeeDashboard';
import EmployeeDetails from './components/hr/EmployeeDetails';
import { AttendanceManagement } from './components/hr';
import MainDashboard from './pages/MainDashboard';
import DocumentContainer from './pages/DocumentContainer';
import EmployeeManagement from './components/hr/EmployeeManagement';
import MyAttendancePage from './components/hr/MyAttendancePage.jsx';
import CustomerDashboard from './components/CRM/CustomerDashboard.jsx';
import CustomerOrdersPage from './components/CRM/CustomerOrders.jsx';
import CustomerProfileView from './components/CRM/CustomerProfileView.jsx';
import PurchasePage from './components/CRM/PurchaseModule.jsx';
import VendorDashboard from './components/vendor/VendorDashboard.jsx';
import VendorRegister from './components/vendor/VendorRegisteration.jsx';
import SalesVendorManagement from './components/vendor/SalesPage.jsx';
import VendorProducts from './components/vendor/VendorProducts.jsx';
import TicketDetails from './pages/TicketDetails.jsx';
import SupportTickets from './pages/SupportTickets.jsx';
import Invoices from './pages/Invoices.jsx';
import PayrollView from './pages/PayrollView.jsx';
import LeaveContainer from './pages/LeaveContainer.jsx';
import VendorProfile from './components/vendor/VendorManagement.jsx';


// Authentication hook
function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('access_token'); 
  });
  const [showRegister, setShowRegister] = useState(false);


  const login = () => setIsAuthenticated(true);
  const logout = () => {
    localStorage.clear();
    setIsAuthenticated(false);
  }

  // Register also logs user in
  const register = () => {
    setIsAuthenticated(true);
    setShowRegister(false);
  };

  return {
    isAuthenticated,
    login,
    logout,
    showRegister,
    setShowRegister,
    register,
  };
}

// ProtectedRoute: Only shows children if logged in, otherwise redirects to login
function ProtectedRoute({ isAuthenticated, children }) {
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

// AuthGate: Handles login/register switching
function AuthGate({ isAuthenticated, login, showRegister, setShowRegister, register }) {
  if (isAuthenticated) return <RedirectBasedOnRole />;
  return showRegister ? (
    <RegisterForm
      onRegister={register}
      onShowLogin={() => setShowRegister(false)}
    />
  ) : (
    <LoginForm
      onLogin={login}
      onShowRegister={() => setShowRegister(true)}
    />
  );
}

// RedirectBasedOnRole: Redirects user based on their role
function RedirectBasedOnRole() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  // Check if user has specific roles and redirect accordingly
  if (user && user.roles) {
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.roles];
    
    // Check for admin role - should go to dashboard
    const hasAdminRole = userRoles.some(role => {
      const roleName = typeof role === 'string' ? role.toLowerCase() : (role.name || '').toLowerCase();
      return roleName.includes('admin');
    });
    
    // Check for HR role - should go to dashboard  
    const hasHRRole = userRoles.some(role => {
      const roleName = typeof role === 'string' ? role.toLowerCase() : (role.name || '').toLowerCase();
      return roleName.includes('hr');
    });
    
    // Check for customer role - should go to customer dashboard
    const hasCustomerRole = userRoles.some(role => {
      const roleName = typeof role === 'string' ? role.toLowerCase() : (role.name || '').toLowerCase();
      return roleName.includes('customer');
    });
    
    // Check for vendor role - should go to vendor dashboard
    const hasVendorRole = userRoles.some(role => {
      const roleName = typeof role === 'string' ? role.toLowerCase() : (role.name || '').toLowerCase();
      return roleName.includes('vendor');
    });
    
    // Check for employee role - should go to documents
    const hasEmployeeRole = userRoles.some(role => {
      const roleName = typeof role === 'string' ? role.toLowerCase() : (role.name || '').toLowerCase();
      return roleName.includes('employee') || roleName.includes('staff');
    });
    
    // Redirect based on role priority
    if (hasAdminRole) {
      return <Navigate to="/dashboard" replace />;
    }
    if (hasHRRole) {
      return <Navigate to="/dashboard" replace />;
    }
    if (hasCustomerRole) {
      return <Navigate to="/customerdashboard" replace />;
    }
    if (hasVendorRole) {
      return <Navigate to="/vendor-dashboard" replace />;
    }
    if (hasEmployeeRole) {
      return <Navigate to="/documents" replace />;
    }
  }
  
  // Default redirect to dashboard for any other case
  return <Navigate to="/dashboard" replace />;
}

import { PermissionsProvider } from './components/contexts/PermissionContext.jsx';

function App() {
  const auth = useAuth();

  return (
    <PermissionsProvider> 
      <BrowserRouter>
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
        <Routes>
          {/* Auth routes */}
          <Route
            path="/login"
            element={
              <AuthGate
                isAuthenticated={auth.isAuthenticated}
                login={auth.login}
                showRegister={auth.showRegister}
                setShowRegister={auth.setShowRegister}
                register={auth.register}
              />
            }
          />
          {/* Default route: redirect based on user role */}
          <Route
            path="/"
            element={
              auth.isAuthenticated ? (
                <RedirectBasedOnRole />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          {/* Main app, only visible if logged in */}
          <Route
            element={
              <ProtectedRoute isAuthenticated={auth.isAuthenticated}>
                <Layout logout={auth.logout} />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<MainDashboard />} />
            <Route path="/payroll" element={<PayrollView />} />
            <Route path="/customerdashboard" element={<CustomerDashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/users/list" element={<UserProfiles />} />
            <Route path="/users/roles" element={<RolesProfiles />} />
            <Route path="/customers" element={<CRMPage />} />
            <Route path="/vendors" element={<VendorProfile />} />
            <Route path="/profile" element={<CustomerProfileView />} />
            <Route path="/orders" element={<CustomerOrdersPage />} />
            <Route path="/purchase" element={<PurchasePage />} />
            <Route path="/add-product" element={<VendorProducts />} />
            <Route path="/vendor-dashboard" element={<VendorDashboard />} />
            <Route path="/vendor-register" element={<VendorRegister />} />
            <Route path="/sales-vendor-management" element={<SalesVendorManagement />} />
            <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
            <Route path="/employee-details/:id" element={<EmployeeDetails />} />
            <Route path="/hr/*" element={<EmployeeManagement />} />
            <Route path="/inventory/*" element={<InventoryManagement />} />
            {/* <Route path="/accounts/*" element={<AccountsFinance />} /> */}
            <Route path="/tasks" element={<TaskView />} />
            <Route path="/employee/:id" element={<EmployeeDetail />} />
            <Route path="/hierarchy-assignment" element={<HierarchyAssignment />} />
            <Route path="/leave-requests" element={<LeaveRequestCard />} />
            <Route path="/leave-management" element={<LeaveContainer />} />
            <Route path="/order-summary/:customerId" element={<OrderSummary />} />
            <Route path="/alerts" element={<AlertsManagement />} />
            <Route path="/support" element={<SupportTickets />} />
            <Route path="/support/:ticket_id" element={<TicketDetails />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/:invoice_id" element={<Invoices />} />
            <Route path="/site-management" element={<SiteManagement />} />
            <Route path="/generator-management" element={<GeneratorsUtilities />} />
            <Route path="/energy-reports" element={<EnergyReports />} />
            <Route path="/company-management" element={<CompaniesPage />} />
            <Route path="/global-reports" element={<GlobalReports />} />
            <Route path="/mark/attendance" element={<AttendanceManagement />} />
            <Route path="/payroll/management" element={<PayrollView />} />
             <Route path="/documents" element={<DocumentContainer />} />
            <Route path="/employee-documents" element={<Navigate to="/documents" replace />} />
            <Route path="/my-attendance" element={<MyAttendancePage />} />
            <Route path="/vendor-profile" element={<VendorProfile />} />

          </Route>
          {/* 404 */}
          <Route path="*" element={
              <div className="p-4">
                <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
              </div>
            } />
        </Routes>
      </BrowserRouter>
    </PermissionsProvider> 
  );
}

export default App;
