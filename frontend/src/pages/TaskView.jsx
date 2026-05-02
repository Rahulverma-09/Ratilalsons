import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TaskWorkflowManagement from "./TaskWorkflowManagement";
import EmployeeTaskView from "./EmployeeTaskView";
import { usePermissions } from "../components/contexts/PermissionContext.jsx";

function TaskView() {
  const navigate = useNavigate();
  const [appRoles, setAppRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const { userPermissions, currentUser, roleNames } = usePermissions();

  // Only read userObj once
  const userObj = React.useMemo(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('[TaskView] Debug Info:', {
      userObj,
      userPermissions,
      roleNames,
      hasTasksAccess: userPermissions.includes('tasks:access'),
      currentUser
    });
  }, [userObj, userPermissions, roleNames, currentUser]);

  // Redirect if not logged in or no user id
  useEffect(() => {
    if (!userObj || !userObj.user_id) {
      console.log('[TaskView] No user found, redirecting to login');
      navigate("/login", { replace: true });
    }
  }, [userObj, navigate]);

  // Only fetch roles once after mount, if userObj is present
  useEffect(() => {
    let isMounted = true;
    async function fetchRoleNames() {
      if (!userObj) {
        if (isMounted) {
          setLoading(false);
          setAppRoles([]);
        }
        return;
      }
      
      // Use role_ids from userObj instead of roles array
      const roleIds = userObj.role_ids || userObj.roles || [];
      console.log('[TaskView] User role IDs:', roleIds);
      
      if (!Array.isArray(roleIds) || roleIds.length === 0) {
        if (isMounted) {
          setLoading(false);
          setAppRoles([]);
        }
        return;
      }
      
      try {
        const token = localStorage.getItem("access_token") || "";
        const fetches = roleIds.map(roleId =>
          fetch(`/api/roles/${roleId}`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then(res => res.ok ? res.json() : null)
        );
        const results = await Promise.all(fetches);
        const names = results
          .map(r => r && r.name ? r.name.toLowerCase() : null)
          .filter(Boolean);
        console.log('[TaskView] Resolved role names:', names);
        if (isMounted) setAppRoles(names);
      } catch (error) {
        console.error('[TaskView] Error fetching roles:', error);
        if (isMounted) setAppRoles([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchRoleNames();
    return () => { isMounted = false; };
  }, [userObj]); // Only run when userObj from localStorage changes

  if (loading) return <div className="text-center py-32">Loading roles...</div>;
  if (!userObj || !userObj.user_id) return null;

  // Check if user has tasks:access permission (from PermissionContext)
  const hasTasksPermission = userPermissions.includes('tasks:access');
  
  // Role-based access (legacy method as fallback)
  const canSeeTaskManagement = appRoles.includes("admin") || appRoles.includes("hr") || roleNames.includes("admin") || roleNames.includes("hr");
  const isEmployee = appRoles.includes("employee") || roleNames.includes("employee");

  console.log('[TaskView] Access Check:', {
    hasTasksPermission,
    canSeeTaskManagement,
    isEmployee,
    appRoles,
    roleNames
  });

  // If user has tasks:access permission, show appropriate view
  if (hasTasksPermission) {
    if (canSeeTaskManagement) return <TaskWorkflowManagement />;
    if (isEmployee) return <EmployeeTaskView />;
    // Default to employee view if they have tasks:access but role is unclear
    return <EmployeeTaskView />;
  }

  // If no permission, show access denied
  return (
    <div className="text-center py-32">
      <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-red-600 font-semibold mb-2">Access Denied</h2>
        <p className="text-red-500 text-sm mb-4">You do not have access to this page.</p>
        <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
          <p><strong>Debug Info:</strong></p>
          <p>Permissions: {userPermissions.join(', ') || 'None'}</p>
          <p>Roles: {roleNames.join(', ') || 'None'}</p>
          <p>Required: tasks:access</p>
        </div>
      </div>
    </div>
  );
}

export default TaskView;
