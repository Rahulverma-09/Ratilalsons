import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Filter, AlertCircle, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { usePermissions } from "../components/contexts/PermissionContext.jsx";
import { API_URL, getAuthHeaders, CUSTOMER_PORTAL_API, TICKET_API } from "../config.js";
import ticketApi from "../api/ticketApi.js";

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleString();
}

export default function SupportTickets() {
  const { userPermissions, currentUser } = usePermissions();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [vendors, setVendors] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal for creating new ticket
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTicket, setNewTicket] = useState({
    title: "",
    description: "",
    priority: "medium",
    category: "support",
    assigned_to_vendor: "",
    raised_by: {
      user_id: "",
      role: "customer",
      full_name: "",
      email: ""
    }
  });
  const [creating, setCreating] = useState(false);

  // Permissions
  const hasSupportAccess = userPermissions?.includes("support:access") || userPermissions?.includes("admin:access");
  const canCreateTicket = true;

  // Fetch vendors
  const fetchVendors = async () => {
    try {
      const response = await fetch(CUSTOMER_PORTAL_API.VENDORS, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        const mappedVendors = (data.vendors || []).map(vendor => ({
          id: vendor.user_id || vendor.id,
          user_id: vendor.user_id,
          username: vendor.username,
          full_name: vendor.name || vendor.full_name,
          email: vendor.email,
          role: 'vendor',
          roles: ['Vendor']
        }));
        setVendors(mappedVendors);
      } else {
        setVendors([
          { id: 'USR-419', user_id: 'USR-419', full_name: 'Madhav Kaushal', username: 'madhav', role: 'vendor', roles: ['Vendor'] }
        ]);
      }
    } catch (err) {
      setVendors([
        { id: 'USR-419', user_id: 'USR-419', full_name: 'Madhav Kaushal', username: 'madhav', role: 'vendor', roles: ['Vendor'] }
      ]);
    }
  };

  // Fetch tickets
  useEffect(() => {
    fetchTickets();
    fetchVendors();
    if (hasSupportAccess) {
      fetchStats();
    }
  }, [page, statusFilter, priorityFilter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError("");
      const params = {
        page,
        limit: 20,
        status: statusFilter.length > 0 ? statusFilter : undefined,
        priority: priorityFilter.length > 0 ? priorityFilter : undefined
      };
      const response = await ticketApi.getTickets(params);
      setTickets(response.tickets || []);
      setTotalPages(Math.ceil(response.total / params.limit));
    } catch (err) {
      if (err.message.includes('Backend server') || err.message.includes('endpoint not found')) {
        setTickets([
          {
            id: 'sample-1',
            ticket_number: 'TKT-001',
            title: 'Sample Support Request',
            description: 'Demo ticket.',
            status: 'open',
            priority: 'medium',
            category: 'support',
            created_at: new Date().toISOString(),
            raised_by: { full_name: 'Demo User', user_id: 'demo-user' }
          }
        ]);
        setTotalPages(1);
        setError('Backend not available - showing demo data');
      } else {
        setError(err.message || "Failed to load tickets");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const statsData = await ticketApi.getStats();
      setStats(statsData);
    } catch (err) {
      if (err.message.includes('Backend server') || err.message.includes('endpoint not found')) {
        setStats({ total_open: 5, total_in_progress: 3, total_resolved: 12, high_priority_open: 2 });
      }
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicket.title.trim() || !newTicket.description.trim()) return;
    try {
      setCreating(true);
      const ticketData = {
        title: newTicket.title.trim(),
        description: newTicket.description.trim(),
        priority: newTicket.priority,
        category: newTicket.category,
        assigned_to_vendor: newTicket.assigned_to_vendor || null,
        raised_by: {
          user_id: currentUser?.user_id || currentUser?.id || "unknown",
          role: "customer",
          full_name: currentUser?.full_name || currentUser?.username || "Customer",
          email: currentUser?.email || ""
        }
      };
      await ticketApi.createTicket(ticketData);
      setShowCreateModal(false);
      fetchTickets();
    } catch (err) {
      alert(err.message || "Failed to create ticket");
    } finally {
      setCreating(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "open": return "text-blue-700 bg-blue-50 border-blue-200";
      case "in_progress": return "text-yellow-700 bg-yellow-50 border-yellow-200";
      case "resolved": return "text-green-700 bg-green-50 border-green-200";
      case "closed": return "text-gray-700 bg-gray-50 border-gray-200";
      default: return "text-gray-700 bg-gray-50 border-gray-200";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case "critical": return "text-red-700 bg-red-50 border-red-300";
      case "high": return "text-orange-700 bg-orange-50 border-orange-300";
      case "medium": return "text-yellow-700 bg-yellow-50 border-yellow-300";
      case "low": return "text-green-700 bg-green-50 border-green-300";
      default: return "text-gray-700 bg-gray-50 border-gray-300";
    }
  };

  const filteredTickets = tickets.filter((ticket) =>
    ticket.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.ticket_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 pt-8 pb-12 font-sans overflow-x-hidden">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Support Tickets</h1>
            </div>
            <p className="text-gray-500 font-medium ml-1">
              Manage and track customer enquiries, technical issues, and service requests.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchTickets}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold text-sm rounded-xl hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4 text-indigo-500" />}
              Refresh
            </button>
            {canCreateTicket && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <Plus className="w-4 h-4" />
                New Ticket
              </button>
            )}
          </div>
        </div>

        {/* Statistics Grid */}
        {hasSupportAccess && stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Open</p>
                <p className="text-2xl font-bold text-blue-600">{stats.total_open}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <AlertCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">In Progress</p>
                <p className="text-2xl font-bold text-amber-600">{stats.total_in_progress}</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Resolved</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.total_resolved || 0}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">High Priority</p>
                <p className="text-2xl font-bold text-rose-600">{stats.high_priority_open}</p>
              </div>
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                <AlertCircle className="w-6 h-6 text-rose-600" />
              </div>
            </div>
          </div>
        )}

        {/* Filters & Search Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-300 outline-none transition-all text-sm font-medium"
              />
            </div>
            <div className="flex gap-4 w-full lg:w-auto">
              <select
                value={statusFilter[0] || ""}
                onChange={(e) => { setStatusFilter(e.target.value ? [e.target.value] : []); setPage(1); }}
                className="flex-1 lg:w-48 px-4 py-3 bg-white border border-gray-200 rounded-xl font-semibold text-xs uppercase tracking-wider outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={priorityFilter[0] || ""}
                onChange={(e) => { setPriorityFilter(e.target.value ? [e.target.value] : []); setPage(1); }}
                className="flex-1 lg:w-48 px-4 py-3 bg-white border border-gray-200 rounded-xl font-semibold text-xs uppercase tracking-wider outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
              >
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tickets Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-32">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Summary</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-48">Raised By</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-32 text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-32 text-center">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                        <p className="text-gray-400 font-semibold text-xs uppercase tracking-wider">Fetching Tickets...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <AlertCircle className="w-8 h-8 text-gray-300" />
                        <p className="text-gray-400 font-semibold text-xs uppercase tracking-wider">No matching tickets found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => navigate(`/support/${ticket.id}`)}
                      className="group hover:bg-indigo-50/30 transition-all cursor-pointer"
                    >
                      <td className="px-6 py-5">
                        <p className="text-sm font-semibold text-gray-900">{formatDateTime(ticket.created_at).split(',')[0]}</p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase mt-1">{formatDateTime(ticket.created_at).split(',')[1]}</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors uppercase leading-tight">{ticket.title}</span>
                          <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider mt-0.5">#{ticket.ticket_number}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[10px] border border-slate-200">
                             {(ticket.raised_by?.full_name || 'U').charAt(0)}
                          </div>
                          <span className="text-sm font-semibold text-gray-700 truncate max-w-[150px]">
                            {ticket.raised_by?.full_name || 'Unknown User'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getStatusColor(ticket.status)}`}>
                          {ticket.status?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Section */}
        {!loading && totalPages > 1 && (
          <div className="mt-10 flex justify-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm"
            >
              Previous
            </button>
            <div className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-xl shadow-indigo-100 flex items-center">
              Page {page} / {totalPages}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Modern Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full p-10 overflow-hidden relative animate-in fade-in zoom-in duration-300">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-8 right-8 text-slate-300 hover:text-slate-600 font-bold text-3xl leading-none transition-colors p-2"
            >
              ×
            </button>
            <div className="mb-10">
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Create New Ticket</h2>
              <p className="text-gray-400 font-bold text-xs uppercase tracking-wider border-l-4 border-indigo-500 pl-4 ml-1">New Service Request Initialization</p>
            </div>
            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Issue Summary *</label>
                  <input
                    type="text"
                    value={newTicket.title}
                    onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-sm font-semibold"
                    placeholder="Short description..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Detailed Narrative *</label>
                  <textarea
                    rows={4}
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-sm font-semibold resize-none"
                    placeholder="Explain the issue..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Severity Level</label>
                  <select
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-50 transition-all text-xs font-bold uppercase tracking-wider"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="critical">Critical Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Department Category</label>
                  <select
                    value={newTicket.category}
                    onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-50 transition-all text-xs font-bold uppercase tracking-wider"
                  >
                    <option value="support">Customer Support</option>
                    <option value="technical">Technical Ops</option>
                    <option value="billing">Accounts & Billing</option>
                    <option value="admin">Administration</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-4 mt-12 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold text-xs uppercase tracking-wider"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={creating || !newTicket.title.trim()}
                className="flex-[2] px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
              >
                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                {creating ? "Processing..." : "Create Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
