import React, { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area
} from "recharts";
import { FaSync, FaDownload, FaChartBar, FaChartPie, FaFire, FaDollarSign, FaChartLine } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = ["#FF8C42", "#4ECDC4", "#C7C7C7", "#45526C", "#F59E0B", "#10B981", "#8B5CF6", "#EC4899"];

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="font-bold text-sm">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

function PeriodRangePicker({ start, end, setStart, setEnd }) {
  return (
    <div className="flex items-center space-x-4">
      <label className="text-sm font-medium text-gray-700">Start</label>
      <input
        type="date"
        className="border rounded px-2 py-1"
        value={start}
        onChange={e => setStart(e.target.value)}
      />
      <label className="text-sm font-medium text-gray-700">End</label>
      <input
        type="date"
        className="border rounded px-2 py-1"
        value={end}
        onChange={e => setEnd(e.target.value)}
      />
    </div>
  );
}

function getCostSummary(generatorArr) {
  if (!generatorArr.length) return {};
  const total_usage = generatorArr.reduce((s, x) => s + (x.total_usage || 0), 0);
  const total_cost = generatorArr.reduce((s, x) => s + (x.total_cost || 0), 0);
  const avg_cost_per_unit = total_usage ? total_cost / total_usage : 0;
  const highest_site = generatorArr.reduce((max, x) =>
    (x.total_cost || 0) > (max.total_cost || 0) ? x : max, generatorArr[0]);
  return {
    total_usage,
    total_cost,
    avg_cost_per_unit,
    highest_site
  };
}

export default function GeneratorsReport({ onDataUpdateRef }) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  // Default to entire year to show all reports
  const [start, setStart] = useState(`${yyyy}-01-01`);
  const [end, setEnd] = useState(`${yyyy}-${mm}-${dd}`);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [trend, setTrend] = useState([]);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("access_token");
      // Change URL to fetch combined report without site_id filter
      const resp = await fetch(
        `https://ratilalsons-backend-api.onrender.com/api/generators-utilities/reports?start=${start}&end=${end}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (!resp.ok) throw new Error("Failed to fetch data");
      const json = await resp.json();
      setReport(json.site_report ? json.site_report : json);
      setTrend(json.trend || []);
      if (onDataUpdateRef && typeof onDataUpdateRef.current === "function") {
        onDataUpdateRef.current();
      }
    } catch (err) {
      setError(err.message);
      setReport(null);
      setTrend([]);
    } finally {
      setLoading(false);
    }
  }, [start, end, onDataUpdateRef]);


  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (onDataUpdateRef) {
      onDataUpdateRef.current = fetchData;
    }
  }, [fetchData, onDataUpdateRef]);

  const handleDownload = () => {
    if (!report || !report.generators) return;
    const rows = [
      ["Equipment Name", "Total Usage", "Total Cost"],
      ...report.generators.map(
        d => [d.generator_name, d.total_usage, d.total_cost]
      )
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = `generators_report_${start}_to_${end}.csv`;
    link.click();
  };

  const summary = (report && report.generators) ? getCostSummary(report.generators) : {};

  // Prepare data for pie chart
  const pieData = report && report.generators ? report.generators.map((gen, idx) => ({
    name: gen.generator_name || gen.generator_id,
    value: gen.total_cost || 0,
    usage: gen.total_usage || 0,
    fill: COLORS[idx % COLORS.length]
  })) : [];

  return (
    <div className="w-full min-h-screen bg-gradient-to-tr from-slate-100 via-white to-slate-100 p-6">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 max-w-8xl mx-auto"
      >
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-2xl shadow-lg flex items-center justify-center">
                <FaChartBar className="text-3xl text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                  Equipment Usage Analytics
                </h1>
                <p className="text-gray-600 text-sm mt-1">
                  Comprehensive fuel consumption and cost analysis across all sites
                </p>
              </div>
            </div>
            <motion.button
              onClick={fetchData}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
            >
              <FaSync className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Date Range Picker */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-3xl p-6 mb-6 shadow-lg border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0 max-w-8xl mx-auto"
      >
        <PeriodRangePicker start={start} end={end} setStart={setStart} setEnd={setEnd} />
        <motion.button
          disabled={!report || !report.generators || !report.generators.length}
          onClick={handleDownload}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FaDownload />
          <span>Download CSV</span>
        </motion.button>
      </motion.div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-60 max-w-8xl mx-auto">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Loading Report</h2>
          <p className="text-gray-600">Fetching equipment usage data...</p>
        </div>
      ) : error ? (
        <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-3xl p-8 text-red-700 text-center shadow-lg max-w-8xl mx-auto">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h3 className="text-xl font-bold mb-2">Error Loading Report</h3>
          <p>{error}</p>
        </div>
      ) : (
        <div className="space-y-8 max-w-8xl mx-auto">
          {/* Summary Cards - Enhanced Design */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
            {/* Card A - Orange */}
            <motion.div
              whileHover={{ y: -5, scale: 1.02 }}
              className="bg-gradient-to-br from-[#FF8C42] to-[#ff7520] rounded-xl shadow-lg p-6 text-white relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -mr-12 -mt-12"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-white opacity-5 rounded-full -ml-8 -mb-8"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <FaFire className="text-2xl" />
                  </div>
                  <div className="text-3xl font-black opacity-30">A</div>
                </div>
                <div className="text-3xl font-black mb-1">
                  {summary.total_usage ? summary.total_usage.toLocaleString("en-IN") : 0}L
                </div>
                <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
                  Total Fuel Consumed
                </div>
                <div className="mt-3 pt-3 border-t border-white border-opacity-20">
                  <div className="text-xs opacity-75">All Equipments</div>
                </div>
              </div>
            </motion.div>

            {/* Card B - Cyan */}
            <motion.div
              whileHover={{ y: -5, scale: 1.02 }}
              className="bg-gradient-to-br from-[#4ECDC4] to-[#3ab8af] rounded-xl shadow-lg p-6 text-white relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -mr-12 -mt-12"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-white opacity-5 rounded-full -ml-8 -mb-8"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <FaDollarSign className="text-2xl" />
                  </div>
                  <div className="text-3xl font-black opacity-30">B</div>
                </div>
                <div className="text-3xl font-black mb-1">
                  ₹{summary.total_cost ? summary.total_cost.toLocaleString("en-IN") : 0}
                </div>
                <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
                  Total Expenditure
                </div>
                <div className="mt-3 pt-3 border-t border-white border-opacity-20">
                  <div className="text-xs opacity-75">Fuel Costs</div>
                </div>
              </div>
            </motion.div>

            {/* Card C - Gray */}
            <motion.div
              whileHover={{ y: -5, scale: 1.02 }}
              className="bg-gradient-to-br from-[#C7C7C7] to-[#a8a8a8] rounded-xl shadow-lg p-6 text-white relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -mr-12 -mt-12"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-white opacity-5 rounded-full -ml-8 -mb-8"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <FaChartLine className="text-2xl" />
                  </div>
                  <div className="text-3xl font-black opacity-30">C</div>
                </div>
                <div className="text-3xl font-black mb-1">
                  ₹{summary.avg_cost_per_unit ? summary.avg_cost_per_unit.toFixed(2) : 0}
                </div>
                <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
                  Cost Efficiency
                </div>
                <div className="mt-3 pt-3 border-t border-white border-opacity-20">
                  <div className="text-xs opacity-75">Per Liter</div>
                </div>
              </div>
            </motion.div>

            {/* Card D - Dark Blue */}
            <motion.div
              whileHover={{ y: -5, scale: 1.02 }}
              className="bg-gradient-to-br from-[#45526C] to-[#323d52] rounded-xl shadow-lg p-6 text-white relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -mr-12 -mt-12"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-white opacity-5 rounded-full -ml-8 -mb-8"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <FaChartPie className="text-2xl" />
                  </div>
                  <div className="text-3xl font-black opacity-30">D</div>
                </div>
                <div className="text-xl font-black mb-1 truncate">
                  {summary.highest_site?.generator_name || "-"}
                </div>
                <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
                  Top Consumer
                </div>
                <div className="mt-3 pt-3 border-t border-white border-opacity-20">
                  <div className="text-xs opacity-75">
                    {summary.highest_site ? `₹${summary.highest_site.total_cost.toLocaleString("en-IN")}` : "N/A"}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Main Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Left: Pie Chart with Labels */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8"
            >
              <h3 className="text-xl font-black text-gray-900 mb-6 tracking-tight">Cost Distribution Analysis</h3>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="35%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={110}
                      fill="#8884d8"
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col space-y-3 ml-6">
                  {pieData.map((item, idx) => (
                    <div key={idx} className="flex items-center">
                      <div className="w-2 h-10 mr-2" style={{ backgroundColor: item.fill }}></div>
                      <div className="border-l-2 border-gray-300 pl-3">
                        <div className="text-2xl font-black text-gray-800">
                          {((item.value / summary.total_cost) * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-600 font-medium">{item.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-center text-xs text-gray-500 mt-4 leading-relaxed">
                Equipment cost distribution shows fuel expenditure allocation across different units, enabling better resource management and cost optimization strategies.
              </p>
            </motion.div>

            {/* Right: Area Chart */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8"
            >
              <h3 className="text-xl font-black text-gray-900 mb-6 tracking-tight">Usage Trend Over Time</h3>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="colorOrange" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF8C42" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#FF8C42" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCyan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4ECDC4" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#4ECDC4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorGray" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C7C7C7" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#C7C7C7" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#45526C" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#45526C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="energy" stackId="1" stroke="#FF8C42" fill="url(#colorOrange)" />
                  <Area type="monotone" dataKey="cost" stackId="1" stroke="#4ECDC4" fill="url(#colorCyan)" />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-center text-xs text-gray-500 mt-4 leading-relaxed">
                Historical fuel consumption pattern analysis reveals operational trends, peak usage periods, and opportunities for efficiency improvements across all equipment units.
              </p>
            </motion.div>
          </div>

          {/* Bar Chart Comparison */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 mb-6"
          >
            <h3 className="text-xl font-black text-gray-900 mb-6 tracking-tight">Equipment Performance Comparison</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={pieData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} />
                <Tooltip
                  formatter={(value) => `${value.toLocaleString("en-IN")} L`}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar dataKey="usage" radius={[6, 6, 0, 0]}>
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-center text-xs text-gray-500 mt-4 leading-relaxed">
              Comparative analysis of fuel consumption levels across equipment units, identifying high-usage equipment and operational efficiency variations for targeted maintenance planning.
            </p>
          </motion.div>

          {/* Data Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
          >
            <div className="px-8 py-6 border-b border-gray-200">
              <h3 className="text-2xl font-black text-gray-900 tracking-tight">Detailed Usage Report</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Site</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Equipment</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Fuel (L)</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Cost (₹)</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Label</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {report && report.generators && report.generators.map((row, idx) => (
                    <tr key={row.generator_id} className="hover:bg-blue-50 transition-colors duration-200">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-1 h-8 mr-3" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                          <span className="font-semibold text-gray-900 text-sm">{row.site_name || "-"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900 text-sm">{row.generator_name}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-lg font-bold" style={{ color: COLORS[idx % COLORS.length] }}>
                          {(row.total_usage || 0).toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-lg font-bold text-gray-800">
                          ₹{(row.total_cost || 0).toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block px-4 py-1 rounded-full text-xs font-bold" style={{
                          backgroundColor: COLORS[idx % COLORS.length],
                          color: 'white'
                        }}>
                          {String.fromCharCode(65 + (idx % 4))}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!report || !report.generators || !report.generators.length) && (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-gray-500">
                        <div className="text-5xl mb-4">📊</div>
                        <p className="text-lg">No data available for selected period</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
