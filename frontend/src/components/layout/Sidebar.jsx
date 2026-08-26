import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { usePermissions } from '../contexts/PermissionContext.jsx';

const MENU_CONFIG = [
  { icon: 'chart-pie', label: 'Dashboard', path: '/dashboard', permission: 'dashboard:read' },
  { icon: 'user', label: 'Users', path: '/users/list', permission: 'users:access' },
  { icon: 'shield-alt', label: 'Roles', path: '/users/roles', permission: 'roles:access' },
  { icon: 'clock', label: 'Attendance', path: '/my-attendance', permission: 'attendance:access' },
  { icon: 'users', label: 'Customers', path: '/customers', permission: 'customers:access' },
  { icon: 'store', label: 'Vendors', path: '/vendors', permission: 'vendors:access' },
  { icon: 'user-tie', label: 'Staff Management', path: '/hr/staff', permission: 'hr:access' },
  { icon: 'check', label: 'Mark Attendance', path: '/mark/attendance', permission: 'mark_attendance:access' },
  { icon: 'umbrella-beach', label: 'Leave Management', path: '/leave-management', permission: 'leave:access' },
  { icon: 'bolt', label: 'Equipment & Utility', path: '/generator-management', permission: 'generator_management:access' },
  { icon: 'building', label: 'Manage Sites', path: '/site-management', permission: 'site_management:access' },
  { icon: 'boxes', label: 'Inventory', path: '/inventory', permission: 'inventory:access' },
  { icon: 'folder', label: 'Documents', path: '/documents', permission: 'documents:access' },
  { icon: 'shopping-bag', label: 'Add Products', path: '/add-product', permission: 'vendor:access' },
  { icon: 'shopping-cart', label: 'Purchase Products', path: '/purchase', permission: 'purchase:access' },
  { icon: 'money-bill', label: 'Manage Sales', path: '/sales-vendor-management', permission: 'sales:access' },
  { icon: 'tasks', label: 'Tasks & Workflow', path: '/tasks', permission: 'tasks:access' },
  { icon: 'users-cog', label: 'Payroll', path: '/payroll/management', permission: 'payroll:access' },
  { icon: 'bell', label: 'Alerts & Notifications', path: '/alerts', permission: 'alerts:read' },
  { icon: 'chart-bar', label: 'Manage Reports', path: '/energy-reports', permission: 'global_reports:view' },
  { icon: 'shopping-cart', label: 'Track Orders', path: '/orders', permission: 'orders:access' },
  { icon: 'life-ring', label: 'Support Tickets', path: '/support', permission: 'support:access' },
  { icon: 'file-invoice', label: 'Bills & Invoice', path: '/invoices', permission: 'invoices:access' }
];

const Sidebar = ({ isOpen, toggleSidebar, isMobile }) => {
  const location = useLocation();
  const { userPermissions, currentUser, roleNames, refetchPermissions } = usePermissions();
  const [expandedMenu, setExpandedMenu] = useState(null);

  // PERFECTLY MATCHES YOUR init_db.py PERMISSIONS
  const hasPermission = useCallback((required) => {
    if (!required) return true;
    // ✅ REMOVED ADMIN BYPASS - Now admins only see modules they have explicit permissions for
    // This allows fine-grained control: you can remove specific permissions from admin role
    return Array.isArray(required) 
      ? required.some(p => userPermissions.includes(p))
      : userPermissions.includes(required);
  }, [userPermissions]);

  // ✅ DYNAMIC FILTERING - Only shows what user has permission for
  const filteredMenuItems = useMemo(() => {
    const filtered = MENU_CONFIG.filter(item => hasPermission(item.permission));
    console.log('[Sidebar] Filtered menu items:', filtered.length, 'of', MENU_CONFIG.length);
    console.log('[Sidebar] Current permissions:', userPermissions);
    return filtered;
  }, [userPermissions, hasPermission]);

  // Auto-expand parent menu when child is active
  useEffect(() => {
    const matchParent = MENU_CONFIG.find(
      item => item.submenu && item.submenu.some(sub => sub.path === location.pathname)
    );
    if (matchParent) setExpandedMenu(matchParent.path);
    else setExpandedMenu(null);
  }, [location.pathname]);

  const toggleSubmenu = useCallback((path, e) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedMenu(prev => prev === path ? null : path);
  }, []);

  const resetExpandedMenus = useCallback(() => setExpandedMenu(null), []);

  const handleNavClick = useCallback((isMobile) => {
    if (isMobile) toggleSidebar(false);
    resetExpandedMenus();
  }, [toggleSidebar, resetExpandedMenus]);

  // REFETCH on permission changes (after admin updates roles)
  useEffect(() => {
    const handleStorageChange = (e) => {
      // ✅ CRITICAL FIX: Refetch when permissions_updated changes
      if (e.key === 'permissions_updated' || e.key === 'access_token' || e.key === 'user') {
        console.log('[Sidebar] Permission change detected, refetching...', e.key);
        refetchPermissions();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refetchPermissions]);

  return (
    <>
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-40 z-20" 
          onClick={() => toggleSidebar(false)} 
        />
      )}
      <aside className={`h-screen bg-slate-900 text-white transition-all duration-300 ease-in-out flex-shrink-0
        ${isMobile
          ? `fixed top-0 left-0 h-full z-30 ${isOpen ? 'translate-x-0' : '-translate-x-full'} w-64`
          : `relative ${isOpen ? 'w-56' : 'w-18'}`}
        overflow-y-auto overflow-x-hidden`}
      >
        {/* Brand */}
        <div className="bg-slate-900 border-b border-slate-800 flex items-center justify-between p-4 relative z-10">
          <div className="flex items-center gap-2 overflow-hidden">
            <img src="/bharat.png" alt="Ratilal" className="h-6 w-6 rounded-full object-cover" />
            {(isOpen || isMobile) && <span className="text-lg font-semibold truncate">Ratilal & Sons</span>}
          </div>
          <button onClick={() => toggleSidebar(!isOpen)} className="text-gray-400 hover:text-white p-1 rounded hover:bg-slate-800">
            <i className={`fas fa-${isMobile ? 'times' : isOpen ? 'chevron-left' : 'chevron-right'} text-sm`}></i>
          </button>
        </div>

        {/* User Profile */}
        <div className="flex items-center p-4 border-b border-slate-800 relative z-10">
          <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <i className="fas fa-user text-white"></i>
          </div>
          {(isOpen || isMobile) && (
            <div className="ml-3 overflow-hidden flex-1 min-w-0">
              <div className="text-base font-medium truncate">{currentUser}</div>
              {roleNames.length > 0 ? (
                <div className="text-sm text-blue-300 truncate">{roleNames.join(', ')}</div>
              ) : (
                <div className="text-sm text-blue-300 truncate">Loading roles...</div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="py-2 flex-1 relative z-10">
          <ul className="space-y-1">
            {filteredMenuItems.map(item => {
              const isActiveMain = location.pathname === item.path;
              
              return (
                <li key={item.path} className="relative">
                  <NavLink
                    to={item.path}
                    className={({ isActive }) => `
                      flex items-center py-2.5 px-4 text-sm transition-all duration-200 rounded-lg
                      ${isActive || isActiveMain 
                        ? 'bg-slate-800 border-l-4 border-blue-500 text-blue-300 shadow-lg' 
                        : 'hover:bg-slate-800 border-l-4 border-transparent text-gray-300 hover:text-white hover:shadow-md'
                      }
                    `}
                    onClick={() => handleNavClick(isMobile)}
                  >
                    <div className={`text-center flex-shrink-0 ${isOpen || isMobile ? 'w-6' : 'w-5'}`}>
                      <i className={`fas fa-${item.icon}`}></i>
                    </div>
                    {(isOpen || isMobile) && (
                      <span className="ml-3 truncate flex-1 min-w-0">{item.label}</span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
          
        </nav>
      </aside>
    </>
  );
};

export default React.memo(Sidebar);
