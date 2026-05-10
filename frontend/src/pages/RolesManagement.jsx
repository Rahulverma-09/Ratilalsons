import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = "https://ratilalsons-backend-api.onrender.com/api/roles/";

const ALL_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "users", label: "Users List", icon: "👥" },
  { key: "roles", label: "Roles & Permissions", icon: "🛡️" },
  { key: "attendance", label: "Attendance (Checkin/Checkout)", icon: "📋" },
  { key: "customers", label: "Manage Customers (Admin)", icon: "🧑‍🤝‍🧑" },
  { key: "vendors", label: "Manage Vendors (Admin)", icon: "🏪" },
  { key: "hr", label: "Staff Management", icon: "💼" },
  { key: "mark_attendance", label: "Mark Attendance (HR/Manager)", icon: "✅" },
  { key: "leave", label: "Leave Management", icon: "🏖️" },
  { key: "payroll", label: "Payroll (Salary & Deductions)", icon: "💳" },
  { key: "generator_management", label: "Equipments & Utility", icon: "⚡" },
  { key: "site_management", label: "Manage Sites", icon: "🏢" },
  { key: "inventory", label: "Inventory (Stock Management)", icon: "📦" },
  { key: "documents", label: "Documents (Upload & Manage)", icon: "📋" },
  { key: "vendor", label: "Add Products (Vendor)", icon: "🛍️" },
  { key: "purchase", label: "Purchase Products (Customer)", icon: "🛒" },
  { key: "sales", label: "Manage Sales (Vendor)", icon: "💰" },
  { key: "tasks", label: "Tasks & Workflow (Assign/Track Work)", icon: "📝" },
  { key: "alerts", label: "Alerts & Notifications", icon: "🔔" },
  { key: "reports", label: "Manage Reports", icon: "📈" },
  { key: "orders", label: "Track Orders (Customer)", icon: "🧾" },
  { key: "support", label: "Support (Help & Tickets)", icon: "🛟" },
  { key: "invoices", label: "Bills & Invoice", icon: "🧾" }
];

const SPECIAL_SINGLE_MAP = {
  dashboard: "dashboard:read",
  alerts: "alerts:read",
  reports: "global_reports:view"
};

// --- Animations ---
const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 30 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
  exit: { opacity: 0, scale: 0.98, y: 20, transition: { duration: 0.2 } }
};
const errorAnim = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 210, damping: 18 } },
  exit: { opacity: 0, y: 10, transition: { duration: 0.2 } }
};

// --- Tree builder ---
const buildRoleTree = (roles, parentId = null) =>
  roles
    .filter(role => {
      const currentParentId = role.parent_id || role.report_to;
      const isTopLevel = parentId === null && (!currentParentId || currentParentId === '');
      return currentParentId === parentId || isTopLevel;
    })
    .map(role => ({
      ...role,
      children: buildRoleTree(roles, role.id)
    }));

// --- Permissions Modal ---
const RolePermissionsModal = ({ role, onClose, onSaved }) => {
  const [expanded, setExpanded] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isAdminRole = role.name.toLowerCase().includes("admin");
  useEffect(() => {
    const mapped = {};
    (role.permissions || []).forEach(key => {
      if (typeof key === "string" && key.includes(":")) {
        const [mod, act] = key.split(":");
        if (SPECIAL_SINGLE_MAP[mod] === key) mapped[mod] = true;
        // For generic modules, use mod:access
        if (act === "access") mapped[mod] = true;
      }
      if (key === "global_reports:view") mapped["reports"] = true;
      if (key === "dashboard:read") mapped["dashboard"] = true;
      if (key === "alerts:read") mapped["alerts"] = true;
    });
    setPermissions(mapped);
  }, [role]);

  const handleModuleAccess = (modKey) => setPermissions(prev => ({
    ...prev, [modKey]: !prev[modKey]
  }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      let perms = [];
      ALL_PERMISSIONS.forEach(mod => {
        if (permissions[mod.key]) {
          if (SPECIAL_SINGLE_MAP[mod.key]) {
            perms.push(SPECIAL_SINGLE_MAP[mod.key]);
          } else {
            perms.push(`${mod.key}:access`);
          }
        }
      });
      perms = Array.from(new Set(perms));
      // ✅ REMOVED FORCED ADMIN INJECTION - Allow fine-grained control
      // Previously, admin:access was always added to admin role even if unchecked
      await fetch(`${API_URL}/${role.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
        body: JSON.stringify({ permissions: perms })
      }).then(res => { if (!res.ok) throw new Error("Failed to save permissions"); });

      // ✅ CRITICAL FIX: Trigger permission refresh for all users
      // Force immediate refresh by updating localStorage timestamp
      localStorage.setItem('permissions_updated', Date.now().toString());

      // Dispatch storage event for current tab
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'permissions_updated',
        newValue: Date.now().toString(),
        url: window.location.href
      }));

      // Trigger manual refresh if available
      if (window.PermissionsContextRefresh) {
        await window.PermissionsContextRefresh();
      }

      onSaved && onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save permissions");
    }
    setSaving(false);
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 md:overflow-y-auto"
      initial="hidden" animate="visible" exit="exit" variants={modalVariants}>
      <motion.div className="bg-white rounded-t-3xl md:rounded-2xl p-4 sm:p-8 max-w-xs sm:max-w-lg md:max-w-2xl w-full shadow-2xl border-t-8 border-purple-600 relative flex flex-col"
        style={{ maxHeight: "95vh" }}>
        <button onClick={onClose} className="absolute top-5 right-5 text-xl sm:text-2xl text-gray-400 hover:text-red-500 font-bold z-10">×</button>
        <div className="text-xl sm:text-2xl font-black mb-4 text-purple-700 flex items-center gap-2 sm:gap-4 mt-2">
          <span>🔑</span>
          <span className="truncate">{`Set Permissions for "${role.name}"`}</span>
        </div>
        <div className="divide-y divide-indigo-100 border rounded-xl shadow-inner bg-indigo-50 mb-5 overflow-y-auto" style={{ maxHeight: "54vh" }}>
          {ALL_PERMISSIONS.map(mod => (
            <div key={mod.key} className="flex flex-col">
              <label className="flex flex-row items-center gap-2 px-2 py-3 bg-indigo-50 rounded shadow border-indigo-200 border m-2">
                <input
                  type="checkbox"
                  className="accent-purple-600 h-5 w-5"
                  checked={permissions[mod.key] || false}
                  onChange={() => handleModuleAccess(mod.key)}
                />
                <span className="flex items-center gap-2 text-sm sm:text-lg font-bold"><span>{mod.icon}</span>{mod.label}</span>
              </label>
            </div>
          ))}
        </div>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <button className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl text-base sm:text-lg py-3 mt-1 hover:from-purple-700 hover:to-indigo-700 transition"
          onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Permissions"}</button>
      </motion.div>
    </motion.div>
  );
};

// --- Tree Node ---
const RoleNode = ({ role, depth, onSetPermissions, onDeleteRole, allRoles }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const parentId = role.parent_id || role.report_to;
  const parentRole = allRoles.find(r => r.id === parentId);
  const parentName = parentRole ? parentRole.name : 'None (Top Level)';
  const hasChildren = role.children && role.children.length > 0;
  const getDepthColor = d => [
    'border-purple-600', 'border-teal-500', 'border-amber-500', 'border-indigo-500', 'border-pink-500'
  ][d % 5];
  const paddingClass = depth === 0 ? "p-4" : "p-3";
  const indentStyle = { marginLeft: `${depth * 16}px`, width: '100%', minWidth: "265px" };

  return (
    <AnimatePresence>
      <motion.div className={`flex flex-col mb-3 rounded-xl shadow-lg bg-white border-l-4 ${getDepthColor(depth)} transition-all duration-300 hover:shadow-xl hover:scale-[1.0125]`} style={indentStyle} layout>
        <div className={`grid grid-cols-4 sm:grid-cols-6 items-center w-full gap-x-2 gap-y-1 ${paddingClass}`}>
          <div className="col-span-3 sm:col-span-4 flex items-center gap-3 min-w-[165px]">
            {hasChildren ? (
              <motion.button onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-600 hover:text-purple-700 transition p-2 rounded-full bg-purple-50 hover:bg-purple-200 border border-purple-300 flex-shrink-0"
                whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }} aria-expanded={isExpanded}
                aria-controls={`children-${role.id}`}>
                <svg className={`w-4 h-4 transform ${isExpanded ? 'rotate-90' : 'rotate-0'} transition-transform duration-300`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path></svg>
              </motion.button>
            ) : (<div className="w-8 h-8 ml-1 flex-shrink-0 flex items-center justify-center text-sm text-gray-400"><span className="text-lg">○</span></div>)}
            <div className="flex overflow-hidden">
              <h4 className="text-base sm:text-lg font-extrabold capitalize text-purple-900 flex items-center gap-2">
                {role.name}
                {role.name.toLowerCase() === 'super-admin' && <span className="text-xs bg-red-700 text-white px-2 py-0.5 rounded-full font-mono shadow-md">ROOT ADMIN</span>}
              </h4>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate flex items-center gap-1">
                <span className="text-indigo-500 font-bold">↑</span>
                Parent: <span className="font-semibold capitalize text-gray-700">{parentName}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end col-span-1 sm:col-span-2 min-w-[110px]">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="w-[110px] sm:w-[125px] px-2 py-2 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-indigo-300/50 transition"
              onClick={() => onSetPermissions(role)}>Set Permissions</motion.button>
            {(role.name.toLowerCase() !== 'super-admin' && role.name.toLowerCase() !== 'admin') && (
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="w-[90px] sm:w-[110px] px-2 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-600 hover:text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-red-300/50 transition"
                onClick={() => onDeleteRole(role)}>Delete</motion.button>
            )}
          </div>
        </div>
        <AnimatePresence>
          {hasChildren && isExpanded && (
            <motion.div id={`children-${role.id}`} className="mt-1 pb-1"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto', transition: { duration: 0.26 } }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.14 } }}>
              {role.children.map(childRole => (
                <RoleNode key={childRole.id} role={childRole} depth={depth + 1}
                  onSetPermissions={onSetPermissions} onDeleteRole={onDeleteRole} allRoles={allRoles} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

// --- Main Manager ---
const RoleHierarchyManager = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newParentId, setNewParentId] = useState("");
  const [deleteRole, setDeleteRole] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [permRole, setPermRole] = useState(null);
  const [showRoleExistsModal, setShowRoleExistsModal] = useState(false);
  const [existingRoleName, setExistingRoleName] = useState("");

  useEffect(() => { fetchRoles(); }, []);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type }), 2300);
  };

  const fetchRoles = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(API_URL, { headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` }, });
      if (!res.ok) throw new Error("Failed to fetch roles");
      const data = await res.json();
      setRoles(data);
    } catch (err) {
      setError("Could not load roles. Please check your network or API status.");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const trimmedRoleName = newRoleName.trim();
    if (!trimmedRoleName) {
      setError("Role name cannot be empty.");
      setSaving(false);
      return;
    }
    try {
      const payload = { name: trimmedRoleName };
      if (newParentId) payload.report_to = newParentId;
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        if (res.status === 400 && typeof errData.detail === "string" && errData.detail.toLowerCase().includes("already exists")) {
          setExistingRoleName(trimmedRoleName);
          setShowRoleExistsModal(true);
          setSaving(false);
          return;
        }
        throw new Error(errData.detail || "Failed to create role");
      }
      setShowCreate(false);
      setNewRoleName("");
      setNewParentId("");
      setError("");
      showToast("Role created successfully", "success");
      fetchRoles();
    } catch (err) {
      setError(err.message || "Could not create role.");
      showToast(err.message || "Could not create role.", "error");
    }
    setSaving(false);
  };

  const handleDeleteRole = async () => {
    if (!deleteRole) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}${deleteRole.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Could not delete role");
      }
      setShowDeleteModal(false);
      setDeleteRole(null);
      fetchRoles();
      showToast("Role deleted successfully", "success");
    } catch (err) {
      setError(err.message || "Could not delete role. Ensure no users report to this role.");
      showToast(err.message || "Could not delete role.", "error");
    }
    setSaving(false);
  };

  const roleTree = buildRoleTree(roles);

  if (loading)
    return <div className="p-8 sm:p-12 text-center text-indigo-700 bg-indigo-100 border border-indigo-300 rounded-xl font-semibold text-md sm:text-lg max-w-lg mx-auto mt-8 sm:mt-10">Loading Role Hierarchy...</div>;
  if (error && !toast.show)
    return <div className="p-8 sm:p-12 text-center text-red-700 bg-red-100 border border-red-400 rounded-xl font-semibold text-md sm:text-lg max-w-lg mx-auto mt-8 sm:mt-10">Error: {error}</div>;

  return (
    <div className="p-2 sm:p-4 md:p-7 bg-gray-50 min-h-screen">
      <AnimatePresence>
        {toast.show && (
          <motion.div className={`fixed top-2 sm:top-4 right-2 sm:right-4 z-[9999] p-3 sm:p-4 pr-7 rounded-xl shadow-2xl font-bold text-white transition-all flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}
            initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 80 }}>
            {toast.type === 'success' ? '👍' : '🚨'} {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 140, damping: 18 }}>
        <header className="flex flex-col sm:flex-row justify-between items-center gap-2 mb-6 sm:mb-8 pb-3 sm:pb-4 border-b-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-500 tracking-tight drop-shadow-sm">
            Role Hierarchy Management 🛠️
          </h2>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.88 }}
            className="bg-gradient-to-r from-purple-400 to-indigo-500 text-white px-4 sm:px-8 py-2 sm:py-3 rounded-xl shadow-sm font-bold transition duration-100 w-full sm:w-auto mt-2 sm:mt-0 text-sm"
            onClick={() => { setShowCreate(true); setError(""); setNewParentId(""); }}>
            ➕ Create New Role
          </motion.button>
        </header>
        <section className="bg-white px-2 sm:px-7 pt-4 pb-8 rounded-2xl sm:rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.05)] max-w-8xl mx-auto">
          <h3 className="text-2xl font-semibold mb-5 text-purple-800 border-b pb-2 flex items-center gap-2">
            Manage Roles and Permissions
          </h3>
          {roleTree.length > 0 ? (
            <div className="p-1 sm:p-2">
              <div className="grid grid-cols-4 sm:grid-cols-6 font-extrabold text-xs sm:text-sm text-gray-700 bg-gray-100 rounded-lg py-3 mb-3 px-2 sm:px-4">
                <div className="col-span-3 sm:col-span-4 flex items-center gap-2"><span className="text-base text-purple-600">👥</span> Role Name & Parent</div>
                <div className="col-span-1 sm:col-span-2 text-right">Actions</div>
              </div>
              <AnimatePresence>
                {roleTree.map(role => (
                  <RoleNode key={role.id} role={role} depth={0} onSetPermissions={setPermRole} onDeleteRole={role => {
                    setDeleteRole(role);
                    setShowDeleteModal(true);
                  }} allRoles={roles} />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <p className="text-center p-8 sm:p-10 text-gray-500 text-lg bg-gray-50 rounded-xl border border-dashed border-gray-300">No roles found. Start by creating the top-level role!</p>
          )}
        </section>
      </motion.div>
      {/* Create Role Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black bg-opacity-30"
            initial="hidden" animate="visible" exit="exit" variants={modalVariants}>
            <motion.form onSubmit={handleCreateRole} className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-lg relative border-t-8 border-purple-500"
              initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: { type: "spring", stiffness: 230, damping: 22 } }} exit={{ scale: 0.95, opacity: 0, transition: { duration: 0.18 } }}>
              <button type="button" onClick={() => setShowCreate(false)} className="absolute top-4 right-4 text-2xl sm:text-3xl text-gray-400 hover:text-red-500 font-light">
                <span className="block w-8 h-8 rounded-full bg-gray-100 hover:bg-red-500 hover:text-white flex items-center justify-center">&times;</span>
              </button>
              <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-purple-900 border-b pb-2 flex items-center gap-2">
                <span className="text-purple-600 text-2xl">✨</span> Define New Role
              </h3>
              <div className="mb-4">
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2" htmlFor="roleName">Role Name:</label>
                <input id="roleName" type="text" value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
                  className="w-full p-2 sm:p-3 border border-cyan-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 transition shadow-sm"
                  placeholder="Enter role name" required />
              </div>
              <div className="mb-6">
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2" htmlFor="parentRole">Reports To (Select Upper Person):</label>
                <select id="parentRole" value={newParentId} onChange={e => setNewParentId(e.target.value)}
                  className="w-full p-2 sm:p-3 border border-cyan-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 bg-white transition shadow-sm">
                  <option value="">-- No Parent (Top Level / CEO) --</option>
                  {roles.filter(r => r.name.toLowerCase() !== 'super-admin').map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
              {error && <motion.div className="text-red-600 text-sm mb-4 p-2 bg-red-50 border border-red-300 rounded-lg" initial="hidden" animate="visible" exit="exit" variants={errorAnim}>{error}</motion.div>}
              <motion.button type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold rounded-xl px-4 py-3 shadow-xl hover:shadow-purple-400/50 hover:from-purple-700 hover:to-indigo-700 transition duration-200 text-lg"
                disabled={saving} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                {saving ? "Creating Role..." : "Create Role"}
              </motion.button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Delete Role Modal */}
      <AnimatePresence>
        {showDeleteModal && deleteRole && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black bg-opacity-30"
            initial="hidden" animate="visible" exit="exit" variants={modalVariants}>
            <motion.div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-sm p-8 shadow-lg relative text-center border-t-8 border-red-500"
              initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 230, damping: 22 } }} exit={{ scale: 0.95, opacity: 0, transition: { duration: 0.18 } }}>
              <div className="text-4xl sm:text-6xl mb-4 text-red-500">⚠️</div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3 text-red-800">Confirm Deletion</h3>
              <p className="mb-6 text-gray-600 text-sm sm:text-md">
                Are you sure you want to delete the role: <span className="font-bold capitalize text-red-700 text-lg">{`"${deleteRole.name}"`}</span>?
                <br />This action is <b>permanent</b> and cannot be undone.
              </p>
              {error && <motion.div className="text-red-600 text-sm mb-4 p-2 bg-red-50 border border-red-300 rounded-lg" initial="hidden" animate="visible" exit="exit" variants={errorAnim}>{error}</motion.div>}
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <motion.button className="flex-1 bg-gray-200 text-gray-700 font-bold rounded-xl px-4 py-3 hover:bg-gray-300 transition shadow-md"
                  onClick={() => setShowDeleteModal(false)} disabled={saving}
                  whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.96 }}>Cancel</motion.button>
                <motion.button className="flex-1 bg-red-600 text-white font-bold rounded-xl px-4 py-3 hover:bg-red-700 transition shadow-lg hover:shadow-red-400/50"
                  onClick={handleDeleteRole} disabled={saving}
                  whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.96 }}>{saving ? "Deleting..." : "Yes, Delete"}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Role Exists Modal */}
      <AnimatePresence>
        {showRoleExistsModal && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black bg-opacity-30"
            initial="hidden" animate="visible" exit="exit" variants={modalVariants}>
            <motion.div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-sm p-8 shadow-lg relative text-center border-t-8 border-yellow-500"
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: { type: "spring", stiffness: 230, damping: 22 } }} exit={{ scale: 0.95, opacity: 0, transition: { duration: 0.19 } }}>
              <div className="text-5xl sm:text-6xl mb-4 text-yellow-500">⚠️</div>
              <h3 className="text-xl sm:text-2xl font-bold mb-2 text-yellow-800">Role Already Exists</h3>
              <p className="mb-6 text-gray-600 text-sm sm:text-md">
                A role named <span className="font-bold capitalize text-yellow-700 text-lg">{`"${existingRoleName}"`}</span> already exists in the system. Please choose a different, unique name.
              </p>
              <motion.button className="w-full bg-yellow-600 text-white font-bold rounded-xl px-4 py-3 hover:bg-yellow-700 transition shadow-lg hover:shadow-yellow-400/50"
                onClick={() => setShowRoleExistsModal(false)}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.97 }}>
                Got It
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Permissions Modal */}
      <AnimatePresence>
        {permRole && (
          <RolePermissionsModal
            role={permRole}
            onClose={() => setPermRole(null)}
            onSaved={fetchRoles}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RoleHierarchyManager;
