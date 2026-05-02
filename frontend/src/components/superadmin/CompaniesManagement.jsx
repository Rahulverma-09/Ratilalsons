import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Dummy org data
const mockTenants = [
  { id: 1, name: "Ratlal & Sons", status: "Active", domain: "ratlal.crm.com" },
  { id: 2, name: "Alpha Corp", status: "Suspended", domain: "alpha.crm.com" }
];

// Modal for adding/editing orgs
function OrgModal({ open, onClose, onSave, org }) {
  const [form, setForm] = useState(org || { name: "", domain: "", status: "Active" });
  if (!open) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}>
        <motion.div
          className="bg-gradient-to-br from-blue-50 via-white to-blue-100 rounded-2xl w-full max-w-xs sm:max-w-md shadow-2xl border-2 border-blue-400 px-4 py-6 relative"
          initial={{ scale: 0.92, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 16, transition: { duration: 0.2 } }}
        >
          <button onClick={onClose} className="absolute top-2 right-3 text-blue-400 hover:text-red-500 text-2xl font-bold">×</button>
          <h2 className="text-lg sm:text-2xl font-bold mb-1 text-blue-700 text-center">{org ? "Edit" : "Add"} Organization</h2>
          <p className="text-xs text-blue-500 mb-3 text-center">Manage a business entity as a tenant.</p>
          <form className="space-y-3" onSubmit={handleSubmit} autoComplete="off">
            <div>
              <label className="block text-sm font-medium mb-1">Org Name</label>
              <input
                name="name"
                className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400"
                value={form.name}
                onChange={handleChange}
                placeholder="Org Name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Domain</label>
              <input
                name="domain"
                className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400"
                value={form.domain}
                onChange={handleChange}
                placeholder="org.crm.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                name="status"
                className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400"
                value={form.status}
                onChange={handleChange}
              >
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
            <motion.button
              type="submit"
              whileHover={{ scale: 1.03 }}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-400 text-white font-semibold rounded px-4 py-2 mt-2"
            >
              {org ? "Update" : "Add"} Organization
            </motion.button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function OrganizationsPanel() {
  const [orgs, setOrgs] = useState(mockTenants);
  const [modalOpen, setModalOpen] = useState(false);
  const [editOrg, setEditOrg] = useState(null);

  const handleAdd = () => {
    setEditOrg(null);
    setModalOpen(true);
  };
  const handleEdit = (org) => {
    setEditOrg(org);
    setModalOpen(true);
  };
  const handleSave = (org) => {
    setOrgs((prev) => {
      if (editOrg) {
        return prev.map((o) => (o.id === editOrg.id ? { ...org, id: editOrg.id } : o));
      }
      return [...prev, { ...org, id: Date.now() }];
    });
  };
  const handleStatusToggle = (o) => {
    setOrgs((prev) =>
      prev.map((org) => org.id === o.id
        ? { ...org, status: org.status === "Active" ? "Suspended" : "Active" }
        : org
      )
    );
  };
  const handleDelete = (id) => {
    if (window.confirm("Delete this organization?")) {
      setOrgs((prev) => prev.filter((o) => o.id !== id));
    }
  };

  return (
    <motion.div
      className="bg-white shadow-lg rounded-2xl mb-6 border border-blue-100"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
    >
      <OrgModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        org={editOrg}
      />
      <div className="flex flex-col sm:flex-row items-center justify-between px-2 sm:px-6 py-3 border-b">
        <h3 className="text-lg font-bold text-blue-700 drop-shadow">Organizations</h3>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold rounded-lg px-4 py-2 text-sm shadow mt-3 sm:mt-0"
          onClick={handleAdd}
        >
          + Add Organization
        </motion.button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[350px] sm:min-w-[600px] md:min-w-[860px] w-full text-xs sm:text-[0.92rem]">
          <thead className="bg-gradient-to-r from-blue-50 to-green-50">
            <tr>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">ID</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Organization</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Domain</th>
              <th className="px-2 sm:px-4 py-2 text-center text-xs font-semibold text-blue-700 uppercase">Status</th>
              <th className="px-2 sm:px-4 py-2 text-center text-xs font-semibold text-blue-700 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {orgs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-2 text-center text-gray-400">
                  No organizations found.
                </td>
              </tr>
            )}
            {orgs.map((org, idx) => (
              <motion.tr
                key={org.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="hover:bg-blue-50 transition"
              >
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-blue-500 font-bold">{org.id}</td>
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-gray-900 font-medium">{org.name}</td>
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-gray-600 font-mono">{org.domain}</td>
                <td className="px-2 sm:px-4 py-2 text-center">
                  <span
                    className={
                      org.status === "Active"
                        ? "bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold"
                        : "bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold"
                    }
                  >
                    {org.status}
                  </span>
                </td>
                <td className="px-2 sm:px-4 py-2 text-center">
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    className="text-blue-600 hover:text-blue-800 font-semibold mx-1"
                    onClick={() => handleEdit(org)}
                  >
                    Edit
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    className={`mx-1 ${org.status === "Active"
                      ? "text-red-600 hover:text-red-800"
                      : "text-green-600 hover:text-green-800"
                      } font-semibold`}
                    onClick={() => handleStatusToggle(org)}
                  >
                    {org.status === "Active" ? "Suspend" : "Activate"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    className="text-gray-500 hover:text-red-500 font-semibold mx-1"
                    onClick={() => handleDelete(org.id)}
                  >
                    Delete
                  </motion.button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
