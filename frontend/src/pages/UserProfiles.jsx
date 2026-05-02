import React, { useEffect, useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const initialNewUser = {
  username: "",
  full_name: "",
  email: "",
  password: "",
  is_active: true,
  roles: [],
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 70 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 340, damping: 30 } },
  exit: { opacity: 0, scale: 0.95, y: 40, transition: { duration: 0.18 } }
};

const toastVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } },
  exit: { opacity: 0, y: 40, transition: { duration: 0.2 } }
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 80 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 340, damping: 30 } },
  exit: { opacity: 0, scale: 0.95, y: 60, transition: { duration: 0.2 } }
};

const tableRowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03, type: "spring", stiffness: 120, damping: 14 }
  }),
  exit: { opacity: 0, x: 20, transition: { duration: 0.16 } }
};

const UserProfiles = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [roles, setRoles] = useState([]);
  const [newUser, setNewUser] = useState(initialNewUser);
  const [actionLoading, setActionLoading] = useState(""); // user id being updated
  const [modal, setModal] = useState({ show: false, title: "", message: "", type: "success" });
  const [deactivateCard, setDeactivateCard] = useState({ show: false, user: null });
  const [deleteCard, setDeleteCard] = useState({ show: false, user: null });
  const [editingRolesUser, setEditingRolesUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editUserData, setEditUserData] = useState({
    full_name: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    role_ids: []
  });

  useEffect(() => {
    fetchUsers();
    fetchRoles();

    // Auto-open create form if navigated from HR module or if 'create' param is present
    if (searchParams.get('create') === 'true' || location.state?.openCreate) {
      setShowCreate(true);
    }
  }, [searchParams, location.state]);

  const showModal = (title, message, type = "success") => {
    setModal({ show: true, title, message, type });
    setTimeout(() => setModal({ show: false, title: "", message: "", type }), 2200);
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("https://ratilalsons-backend-api.onrender.com/api/auth/users", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
        }
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError("Could not load users.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch("https://ratilalsons-backend-api.onrender.com/api/roles/", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
        }
      });
      if (!res.ok) throw new Error("Failed to fetch roles");
      const data = await res.json();
      setRoles(data);
    } catch {
      setRoles([]);
    }
  };

  function renderRoles(user) {
    let idList = [];
    if (Array.isArray(user.role_ids) && user.role_ids.length > 0) {
      idList = user.role_ids;
    } else if (Array.isArray(user.roles) && user.roles.length > 0) {
      // If roles are objects, map by name
      if (typeof user.roles[0] === "object" && user.roles[0].name) {
        return user.roles.map(r => r.name).join(", ");
      }
      idList = user.roles;
    } else if (typeof user.roles === "string") {
      idList = [user.roles];
    }

    // Map idList to names, fallback to id if not found
    if (roles && roles.length > 0) {
      return idList.map(rid => {
        const found = roles.find(role => (
          role.id === rid || role.name === rid // match both id or name on accident
        ));
        return found ? found.name : rid;
      }).join(", ");
    }
    return idList.join(", ");
  }


  const onNewUserChange = e => {
    const { name, value, type, checked } = e.target;
    if (name === "is_active") {
      setNewUser(u => ({ ...u, is_active: checked }));
    } else if (name === "roles") {
      setNewUser(u => ({
        ...u,
        roles: [value]
      }));
    } else {
      setNewUser(u => ({ ...u, [name]: value }));
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        ...newUser,
        role_ids: newUser.roles,
      };
      delete payload.roles;
      const res = await fetch("https://ratilalsons-backend-api.onrender.com/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        showModal("Failed", errData.detail || "Failed to create user", "error");
        setError(errData.detail || "Failed to create user");
        setLoading(false);
        return;
      }
      setShowCreate(false);
      setNewUser(initialNewUser);
      fetchUsers();
      showModal("Success", "User created successfully", "success");
    } catch (err) {
      setError(err.message || "Could not create user.");
      showModal("Failed", err.message || "Could not create user.", "error");
    }
    setLoading(false);
  };

  const handleDeactivateUser = (user) => {
    setDeactivateCard({ show: true, user });
  };

  const confirmDeactivateUser = async (user) => {
    setActionLoading(user.id + "-deactivate");
    setError("");
    try {
      const payload = { is_active: false };
      const res = await fetch(
        `https://ratilalsons-backend-api.onrender.com/api/auth/users/${user.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
          },
          body: JSON.stringify(payload)
        }
      );
      if (!res.ok) {
        const errData = await res.json();
        showModal("Failed", errData.detail || "Failed to deactivate user", "error");
        throw new Error(errData.detail || "Failed to deactivate user");
      }
      fetchUsers();
      showModal("Success", "User deactivated successfully", "success");
    } catch (err) {
      setError(err.message || "Could not deactivate user.");
      showModal("Failed", err.message || "Could not deactivate user.", "error");
    }
    setActionLoading("");
    setDeactivateCard({ show: false, user: null });
  };

  const handleActivateUser = async (user) => {
    setActionLoading(user.id + "-activate");
    setError("");
    try {
      const payload = { is_active: true };
      const res = await fetch(
        `https://ratilalsons-backend-api.onrender.com/api/auth/users/${user.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
          },
          body: JSON.stringify(payload)
        }
      );
      if (!res.ok) {
        const errData = await res.json();
        showModal("Failed", errData.detail || "Failed to activate user", "error");
        throw new Error(errData.detail || "Failed to activate user");
      }
      fetchUsers();
      showModal("Success", "User activated successfully", "success");
    } catch (err) {
      setError(err.message || "Could not activate user.");
      showModal("Failed", err.message || "Could not activate user.", "error");
    }
    setActionLoading("");
  };

  // Show delete card popup instead of browser confirm
  const handleDeleteUser = (user) => {
    setDeleteCard({ show: true, user });
  };

  const confirmDeleteUser = async (user) => {
    setActionLoading(user.id + "-delete");
    setError("");
    try {
      const res = await fetch(
        `https://ratilalsons-backend-api.onrender.com/api/auth/users/${user.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
          }
        }
      );
      if (res.status === 204) {
        fetchUsers();
        showModal("Success", "User deleted successfully", "success");
      } else {
        const errData = await res.json();
        showModal("Failed", errData.detail || "Failed to delete user", "error");
        throw new Error(errData.detail || "Failed to delete user");
      }
    } catch (err) {
      setError(err.message || "Could not delete user.");
      showModal("Failed", err.message || "Could not delete user.", "error");
    }
    setActionLoading("");
    setDeleteCard({ show: false, user: null });
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setEditUserData({
      full_name: user.full_name || "",
      email: user.email || "",
      username: user.username || "",
      password: "",
      confirmPassword: "",
      role_ids: user.role_ids || []
    });
  };

  const handleEditUserChange = (e) => {
    const { name, value } = e.target;
    setEditUserData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditUserRoleChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setEditUserData(prev => ({
      ...prev,
      role_ids: selectedOptions
    }));
  };

  const updateUser = async () => {
    if (!editingUser) return;

    // Validate passwords match if password is being changed
    if (editUserData.password && editUserData.password !== editUserData.confirmPassword) {
      showModal("Failed", "Passwords do not match", "error");
      return;
    }

    // Validate that at least one role is selected
    if (!editUserData.role_ids || editUserData.role_ids.length === 0) {
      showModal("Failed", "Please select at least one role", "error");
      return;
    }

    setActionLoading(editingUser.id + "-update");
    setError("");
    try {
      const userId = editingUser.id || editingUser.user_id || editingUser._id;
      
      // Get role names for the selected role IDs
      const selectedRoleNames = editUserData.role_ids.map(roleId => {
        const role = roles.find(r => r.id === roleId);
        console.log(`Role ID: ${roleId}, Found Role:`, role);
        return role ? role.name : roleId;
      }).filter(name => name);

      console.log("Available roles:", roles);
      console.log("Selected Role IDs:", editUserData.role_ids);
      console.log("Mapped Role Names:", selectedRoleNames);

      // Ensure we have valid role names
      if (selectedRoleNames.length === 0) {
        showModal("Failed", "Invalid role selection", "error");
        return;
      }

      const payload = {
        full_name: editUserData.full_name.trim(),
        email: editUserData.email.trim(),
        username: editUserData.username.trim(),
        role_ids: editUserData.role_ids,
        roles: selectedRoleNames.length === 1 ? selectedRoleNames[0] : selectedRoleNames
      };

      // Only include password if it's being changed
      if (editUserData.password && editUserData.password.trim()) {
        payload.password = editUserData.password;
      }

      console.log("Final payload being sent:", payload);

      const res = await fetch(`https://ratilalsons-backend-api.onrender.com/api/auth/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        console.error("Error updating user:", errData);
        showModal("Failed", errData.detail || "Failed to update user", "error");
        throw new Error(errData.detail || "Failed to update user");
      }

      const responseData = await res.json();
      console.log("Backend response:", responseData);
      
      // Check if the roles were updated correctly
      if (responseData.roles !== payload.roles) {
        console.warn("Role mismatch! Sent:", payload.roles, "Received:", responseData.roles);
      }

      fetchUsers();
      showModal("Success", "User updated successfully", "success");
      setEditingUser(null);
      setEditUserData({
        full_name: "",
        email: "",
        username: "",
        password: "",
        confirmPassword: "",
        role_ids: []
      });
    } catch (err) {
      console.error("Update user error:", err);
      setError(err.message || "Could not update user.");
      showModal("Failed", err.message || "Could not update user.", "error");
    }
    setActionLoading("");
  };

  // Responsive grid columns for forms
  const inputCol = "col-span-12 sm:col-span-6";
  const inputColFull = "col-span-12";
  const labelStyle = "block mb-1 font-medium";
  const inputStyle = "border rounded p-2 w-full focus:ring focus:ring-blue-100";
  const errorStyle = "text-red-600 text-sm mb-2";

  if (loading)
    return (
      <motion.div
        className="fixed inset-0 flex items-center justify-center bg-white z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="text-center"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: { type: "spring", stiffness: 180, damping: 20 } }}
        >
          <div className="animate-spin mx-auto mb-4 rounded-full border-4 border-blue-400 border-t-transparent w-12 h-12" />
          <div className="text-blue-600 font-bold text-lg">Loading users...</div>
        </motion.div>
      </motion.div>
    );
  if (error)
    return <div className="p-8 text-center text-red-600 font-semibold text-lg">{error}</div>;

  return (
    <div className="p-2 sm:p-3 md:p-6">
      {/* Animated Modal for feedback */}
      <AnimatePresence>
        {modal.show && (
          <motion.div
            className={`fixed top-6 left-1/2 z-50 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg text-white font-semibold
              ${modal.type === "success" ? "bg-green-600" : "bg-red-600"}`}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={toastVariants}
          >
            <div className="text-lg font-bold">{modal.title}</div>
            <div className="text-base">{modal.message}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deactivate confirmation card */}
      <AnimatePresence>
        {deactivateCard.show && deactivateCard.user && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={cardVariants}
            key="deactivate-card"
          >
            <motion.div
              className="bg-white rounded-2xl max-w-sm w-full p-7 shadow-2xl flex flex-col items-center border-2 border-yellow-400"
              initial={{ scale: 0.91, opacity: 0, y: 60 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }}
              exit={{ scale: 0.95, opacity: 0, y: 20, transition: { duration: 0.15 } }}
            >
              <div className="text-4xl mb-2 text-yellow-400 animate-pulse">⚠️</div>
              <div className="text-xl font-bold mb-1 text-gray-800 text-center">Deactivate User</div>
              <div className="text-gray-700 mb-4 text-base text-center">
                Are you sure you want to deactivate <span className="font-semibold">{deactivateCard.user.full_name || deactivateCard.user.username}</span>?<br />
                <span className="text-yellow-600">They will not be able to log in until reactivated.</span>
              </div>
              <div className="flex gap-3 w-full mt-2 flex-col sm:flex-row">
                <button
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg px-4 py-2 font-semibold transition"
                  disabled={actionLoading === deactivateCard.user.id + "-deactivate"}
                  onClick={() => confirmDeactivateUser(deactivateCard.user)}
                >
                  {actionLoading === deactivateCard.user.id + "-deactivate" ? "Deactivating..." : "Deactivate"}
                </button>
                <button
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 font-semibold transition shadow"
                  onClick={() => setDeactivateCard({ show: false, user: null })}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation card */}
      <AnimatePresence>
        {deleteCard.show && deleteCard.user && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={cardVariants}
            key="delete-card"
          >
            <motion.div
              className="bg-white rounded-2xl max-w-sm w-full p-7 shadow-2xl flex flex-col items-center border-2 border-red-400"
              initial={{ scale: 0.91, opacity: 0, y: 60 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }}
              exit={{ scale: 0.95, opacity: 0, y: 20, transition: { duration: 0.15 } }}
            >
              <div className="text-4xl mb-2 text-red-500 animate-pulse">🗑️</div>
              <div className="text-xl font-bold mb-1 text-gray-800 text-center">Delete User</div>
              <div className="text-gray-700 mb-4 text-base text-center">
                Are you sure you want to <span className="font-semibold text-red-600">delete</span> <span className="font-semibold">{deleteCard.user.full_name || deleteCard.user.username}</span>?<br />
                This action cannot be undone.
              </div>
              <div className="flex gap-3 w-full mt-2 flex-col sm:flex-row">
                <button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2 font-semibold transition"
                  disabled={actionLoading === deleteCard.user.id + "-delete"}
                  onClick={() => confirmDeleteUser(deleteCard.user)}
                >
                  {actionLoading === deleteCard.user.id + "-delete" ? "Deleting..." : "Delete"}
                </button>
                <button
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 font-semibold transition shadow"
                  onClick={() => setDeleteCard({ show: false, user: null })}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 140, damping: 18 }}>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 tracking-tight drop-shadow text-center w-full sm:w-auto">
            User Profiles
          </h2>
          {(
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.98 }}
              className="bg-gradient-to-r from-blue-600 to-blue-400 text-white px-4 sm:px-6 py-2 rounded-lg shadow-md hover:from-blue-700 hover:to-blue-500 font-semibold transition w-full sm:w-auto"
              onClick={() => setShowCreate(true)}
            >
              + New User
            </motion.button>
          )}
        </div>
        <div className="overflow-x-auto bg-white rounded-2xl shadow-lg border border-gray-100">
          <table className="min-w-[350px] sm:min-w-[600px] md:min-w-[860px] w-full text-xs sm:text-base">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-blue-100 text-left">
                <th className="p-2 sm:p-3 md:p-4 font-semibold text-blue-700">User Name</th>
                <th className="p-2 sm:p-3 md:p-4 font-semibold text-blue-700">Name</th>
                <th className="p-2 sm:p-3 md:p-4 font-semibold text-blue-700">Email</th>
                <th className="p-2 sm:p-3 md:p-4 font-semibold text-blue-700">Role</th>
                <th className="p-2 sm:p-3 md:p-4 font-semibold text-blue-700">Status</th>
                {<th className="p-2 sm:p-3 md:p-4 font-semibold text-blue-700">Action</th>}
              </tr>
            </thead>
            <AnimatePresence>
              <tbody>
                {users.map((u, i) => (
                  <motion.tr
                    key={u.id}
                    variants={tableRowVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    custom={i}
                    className="border-t hover:bg-blue-50 transition"
                  >
                    <td className="p-2 sm:p-3 md:p-4 font-medium break-all">{u.username}</td>
                    <td className="p-2 sm:p-3 md:p-4 font-medium break-all">{u.full_name || u.username}</td>
                    <td className="p-2 sm:p-3 md:p-4 break-all">{u.email}</td>
                    <td className="p-2 sm:p-3 md:p-4 capitalize break-all">{renderRoles(u)}</td>
                    <td className="p-2 sm:p-3 md:p-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${u.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {(
                      <td className="p-2 sm:p-3 md:p-4 flex gap-2 flex-wrap">
                        {u.is_active ? (
                          <>
                            <motion.button
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.96 }}
                              className="bg-blue-500 text-white px-2 sm:px-3 py-1 rounded-lg text-xs font-semibold shadow hover:bg-blue-600 transition"
                              disabled={actionLoading === u.id + "-update"}
                              onClick={() => handleEditUser(u)}
                            >
                              {actionLoading === u.id + "-update" ? "Updating..." : "Edit"}
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.96 }}
                              className="bg-yellow-500 text-white px-2 sm:px-3 py-1 rounded-lg text-xs font-semibold shadow hover:bg-yellow-600 transition"
                              disabled={actionLoading === u.id + "-deactivate"}
                              onClick={() => handleDeactivateUser(u)}
                            >
                              {actionLoading === u.id + "-deactivate" ? "Deactivating..." : "Deactivate"}
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.96 }}
                              className="bg-red-600 text-white px-2 sm:px-3 py-1 rounded-lg text-xs font-semibold shadow hover:bg-red-700 transition"
                              disabled={actionLoading === u.id + "-delete"}
                              onClick={() => handleDeleteUser(u)}
                            >
                              {actionLoading === u.id + "-delete" ? "Deleting..." : "Delete"}
                            </motion.button>
                          </>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            className="bg-green-600 text-white px-2 sm:px-3 py-1 rounded-lg text-xs font-semibold shadow hover:bg-green-700 transition"
                            disabled={actionLoading === u.id + "-activate"}
                            onClick={() => handleActivateUser(u)}
                          >
                            {actionLoading === u.id + "-activate" ? "Activating..." : "Activate"}
                          </motion.button>
                        )}
                      </td>
                    )}
                  </motion.tr>
                ))}
              </tbody>
            </AnimatePresence>
          </table>
        </div>
      </motion.div>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            key="edit-user-modal"
          >
            <motion.div
              className="bg-white rounded-2xl w-full max-w-xs sm:max-w-lg md:max-w-2xl p-4 sm:p-6 md:p-7 shadow-2xl relative border border-blue-200"
              initial={{ scale: 0.85, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 230, damping: 20 } }}
              exit={{ scale: 0.95, opacity: 0, y: 20, transition: { duration: 0.18 } }}
            >
              <button
                onClick={() => {
                  setEditingUser(null);
                  setEditUserData({
                    full_name: "",
                    email: "",
                    username: "",
                    password: "",
                    confirmPassword: "",
                    role_ids: []
                  });
                }}
                className="absolute top-2 right-3 text-2xl text-gray-400 hover:text-red-500 font-bold"
                aria-label="Close"
              >×</button>
              <h3 className="text-lg sm:text-2xl font-bold mb-3 text-blue-800 text-center">
                Edit User: {editingUser.full_name || editingUser.username}
              </h3>
              <form onSubmit={(e) => { e.preventDefault(); updateUser(); }} className="grid grid-cols-12 gap-3 sm:gap-4 md:gap-5">
                <div className="col-span-12 sm:col-span-6">
                  <label className="block mb-1 font-medium">Username</label>
                  <input
                    name="username"
                    value={editUserData.username}
                    onChange={handleEditUserChange}
                    className="border rounded p-2 w-full focus:ring focus:ring-blue-100"
                    required
                    placeholder="johndoe"
                  />
                </div>
                <div className="col-span-12 sm:col-span-6">
                  <label className="block mb-1 font-medium">Full Name</label>
                  <input
                    name="full_name"
                    value={editUserData.full_name}
                    onChange={handleEditUserChange}
                    className="border rounded p-2 w-full focus:ring focus:ring-blue-100"
                    required
                    placeholder="John Doe"
                  />
                </div>
                <div className="col-span-12">
                  <label className="block mb-1 font-medium">Email</label>
                  <input
                    name="email"
                    type="email"
                    value={editUserData.email}
                    onChange={handleEditUserChange}
                    className="border rounded p-2 w-full focus:ring focus:ring-blue-100"
                    required
                    placeholder="johndoe@example.com"
                  />
                </div>
                <div className="col-span-12 sm:col-span-6">
                  <label className="block mb-1 font-medium">New Password</label>
                  <input
                    name="password"
                    type="password"
                    value={editUserData.password}
                    onChange={handleEditUserChange}
                    className="border rounded p-2 w-full focus:ring focus:ring-blue-100"
                    placeholder="Leave blank to keep current password"
                    autoComplete="new-password"
                  />
                </div>
                <div className="col-span-12 sm:col-span-6">
                  <label className="block mb-1 font-medium">Confirm New Password</label>
                  <input
                    name="confirmPassword"
                    type="password"
                    value={editUserData.confirmPassword}
                    onChange={handleEditUserChange}
                    className="border rounded p-2 w-full focus:ring focus:ring-blue-100"
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                  />
                </div>
                <div className="col-span-12">
                  <label className="block mb-1 font-medium">Roles</label>
                  <select
                    multiple
                    value={editUserData.role_ids}
                    onChange={handleEditUserRoleChange}
                    className="border rounded p-2 w-full h-32 focus:ring focus:ring-blue-100"
                    size="4"
                  >
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple roles</p>
                </div>
                {error && (
                  <div className="col-span-12 text-red-600 text-sm mb-2">{error}</div>
                )}
                <div className="col-span-12">
                  <motion.button
                    type="submit"
                    disabled={actionLoading === editingUser.id + "-update"}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-400 text-white font-semibold rounded px-4 py-2 mt-2 shadow-sm hover:from-blue-700 hover:to-blue-500"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {actionLoading === editingUser.id + "-update" ? "Updating..." : "Update User"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create User Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            key="create-modal"
          >
            <motion.div
              className="bg-white rounded-2xl w-full max-w-xs sm:max-w-lg md:max-w-2xl p-4 sm:p-6 md:p-7 shadow-2xl relative border border-blue-200"
              initial={{ scale: 0.85, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 230, damping: 20 } }}
              exit={{ scale: 0.95, opacity: 0, y: 20, transition: { duration: 0.18 } }}
            >
              <button
                onClick={() => setShowCreate(false)}
                className="absolute top-2 right-3 text-2xl text-gray-400 hover:text-red-500 font-bold"
                aria-label="Close"
              >×</button>
              <h3 className="text-lg sm:text-2xl font-bold mb-3 text-blue-800 text-center">Create New User</h3>
              <form onSubmit={handleCreateUser} className="grid grid-cols-12 gap-3 sm:gap-4 md:gap-5">
                <div className={inputCol}>
                  <label className={labelStyle}>Username</label>
                  <input
                    name="username"
                    value={newUser.username}
                    onChange={onNewUserChange}
                    className={inputStyle}
                    required
                    placeholder="johndoe"
                    autoFocus
                  />
                </div>
                <div className={inputCol}>
                  <label className={labelStyle}>Full Name</label>
                  <input
                    name="full_name"
                    value={newUser.full_name}
                    onChange={onNewUserChange}
                    className={inputStyle}
                    required
                    placeholder="John Doe"
                  />
                </div>
                <div className={inputCol}>
                  <label className={labelStyle}>Email</label>
                  <input
                    name="email"
                    type="email"
                    value={newUser.email}
                    onChange={onNewUserChange}
                    className={inputStyle}
                    required
                    placeholder="johndoe@example.com"
                  />
                </div>
                <div className={inputCol}>
                  <label className={labelStyle}>Password</label>
                  <input
                    name="password"
                    type="password"
                    value={newUser.password}
                    onChange={onNewUserChange}
                    className={inputStyle}
                    required
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
                <div className={inputCol}>
                  <label className={labelStyle}>Role</label>
                  <select
                    name="roles"
                    value={newUser.roles[0] || ""}
                    onChange={onNewUserChange}
                    className={inputStyle}
                    required
                  >
                    <option value="">Select Role</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                </div>
                <div className={inputCol + " flex items-center"}>
                  <label className={labelStyle + " mr-2 mb-0"}>Active</label>
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={newUser.is_active}
                    onChange={onNewUserChange}
                    className="h-5 w-5"
                  />
                </div>
                {error && (
                  <div className={inputColFull + " " + errorStyle}>{error}</div>
                )}
                <div className={inputColFull}>
                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-400 text-white font-semibold rounded px-4 py-2 mt-2 shadow-sm hover:from-blue-700 hover:to-blue-500"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {loading ? "Saving..." : "Create User"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserProfiles;