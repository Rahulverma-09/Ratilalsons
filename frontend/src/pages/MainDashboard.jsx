import React, { useEffect, useState } from "react";
import { API_URL } from '../config.js';

import ClientDashboard from "./Dashboard";
import { DashboardContainer } from "../components/hr";
import EmployeeDashboard from "../components/hr/EmployeeDashboard";
import CustomerDashboard from "../components/CRM/CustomerDashboard";
import VendorDashboard from "../components/vendor/VendorDashboard";
import ErrorBoundary from "../components/ErrorBoundary";

const PERMISSIONS_API = `${API_URL}/api/permissions/my`;

// List the codes that allow dashboard access
const DASHBOARD_PERMISSION_CODES = ["dashboard:read", "dashboard:view"];


export default function MainDashboard() {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleNames, setRoleNames] = useState([]);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch(PERMISSIONS_API, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
        const data = await res.json();
        // API returns an array of permission objects
        setPermissions((Array.isArray(data) ? data : []).map(perm => perm.code));
      } catch (e) {
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPermissions();
    // Get role names from localStorage if available - check multiple storage keys
    try {
      let user = null;
      
      // Try multiple localStorage keys where user data might be stored
      const userKeys = ["user", "currentUser", "user_info"];
      
      for (const key of userKeys) {
        const userStr = localStorage.getItem(key);
        if (userStr) {
          try {
            const parsedUser = JSON.parse(userStr);
            if (parsedUser && (parsedUser.roles || parsedUser.role || parsedUser.role_names)) {
              user = parsedUser;
              console.log(`Found user data in localStorage key '${key}':`, user);
              break;
            }
          } catch (e) {
            console.warn(`Error parsing user data from '${key}':`, e);
          }
        }
      }
      
      if (user && (user.roles || user.role || user.role_names)) {
        let roles = [];
        
        // Extract roles from multiple possible fields
        if (Array.isArray(user.roles)) {
          roles = user.roles.map(r =>
            typeof r === "string"
              ? r.trim().toLowerCase()
              : (r.name || r.role || "").trim().toLowerCase()
          );
        } else if (typeof user.roles === "string") {
          roles = [user.roles.trim().toLowerCase()];
        }
        
        if (user.role && typeof user.role === "string") {
          roles.push(user.role.trim().toLowerCase());
        }
        
        if (Array.isArray(user.role_names)) {
          roles = [...roles, ...user.role_names.map(r => 
            typeof r === "string" ? r.trim().toLowerCase() : ""
          ).filter(r => r)];
        }
        
        // Remove duplicates and filter out empty strings
        setRoleNames([...new Set(roles.filter(r => r))]);
      }
    } catch (e) {
      console.error("Error extracting user roles:", e);
    }
  }, []);

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  // Check for necessary dashboard permission
  const canViewDashboard = permissions.some(code => DASHBOARD_PERMISSION_CODES.includes(code));
  
  // Also allow employees to view dashboard if they have any of the typical employee permissions
  const hasEmployeePermissions = permissions.some(code => 
    ['tasks:access', 'attendance:access', 'profile:access', 'documents:access'].includes(code)
  );
  
  // Check role names for fallback access
  const hasEmployeeRole = roleNames.some(role => 
    ['employee', 'staff', 'ro-024'].includes(role.toLowerCase())
  );

  const allowDashboardAccess = canViewDashboard || hasEmployeePermissions || hasEmployeeRole;

  console.log('=== DASHBOARD ACCESS DEBUG ===');
  console.log('Permissions:', permissions);
  console.log('Role Names:', roleNames); 
  console.log('canViewDashboard:', canViewDashboard);
  console.log('hasEmployeePermissions:', hasEmployeePermissions);
  console.log('hasEmployeeRole:', hasEmployeeRole);
  console.log('allowDashboardAccess:', allowDashboardAccess);
  console.log('================================');

  if (!allowDashboardAccess) {
    console.log('Dashboard access denied. Permissions:', permissions, 'Roles:', roleNames);
    return (
      <div className="p-8 text-red-600 text-2xl text-center font-semibold">
        You are not allowed to view dashboard.
        <div className="text-sm mt-4 text-gray-600">
          Debug: Permissions: {JSON.stringify(permissions)}, Roles: {JSON.stringify(roleNames)}
        </div>
      </div>
    );
  }

  // Get user info for additional admin detection - check multiple storage locations
  let user = {};
  let userId = null;
  let username = null;
  
  try {
    const userKeys = ["user", "currentUser", "user_info"];
    for (const key of userKeys) {
      const userStr = localStorage.getItem(key);
      if (userStr) {
        try {
          const parsedUser = JSON.parse(userStr);
          if (parsedUser && (parsedUser.id || parsedUser.user_id || parsedUser.username)) {
            user = parsedUser;
            userId = user.id || user.user_id;
            username = user.username || user.name;
            console.log(`Using user data from localStorage key '${key}':`, user);
            break;
          }
        } catch (e) {
          console.warn(`Error parsing user from '${key}':`, e);
        }
      }
    }
  } catch (e) {
    console.error("Error getting user info:", e);
  }

  console.log('=== MAIN DASHBOARD DEBUG START ===');
  console.log('User permissions:', permissions);
  console.log('Role names:', roleNames);
  console.log('Raw user data:', user);
  console.log('Can view dashboard:', allowDashboardAccess);

  // Additional admin check: if user has permissions across multiple domains, likely admin
  const hasMultipleDomainAccess = [
    permissions.some(code => code.includes("hr")),
    permissions.some(code => code.includes("employee")),
    permissions.some(code => code.includes("vendor")),
    permissions.some(code => code.includes("customer")),
    permissions.some(code => code.includes("stock") || code.includes("inventory")),
    permissions.some(code => code.includes("finance") || code.includes("payment"))
  ].filter(Boolean).length >= 3;

  // Infer dashboard access by specific permissions and role names
  const isAdmin = permissions.some(code => code.startsWith("admin:") || code.includes("admin:access")) || 
                  roleNames.some(r => 
                    (r.includes("admin") && !r.includes("hr")) || 
                    r.includes("superuser") || 
                    r.includes("root") ||
                    r.toLowerCase() === "admin" ||
                    r === "administrator"
                  ) ||
                  // Fallback: check if user_id is 1 (usually admin) or username is admin
                  userId === 1 || userId === "1" || 
                  (username && username.toLowerCase() === "admin") ||
                  // Multi-domain access indicates admin privileges (but not if user is HR)
                  (hasMultipleDomainAccess && !roleNames.some(r => r.includes("hr")));
  
  const isHR = permissions.some(code => code.startsWith("hr:") || code.includes("hr:access")) || 
               roleNames.some(r => 
                 r.includes("hr") || 
                 r.includes("human_resources") || 
                 r.includes("human resource") ||
                 r.includes("humanresources") ||
                 r === "hr" ||
                 r.startsWith("hr_") ||
                 r.includes("hrstaff") ||
                 r.includes("hr staff")
               );
  
  const isEmployee = permissions.some(code => code.startsWith("employee:")) ||
                     roleNames.some(r => r.includes("employee") || r.includes("staff") || r.includes("worker")) ||
                     // Also check if user has task/attendance permissions (common for employees)
                     permissions.some(code => code.includes("task") || code.includes("attendance") || code.includes("leave"));
  
  const isVendor = roleNames.some(r => r.includes("vendor")) ||
                   // Also check permissions - vendors might have specific vendor permissions
                   permissions.some(code => code.includes("vendor")) ||
                   // Check user position/role fields like backend does
                   (user.position && user.position.toLowerCase().includes("vendor")) ||
                   (user.role && typeof user.role === "string" && user.role.toLowerCase().includes("vendor")) ||
                   // Check additional user fields that might contain vendor info
                   (user.user_type && user.user_type.toLowerCase().includes("vendor")) ||
                   (user.account_type && user.account_type.toLowerCase().includes("vendor")) ||
                   // Check if username contains vendor (common pattern)
                   (user.username && user.username.toLowerCase().includes("vendor"));
  
  const isCustomer = roleNames.some(r => r.includes("customer") || r.includes("client")) ||
                     // Also check permissions - customers have purchase/orders but not admin/hr/employee permissions
                     (permissions.includes("purchase:access") || permissions.includes("orders:access")) &&
                     !permissions.some(code => code.startsWith("admin:") || code.startsWith("hr:") || code.startsWith("employee:") || code.includes("vendor"));

  // Debug what's actually stored in localStorage
  const rawUserData = localStorage.getItem("user");
  console.log('Raw user data from localStorage:', rawUserData);
  
  let parsedUserData = null;
  try {
    parsedUserData = JSON.parse(rawUserData || '{}');
  } catch (e) {
    console.error('Error parsing user data:', e);
  }
  console.log('Parsed user data:', parsedUserData);
  
  // Show all localStorage keys related to user data
  console.log('All localStorage keys:', Object.keys(localStorage));
  console.log('user_info from localStorage:', localStorage.getItem('user_info'));
  console.log('currentUser from localStorage:', localStorage.getItem('currentUser'));
  
  console.log('Dashboard routing debug:', {
    roleNames,
    permissions,
    userId,
    username,
    userPosition: user.position,
    userRole: user.role,
    isAdmin,
    isHR, 
    isEmployee,
    isVendor,
    isCustomer,
    adminChecks: {
      hasAdminPermission: permissions.some(code => code.startsWith("admin:") || code.includes("admin:access")),
      hasAdminRole: roleNames.some(r => (r.includes("admin") && !r.includes("hr")) || r.includes("superuser") || r.includes("root")),
      isUserId1: userId === 1 || userId === "1",
      isUsernameAdmin: username && username.toLowerCase() === "admin",
      hasMultipleDomainAccess,
      hasHRInRole: roleNames.some(r => r.includes("hr"))
    },
    hrChecks: {
      hasHRPermission: permissions.some(code => code.startsWith("hr:") || code.includes("hr:access")),
      hasHRRole: roleNames.some(r => r.includes("hr") || r.includes("human_resource")),
      isClearlyHR: roleNames.some(r => r === "hr" || r.includes("hr") || r.includes("human_resource") || r.includes("hrstaff"))
    },
    vendorChecks: {
      hasVendorRole: roleNames.some(r => r.includes("vendor")),
      hasVendorPermission: permissions.some(code => code.includes("vendor")),
      hasVendorPosition: user.position && user.position.toLowerCase().includes("vendor"),
      hasVendorInUserRole: user.role && typeof user.role === "string" && user.role.toLowerCase().includes("vendor"),
      hasVendorUserType: user.user_type && user.user_type.toLowerCase().includes("vendor"),
      hasVendorAccountType: user.account_type && user.account_type.toLowerCase().includes("vendor"),
      hasVendorUsername: user.username && user.username.toLowerCase().includes("vendor"),
      roleNamesArray: roleNames,
      exactRoleMatch: roleNames.some(r => r.toLowerCase().indexOf("vendor") !== -1),
      allUserFields: {
        position: user.position,
        role: user.role,
        user_type: user.user_type,
        account_type: user.account_type,
        username: user.username
      }
    }
  });

  // Define role detection variables for other roles first
  const isClearlyHR = roleNames.some(r => 
    r === "hr" || 
    r.includes("hr") || 
    r.includes("human_resource") ||
    r.includes("human resource") ||
    r.includes("hrstaff")
  );

  // ✅ PRIORITY #1: ADMIN DASHBOARD (highest priority - admin can manage all areas)
  if (isAdmin && !isClearlyHR) {
    console.log('📊 ADMIN DASHBOARD SELECTED - Admin user detected');
    return (
      <ErrorBoundary>
        <ClientDashboard />
      </ErrorBoundary>
    );
  }

  // ✅ PRIORITY #2: HR DASHBOARD (if clearly HR and not admin)
  if (isClearlyHR && !isAdmin) {
    console.log('👥 HR DASHBOARD SELECTED - HR user detected');
    return (
      <ErrorBoundary>
        <DashboardContainer />
      </ErrorBoundary>
    );
  }

  // ========== VENDOR CHECK - More specific to avoid admin conflicts ==========
  // Only check for vendor if user is NOT admin or HR
  const vendorIndicators = {
    roleNames: roleNames.some(r => r.toLowerCase().includes("vendor")),
    userPosition: user.position && user.position.toLowerCase().includes("vendor"),
    userRole: user.role && typeof user.role === "string" && user.role.toLowerCase().includes("vendor"),
    userType: user.user_type && user.user_type.toLowerCase().includes("vendor"),
    accountType: user.account_type && user.account_type.toLowerCase().includes("vendor"),
    username: user.username && user.username.toLowerCase().includes("vendor"),
    // Remove permission check as admin might have vendor permissions
  };

  const hasAnyVendorIndication = Object.values(vendorIndicators).some(Boolean);

  console.log('=== VENDOR DETECTION DEBUG ===');
  console.log('Vendor indicators:', vendorIndicators);
  console.log('Has any vendor indication:', hasAnyVendorIndication);
  console.log('Role names array:', roleNames);
  console.log('User object fields:', {
    position: user.position,
    role: user.role,
    user_type: user.user_type,
    account_type: user.account_type,
    username: user.username
  });

  // ✅ PRIORITY #3: VENDOR DASHBOARD (only if not admin/HR and has vendor indicators)
  if (hasAnyVendorIndication && allowDashboardAccess && !isAdmin && !isClearlyHR) {
    console.log('🎯 VENDOR DASHBOARD SELECTED - Found vendor indication (non-admin)');
    console.log('Vendor detection details:', {
      triggeredBy: Object.entries(vendorIndicators).filter(([key, value]) => value),
      userRole: user.role,
      roleNames
    });
    
    return (
      <ErrorBoundary>
        <VendorDashboard />
      </ErrorBoundary>
    );
  }
  
  // ✅ PRIORITY #4: EMPLOYEE DASHBOARD (if employee and not other roles)
  if (isEmployee && !isAdmin && !isClearlyHR && !hasAnyVendorIndication) {
    console.log('👤 EMPLOYEE DASHBOARD SELECTED');
    return (
      <ErrorBoundary>
        <EmployeeDashboard />
      </ErrorBoundary>
    );
  }

  // ✅ PRIORITY #5: CUSTOMER DASHBOARD (fallback for users with dashboard permission)
  if (allowDashboardAccess && (isCustomer || (!isAdmin && !isClearlyHR && !isEmployee && !hasAnyVendorIndication))) {
    console.log('🛍️ CUSTOMER DASHBOARD SELECTED - Final fallback');
    return (
      <ErrorBoundary>
        <CustomerDashboard />
      </ErrorBoundary>
    );
  }

  // ✅ FINAL FALLBACK: Admin users who somehow didn't match above
  if (isAdmin) {
    console.log('📊 FINAL ADMIN FALLBACK DASHBOARD SELECTED');
    return (
      <ErrorBoundary>
        <ClientDashboard />
      </ErrorBoundary>
    );
  }

  // ✅ FINAL FALLBACK: If user has dashboard permission but doesn't match other categories
  if (allowDashboardAccess) {
    console.log('🔄 DEFAULT FALLBACK - Showing customer dashboard for user with dashboard permission');
    return (
      <ErrorBoundary>
        <CustomerDashboard />
      </ErrorBoundary>
    );
  }

  return <div>Authorized but no dashboard available for your roles.</div>;
}

// Add debug functions to window for testing
window.debugVendorDetection = () => {
  console.log('=== DEBUG VENDOR DETECTION ===');
  
  const userKeys = ["user", "currentUser", "user_info"];
  let user = {};
  
  for (const key of userKeys) {
    const userStr = localStorage.getItem(key);
    if (userStr) {
      try {
        const parsedUser = JSON.parse(userStr);
        if (parsedUser && (parsedUser.id || parsedUser.user_id || parsedUser.username)) {
          user = parsedUser;
          console.log(`Using user data from '${key}':`, user);
          break;
        }
      } catch (e) {
        console.warn(`Error parsing '${key}':`, e);
      }
    }
  }
  
  const roleNames = [];
  if (Array.isArray(user.roles)) {
    user.roles.forEach(r => {
      if (typeof r === "string") {
        roleNames.push(r.trim().toLowerCase());
      } else if (r.name) {
        roleNames.push(r.name.trim().toLowerCase());
      }
    });
  }
  if (user.role && typeof user.role === "string") {
    roleNames.push(user.role.trim().toLowerCase());
  }
  
  const vendorDetectionResults = {
    user: user,
    roleNames: roleNames,
    checks: {
      hasVendorInRoles: roleNames.some(r => r.includes("vendor")),
      hasVendorInPosition: user.position && user.position.toLowerCase().includes("vendor"),
      hasVendorInRole: user.role && typeof user.role === "string" && user.role.toLowerCase().includes("vendor"),
      hasVendorInUsername: user.username && user.username.toLowerCase().includes("vendor"),
      hasVendorInUserType: user.user_type && user.user_type.toLowerCase().includes("vendor"),
      hasVendorInAccountType: user.account_type && user.account_type.toLowerCase().includes("vendor")
    }
  };
  
  const shouldShowVendorDashboard = Object.values(vendorDetectionResults.checks).some(Boolean);
  
  console.log('Vendor detection results:', vendorDetectionResults);
  console.log('SHOULD SHOW VENDOR DASHBOARD:', shouldShowVendorDashboard);
  
  return vendorDetectionResults;
};

window.simulateVendorUser = () => {
  const vendorUser = {
    id: "USR-999",
    user_id: "USR-999", 
    username: "test_vendor",
    email: "vendor@example.com",
    full_name: "Test Vendor User",
    roles: ["vendor"],
    role: "vendor",
    position: "vendor representative"
  };
  
  localStorage.setItem('user', JSON.stringify(vendorUser));
  console.log('Vendor user simulated:', vendorUser);
  console.log('Refresh the page to see the vendor dashboard');
  
  return vendorUser;
};

console.log('Debug functions available:');
console.log('- window.debugVendorDetection() - Check current vendor detection');
console.log('- window.simulateVendorUser() - Create test vendor user');
