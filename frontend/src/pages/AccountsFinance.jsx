import React, { useState, useEffect } from "react";
import { authenticatedFetch } from "../utils/authAPI";

// --- NAVIGATION SECTION TITLES ---
const NAV_SECTIONS = [
  { key: "milestones", name: "Payment Milestones" },
  { key: "dealerlog", name: "Dealer Payment Log" },
  { key: "profit", name: "Profit Per Dealer" },
  { key: "gst", name: "GST Invoices" },
  { key: "expense", name: "Expense Tracking" },
  { key: "pl", name: "Monthly P&L" },
];

// --- COMPONENTS ---
function AccountsFinanceTopTitle({ search, setSearch }) {
  return (
    <div className="py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-left text-blue-700 leading-7">
          Accounts & Finance Management
        </h2>
        <p className="text-gray-500 mt-1 text-left text-sm sm:text-base">
          Monitor payments, track expenses, calculate profits, and generate GST invoices with ease.
        </p>
      </div>
      <div className="mt-4 sm:mt-0 sm:ml-4 flex-shrink-0 w-full sm:w-auto flex justify-start sm:justify-end">
        <input
          type="text"
          placeholder="Search dealer, invoice, or expense"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full sm:w-64"
        />
      </div>
    </div>
  );
}

function Section({ title, children, icon }) {
  return (
    <section className="mb-10">
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2 text-blue-700">
          {icon}
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

// --- DATA FETCHING COMPONENTS ---
// Helper: API base (change to your backend base if needed)
const API_BASE = "http://localhost:8000/api/payments";

// 1. Payment Milestones
function PaymentMilestoneTable({ search }) {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authenticatedFetch(`${API_BASE}`)
      .then(res => res.json())
      .then(data => setMilestones(data.payments || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = milestones.filter(
    m =>
      (m.name || "").toLowerCase().includes(search) ||
      (m.dealer || m.dealer_id || "").toLowerCase().includes(search)
  );

  if (loading) return <Section title="Payment Milestones">Loading...</Section>;

  return (
    <Section
      title="Payment Milestones"
      icon={
        <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7 20h10M7 4h10v16H7z" />
        </svg>
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr className="bg-blue-100 text-gray-700">
              <th className="py-2 px-4">Milestone</th>
              <th className="py-2 px-4">Dealer</th>
              <th className="py-2 px-4">Amount (₹)</th>
              <th className="py-2 px-4">Due Date</th>
              <th className="py-2 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id} className="border-b last:border-b-0 hover:bg-blue-50 transition">
                <td className="py-2 px-4">{m.name}</td>
                <td className="py-2 px-4">{m.dealer || m.dealer_id}</td>
                <td className="py-2 px-4">{Number(m.amount).toLocaleString()}</td>
                <td className="py-2 px-4">{m.dueDate || m.date}</td>
                <td className={`py-2 px-4 font-semibold ${m.status === "Completed" ? "text-green-600" : "text-yellow-600"}`}>{m.status}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 px-4 text-gray-400 text-center">No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// 2. Dealer Payment Log (Assuming milestones as payments for now)
function DealerPaymentLog({ search }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authenticatedFetch(`${API_BASE}`)
      .then(res => res.json())
      .then(data => setPayments(data.payments || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = payments.filter(
    p =>
      (p.dealer || p.dealer_id || "").toLowerCase().includes(search)
  );

  if (loading) return <Section title="Dealer Payment Log">Loading...</Section>;

  return (
    <Section
      title="Dealer Payment Log"
      icon={
        <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a5 5 0 00-10 0v2M5 12h14M5 12a2 2 0 100 4h14a2 2 0 100-4" />
        </svg>
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr className="bg-green-100 text-gray-700">
              <th className="py-2 px-4">Date</th>
              <th className="py-2 px-4">Dealer</th>
              <th className="py-2 px-4">Amount (₹)</th>
              <th className="py-2 px-4">Type</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b last:border-b-0 hover:bg-green-50 transition">
                <td className="py-2 px-4">{p.dueDate || p.date}</td>
                <td className="py-2 px-4">{p.dealer || p.dealer_id}</td>
                <td className="py-2 px-4">{Number(p.amount).toLocaleString()}</td>
                <td className="py-2 px-4">{p.type || "-"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 px-4 text-gray-400 text-center">No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// 3. Profit Per Dealer (Requires aggregation, placeholder)
function ProfitPerDealer({ search }) {
  return (
    <Section
      title="Profit Calculation Per Dealer"
      icon={
        <svg className="h-6 w-6 text-purple-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6 1a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
    >
      <div className="text-gray-500 px-4 py-6">Backend does not provide profit per dealer. Please add an endpoint for this.</div>
    </Section>
  );
}

// 4. GST Invoice Generation



// Assume Section and API_BASE are imported or declared above



// Assume Section and API_BASE are imported or declared above

function GSTInvoiceGeneration({ search: parentSearch }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dealerSearch, setDealerSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  const PAGE_SIZE = 10;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.append("skip", (page - 1) * PAGE_SIZE);
    params.append("limit", PAGE_SIZE);
    if (dealerSearch.trim()) {
      params.append("dealer_id", dealerSearch.trim());
    }
    authenticatedFetch(`${API_BASE}/invoices?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        // Handle backend response format: { success: true, invoices: [...], pagination: {...} }
        const invoicesData = data.invoices || data || [];
        setInvoices(invoicesData);
        setHasPrev(page > 1);
        // Check if there are more results based on pagination info or array length
        const hasMoreResults = data.pagination ? data.pagination.has_more : invoicesData.length === PAGE_SIZE;
        setHasNext(hasMoreResults);
      })
      .finally(() => setLoading(false));
  }, [page, dealerSearch]);

  const filtered = invoices.filter(
    inv =>
      (inv.dealer_id || "").toLowerCase().includes((parentSearch || "").toLowerCase())
  );

  // Download handler
  const handleDownload = async (url, suggestedFileName = "invoice.pdf") => {
    try {
      const response = await authenticatedFetch(url, { method: "GET" });
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      // Try to get filename from Content-Disposition header
      let fileName = suggestedFileName;
      const disposition = response.headers.get("Content-Disposition");
      if (disposition && disposition.indexOf("filename=") !== -1) {
        const match = disposition.match(/filename="?(.+?)"?$/);
        if (match && match[1]) fileName = match[1];
      }
      const urlBlob = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = urlBlob;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(urlBlob);
    } catch (err) {
      alert("Could not download file. " + err.message);
    }
  };

  if (loading) return <Section title="GST Invoice Generation">Loading...</Section>;

  return (
    <Section
      title="GST Invoice Generation"
      icon={
        <svg className="h-6 w-6 text-orange-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2M7 7h10M7 11h10M5 19h14V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14z" />
        </svg>
      }
    >
      <div className="flex items-center justify-end mb-3">
        <input
          type="text"
          placeholder="Dealer ID"
          value={dealerSearch}
          onChange={e => { setPage(1); setDealerSearch(e.target.value); }}
          className="border border-gray-300 rounded px-2 py-1 w-full max-w-xs md:max-w-[180px] text-sm focus:outline-none focus:ring focus:ring-orange-200 transition"
          style={{ minWidth: 0 }}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr className="bg-orange-100 text-gray-700">
              <th className="py-2 px-4">Dealer ID</th>
              <th className="py-2 px-4">Invoice Items</th>
              <th className="py-2 px-4">Amount (₹)</th>
              <th className="py-2 px-4">Date</th>
              <th className="py-2 px-4">PDF</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv, idx) => (
              <tr key={inv.id || idx} className="border-b last:border-b-0 hover:bg-orange-50 transition">
                <td className="py-2 px-4">{inv.dealer_id}</td>
                <td className="py-2 px-4">
                  <ul className="list-disc pl-4">
                    {Array.isArray(inv.items) && inv.items.map((item, i) => (
                      <li key={i} className="text-xs md:text-sm">
                        {item.description} (Qty: {item.quantity}, Price: ₹{item.price})
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="py-2 px-4">{Number(inv.total).toLocaleString()}</td>
                <td className="py-2 px-4">
                  {inv.date && inv.date.$date
                    ? new Date(inv.date.$date).toLocaleDateString()
                    : inv.date
                      ? new Date(inv.date).toLocaleDateString()
                      : ""}
                </td>
                <td className="py-2 px-4">
                  {inv.pdf_url
                    ? (
                      <button
                        onClick={`() => handleDownload(inv.pdf_url, invoice_${inv.id || idx}.pdf)`}
                        className="text-blue-600 underline text-xs md:text-sm hover:text-blue-800 focus:outline-none"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        title="Download PDF"
                      >
                        Download
                      </button>
                    )
                    : "-"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 px-4 text-gray-400 text-center">No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={!hasPrev}
          className={`px-3 py-1 rounded text-sm ${hasPrev ? "bg-orange-500 text-white hover:bg-orange-600" : "bg-gray-200 text-gray-400"} transition`}
        >
          Previous
        </button>
        <span className="text-sm">Page {page}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={!hasNext}
          className={`px-3 py-1 rounded text-sm ${hasNext ? "bg-orange-500 text-white hover:bg-orange-600" : "bg-gray-200 text-gray-400"} transition`}
        >
          Next
        </button>
      </div>
    </Section>
  );
}


// 5. Expense Tracking
function ExpenseTracking({ search }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authenticatedFetch(`${API_BASE}/expenses`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        // Ensure data is always an array
        setExpenses(Array.isArray(data) ? data : []);
      })
      .catch(error => {
        console.error('Error fetching expenses:', error);
        // Set empty array on error (404 or other errors)
        setExpenses([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Ensure expenses is always an array before filtering
  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const filtered = safeExpenses.filter(
    exp =>
      (exp.description || "").toLowerCase().includes(search) ||
      (exp.category || "").toLowerCase().includes(search)
  );

  if (loading) return <Section title="Expense Tracking">Loading...</Section>;

  return (
    <Section
      title="Expense Tracking"
      icon={
        <svg className="h-6 w-6 text-pink-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4v4h8v-4c0-2.21-1.79-4-4-4zm0 0V4m0 0a4 4 0 110 8 4 4 0 010-8z" />
        </svg>
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr className="bg-pink-100 text-gray-700">
              <th className="py-2 px-4">Date</th>
              <th className="py-2 px-4">Dealer ID</th>
              <th className="py-2 px-4">Amount (₹)</th>
              <th className="py-2 px-4">Description</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(exp => (
              <tr key={exp.id} className="border-b last:border-b-0 hover:bg-pink-50 transition">
                <td className="py-2 px-4">{exp.date}</td>
                <td className="py-2 px-4">{exp.dealer_id}</td>
                <td className="py-2 px-4">{Number(exp.amount).toLocaleString()}</td>
                <td className="py-2 px-4">{exp.description}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 px-4 text-gray-400 text-center">No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// 6. Monthly P&L Summary (Requires dealer_id, year, month)
function MonthlyPLSummary({ search }) {
  // Simple demo: use current date and first dealer_id found in milestones
  const [milestoneDealers, setMilestoneDealers] = useState([]);
  const [selectedDealer, setSelectedDealer] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch dealers for dropdown
  useEffect(() => {
    authenticatedFetch(`${API_BASE}`)
      .then(res => res.json())
      .then(data => {
        const paymentsData = data.payments || [];
        const dealers = Array.from(new Set(paymentsData.map(d => d.dealer_id || d.dealer).filter(Boolean)));
        setMilestoneDealers(dealers);
        if (dealers.length > 0 && !selectedDealer) setSelectedDealer(dealers[0]);
      });
  }, []);

  useEffect(() => {
    if (!selectedDealer) return;
    setLoading(true);
    authenticatedFetch(`${API_BASE}/monthly_report?dealer_id=${selectedDealer}&year=${year}&month=${month}`)
      .then(res => res.json())
      .then(setReport)
      .finally(() => setLoading(false));
  }, [selectedDealer, year, month]);

  return (
    <Section
      title="Monthly P&L Summary"
      icon={
        <svg className="h-6 w-6 text-cyan-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      }
    >
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <label className="block text-gray-600 text-sm mb-1">Dealer</label>
          <select
            className="border rounded px-2 py-1"
            value={selectedDealer}
            onChange={e => setSelectedDealer(e.target.value)}
          >
            {milestoneDealers.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-gray-600 text-sm mb-1">Year</label>
          <input
            type="number"
            className="border rounded px-2 py-1"
            value={year}
            min={2000}
            max={2100}
            onChange={e => setYear(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-gray-600 text-sm mb-1">Month</label>
          <input
            type="number"
            className="border rounded px-2 py-1"
            value={month}
            min={1}
            max={12}
            onChange={e => setMonth(Number(e.target.value))}
          />
        </div>
      </div>
      {loading ? (
        <div className="py-4 text-gray-600">Loading...</div>
      ) : report ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="bg-cyan-100 text-gray-700">
                <th className="py-2 px-4">Month</th>
                <th className="py-2 px-4">Total Payments (₹)</th>
                <th className="py-2 px-4">Total Expenses (₹)</th>
                <th className="py-2 px-4">Net Profit (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b last:border-b-0 hover:bg-cyan-50 transition">
                <td className="py-2 px-4">{report.month}</td>
                <td className="py-2 px-4">{Number(report.total_payments).toLocaleString()}</td>
                <td className="py-2 px-4">{Number(report.total_expenses).toLocaleString()}</td>
                <td className={`py-2 px-4 font-bold ${report.net_profit >= 0 ? "text-green-600" : "text-red-600"}`}>{Number(report.net_profit).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-4 text-gray-500">No data found.</div>
      )}
    </Section>
  );
}

// --- MAIN COMPONENT ---
export default function AccountsFinance() {
  const [activeTab, setActiveTab] = useState("milestones");
  const [search, setSearch] = useState("");

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <AccountsFinanceTopTitle search={search} setSearch={setSearch} />
        <div className="border-b border-gray-200 bg-white mt-3">
          <nav className="-mb-px flex flex-col sm:flex-row sm:space-x-6 overflow-x-auto">
            {NAV_SECTIONS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`${
                  activeTab === tab.key
                    ? 'border-b-2 border-blue-500 text-blue-700 font-semibold'
                    : 'border-b-2 border-transparent text-gray-700 hover:text-blue-600 hover:border-blue-300'
                } whitespace-nowrap py-3 px-1 font-medium text-base text-left transition focus:outline-none`}
                style={{ minWidth: 120 }}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
        <div className="py-8">
          {activeTab === "milestones" && <PaymentMilestoneTable search={search.toLowerCase()} />}
          {activeTab === "dealerlog" && <DealerPaymentLog search={search.toLowerCase()} />}
          {activeTab === "profit" && <ProfitPerDealer search={search.toLowerCase()} />}
          {activeTab === "gst" && <GSTInvoiceGeneration search={search.toLowerCase()} />}
          {activeTab === "expense" && <ExpenseTracking search={search.toLowerCase()} />}
          {activeTab === "pl" && <MonthlyPLSummary search={search.toLowerCase()} />}
        </div>
      </div>
    </div>
  );
}