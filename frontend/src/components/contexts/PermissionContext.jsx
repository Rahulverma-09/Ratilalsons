import React, { createContext, useContext, useState, useEffect } from "react";
import { API_URL } from "../../config";

const PermissionsContext = createContext();

export function usePermissions() {
  return useContext(PermissionsContext);
}

export function PermissionsProvider({ children }) {
  const [userPermissions, setUserPermissions] = useState([]);
  const [currentUser, setCurrentUser] = useState("Unknown User");
  const [roleNames, setRoleNames] = useState([]);
  const [rolesList, setRolesList] = useState([]);

  // Expose refetch for manual triggers
  async function fetchUserAndPermissions() {
    try {
      console.log('[PermissionContext] Fetching user and permissions...');
      
      // 1. Load roles (only if authenticated)
      let allRoles = [];
      const tokenForRoles = localStorage.getItem("access_token");
      if (tokenForRoles) {
        try {
          const res = await fetch(`${API_URL}/api/roles/`, {
            headers: { Authorization: `Bearer ${tokenForRoles}` },
          });
          if (res.ok) {
            allRoles = await res.json();
            console.log('[PermissionContext] Loaded', allRoles.length, 'roles');
          }
        } catch {
          allRoles = [];
        }
      }
      setRolesList(allRoles);

      // 2. Load user
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const userObj = JSON.parse(userStr);
        setCurrentUser(userObj.full_name || userObj.username || "Unknown User");

        // IDs from userObj
        const roleIds =
          userObj.role_ids && userObj.role_ids.length > 0
            ? userObj.role_ids
            : Array.isArray(userObj.roles)
            ? userObj.roles
            : typeof userObj.roles === "string"
            ? [userObj.roles]
            : [];

        // Map IDs to names (but after rolesList is loaded)
        setRoleNames(
          Array.isArray(roleIds) && allRoles.length
            ? roleIds.map(id => allRoles.find(r => r.id === id)?.name || id)
            : []
        );
        console.log('[PermissionContext] User role IDs:', roleIds);
      } else {
        setCurrentUser("Unknown User");
        setRoleNames([]);
      }

      // 3. Get permissions
      const token = localStorage.getItem("access_token");
      if (token) {
        const res = await fetch(`${API_URL}/api/permissions/my`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const permsData = await res.json();
          const permissions = Array.isArray(permsData)
            ? permsData.map(p => typeof p === "string" ? p : p.code)
            : [];
          setUserPermissions(permissions);
          console.log('[PermissionContext] Loaded permissions:', permissions);
        } else {
          console.warn('[PermissionContext] Failed to fetch permissions, status:', res.status);
          setUserPermissions([]);
        }
      } else {
        console.warn('[PermissionContext] No access token found');
        setUserPermissions([]);
      }
    } catch (error) {
      console.error('[PermissionContext] Error fetching permissions:', error);
      setUserPermissions([]);
      setCurrentUser("Unknown User");
      setRoleNames([]);
      setRolesList([]);
    }
  }

  // Keep role names synced with user/rolesList *any time either changes*.
  useEffect(() => {
    fetchUserAndPermissions();
    // Listen for storage and login/logout for live reload
    function handleStorage(evt) {
      // ✅ CRITICAL FIX: Also refresh when permissions are updated by admin
      if (["access_token", "user", "permissions_updated"].includes(evt.key)) {
        console.log('[PermissionContext] Detected change, refetching permissions:', evt.key);
        fetchUserAndPermissions();
      }
    }
    window.addEventListener("storage", handleStorage);

    function handleManual() {
      console.log('[PermissionContext] Manual refresh triggered');
      fetchUserAndPermissions();
    }
    window.addEventListener("login", handleManual);
    window.addEventListener("logout", handleManual);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("login", handleManual);
      window.removeEventListener("logout", handleManual);
    };
    // eslint-disable-next-line
  }, []);

  // Whenever rolesList or user changes, remap role names
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr && rolesList.length > 0) {
      const userObj = JSON.parse(userStr);
      const roleIds =
        userObj.role_ids && userObj.role_ids.length > 0
          ? userObj.role_ids
          : Array.isArray(userObj.roles)
          ? userObj.roles
          : typeof userObj.roles === "string"
          ? [userObj.roles]
          : [];
      setRoleNames(
        Array.isArray(roleIds)
          ? roleIds.map(id => rolesList.find(r => r.id === id)?.name || id)
          : []
      );
    }
  }, [rolesList]);

  // Attach to window for manual calls if ever needed
  window.PermissionsContextRefresh = fetchUserAndPermissions;

  return (
    <PermissionsContext.Provider value={{
      userPermissions,
      setUserPermissions,
      currentUser,
      setCurrentUser,
      roleNames,
      setRoleNames,
      rolesList,
      refetchPermissions: fetchUserAndPermissions
    }}>
      {children}
    </PermissionsContext.Provider>
  );
}
