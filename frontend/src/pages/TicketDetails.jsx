import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessageCircle, Clock, User2, Info, Star, Loader2, AlertCircle } from "lucide-react";
import { usePermissions } from "../components/contexts/PermissionContext.jsx";
import { API_URL, getAuthHeaders, TICKET_API } from "../config.js";
import ticketApi from "../api/ticketApi.js";

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleString();
}

export default function TicketDetails() {
  const { userPermissions, currentUser } = usePermissions();
  const { ticket_id } = useParams();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("Activity");
  const [activities, setActivities] = useState([]);
  const [history, setHistory] = useState([]);
  const [feedback, setFeedback] = useState([]);

  const [newMessage, setNewMessage] = useState("");
  const [responseSubmitting, setResponseSubmitting] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [showRatingModal, setShowRatingModal] = useState(false);

  // Permissions & Role Detection
  const hasSupportAccess = userPermissions?.includes("support:access") || false;
  const hasAdminAccess = userPermissions?.includes("admin:access") || false;
  const hasHRAccess = userPermissions?.includes("hr:access") || false;
  const hasManagerAccess = userPermissions?.includes("manager:access") || false;
  const hasPurchaseAccess = userPermissions?.includes("purchase:access") || false;
  const hasOrdersAccess = userPermissions?.includes("orders:access") || false;
  
  const isAdmin = hasAdminAccess;
  const isSupport = hasSupportAccess && !hasAdminAccess;
  const isVendor = (hasPurchaseAccess || hasOrdersAccess) && !hasAdminAccess && !hasSupportAccess;
  const isEmployee = !hasAdminAccess && !hasSupportAccess && !isVendor && userPermissions?.length > 0;
  
  const canRespond = hasSupportAccess || hasAdminAccess || isVendor || isEmployee;
  const canUpdateStatus = hasAdminAccess || hasHRAccess || hasManagerAccess || hasSupportAccess;
  const canRate = !hasAdminAccess && !hasSupportAccess && ticket?.status?.toLowerCase() === "resolved";

  useEffect(() => {
    fetchTicket();
  }, [ticket_id]);

  const fetchTicket = async () => {
    try {
      setLoading(true);
      setError("");
      const ticketData = await ticketApi.getTicket(ticket_id);
      setTicket(ticketData);
      
      const acts = [];
      if (ticketData.resolution_log && ticketData.resolution_log.length > 0) {
        ticketData.resolution_log.forEach((log, idx) => {
          const hasPermissionToSeeInternal = userPermissions?.includes("admin:access") || 
                                             userPermissions?.includes("support:access");
          if (log.internal && !hasPermissionToSeeInternal) return;
          acts.push({
            id: `log-${idx}`,
            action: log.internal ? "🔒 Internal Note" : "💬 Response",
            user: log.author_id || "System",
            details: log.message,
            time: formatDateTime(log.timestamp),
            internal: log.internal
          });
        });
      }
      acts.unshift({
        id: "created",
        action: "Ticket Created",
        user: `${ticketData.raised_by?.full_name || ticketData.raised_by?.user_id}`,
        details: ticketData.title,
        time: formatDateTime(ticketData.created_at),
      });
      setActivities(acts);

      if (ticketData.status_history && ticketData.status_history.length > 0) {
        const hist = ticketData.status_history.map((sh, idx) => ({
          id: `status-${idx}`,
          status: sh.status,
          by: sh.changed_by,
          at: formatDateTime(sh.timestamp),
        }));
        setHistory(hist);
      }
    } catch (err) {
      setError(err.message || "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  };

  const postResponse = async () => {
    if (!newMessage.trim()) return;
    try {
      setResponseSubmitting(true);
      await ticketApi.addResponse(ticket_id, newMessage, false);
      await fetchTicket();
      setNewMessage("");
    } catch (err) {
      alert(err.message || "Failed to post response");
    } finally {
      setResponseSubmitting(false);
    }
  };

  const updateStatus = async () => {
    if (!newStatus || !canUpdateStatus) return;
    try {
      setStatusUpdating(true);
      await ticketApi.updateStatus(ticket_id, newStatus);
      await fetchTicket();
      setNewStatus("");
      alert("Status updated successfully!");
    } catch (err) {
      alert(err.message || "Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  };
  
  const submitRating = async () => {
    if (rating === 0) return;
    try {
      const ratingMessage = `⭐ Customer Rating: ${rating}/5\nFeedback: ${ratingComment || "No additional feedback"}`;
      await ticketApi.addResponse(ticket_id, ratingMessage, false);
      await fetchTicket();
      setShowRatingModal(false);
      setRating(0);
      setRatingComment("");
      alert("Thank you for your feedback!");
    } catch (err) {
      alert(err.message || "Failed to submit rating");
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8">
      <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mb-4" />
      <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Loading Ticket Data...</p>
    </div>
  );

  if (error || !ticket) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center max-w-md">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-6" />
        <h2 className="text-xl font-bold text-slate-900 mb-2 uppercase tracking-tight">Access Error</h2>
        <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">{error || "The ticket you are looking for does not exist."}</p>
        <button onClick={() => navigate("/support")} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-sm">
          Return to Dashboard
        </button>
      </div>
    </div>
  );

  const statusStyle = {
    resolved: "text-emerald-700 bg-emerald-50 border-emerald-100",
    "in progress": "text-amber-700 bg-amber-50 border-amber-100",
    closed: "text-slate-600 bg-slate-100 border-slate-100",
    open: "text-blue-700 bg-blue-50 border-blue-100",
  }[ticket.status?.toLowerCase()] || "text-slate-700 bg-slate-50 border-slate-100";

  const priorityStyle = {
    high: "text-rose-700 bg-rose-50 border-rose-100",
    medium: "text-amber-700 bg-amber-50 border-amber-100",
    low: "text-emerald-700 bg-emerald-50 border-emerald-100",
  }[ticket.priority?.toLowerCase()] || "text-slate-700 bg-slate-50 border-slate-100";

  return (
    <div className="min-h-screen bg-gray-50 pt-6 pb-12 font-sans">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <span>←</span>
            <span>Back to Tickets</span>
          </button>
          
          <div className="flex items-center gap-3">
             {isAdmin && <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-rose-50 text-rose-600 border border-rose-100 tracking-wider">👑 Admin Mode</span>}
             {isSupport && !isAdmin && <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-indigo-50 text-indigo-600 border border-indigo-100 tracking-wider">🎧 Support Session</span>}
             <div className="h-4 w-px bg-slate-200 mx-1"></div>
             <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">#{ticket.ticket_number}</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <main className="flex-1 space-y-6 min-w-0 order-2 lg:order-1">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-tight mb-2">{ticket.title}</h1>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusStyle}`}>
                      {ticket.status}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${priorityStyle}`}>
                      {ticket.priority} Priority
                    </span>
                    <span className="h-1 w-1 rounded-full bg-slate-300 mx-1"></span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{ticket.category}</span>
                  </div>
                </div>
                {canRate && (
                  <button
                    onClick={() => setShowRatingModal(true)}
                    className="shrink-0 px-5 py-2.5 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-amber-600 transition-all shadow-sm"
                  >
                    ⭐ Rate Service
                  </button>
                )}
              </div>
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Issue Description</p>
                <p className="text-slate-700 text-sm leading-relaxed font-medium whitespace-pre-wrap">{ticket.description}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex border-b border-slate-200 gap-8">
                {[
                  { id: "Activity", label: "Conversation", icon: MessageCircle },
                  { id: "Details", label: "Technical Log", icon: Info },
                  { id: "History", label: "Audit Trail", icon: Clock },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`pb-4 px-1 text-xs font-bold uppercase tracking-wider transition-all relative ${
                      activeTab === id ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                       <Icon className="w-3.5 h-3.5" />
                       {label}
                    </div>
                    {activeTab === id && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>

              <div className="min-h-[400px]">
                {activeTab === "Activity" && (
                  <div className="space-y-6">
                    <div className="space-y-6">
                      {activities.map((act) => (
                        <div key={act.id} className="flex gap-4">
                          <div className="shrink-0 w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                            {act.user?.charAt(0) || "S"}
                          </div>
                          <div className="flex-1 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <div className="flex justify-between items-center mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-slate-900 uppercase tracking-tight">{act.action}</span>
                                <span className="text-[10px] font-semibold text-slate-400">by {act.user}</span>
                              </div>
                              <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">{act.time}</span>
                            </div>
                            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                              {act.details}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {canRespond && (
                      <div className="pt-6 border-t border-slate-200">
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Post a formal response</p>
                          <textarea
                            rows={3}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your message here..."
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-sm font-medium"
                            disabled={responseSubmitting}
                          />
                          <div className="flex items-center justify-between mt-4">
                            <div className="flex gap-2">
                              {isVendor && ["investigating", "resolved"].map((key) => (
                                <button
                                  key={key}
                                  onClick={() => setNewMessage(act => act + " " + key)}
                                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[9px] font-bold text-slate-500 uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                >
                                  + {key}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={postResponse}
                              disabled={responseSubmitting || !newMessage.trim()}
                              className="px-6 py-2.5 bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-all"
                            >
                              {responseSubmitting ? "Posting..." : "Send Message"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "Details" && (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 space-y-8 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <div className="pb-4 border-b border-slate-50">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ticket Reference</p>
                             <p className="text-sm font-bold text-slate-800">{ticket.ticket_number}</p>
                          </div>
                          <div className="pb-4 border-b border-slate-50">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Impact Level</p>
                             <p className="text-sm font-bold text-slate-800 uppercase tabular-nums">{ticket.priority}</p>
                          </div>
                       </div>
                       <div className="space-y-4">
                          <div className="pb-4 border-b border-slate-50">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current Status</p>
                             <p className="text-sm font-bold text-slate-800 uppercase">{ticket.status}</p>
                          </div>
                          <div className="pb-4 border-b border-slate-50">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Submission Date</p>
                             <p className="text-sm font-bold text-slate-800">{formatDateTime(ticket.created_at)}</p>
                          </div>
                       </div>
                    </div>
                  </div>
                )}

                {activeTab === "History" && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-8 flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-indigo-600 rounded-full"></div>
                        Event Log
                      </h3>
                      <div className="space-y-4">
                        {history.map((h) => (
                          <div key={h.id} className="flex items-center gap-4 p-4 border border-slate-50 rounded-lg hover:bg-slate-50/50 transition-colors">
                            <Clock className="w-4 h-4 text-slate-300" />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-800">
                                Status transitioned to <span className="text-indigo-600 font-bold uppercase tracking-tight">{h.status}</span>
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-slate-400 font-semibold uppercase">Authorized BY {h.by}</span>
                                <span className="h-1 w-1 rounded-full bg-slate-200"></span>
                                <span className="text-[10px] text-slate-300 font-semibold uppercase">{h.at}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {canUpdateStatus && (
                       <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
                          <div className="flex items-center gap-2 mb-6">
                             <Clock className="w-4 h-4 text-indigo-500" />
                             <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Administrative Actions</h4>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-4">
                            <select
                              value={newStatus}
                              onChange={(e) => setNewStatus(e.target.value)}
                              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider outline-none focus:bg-white text-slate-700"
                            >
                              <option value="">Update Status...</option>
                              <option value="open">Open</option>
                              <option value="in_progress">In Progress</option>
                              <option value="resolved">Resolved</option>
                              <option value="closed">Closed</option>
                            </select>
                            <button
                              onClick={updateStatus}
                              disabled={statusUpdating || !newStatus}
                              className="px-8 py-3 bg-indigo-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-50"
                            >
                              {statusUpdating ? "Saving..." : "Commit Update"}
                            </button>
                          </div>
                       </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </main>

          <aside className="lg:w-[320px] shrink-0 space-y-6 order-1 lg:order-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
              <div className="p-6">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Requestor Information</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                    {(ticket.raised_by?.full_name || ticket.raised_by?.user_id)?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 leading-tight">{ticket.raised_by?.full_name || ticket.raised_by?.user_id}</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase mt-1">ID: {ticket.raised_by?.user_id?.slice(0, 8)}</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Internal Assignment</p>
                {ticket.assigned_to ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs border border-slate-200">
                      {ticket.assigned_to.full_name?.charAt(0)}
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{ticket.assigned_to.full_name}</p>
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-slate-400 italic">No technician assigned</p>
                )}
              </div>

              <div className="p-6">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Key Timestamps</p>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-semibold text-slate-400 uppercase">Created</span>
                    <span className="font-bold text-slate-700 tracking-tight">{formatDateTime(ticket.created_at).split(',')[0]}</span>
                  </div>
                   {ticket.updated_at && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-slate-400 uppercase">Updated</span>
                      <span className="font-bold text-slate-700 tracking-tight">{formatDateTime(ticket.updated_at).split(',')[0]}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-xl">
               <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider mb-1">Support Guidelines</p>
                    <p className="text-[10px] text-indigo-600/80 font-semibold leading-relaxed">
                      Ensure all responses follow professional protocol. Internal notes are visible only to authorized personnel.
                    </p>
                  </div>
               </div>
            </div>
          </aside>
        </div>
      </div>

      {showRatingModal && canRate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-10 relative animate-in fade-in zoom-in duration-300">
            <button onClick={() => setShowRatingModal(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 text-2xl font-bold leading-none">×</button>
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Service Feedback</h3>
              <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Rate your experience</p>
            </div>
            <div className="mb-8 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setRating(star)}>
                  <Star className={`w-10 h-10 ${star <= rating ? "text-amber-500 fill-amber-500" : "text-slate-100"}`} />
                </button>
              ))}
            </div>
            <textarea rows={3} value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} placeholder="Comments..." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none text-sm font-medium mb-8" />
            <div className="flex gap-4">
              <button onClick={submitRating} disabled={rating === 0} className="flex-[2] bg-indigo-600 text-white py-3 rounded-lg font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50">Submit Rating</button>
              <button onClick={() => setShowRatingModal(false)} className="flex-1 px-6 py-3 bg-slate-100 text-slate-500 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-slate-200">Back</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
