import React, { useState, useEffect } from 'react';
import EmployeeDocument from './EmployeeDocument';
import DocumentManagement from './DocumentManagement';

const PERMISSIONS_API = "https://ratilalsons-backend-api.onrender.com/api/permissions/my";

// List the codes that allow document access
const DOCUMENT_PERMISSION_CODES = ["document:read", "document:view", "document:manage"];
const DOCUMENT_MANAGE_PERMISSION_CODES = ["document:manage", "hr:document", "admin:document"];

const DocumentsContainer = () => {
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
    
    // Get role names from localStorage if available
    try {
      const userStr = localStorage.getItem("currentUser");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user && user.roles) {
          // Support both string and object roles, case-insensitive
          setRoleNames(
            Array.isArray(user.roles)
              ? user.roles.map(r =>
                  typeof r === "string"
                    ? r.trim().toLowerCase()
                    : (r.name || r.role || "").trim().toLowerCase()
                )
              : []
          );
        }
      }
    } catch {}
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading Documents</h2>
          <p className="text-gray-500">Please wait while we load your document management interface...</p>
        </div>
      </div>
    );
  }

  // Infer document access by specific permissions
  const isAdmin = permissions.some(code => code.startsWith("admin:"));
  const isHR = permissions.some(code => code.startsWith("hr:"));
  const canManageDocuments = permissions.some(code => DOCUMENT_MANAGE_PERMISSION_CODES.includes(code));
  const isHRRole = roleNames.some(r => ["hr", "hr_manager", "hr_staff", "admin"].includes(r));

  // If user has document management permissions or is HR/Admin, show HR Document Management
  if (canManageDocuments || isAdmin || isHR || isHRRole) {
    return <DocumentManagement />;
  }

  // For all other users (including those without specific document permissions), show Employee Document page
  return <EmployeeDocument />;
};

export default DocumentsContainer;
