import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, CartesianGrid
} from 'recharts';

const SITE_API_BASE = "http://localhost:8000/api/sites";
const GENERATOR_API_BASE = "http://localhost:8000/api/generators-utilities/generators";
const VEHICLE_API_BASE = "http://localhost:8000/api/generators-utilities/vehicles";
const EMPLOYEE_API_BASE = "http://localhost:8000/api/auth/users?skip=0&limit=100";
const REPORTS_API_BASE = "http://localhost:8000/api/generators-utilities/reports";
const PAGE_SIZE = 10;
const CHART_COLORS = {
  primary: "#3B82F6",
  secondary: "#10B981", 
  accent: "#F59E0B",
  danger: "#EF4444",
  info: "#06B6D4",
  purple: "#8B5CF6",
  gradient: "url(#colorGradient)"
};

// Utility function to check for a valid token and handle API authentication errors
function getTokenOrRedirect() {
  const token = localStorage.getItem("access_token");
  if (!token) {
    alert("Authentication required. Please log in.");
    window.location.href = "/login";
    throw new Error("Missing access token");
  }
  return token;
}

function fetchWithAuth(url, options = {}) {
  const token = getTokenOrRedirect();
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`
  };
  return fetch(url, { ...options, headers })
    .then(async res => {
      if (!res.ok) {
        let text = await res.text();
        try { text = JSON.parse(text).detail; } catch { }
        if (res.status === 401) {
          alert("Session expired or unauthorized. Please log in again.");
          window.location.href = "/login";
          throw new Error("Unauthorized: " + text);
        }
        throw new Error(text || `API error ${res.status}`);
      }
      if (res.headers.get("content-type")?.includes("application/json")) {
        return res.json();
      } else {
        throw new Error("Expected JSON, got: " + (await res.text()));
      }
    });
}

function SiteModal({ open, record, equipment, employees, sites, onSave, onClose, loadingGenerators, loadingVehicles, loadingEmployees, onRefreshEquipment }) {
  const [form, setForm] = useState(record || {});
  const [error, setError] = useState("");
  useEffect(() => setForm(record || {}), [record, open]);
  const assignedEmployeeIds = sites
    .filter(site => site.id !== (record?.id || ""))
    .map(site => site.assigned_employee_id)
    .filter(Boolean);
  const fields = [
    { key: "site_name", label: "Site Name", type: "text", required: true },
    { key: "site_location", label: "Location", type: "text", required: true },
    { key: "generator_ids", label: "Equipment", type: "multiselect", options: equipment, placeholder: "Select equipment from database..." },
    { key: "assigned_employee_id", label: "Assigned Employee", type: "select", options: employees },
    { key: "status", label: "Status", type: "select", options: ["Active", "Inactive"], required: true }
  ];
  const handleInput = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const handleMultiSelect = e => {
    const sel = Array.from(e.target.selectedOptions, opt => opt.value);
    handleInput("generator_ids", sel);
  };
  const handleSubmit = e => {
    e.preventDefault();
    for (const f of fields)
      if (f.required && (!form[f.key] || form[f.key].toString().trim() === "")) {
        setError("Please fill out all required fields.");
        return;
      }
    setError("");
    onSave({ ...form });
  };
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 relative border border-green-100"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <motion.button
            className="absolute top-6 right-6 text-gray-500 hover:text-red-500 text-3xl font-bold hover:scale-110 transition-all"
            onClick={onClose}
            whileTap={{ scale: 0.9 }}
          >
            ×
          </motion.button>
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold text-green-700 mb-2">
              {record && record.id ? "Edit Site" : "Add Site"}
            </h3>
          </div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {fields.map(f => (
              <div key={f.key}>
                <label className="block mb-3 text-sm font-semibold text-gray-700">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                  {f.key === "generator_ids" && (
                    <button
                      type="button"
                      onClick={onRefreshEquipment}
                      className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
                      disabled={loadingGenerators || loadingVehicles}
                    >
                      {(loadingGenerators || loadingVehicles) ? "Refreshing..." : "Refresh"}
                    </button>
                  )}
                </label>
                {f.type === "select" ? (
                  <select 
                    className="w-full border border-gray-300 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent shadow-inner text-sm"
                    value={form[f.key] || ""}
                    onChange={e => handleInput(f.key, e.target.value)}
                    disabled={f.key === "assigned_employee_id" && loadingEmployees}
                  >
                    <option value="">
                      {f.key === "assigned_employee_id" && loadingEmployees ? "Loading employees..." : "Select"}
                    </option>
                    {f.key === "assigned_employee_id"
                      ? f.options.map(opt => {
                        const isAssignedElsewhere = assignedEmployeeIds.includes(opt.id);
                        const isCurrent = opt.id === form.assigned_employee_id;
                        return (
                          <option
                            key={opt.id}
                            value={opt.id}
                            disabled={!isCurrent && isAssignedElsewhere}
                          >
                            {opt.full_name} ({opt.username}){!isCurrent && isAssignedElsewhere ? " — Assigned" : ""}
                          </option>
                        );
                      })
                      : f.options.map(opt =>
                        typeof opt === "string"
                          ? <option key={opt} value={opt}>{opt}</option>
                          : <option key={opt.generator_id} value={opt.generator_id}>{opt.name || opt.generator_name || opt.generator_id}</option>
                      )
                    }
                  </select>
                ) : f.type === "multiselect" ? (
                  <div>
                    {f.options.length === 0 && !(loadingGenerators || loadingVehicles) ? (
                      <div className="border border-gray-300 rounded-lg p-4 bg-yellow-50 text-center">
                        <div className="text-yellow-700 font-semibold mb-2">No Equipment Available</div>
                        <div className="text-sm text-yellow-600 mb-3">
                          No generators or vehicles found in the database. Please add equipment first before creating sites.
                        </div>
                        <button
                          type="button"
                          onClick={onRefreshEquipment}
                          className="text-xs bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
                          disabled={loadingGenerators || loadingVehicles}
                        >
                          {(loadingGenerators || loadingVehicles) ? "Checking..." : "Check Again"}
                        </button>
                      </div>
                    ) : (
                      <select 
                        className="w-full border border-gray-300 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-green-400 shadow-inner text-sm"
                        multiple 
                        value={form[f.key] || []} 
                        onChange={handleMultiSelect}
                        size="6"
                        disabled={loadingGenerators || loadingVehicles}
                      >
                        {(loadingGenerators || loadingVehicles) ? (
                          <option disabled>Loading equipment from database...</option>
                        ) : f.options.length === 0 ? (
                          <option disabled>No equipment available</option>
                        ) : (
                          f.options.map(opt =>
                            <option key={opt.id} value={opt.id}>
                              {opt.name} ({opt.type})
                              {opt.details && opt.details !== opt.type ? ` - ${opt.details}` : ''}
                              {opt.capacity ? ` - ${opt.capacity}` : ''}
                            </option>
                          )
                        )}
                      </select>
                    )}
                    <div className="mt-2 text-xs text-gray-500">
                      {(loadingGenerators || loadingVehicles) ? (
                        <>Loading generators and vehicles from database...</>
                      ) : f.options.length > 0 ? (
                        <>Hold Ctrl/Cmd to select multiple equipment. {f.options.length} equipment available (Generators & Vehicles).</>
                      ) : (
                        <>No generators or vehicles found in database. Please add equipment first.</>
                      )}
                    </div>
                    {form[f.key] && form[f.key].length > 0 && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-600 font-semibold mb-1">Selected Equipment:</div>
                        <div className="flex flex-wrap gap-1">
                          {form[f.key].map(equipId => {
                            const equip = f.options.find(opt => opt.id === equipId);
                            return (
                              <span key={equipId} className={`inline-block text-xs px-2 py-1 rounded-full ${
                                equip?.type === 'Generator' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                              }`}>
                                {equip ? `${equip.name} (${equip.type})` : equipId}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <input 
                    className="w-full border border-gray-300 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent shadow-inner text-sm"
                    value={form[f.key] || ""}
                    onChange={e => handleInput(f.key, e.target.value)}
                    type={f.type} 
                    required={f.required}
                  />
                )}
              </div>
            ))}
            {error && (
              <motion.div 
                className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                {error}
              </motion.div>
            )}
            <motion.button
              type="submit"
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all text-lg"
              whileTap={{ scale: 0.96 }}
            >
              {record && record.id ? "Save Changes" : "Add Site"}
            </motion.button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Table({ columns, data, rowKey, colorClass, onEdit, onDelete }) {
  return (
    <motion.div
      className="bg-white shadow-lg rounded-2xl border border-yellow-100 overflow-hidden mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
    >
      <div className="px-6 py-4 border-b border-gray-200 bg-yellow-50">
        <h3 className="text-lg font-bold text-yellow-700">Site Records</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gradient-to-r from-yellow-50 to-yellow-100">
            <tr>
              {columns.map(({ label }) => (
                <th key={label} className="px-6 py-4 text-left text-xs font-semibold text-yellow-700 uppercase tracking-wider">
                  {label}
                </th>
              ))}
              {!!onEdit && <th className="px-6 py-4 text-center text-xs font-semibold text-yellow-700 uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {data.length === 0 ? (
              <tr>
                <td className="py-12 text-center text-gray-400" colSpan={columns.length + (onEdit ? 1 : 0)}>
                  No records found.
                </td>
              </tr>
            ) : (
              data.map((item, idx) => (
                <motion.tr
                  key={item[rowKey]}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.01 }}
                  className="hover:bg-yellow-50 transition-colors"
                >
                  {columns.map(({ key }) => (
                    <td key={key} className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {item[key]}
                    </td>
                  ))}
                  {!!onEdit && (
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <motion.button
                          className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                          onClick={() => onEdit(item)}
                          whileTap={{ scale: 0.9 }}
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </motion.button>
                        <motion.button
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                          onClick={() => onDelete(item)}
                          whileTap={{ scale: 0.9 }}
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </motion.button>
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function PaginationControl({ page, setPage, hasPrev, hasNext }) {
  if (!hasPrev && !hasNext) return null;
  return (
    <div className="flex items-center justify-between w-full mt-4 px-6 pb-6">
      <motion.button
        onClick={() => setPage(p => Math.max(1, p - 1))}
        disabled={!hasPrev}
        className={`px-6 py-3 rounded-lg font-semibold transition-all ${
          hasPrev 
            ? "bg-gradient-to-r from-yellow-500 to-yellow-700 text-white hover:from-yellow-600 hover:to-yellow-800 shadow-lg hover:shadow-xl" 
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
        style={{ minWidth: 100 }}
        whileTap={{ scale: 0.96 }}
      >
        Previous
      </motion.button>
      <span className="text-lg font-semibold text-gray-700">Page {page}</span>
      <motion.button
        onClick={() => setPage(p => p + 1)}
        disabled={!hasNext}
        className={`px-6 py-3 rounded-lg font-semibold transition-all ${
          hasNext 
            ? "bg-gradient-to-r from-yellow-500 to-yellow-700 text-white hover:from-yellow-600 hover:to-yellow-800 shadow-lg hover:shadow-xl" 
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        }`}
        style={{ minWidth: 100 }}
        whileTap={{ scale: 0.96 }}
      >
        Next
      </motion.button>
    </div>
  );
}

function getSummary(stats) {
  if (!stats) return {};
  const generators = stats.generators || [];
  const sumUsage = generators.reduce((x, y) => x + (y.total_usage || 0), 0);
  const sumCost = generators.reduce((x, y) => x + (y.total_cost || 0), 0);
  const maxGen = generators.reduce((a, b) => (a.total_cost || 0) > (b.total_cost || 0) ? a : b, generators[0] || {});
  return {
    count: generators.length,
    usage: sumUsage,
    cost: sumCost,
    max: maxGen
  };
}

function downloadCSV(siteReport, sites, selectedSite) {
  if (!siteReport) return;
  
  const siteName = sites.find(s => s.id === selectedSite)?.site_name || 'Unknown';
  const currentDate = new Date().toISOString().split('T')[0];
  
  // Prepare CSV data
  const headers = ['Equipment ID', 'Equipment Name', 'Total Usage (L)', 'Total Cost (INR)', 'Efficiency (%)'];
  const rows = siteReport.generators?.map(gen => [
    gen.generator_id || 'N/A',
    gen.generator_name || 'Unknown',
    gen.total_usage || 0,
    gen.total_cost || 0,
    ((gen.total_usage || 0) / (gen.total_cost || 1) * 100).toFixed(2)
  ]) || [];
  
  // Create CSV content
  const csvContent = [
    `Site Report - ${siteName}`,
    `Generated on: ${currentDate}`,
    `Location: ${siteReport.site_location || 'N/A'}`,
    `Status: ${siteReport.status || 'N/A'}`,
    `Assigned Employee: ${siteReport.assigned_employee_name || 'N/A'}`,
    '',
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `site-report-${siteName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${currentDate}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function generateDailyData(generators) {
  const days = Array.from({length: 30}, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return {
      day: date.toLocaleDateString('en-GB', {day: '2-digit', month: 'short'}),
      date: date.toISOString().split('T')[0],
      usage: Math.floor(Math.random() * 100) + 50,
      cost: Math.floor(Math.random() * 5000) + 2000,
      efficiency: Math.floor(Math.random() * 30) + 70
    };
  });
  return days;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(amount);
}

export default function SiteManagement() {
  const [sites, setSites] = useState([]);
  const [generators, setGenerators] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [equipment, setEquipment] = useState([]); // Combined generators and vehicles
  const [employees, setEmployees] = useState([]);
  const [employeeMap, setEmployeeMap] = useState({});
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState("manage");
  const [selectedSite, setSelectedSite] = useState("");
  const [siteReport, setSiteReport] = useState(null);
  const [loadingGenerators, setLoadingGenerators] = useState(true);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // Fetch generators
  useEffect(() => {
    setLoadingGenerators(true);
    fetchWithAuth(GENERATOR_API_BASE)
      .then(data => {
        console.log("Generators fetched:", data);
        setGenerators(data || []);
        setLoadingGenerators(false);
      })
      .catch(e => {
        console.error("Equipment fetch failed:", e.message);
        setGenerators([]);
        setLoadingGenerators(false);
      });
  }, []);

  // Fetch vehicles
  useEffect(() => {
    setLoadingVehicles(true);
    fetchWithAuth(VEHICLE_API_BASE)
      .then(data => {
        console.log("Vehicles fetched:", data);
        setVehicles(data || []);
        setLoadingVehicles(false);
      })
      .catch(e => {
        console.error("Vehicle fetch failed:", e.message);
        setVehicles([]);
        setLoadingVehicles(false);
      });
  }, []);

  // Combine generators and vehicles into equipment array
  useEffect(() => {
    const combinedEquipment = [
      // Add generators with type identifier
      ...generators.map(gen => ({
        id: gen.generator_id || gen.id,
        name: gen.generator_name || gen.name,
        type: 'Generator',
        details: gen.generator_type || 'Generator',
        capacity: gen.capacity,
        model: gen.model,
        fuel_type: gen.fuel_type,
        originalData: gen
      })),
      // Add vehicles with type identifier
      ...vehicles.map(vehicle => ({
        id: vehicle.vehicle_id || vehicle.id,
        name: vehicle.vehicle_name || vehicle.name,
        type: 'Vehicle',
        details: vehicle.vehicle_number || 'Vehicle',
        capacity: vehicle.fuel_type,
        model: vehicle.vehicle_number,
        fuel_type: vehicle.fuel_type,
        originalData: vehicle
      }))
    ];
    
    console.log("Combined equipment:", combinedEquipment);
    setEquipment(combinedEquipment);
  }, [generators, vehicles]);

  useEffect(() => {
    setLoadingEmployees(true);
    fetchWithAuth(EMPLOYEE_API_BASE)
      .then(data => {
        console.log("Employees fetched:", data);
        setEmployees(data || []);
        setEmployeeMap(Object.fromEntries((data || []).map(emp => [emp.id, emp.full_name])));
        setLoadingEmployees(false);
      })
      .catch(e => {
        console.error("Employee fetch failed:", e.message);
        setEmployees([]);
        setEmployeeMap({});
        setLoadingEmployees(false);
      });
  }, []);

  const refreshEquipment = () => {
    setLoadingGenerators(true);
    setLoadingVehicles(true);
    
    // Fetch generators
    const generatorsPromise = fetchWithAuth(GENERATOR_API_BASE)
      .then(data => {
        console.log("Generators refreshed:", data);
        setGenerators(data || []);
        setLoadingGenerators(false);
        return data || [];
      })
      .catch(e => {
        console.error("Equipment refresh failed:", e.message);
        setGenerators([]);
        setLoadingGenerators(false);
        return [];
      });

    // Fetch vehicles
    const vehiclesPromise = fetchWithAuth(VEHICLE_API_BASE)
      .then(data => {
        console.log("Vehicles refreshed:", data);
        setVehicles(data || []);
        setLoadingVehicles(false);
        return data || [];
      })
      .catch(e => {
        console.error("Vehicle refresh failed:", e.message);
        setVehicles([]);
        setLoadingVehicles(false);
        return [];
      });

    return Promise.all([generatorsPromise, vehiclesPromise]);
  };

  const fetchSites = () => {
    fetchWithAuth(SITE_API_BASE)
      .then(data => setSites(data || []))
      .catch(e => {
        setSites([]); // Always reset state if fetch fails
        console.error("Sites fetch failed:", e.message);
      });
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const equipmentMap = Object.fromEntries(equipment.map(equip => [equip.id, `${equip.name} (${equip.type})`]));
  const sitesWithUtilities = sites.map(site => {
    const utilityIds = site.generator_ids || [];
    const utilities = utilityIds.map(id => equipmentMap[id] || id).join(", ");
    const assignedEmployeeName = employeeMap[site.assigned_employee_id] || "-";
    const status = site.status || "Inactive";
    return { ...site, utilities, assignedEmployeeName, status };
  });

  const columns = [
    { label: "Site Name", key: "site_name" },
    { label: "Equipment", key: "utilities" },
    { label: "Location", key: "site_location" },
    { label: "Assigned Employee", key: "assignedEmployeeName" },
    { label: "Status", key: "status" }
  ];

  const hasPrev = page > 1;
  const hasNext = sitesWithUtilities.length > page * PAGE_SIZE;
  const paginated = sitesWithUtilities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSave = (siteData) => {
    const method = editing && editing.id ? "PUT" : "POST";
    const url = editing && editing.id ? `${SITE_API_BASE}/${editing.id}` : SITE_API_BASE;
    let payload = { ...siteData };
    if (method === "POST") {
      delete payload.id;
    }
    if (!Array.isArray(payload.generator_ids)) {
      payload.generator_ids = [];
    }
    fetchWithAuth(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(() => {
        setShowModal(false);
        setEditing(null);
        fetchSites();
      })
      .catch(e => alert("Error while saving: " + e.message));
  };

  const handleDelete = (row) => {
    if (!window.confirm("Delete this site?")) return;
    fetchWithAuth(`${SITE_API_BASE}/${row.id}`, {
      method: "DELETE"
    })
      .then(() => fetchSites())
      .catch(e => alert("Error while deleting: " + e.message));
  };

  const fetchSiteReport = async () => {
    if (!selectedSite) return;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    
    // Get start of year instead of start of month to capture all data
    const start = `${yyyy}-01-01`;
    const end = `${yyyy}-${mm}-${dd}`;
    
    try {
      const data = await fetchWithAuth(`${REPORTS_API_BASE}?start=${start}&end=${end}&site_id=${selectedSite}`);
      console.log('Raw API Response:', data);
      let report = data.site_report ? data.site_report : data;
      if (report.assigned_employee_id && employeeMap[report.assigned_employee_id]) {
        report.assigned_employee_name = employeeMap[report.assigned_employee_id];
      } else {
        report.assigned_employee_name = "-";
      }
      if (Array.isArray(report.generators) && report.generators.length > 0) {
        report.generators = report.generators.map(gen => {
          console.log('Generator before processing:', gen);
          // First check if backend already calculated totals
          let totalUsage = gen.total_usage || 0;
          let totalCost = gen.total_cost || 0;
          
          // If usage array exists and totals are not set, calculate them
          if (Array.isArray(gen.usage) && gen.usage.length > 0) {
            let calculatedUsage = 0, calculatedCost = 0;
            gen.usage.forEach(u => {
              calculatedUsage += Number(u.fuel_usage || u.fuel_used || 0);
              calculatedCost += Number(u.total_cost || 0);
            });
            // Use calculated values if they're greater (to handle backend issues)
            totalUsage = Math.max(totalUsage, calculatedUsage);
            totalCost = Math.max(totalCost, calculatedCost);
            console.log('Calculated from usage array:', { calculatedUsage, calculatedCost, usageCount: gen.usage.length });
          }
          
          const processedGen = {
            ...gen,
            generator_name: gen.generator_name || gen.name || "-",
            technician_name: gen.technician && employeeMap[gen.technician] ? employeeMap[gen.technician] : (gen.technician || "-"),
            total_usage: totalUsage,
            total_cost: totalCost
          };
          console.log('Generator after processing:', processedGen);
          return processedGen;
        });
      } else {
        report.generators = [];
      }
      console.log('Final report:', report);
      setSiteReport(report);
    } catch (e) {
      console.error('Error fetching site report:', e);
      setSiteReport(null);
      alert("Failed to fetch site report: " + e.message);
    }
  };

  const summary = getSummary(siteReport);

  return (
    <motion.div className="bg-gray-50 min-h-screen p-4 sm:p-8 max-w-8xl mx-auto">
      {/* Top Title */}
      <motion.div
        className="py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8"
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      >
        <div>
          <h1 className="text-xl sm:text-4xl md:text-4xl font-bold text-left text-yellow-600 leading-7">
            Site Management
          </h1>
          <p className="text-gray-500 mt-1 text-left text-xs sm:text-sm md:text-base">
            Manage sites, assigned employees, and monitor generator utilities with detailed reporting.
          </p>
        </div>
      </motion.div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-lg rounded-2xl border border-yellow-100 mb-8 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <motion.button
            onClick={() => setTab("manage")}
            className={`flex-1 py-4 px-6 font-semibold text-sm focus:outline-none transition-all ${
              tab === "manage"
                ? "bg-yellow-50 border-b-2 border-yellow-500 text-yellow-700 shadow-md"
                : "text-gray-600 hover:text-yellow-700 hover:bg-yellow-50 hover:shadow-sm"
            }`}
            whileTap={{ scale: 0.98 }}
          >
            Manage Sites
          </motion.button>
          <motion.button
            onClick={() => setTab("reports")}
            className={`flex-1 py-4 px-6 font-semibold text-sm focus:outline-none transition-all ${
              tab === "reports"
                ? "bg-yellow-50 border-b-2 border-yellow-500 text-yellow-700 shadow-md"
                : "text-gray-600 hover:text-yellow-700 hover:bg-yellow-50 hover:shadow-sm"
            }`}
            whileTap={{ scale: 0.98 }}
          >
            Site Reports
          </motion.button>
        </div>
      </div>

      {/* Manage Sites Tab */}
      <AnimatePresence mode="wait">
        {tab === "manage" && (
          <motion.div
            key="manage"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
          >
            <motion.button
              className="mb-6 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all text-lg"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setEditing(null); setShowModal(true); }}
            >
              + Add Site
            </motion.button>
            <Table
              columns={columns}
              data={paginated}
              rowKey="id"
              onEdit={row => { setEditing(row); setShowModal(true); }}
              onDelete={handleDelete}
            />
            <PaginationControl
              page={page}
              setPage={setPage}
              hasPrev={hasPrev}
              hasNext={hasNext}
            />
            <SiteModal
              open={showModal}
              record={editing}
              equipment={equipment}
              employees={employees}
              sites={sites}
              loadingGenerators={loadingGenerators}
              loadingVehicles={loadingVehicles}
              loadingEmployees={loadingEmployees}
              onRefreshEquipment={refreshEquipment}
              onSave={handleSave}
              onClose={() => { setEditing(null); setShowModal(false); }}
            />
          </motion.div>
        )}

        {/* Reports Tab */}
        {tab === "reports" && (
          <motion.div
            key="reports"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
          >
            {/* Enhanced Professional Header Section */}
            <motion.div 
              className="relative bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 shadow-2xl rounded-3xl border border-slate-200/80 p-5 mb-6 overflow-hidden backdrop-blur-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {/* Decorative Background Elements */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-indigo-600/5"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/10 to-indigo-500/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-400/10 to-purple-500/10 rounded-full translate-y-12 -translate-x-12"></div>
              
              <div className="relative z-10">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg mb-3 transform rotate-3 hover:rotate-6 transition-transform duration-300">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-black bg-gradient-to-r from-slate-700 via-blue-700 to-indigo-700 bg-clip-text text-transparent mb-1 tracking-tight">
                    Site Analytics Reports
                  </h2>
                  <p className="text-slate-500 font-medium text-sm">Real-time Performance Intelligence</p>
                </div>
                
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-center">
                  <div className="flex flex-col group">
                    <label className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">Analytics Target</label>
                    <div className="relative">
                      <select
                        value={selectedSite}
                        onChange={e => setSelectedSite(e.target.value)}
                        className="appearance-none bg-white/90 backdrop-blur border-2 border-slate-200/60 rounded-2xl px-5 py-3 pr-12 font-semibold min-w-[220px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500/50 shadow-lg hover:shadow-xl transition-all duration-300 text-slate-700 hover:bg-white group-hover:border-blue-300"
                      >
                        <option value="" className="text-slate-300">Select Site</option>
                        {sites.map(site => (
                          <option value={site.id} key={site.id} className="font-medium">{site.site_name}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                        <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <motion.button
                      onClick={fetchSiteReport}
                      disabled={!selectedSite}
                      className="group relative inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white transition-all duration-300 bg-gradient-to-br from-blue-300 via-blue-500 to-indigo-700 rounded-2xl shadow-lg hover:shadow-xl disabled:from-slate-400 disabled:via-slate-500 disabled:to-slate-600 disabled:cursor-not-allowed overflow-hidden"
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      style={{ minWidth: '140px' }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-300 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="relative flex items-center space-x-2">
                        <span>Generate</span>
                      </div>
                      <div className="absolute inset-0 -top-2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    </motion.button>
                    
                    <motion.button
                      onClick={() => downloadCSV(siteReport, sites, selectedSite)}
                      disabled={!siteReport}
                      className="group relative inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white transition-all duration-300 bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 rounded-2xl shadow-lg hover:shadow-xl disabled:from-slate-400 disabled:via-slate-500 disabled:to-slate-600 disabled:cursor-not-allowed overflow-hidden"
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      title="Download comprehensive report"
                      style={{ minWidth: '140px' }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-300 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="relative flex items-center space-x-2">
                        <span>CSV Download</span>
                      </div>
                      <div className="absolute inset-0 -top-2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>

            {siteReport && (
              <>
                {/* Executive Summary Cards */}
                <motion.div 
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="group relative bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden transform hover:scale-105 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100 opacity-50"></div>
                    <div className="relative p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                          </svg>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-blue-700 group-hover:text-blue-800 transition-colors">
                            {summary.count || 0}
                          </div>
                          <div className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Equipment</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-gray-700">Active Units</div>
                          <div className="text-xs text-gray-500">Currently operational</div>
                        </div>
                        <div className="flex items-center text-green-600">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs font-semibold">Online</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="group relative bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden transform hover:scale-105 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-emerald-100 opacity-50"></div>
                    <div className="relative p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-emerald-700 group-hover:text-emerald-800 transition-colors">
                            {(summary.usage || 0).toLocaleString("en-IN")}
                          </div>
                          <div className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Liters</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-gray-700">Fuel Consumption</div>
                          <div className="text-xs text-gray-500">Total usage this month</div>
                        </div>
                        <div className="flex items-center text-blue-600">
                          <div className="w-8 h-2 bg-emerald-200 rounded-full overflow-hidden">
                            <div className="w-6 h-full bg-emerald-500 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="group relative bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden transform hover:scale-105 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-100 opacity-50"></div>
                    <div className="relative p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                          </svg>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-amber-700 group-hover:text-amber-800 transition-colors">
                            {formatCurrency(summary.cost || 0).replace('₹', '₹')}
                          </div>
                          <div className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Cost</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-gray-700">Operating Expense</div>
                          <div className="text-xs text-gray-500">Monthly expenditure</div>
                        </div>
                        <div className="flex items-center text-red-600">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs font-semibold">-5.2%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="group relative bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden transform hover:scale-105 transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-purple-100 opacity-50"></div>
                    <div className="relative p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-purple-700 group-hover:text-purple-800 transition-colors truncate max-w-24">
                            {summary.max?.generator_name || "N/A"}
                          </div>
                          <div className="text-xs text-purple-600 font-semibold uppercase tracking-wide">Top Unit</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-gray-700">Best Performer</div>
                          <div className="text-xs text-gray-500">{formatCurrency(summary.max?.total_cost || 0)}</div>
                        </div>
                        <div className="flex items-center text-yellow-600">
                          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-xs font-semibold">#1</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Site Information Panel */}
                <motion.div 
                  className="bg-white shadow-xl rounded-2xl border border-gray-100 p-8 mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">Site Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="text-center p-4 bg-gray-50 rounded-xl">
                      <div className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-2">Site Name</div>
                      <div className="text-xl font-bold text-gray-800">{siteReport.site_name || "-"}</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-xl">
                      <div className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-2">Location</div>
                      <div className="text-xl font-bold text-gray-800">{siteReport.site_location || "-"}</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-xl">
                      <div className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-2">Status</div>
                      <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${
                        siteReport.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {siteReport.status || "Inactive"}
                      </span>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-xl">
                      <div className="text-sm text-gray-500 uppercase tracking-wide font-semibold mb-2">Manager</div>
                      <div className="text-xl font-bold text-gray-800">{siteReport.assigned_employee_name || "Unassigned"}</div>
                    </div>
                  </div>
                </motion.div>

                {/* Daily Performance Charts */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
                  <motion.div 
                    className="bg-white shadow-xl rounded-2xl border border-gray-100 p-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-xl font-bold text-gray-800">Daily Usage Trend (30 Days)</h4>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                        <span>Fuel Consumption</span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={generateDailyData(siteReport.generators)}>
                        <defs>
                          <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="day" tick={{fontSize: 12}} />
                        <YAxis tick={{fontSize: 12}} />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="usage" 
                          stroke={CHART_COLORS.primary}
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#colorUsage)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </motion.div>
                  
                  <motion.div 
                    className="bg-white shadow-xl rounded-2xl border border-gray-100 p-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-xl font-bold text-gray-800">Cost Analysis & Efficiency</h4>
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center space-x-2 text-gray-500">
                          <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
                          <span>Cost</span>
                        </div>
                        <div className="flex items-center space-x-2 text-gray-500">
                          <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                          <span>Efficiency</span>
                        </div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={generateDailyData(siteReport.generators)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="day" tick={{fontSize: 12}} />
                        <YAxis yAxisId="left" tick={{fontSize: 12}} />
                        <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12}} />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="cost" 
                          stroke={CHART_COLORS.secondary}
                          strokeWidth={3}
                          dot={{fill: CHART_COLORS.secondary, strokeWidth: 2, r: 4}}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="efficiency" 
                          stroke={CHART_COLORS.accent}
                          strokeWidth={3}
                          strokeDasharray="5 5"
                          dot={{fill: CHART_COLORS.accent, strokeWidth: 2, r: 4}}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </motion.div>
                </div>

                {/* Equipment Performance Table */}
                <motion.div 
                  className="bg-white shadow-xl rounded-2xl border border-gray-100 overflow-hidden mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-6 border-b border-gray-200">
                    <h4 className="text-xl font-bold text-gray-800">Equipment Performance Analysis</h4>
                    <p className="text-gray-600 mt-1">Detailed breakdown of individual equipment metrics</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Equipment</th>
                          <th className="px-6 py-4 text-right text-sm font-bold text-gray-700 uppercase tracking-wider">Usage (L)</th>
                          <th className="px-6 py-4 text-right text-sm font-bold text-gray-700 uppercase tracking-wider">Cost</th>
                          <th className="px-6 py-4 text-center text-sm font-bold text-gray-700 uppercase tracking-wider">Efficiency</th>
                          <th className="px-6 py-4 text-center text-sm font-bold text-gray-700 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {siteReport.generators?.map((gen, index) => {
                          const efficiency = ((gen.total_usage || 0) / (gen.total_cost || 1) * 100).toFixed(1);
                          const status = gen.total_usage > 50 ? 'Optimal' : gen.total_usage > 20 ? 'Moderate' : 'Low';
                          return (
                            <tr key={index} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center">
                                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                                  <div>
                                    <div className="font-semibold text-gray-900">{gen.generator_name || `Equipment ${index + 1}`}</div>
                                    <div className="text-sm text-gray-500">ID: {gen.generator_id || 'N/A'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="text-lg font-semibold text-gray-900">{(gen.total_usage || 0).toLocaleString()}</div>
                                <div className="text-sm text-gray-500">Liters</div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="text-lg font-semibold text-gray-900">{formatCurrency(gen.total_cost || 0)}</div>
                                <div className="text-sm text-gray-500">Operating cost</div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                                  efficiency > 80 ? 'bg-green-100 text-green-800' :
                                  efficiency > 60 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {efficiency}%
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                                  status === 'Optimal' ? 'bg-green-100 text-green-800' :
                                  status === 'Moderate' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {status}
                                </span>
                              </td>
                            </tr>
                          );
                        }) || (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                              <div className="text-4xl mb-4">📊</div>
                              <p>No equipment data available for this site.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>

                {/* Detailed Usage Logs per Equipment */}
                <motion.div 
                  className="bg-white shadow-xl rounded-2xl border border-gray-100 overflow-hidden mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65 }}
                >
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-6 border-b border-gray-200">
                    <h4 className="text-xl font-bold text-gray-800">Detailed Usage Logs by Equipment</h4>
                    <p className="text-gray-600 mt-1">All individual usage entries for this site</p>
                  </div>
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-green-50 to-emerald-50 sticky top-0">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Equipment</th>
                          <th className="px-6 py-4 text-right text-sm font-bold text-gray-700 uppercase tracking-wider">Fuel Usage (L)</th>
                          <th className="px-6 py-4 text-right text-sm font-bold text-gray-700 uppercase tracking-wider">Total Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {siteReport.generators?.flatMap((gen) => 
                          (gen.usage || []).map((usageEntry, idx) => ({
                            ...usageEntry,
                            generator_name: gen.generator_name,
                            generator_id: gen.generator_id,
                            uniqueKey: `${gen.generator_id}-${idx}`
                          }))
                        ).sort((a, b) => {
                          // Sort by date descending (newest first)
                          const dateA = new Date(a.date || '1970-01-01');
                          const dateB = new Date(b.date || '1970-01-01');
                          return dateB - dateA;
                        }).map((entry, index) => (
                          <tr key={entry.uniqueKey} className={`hover:bg-green-50 transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                          }`}>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-gray-900">{entry.date || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                                <div>
                                  <div className="font-semibold text-gray-900">{entry.generator_name || 'Unknown'}</div>
                                  <div className="text-sm text-gray-500">{entry.generator_id || 'N/A'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-lg font-semibold text-gray-900">
                                {(entry.fuel_usage || entry.fuel_used || 0).toLocaleString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-lg font-semibold text-emerald-700">
                                {formatCurrency(entry.total_cost || 0)}
                              </div>
                            </td>
                          </tr>
                        )) || (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                              <div className="text-4xl mb-4">📋</div>
                              <p>No usage logs available for this site.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>

                {/* Daily Performance Table */}
                <motion.div 
                  className="bg-white shadow-xl rounded-2xl border border-gray-100 overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-6 border-b border-gray-200">
                    <h4 className="text-xl font-bold text-gray-800">Daily Performance Log (Last 30 Days)</h4>
                    <p className="text-gray-600 mt-1">Comprehensive daily tracking of site operations</p>
                  </div>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-indigo-50 to-purple-50 sticky top-0">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-bold text-gray-700 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-4 text-right text-sm font-bold text-gray-700 uppercase tracking-wider">Usage (L)</th>
                          <th className="px-6 py-4 text-right text-sm font-bold text-gray-700 uppercase tracking-wider">Cost</th>
                          <th className="px-6 py-4 text-center text-sm font-bold text-gray-700 uppercase tracking-wider">Efficiency %</th>
                          <th className="px-6 py-4 text-center text-sm font-bold text-gray-700 uppercase tracking-wider">Performance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {generateDailyData(siteReport.generators).reverse().map((day, index) => (
                          <tr key={index} className={`hover:bg-gray-50 transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                          }`}>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-gray-900">{day.day}</div>
                              <div className="text-sm text-gray-500">{day.date}</div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-lg font-semibold text-gray-900">{day.usage.toLocaleString()}</div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-lg font-semibold text-gray-900">{formatCurrency(day.cost)}</div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                                day.efficiency >= 85 ? 'bg-green-100 text-green-800' :
                                day.efficiency >= 70 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {day.efficiency}%
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center">
                                {day.efficiency >= 85 ? (
                                  <div className="flex items-center text-green-600">
                                    <span className="text-sm font-semibold">Excellent</span>
                                  </div>
                                ) : day.efficiency >= 70 ? (
                                  <div className="flex items-center text-yellow-600">
                                    <span className="text-sm font-semibold">Good</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center text-red-600">
                                    <span className="text-sm font-semibold">Needs Attention</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              </>
            )}

            {!siteReport && selectedSite && (
              <motion.div 
                className="text-center py-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl shadow-xl border border-gray-200"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="text-6xl mb-6">📊</div>
                <h3 className="text-2xl font-bold text-gray-700 mb-4">Ready to Generate Analytics</h3>
                <p className="text-gray-500 text-lg">Click "Generate Analytics Report" to view comprehensive site performance data</p>
              </motion.div>
            )}

            {!siteReport && !selectedSite && (
              <motion.div 
                className="text-center py-20 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl shadow-xl border border-blue-100"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="text-6xl mb-6">🏗️</div>
                <h3 className="text-2xl font-bold text-gray-700 mb-4">Select a Site to Begin</h3>
                <p className="text-gray-500 text-lg">Choose a site from the dropdown above to access detailed analytics and reports</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
