import React, { useState, useEffect } from "react";

// Helper functions
async function fetchEnquiries() {
  const res = await fetch("https://ratilalsons-backend-api.onrender.com/api/franchises/");
  if (!res.ok) throw new Error("Failed to load franchise enquiries");
  return await res.json();
}
async function updateEnquiryStatus(id, status) {
  // You may need to adjust the endpoint/method based on your backend
  const res = await fetch(
    `https://ratilalsons-backend-api.onrender.com/api/franchises/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }
  );
  if (!res.ok) throw new Error("Failed to update status");
  return await res.json();
}

// --- Add New Franchise Form as an inline component ---
function AddNewFranchiseForm({ onCreated }) {
  const [form, setForm] = useState({
    name: "",
    owner_name: "",
    email: "",
    phone: "",
    address: "",
    region: "",
    latitude: "",
    longitude: "",
    kyc_docs: [],
    investment_amount: "",
    commission_logs: [],
    status: "pending",
    expiry_date: "",
    created_at: "",
    approved_at: "",
    rejected_at: "",
    notes: ""
  });
  const [kycDoc, setKycDoc] = useState({
    name: "",
    url: "",
    docType: "",
    status: "pending",
    rejected_reason: ""
  });
  const [commissionLog, setCommissionLog] = useState({
    month: "",
    amount: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Change handler for main fields
  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
  }

  // Add a KYC doc object
  function addKycDoc() {
    if (!kycDoc.name || !kycDoc.docType) return;
    setForm(f => ({ ...f, kyc_docs: [...f.kyc_docs, { ...kycDoc }] }));
    setKycDoc({ name: "", url: "", docType: "", status: "pending", rejected_reason: "" });
  }

  // Add a commission log
  function addCommissionLog() {
    if (!commissionLog.month || !commissionLog.amount) return;
    setForm((f) => ({
      ...f,
      commission_logs: [
        ...f.commission_logs,
        { month: commissionLog.month, amount: parseFloat(commissionLog.amount) }
      ]
    }));
    setCommissionLog({ month: "", amount: "" });
  }

  async function handleSubmit(e) {
  e.preventDefault();
  setError("");
  setSuccess(false);

  // Required fields validation
  if (!form.name || !form.owner_name || !form.email || !form.phone || !form.address || !form.region) {
    setError("Please fill all required fields.");
    return;
  }

  try {
    // Prepare payload for backend
    const payload = {
      name: form.name,
      owner_name: form.owner_name,
      email: form.email,
      phone: form.phone || undefined,
      address: form.address,
      region: form.region || undefined,
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      investment_amount: form.investment_amount ? parseFloat(form.investment_amount) : 0,
      kyc_docs: form.kyc_docs.length ? form.kyc_docs : [],
      commission_logs: form.commission_logs.length ? form.commission_logs : [],
      status: form.status || "pending",
      expiry_date: form.expiry_date || undefined,
      created_at: form.created_at || undefined,
      approved_at: form.approved_at || undefined,
      rejected_at: form.rejected_at || undefined,
      notes: form.notes || undefined
    };

    const response = await fetch("https://ratilalsons-backend-api.onrender.com/api/franchises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    // Handle validation errors from FastAPI
    if (!response.ok) {
      const data = await response.json();
      if (data.detail) {
        // If detail is an array (Pydantic validation errors), join messages
        const message = Array.isArray(data.detail)
          ? data.detail.map(err => `${err.loc.join(".")}: ${err.msg}`).join("; ")
          : data.detail;
        setError(message);
      } else {
        setError("Failed to add franchise.");
      }
      return;
    }

    // Success
    setSuccess(true);

    // Reset form
    setForm({
      name: "",
      owner_name: "",
      email: "",
      phone: "",
      address: "",
      region: "",
      latitude: "",
      longitude: "",
      kyc_docs: [],
      investment_amount: "",
      commission_logs: [],
      status: "pending",
      expiry_date: "",
      created_at: "",
      approved_at: "",
      rejected_at: "",
      notes: ""
    });

    if (typeof onCreated === "function") onCreated();

  } catch (err) {
    console.error(err);
    setError("Network error.");
  }
}

  return (
    <div className="max-w-6xl mx-auto bg-white p-8 rounded shadow mb-8">
      <h2 className="text-xl font-bold mb-5 text-indigo-600">Add New Franchise</h2>
      {error && <div className="text-red-600 mb-3">{error}</div>}
      {success && <div className="text-green-600 mb-3">Franchise created successfully!</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="name" value={form.name} onChange={handleChange} placeholder="Franchise Name" className="w-full p-2 border rounded" required />
        <input name="owner_name" value={form.owner_name} onChange={handleChange} placeholder="Owner Name" className="w-full p-2 border rounded" required />
        <input name="email" value={form.email} onChange={handleChange} placeholder="Owner Email" className="w-full p-2 border rounded" required />
        <input name="phone" value={form.phone} onChange={handleChange} placeholder="Owner Phone" className="w-full p-2 border rounded" required />
        <input name="address" value={form.address} onChange={handleChange} placeholder="Address" className="w-full p-2 border rounded" required />
        <input name="region" value={form.region} onChange={handleChange} placeholder="Region" className="w-full p-2 border rounded" required />
        <input name="latitude" value={form.latitude} onChange={handleChange} placeholder="Latitude" type="number" className="w-full p-2 border rounded" />
        <input name="longitude" value={form.longitude} onChange={handleChange} placeholder="Longitude" type="number" className="w-full p-2 border rounded" />
        <input name="investment_amount" value={form.investment_amount} onChange={handleChange} placeholder="Investment Amount" type="number" className="w-full p-2 border rounded" />
        <input name="expiry_date" value={form.expiry_date} onChange={handleChange} placeholder="Expiry Date (YYYY-MM-DD)" className="w-full p-2 border rounded" />
        <input name="created_at" value={form.created_at} onChange={handleChange} placeholder="Created At (YYYY-MM-DD)" className="w-full p-2 border rounded" />
        <input name="approved_at" value={form.approved_at} onChange={handleChange} placeholder="Approved At (YYYY-MM-DD)" className="w-full p-2 border rounded" />
        <input name="rejected_at" value={form.rejected_at} onChange={handleChange} placeholder="Rejected At (YYYY-MM-DD)" className="w-full p-2 border rounded" />
        <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Notes" className="w-full p-2 border rounded" />
        <label>
          Status
          <select name="status" value={form.status} onChange={handleChange} className="w-full p-2 border rounded">
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        {/* KYC Docs Section */}
        <div className="bg-gray-50 p-3 rounded mb-2">
          <div className="font-bold mb-2 text-sm text-gray-600">KYC Documents</div>
          <div className="flex gap-2 mb-2">
            <input name="name" value={kycDoc.name} onChange={e => setKycDoc(doc => ({ ...doc, name: e.target.value }))} placeholder="Doc Name" className="p-2 border rounded" />
            <input name="url" value={kycDoc.url} onChange={e => setKycDoc(doc => ({ ...doc, url: e.target.value }))} placeholder="URL" className="p-2 border rounded" />
            <input name="docType" value={kycDoc.docType} onChange={e => setKycDoc(doc => ({ ...doc, docType: e.target.value }))} placeholder="Type" className="p-2 border rounded" />
            <input name="rejected_reason" value={kycDoc.rejected_reason} onChange={e => setKycDoc(doc => ({ ...doc, rejected_reason: e.target.value }))} placeholder="Rejected Reason" className="p-2 border rounded" />
            <button type="button" onClick={addKycDoc} className="px-3 py-2 bg-indigo-500 text-white rounded">Add Doc</button>
          </div>
          <ul className="text-xs ml-2 text-gray-700">
            {form.kyc_docs.map((d, idx) => (
              <li key={idx}>{d.name} - {d.docType} ({d.status})</li>
            ))}
          </ul>
        </div>
        {/* Commission Logs Section */}
        <div className="bg-gray-50 p-3 rounded mb-2">
          <div className="font-bold mb-2 text-sm text-gray-600">Commission Logs</div>
          <div className="flex gap-2 mb-2">
            <input name="month" value={commissionLog.month} onChange={e => setCommissionLog(log => ({ ...log, month: e.target.value }))} placeholder="Month" className="p-2 border rounded" />
            <input name="amount" value={commissionLog.amount} type="number" onChange={e => setCommissionLog(log => ({ ...log, amount: e.target.value }))} placeholder="Amount" className="p-2 border rounded" />
            <button type="button" onClick={addCommissionLog} className="px-3 py-2 bg-indigo-500 text-white rounded">Add Log</button>
          </div>
          <ul className="text-xs ml-2 text-gray-700">
            {form.commission_logs.map((c, idx) => (
              <li key={idx}>{c.month}: ₹{c.amount}</li>
            ))}
          </ul>
        </div>
        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded font-bold">Create Franchise</button>
      </form>
    </div>
  );
}

// --- Main Card ---
function FranchiseCard({ onBack }) {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewEnquiry, setViewEnquiry] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const rowsPerPage = 10;

  useEffect(() => {
    setLoading(true);
    fetchEnquiries()
      .then(setEnquiries)
      .catch((e) =>
        setError(typeof e === "string" ? e : e.message || JSON.stringify(e))
      )
      .finally(() => setLoading(false));
  }, []);

  const getId = (enq) =>
    enq._id?.$oid || enq._id || enq.id;

  const handleApprove = async (enquiry) => {
    setStatusUpdating(true);
    setStatusError("");
    try {
      await updateEnquiryStatus(getId(enquiry), "approved");
      setEnquiries((prev) =>
        prev.map((e) =>
          getId(e) === getId(enquiry)
            ? { ...e, status: "approved" }
            : e
        )
      );
      setViewEnquiry((prev) =>
        prev ? { ...prev, status: "approved" } : prev
      );
    } catch (e) {
      setStatusError(typeof e === "string" ? e : e.message || JSON.stringify(e));
    }
    setStatusUpdating(false);
  };

  const handleReject = async (enquiry) => {
    setStatusUpdating(true);
    setStatusError("");
    try {
      await updateEnquiryStatus(getId(enquiry), "rejected");
      setEnquiries((prev) =>
        prev.map((e) =>
          getId(e) === getId(enquiry)
            ? { ...e, status: "rejected" }
            : e
        )
      );
      setViewEnquiry((prev) =>
        prev ? { ...prev, status: "rejected" } : prev
      );
    } catch (e) {
      setStatusError(typeof e === "string" ? e : e.message || JSON.stringify(e));
    }
    setStatusUpdating(false);
  };

  // Search & Pagination
  const filteredEnquiries = enquiries.filter((enq) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      (enq.first_name || "").toLowerCase().includes(query) ||
      (enq.last_name || "").toLowerCase().includes(query) ||
      (enq.email || "").toLowerCase().includes(query) ||
      (enq.location || "").toLowerCase().includes(query) ||
      (enq.cell_number || "").toLowerCase().includes(query)
    );
  });
  useEffect(() => {
    if (page > Math.floor(filteredEnquiries.length / rowsPerPage)) setPage(0);
    // eslint-disable-next-line
  }, [search, filteredEnquiries.length]);
  const paginatedEnquiries = filteredEnquiries.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-8 bg-gray-50 min-h-screen">
      {/* Back Button */}
      <button
        className="mb-6 px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition inline-block"
        onClick={onBack}
      >
        &larr; Back to Dashboard
      </button>
      {/* Add New Franchise Button and Form */}
      <button
        className="mb-6 px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
        onClick={() => setShowAddForm((v) => !v)}
      >
        {showAddForm ? "Hide Add Franchise" : "Add New Franchise"}
      </button>
      {showAddForm && (
        <AddNewFranchiseForm onCreated={() => fetchEnquiries().then(setEnquiries)} />
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col sm:flex-row items-center justify-between mb-8 gap-5">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-indigo-700 mb-1">
            Franchise Enquiries
          </h2>
          <p className="text-gray-500">
            All franchise/dealership applications with approve/reject actions.
          </p>
        </div>
      </div>

      {/* Search and Table */}
      <div className="bg-white rounded-2xl shadow-xl p-0 sm:p-4 mb-8">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-0">
            All Franchise Enquiries
          </h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {loading && <span className="text-sm text-gray-400 mr-4">Loading...</span>}
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition w-full sm:w-60"
              style={{ minWidth: 130 }}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          {/* Table for desktop */}
          <table className="min-w-full divide-y divide-gray-200 text-sm hidden md:table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase">Location</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase">Phone</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {paginatedEnquiries.map((enquiry) => (
                <tr key={getId(enquiry) || Math.random()}>
                  <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">
                    {(enquiry.title || "") + " " + (enquiry.first_name || "") + " " + (enquiry.middle_name ? enquiry.middle_name + " " : "") + (enquiry.last_name || "")}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{enquiry.location || ""}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{enquiry.cell_number || ""}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${enquiry.status === "approved"
                      ? "bg-green-100 text-green-700"
                      : enquiry.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-800"
                      }`}>
                      {enquiry.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 flex flex-wrap gap-2 whitespace-nowrap">
                    <button
                      onClick={() => setViewEnquiry(enquiry)}
                      className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-xs font-semibold hover:bg-indigo-200 transition"
                    >View</button>
                    <button
                      disabled={statusUpdating || enquiry.status === "approved"}
                      onClick={() => handleApprove(enquiry)}
                      className="bg-green-50 text-green-700 px-3 py-1 rounded text-xs font-semibold hover:bg-green-100 transition disabled:opacity-50"
                    >Approve</button>
                    <button
                      disabled={statusUpdating || enquiry.status === "rejected"}
                      onClick={() => handleReject(enquiry)}
                      className="bg-red-50 text-red-700 px-3 py-1 rounded text-xs font-semibold hover:bg-red-100 transition disabled:opacity-50"
                    >Reject</button>
                  </td>
                </tr>
              ))}
              {!loading && paginatedEnquiries.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-400 py-8">
                    No enquiries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {/* Cards for mobile */}
          <div className="md:hidden flex flex-col gap-4 py-2">
            {paginatedEnquiries.length === 0 && !loading ? (
              <div className="text-center text-gray-400 py-8">No enquiries yet.</div>
            ) : paginatedEnquiries.map((enquiry) => (
              <div
                key={getId(enquiry) || Math.random()}
                className="rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-white shadow-sm p-4 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-gray-900 text-base">
                    {(enquiry.title || "") + " " + (enquiry.first_name || "") + " " + (enquiry.middle_name ? enquiry.middle_name + " " : "") + (enquiry.last_name || "")}
                  </span>
                </div>
                <div className="flex gap-1 text-sm">
                  <span className="font-semibold text-gray-600 w-24">Location:</span>
                  <span>{enquiry.location || "-"}</span>
                </div>
                <div className="flex gap-1 text-sm">
                  <span className="font-semibold text-gray-600 w-24">Phone:</span>
                  <span>{enquiry.cell_number || "-"}</span>
                </div>
                <div className="flex gap-1 text-sm">
                  <span className="font-semibold text-gray-600 w-24">Status:</span>
                  <span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${enquiry.status === "approved"
                      ? "bg-green-100 text-green-700"
                      : enquiry.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-800"
                      }`}>
                      {enquiry.status}
                    </span>
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setViewEnquiry(enquiry)}
                    className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-xs font-semibold hover:bg-indigo-200 transition"
                  >View</button>
                  <button
                    disabled={statusUpdating || enquiry.status === "approved"}
                    onClick={() => handleApprove(enquiry)}
                    className="bg-green-50 text-green-700 px-3 py-1 rounded text-xs font-semibold hover:bg-green-100 transition disabled:opacity-50"
                  >Approve</button>
                  <button
                    disabled={statusUpdating || enquiry.status === "rejected"}
                    onClick={() => handleReject(enquiry)}
                    className="bg-red-50 text-red-700 px-3 py-1 rounded text-xs font-semibold hover:bg-red-100 transition disabled:opacity-50"
                  >Reject</button>
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            )}
          </div>
        </div>
        {/* Pagination Controls and Total Enquiries */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 py-2">
          <div className="text-gray-700 font-medium text-sm">
            <b>Total Enquiries:</b> {filteredEnquiries.length}
          </div>
          {filteredEnquiries.length > rowsPerPage && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="mx-2 text-gray-600">
                Page {page + 1} of {Math.ceil(filteredEnquiries.length / rowsPerPage)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(filteredEnquiries.length / rowsPerPage) - 1}
                className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- Modal: Enquiry Details --- */}
      {viewEnquiry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          aria-modal="true"
          tabIndex={-1}
          onClick={() => setViewEnquiry(null)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-2 p-8 border flex flex-col max-h-[90vh] overflow-y-auto animate-modernModal"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 text-xl font-bold text-gray-400 hover:text-gray-700"
              onClick={() => setViewEnquiry(null)}
              aria-label="Close details modal"
            >
              ×
            </button>
            <h3 className="text-2xl font-semibold mb-6 text-center border-b pb-2 text-indigo-700 tracking-wide">
              Enquiry Details
            </h3>
            <dl className="space-y-3 text-sm sm:text-base">
              <div>
                <dt className="font-semibold">Title:</dt>
                <dd>{viewEnquiry.title}</dd>
              </div>
              <div>
                <dt className="font-semibold">First Name:</dt>
                <dd>{viewEnquiry.first_name}</dd>
              </div>
              <div>
                <dt className="font-semibold">Middle Name:</dt>
                <dd>{viewEnquiry.middle_name}</dd>
              </div>
              <div>
                <dt className="font-semibold">Last Name:</dt>
                <dd>{viewEnquiry.last_name}</dd>
              </div>
              <div>
                <dt className="font-semibold">Email:</dt>
                <dd>
                  <a href={`mailto:${viewEnquiry.email}`} className="text-blue-600 underline">
                    {viewEnquiry.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Cell Number:</dt>
                <dd>{viewEnquiry.cell_number}</dd>
              </div>
              <div>
                <dt className="font-semibold">Location:</dt>
                <dd>{viewEnquiry.location}</dd>
              </div>
              <div>
                <dt className="font-semibold">Total Cash to Invest:</dt>
                <dd>₹{viewEnquiry.total_cash}</dd>
              </div>
              <div>
                <dt className="font-semibold">Number of Stores:</dt>
                <dd>{viewEnquiry.num_stores}</dd>
              </div>
              <div>
                <dt className="font-semibold">Status:</dt>
                <dd>{viewEnquiry.status}</dd>
              </div>
            </dl>
            {statusError && (
              <div className="text-red-500 text-center mt-4">{statusError}</div>
            )}
            <div className="flex gap-4 mt-6 justify-center">
              <button
                disabled={statusUpdating || viewEnquiry.status === "approved"}
                onClick={() => handleApprove(viewEnquiry)}
                className="bg-green-50 text-green-700 px-6 py-2 rounded text-sm font-semibold hover:bg-green-100 transition disabled:opacity-50"
              >
                Approve
              </button>
              <button
                disabled={statusUpdating || viewEnquiry.status === "rejected"}
                onClick={() => handleReject(viewEnquiry)}
                className="bg-red-50 text-red-700 px-6 py-2 rounded text-sm font-semibold hover:bg-red-100 transition disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => setViewEnquiry(null)}
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded text-sm font-semibold hover:bg-gray-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FranchiseCard;
export { AddNewFranchiseForm };
