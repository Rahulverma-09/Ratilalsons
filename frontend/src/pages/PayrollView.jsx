import React, { useState, useEffect } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import PayrollAdmin from './AdminPayroll';
import PayrollDashboard from './HrPayrollView';
import EmployeePayroll from './EmployeePayroll'; // We'll create this

const API_URL = 'http://localhost:8000';
const PERMISSIONS_API = `${API_URL}/api/permissions/my`;

// List the codes that allow payroll access
const PAYROLL_PERMISSION_CODES = ["payroll:read", "payroll:view", "payroll:access", "hr:access"];

export default function PayrollView() {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleNames, setRoleNames] = useState([]);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          console.error('No access token found');
          return;
        }

        const response = await fetch(PERMISSIONS_API, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setPermissions(data.permissions || []);
        } else {
          console.error('Failed to fetch permissions');
        }
      } catch (e) {
        console.error('Error fetching permissions:', e);
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
            if (parsedUser && Object.keys(parsedUser).length > 0) {
              user = parsedUser;
              break; // Use the first valid user object found
            }
          } catch (e) {
            console.error(`Error parsing user data from ${key}:`, e);
          }
        }
      }
      
      if (user && (user.roles || user.role || user.role_names)) {
        // Handle different role data structures
        if (Array.isArray(user.roles)) {
          user.roles.forEach(role => {
            if (typeof role === "string") {
              setRoleNames(prev => [...prev, role.trim().toLowerCase()]);
            } else if (role && role.name) {
              setRoleNames(prev => [...prev, role.name.trim().toLowerCase()]);
            }
          });
        }
        
        // Handle single role field
        if (user.role && typeof user.role === "string") {
          setRoleNames(prev => [...prev, user.role.trim().toLowerCase()]);
        }
        
        // Handle role_names array
        if (Array.isArray(user.role_names)) {
          user.role_names.forEach(roleName => {
            if (typeof roleName === "string") {
              setRoleNames(prev => [...prev, roleName.trim().toLowerCase()]);
            }
          });
        }
        
        // Remove duplicates
        setRoleNames(prev => [...new Set(prev)]);
      }
    } catch (e) {
      console.error("Error extracting user roles:", e);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading Payroll...</p>
        </div>
      </div>
    );
  }

  // Check for necessary payroll permission
  const canViewPayroll = permissions.some(code => PAYROLL_PERMISSION_CODES.includes(code));
  
  // Also allow HR to view payroll if they have HR-related permissions
  const hasHRPermissions = permissions.some(code => 
    ['hr:access', 'employee:read', 'employee:manage', 'payroll:read'].includes(code)
  );
  
  // Also allow admin to view payroll if they have admin permissions
  const hasAdminPermissions = permissions.some(code => 
    ['admin:access', 'payroll:admin', 'payroll:manage'].includes(code)
  );

  // Check role names for fallback access
  const hasHRRole = roleNames.some(role => 
    ['hr', 'human_resources', 'human resource', 'humanresources', 'hr_staff'].includes(role.toLowerCase())
  );

  const hasAdminRole = roleNames.some(role => 
    ['admin', 'administrator', 'superuser', 'root'].includes(role.toLowerCase()) && 
    !role.includes('hr') // Exclude HR admin roles
  );

  const allowPayrollAccess = canViewPayroll || hasHRPermissions || hasAdminPermissions || hasHRRole || hasAdminRole;

  console.log('=== PAYROLL ACCESS DEBUG ===');
  console.log('Permissions:', permissions);
  console.log('Role Names:', roleNames); 
  console.log('canViewPayroll:', canViewPayroll);
  console.log('hasHRPermissions:', hasHRPermissions);
  console.log('hasAdminPermissions:', hasAdminPermissions);
  console.log('hasHRRole:', hasHRRole);
  console.log('hasAdminRole:', hasAdminRole);
  console.log('allowPayrollAccess:', allowPayrollAccess);
  console.log('===============================');

  if (!allowPayrollAccess) {
    console.log('Payroll access denied. Permissions:', permissions, 'Roles:', roleNames);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/50 text-center">
          <div className="text-red-600 text-2xl font-semibold mb-4">
            Access Denied
          </div>
          <p className="text-gray-600 mb-4">
            You are not authorized to access the payroll system.
          </p>
          <div className="text-sm text-gray-500">
            Debug: Permissions: {JSON.stringify(permissions)}, Roles: {JSON.stringify(roleNames)}
          </div>
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
          if (parsedUser && Object.keys(parsedUser).length > 0) {
            user = parsedUser;
            userId = user.id || user.user_id || user.userId;
            username = user.username || user.email;
            break;
          }
        } catch (e) {
          console.error(`Error parsing user data from ${key}:`, e);
        }
      }
    }
  } catch (e) {
    console.error("Error getting user info:", e);
  }

  console.log('=== PAYROLL ROUTING DEBUG START ===');
  console.log('User permissions:', permissions);
  console.log('Role names:', roleNames);
  console.log('Raw user data:', user);
  console.log('Can view payroll:', allowPayrollAccess);

  // Additional admin check: if user has permissions across multiple domains, likely admin
  const hasMultipleDomainAccess = [
    permissions.some(code => code.includes("hr")),
    permissions.some(code => code.includes("employee")),
    permissions.some(code => code.includes("vendor")),
    permissions.some(code => code.includes("customer")),
    permissions.some(code => code.includes("stock") || code.includes("inventory")),
    permissions.some(code => code.includes("finance") || code.includes("payment")),
    permissions.some(code => code.includes("admin"))
  ].filter(Boolean).length >= 3;

  // Infer payroll access by specific permissions and role names
  const isAdmin = permissions.some(code => 
      code.startsWith("admin:") || 
      code.includes("admin:access") || 
      code.includes("payroll:admin") ||
      code.includes("payroll:manage")
    ) || 
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
  
  const isHR = permissions.some(code => 
      code.startsWith("hr:") || 
      code.includes("hr:access") ||
      code.includes("payroll:read") ||
      code.includes("employee:manage")
    ) || 
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

  // Define role detection variables for other roles first
  const isClearlyHR = roleNames.some(r => 
    r === "hr" || 
    r.includes("hr") || 
    r.includes("human_resource") ||
    r.includes("human resource") ||
    r.includes("hrstaff")
  ) && !isAdmin;

  console.log('Payroll routing debug:', {
    roleNames,
    permissions,
    userId,
    username,
    userPosition: user.position,
    userRole: user.role,
    isAdmin,
    isHR,
    isClearlyHR,
    adminChecks: {
      hasAdminPermission: permissions.some(code => code.startsWith("admin:") || code.includes("admin:access")),
      hasPayrollAdminPermission: permissions.some(code => code.includes("payroll:admin") || code.includes("payroll:manage")),
      hasAdminRole: roleNames.some(r => (r.includes("admin") && !r.includes("hr")) || r.includes("superuser") || r.includes("root")),
      isUserId1: userId === 1 || userId === "1",
      isUsernameAdmin: username && username.toLowerCase() === "admin",
      hasMultipleDomainAccess,
      hasHRInRole: roleNames.some(r => r.includes("hr"))
    },
    hrChecks: {
      hasHRPermission: permissions.some(code => code.startsWith("hr:") || code.includes("hr:access")),
      hasPayrollReadPermission: permissions.some(code => code.includes("payroll:read")),
      hasHRRole: roleNames.some(r => r.includes("hr") || r.includes("human_resource")),
      isClearlyHR: roleNames.some(r => r === "hr" || r.includes("hr") || r.includes("human_resource") || r.includes("hrstaff"))
    }
  });

  // ✅ PRIORITY #1: ADMIN PAYROLL (highest priority - admin can manage payroll configuration)
  if (isAdmin && !isClearlyHR) {
    console.log('📊 ADMIN PAYROLL SELECTED - Admin user detected');
    return (
      <ErrorBoundary>
        <PayrollAdmin />
      </ErrorBoundary>
    );
  }

  // ✅ PRIORITY #2: HR PAYROLL DASHBOARD (if clearly HR and not admin)
  if ((isClearlyHR || isHR) && !isAdmin) {
    console.log('👥 HR PAYROLL DASHBOARD SELECTED - HR user detected');
    return (
      <ErrorBoundary>
        <PayrollDashboard />
      </ErrorBoundary>
    );
  }

  // ✅ PRIORITY #3: EMPLOYEE PAYROLL VIEW (regular employees)
  if (allowPayrollAccess && !isAdmin && !isHR) {
    console.log('👤 EMPLOYEE PAYROLL VIEW SELECTED - Regular employee detected');
    return (
      <ErrorBoundary>
        <EmployeePayroll />
      </ErrorBoundary>
    );
  }

  // ✅ FINAL FALLBACK: Admin users who somehow didn't match above
  if (isAdmin) {
    console.log('📊 FINAL ADMIN PAYROLL FALLBACK SELECTED');
    return (
      <ErrorBoundary>
        <PayrollAdmin />
      </ErrorBoundary>
    );
  }

  // ✅ FINAL FALLBACK: If user has payroll permission but doesn't match other categories
  if (allowPayrollAccess) {
    console.log('🔄 DEFAULT FALLBACK - Showing Employee payroll view for user with payroll permission');
    return (
      <ErrorBoundary>
        <EmployeePayroll />
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
      <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/50 text-center">
        <div className="text-gray-600 text-xl font-semibold">
          Authorized but no payroll dashboard available for your roles.
        </div>
      </div>
    </div>
  );
}

// Add debug functions to window for testing
window.debugPayrollDetection = () => {
  console.log('=== DEBUG PAYROLL DETECTION ===');
  
  const userKeys = ["user", "currentUser", "user_info"];
  let user = {};
  
  for (const key of userKeys) {
    const userStr = localStorage.getItem(key);
    if (userStr) {
      try {
        const parsedUser = JSON.parse(userStr);
        if (parsedUser && Object.keys(parsedUser).length > 0) {
          user = parsedUser;
          break;
        }
      } catch (e) {
        console.error(`Error parsing user data from ${key}:`, e);
      }
    }
  }
  
  const roleNames = [];
  if (Array.isArray(user.roles)) {
    user.roles.forEach(r => {
      if (typeof r === "string") {
        roleNames.push(r.trim().toLowerCase());
      } else if (r && r.name) {
        roleNames.push(r.name.trim().toLowerCase());
      }
    });
  }
  if (user.role && typeof user.role === "string") {
    roleNames.push(user.role.trim().toLowerCase());
  }
  
  const payrollDetectionResults = {
    user: user,
    roleNames: roleNames,
    checks: {
      hasAdminRole: roleNames.some(r => r.includes("admin") && !r.includes("hr")),
      hasHRRole: roleNames.some(r => r.includes("hr")),
      hasAdminPermissions: "Check permissions manually",
      hasHRPermissions: "Check permissions manually"
    }
  };
  
  console.log('Payroll detection results:', payrollDetectionResults);
  
  return payrollDetectionResults;
};

console.log('Debug functions available:');
console.log('- window.debugPayrollDetection() - Check current payroll detection');
