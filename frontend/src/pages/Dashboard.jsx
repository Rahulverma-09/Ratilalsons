import React, { useEffect, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";
import { useNavigate } from "react-router-dom";
Chart.register(...registerables);

const API_BASE = "http://localhost:8000/api";

function calcTrend(current, previous) {
  if (typeof current !== "number" || typeof previous !== "number" || previous === 0)
    return { trend: "—", trendDirection: "positive" };
  const delta = current - previous;
  const trend = (delta >= 0 ? "+" : "") + Math.round((delta / previous) * 100) + "%";
  return { trend, trendDirection: delta >= 0 ? "positive" : "negative" };
}

export default function ClientDashboard() {
  const navigate = useNavigate();
  const energyRef = useRef(null);
  const attendanceRef = useRef(null);
  const salesRef = useRef(null);
  const ordersRef = useRef(null);
  const energyChartRef = useRef(null);
  const attendanceChartRef = useRef(null);
  const salesChartRef = useRef(null);
  const ordersChartRef = useRef(null);

  const [energyMode, setEnergyMode] = useState("all");
  const [dashboardCards, setDashboardCards] = useState([
    {
      key: "total_inventory",
      title: "Total Inventory Items",
      value: "—",
      trend: "—",
      trendDirection: "positive",
      icon: "boxes",
      iconColor: "bg-blue-500",
      note: "vs last week"
    },
    {
      key: "attendance",
      title: "Today's Attendance",
      value: "—",
      trend: "—",
      trendDirection: "positive",
      icon: "users",
      iconColor: "bg-green-500",
      note: "of registered staff"
    },
    {
      key: "revenue",
      title: "Monthly Revenue",
      value: "—",
      trend: "—",
      trendDirection: "positive",
      icon: "rupee-sign",
      iconColor: "bg-purple-500",
      note: "vs last month"
    },
    {
      key: "energy_used",
      title: "Energy Used (kWh)",
      value: "—",
      trend: "—",
      trendDirection: "positive",
      icon: "bolt",
      iconColor: "bg-yellow-500",
      note: "Select period"
    }
  ]);
  
  const [energyData, setEnergyData] = useState({ labels: [], usage: [], cost: [], totalUsage: 0 });
  const [attendanceData, setAttendanceData] = useState({ labels: [], present: [], absent: [] });
  const [salesData, setSalesData] = useState({ labels: [], sales: [], orders: [] });
  const [ordersData, setOrdersData] = useState({ labels: [], pending: [], completed: [], cancelled: [] });
  const [inventoryData, setInventoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attendanceFilter, setAttendanceFilter] = useState("all"); // all, 7, 14, 30 days

  // Function to fetch attendance data based on filter
  const fetchAttendanceData = async (filter = attendanceFilter) => {
    const token = localStorage.getItem("access_token");
    try {
      const url = filter === "all" 
        ? `${API_BASE}/hr/attendance/statistics` 
        : `${API_BASE}/hr/attendance/statistics?days=${filter}`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const attendance = await response.json();
        
        // Update attendance card
        const currentAttendance = attendance?.today_attendance_percentage || 0;
        const prevAttendance = attendance?.yesterday_attendance_percentage || 0;
        const { trend: attTrend, trendDirection: attDirection } = calcTrend(currentAttendance, prevAttendance);
        
        setDashboardCards(prev => prev.map(card => 
          card.key === "attendance" 
            ? { ...card, value: `${currentAttendance}%`, trend: attTrend, trendDirection: attDirection }
            : card
        ));

        // Set attendance chart data
        const attendanceTrend = attendance?.daily_trend || [];
        setAttendanceData({
          labels: attendanceTrend.map(d => new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })),
          present: attendanceTrend.map(d => d.present || 0),
          absent: attendanceTrend.map(d => d.absent || 0)
        });
      }
    } catch (error) {
      console.error("Error fetching attendance data:", error);
    }
  };

  // Fetch attendance data when filter changes
  useEffect(() => {
    fetchAttendanceData();
  }, [attendanceFilter]);

  // Fetch all dashboard data dynamically
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    setLoading(true);
    
    // Fetch inventory stats & trend (excluding attendance - it's handled separately)
    Promise.all([
      fetch(`${API_BASE}/stock/products-trend?period_days=7`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(`${API_BASE}/stock/products`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(`${API_BASE}/invoices/statistics?period=monthly`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(`${API_BASE}/orders/statistics?days=30`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ])
    .then(async ([inventoryRes, productsRes, revenueRes, ordersRes]) => {
      const [inventoryData, products, revenue, orders] = await Promise.all([
        inventoryRes.ok ? inventoryRes.json() : {},
        productsRes.ok ? productsRes.json() : [],
        revenueRes.ok ? revenueRes.json() : {},
        ordersRes.ok ? ordersRes.json() : {}
      ]);

      // Update dashboard cards
      const currentVal = inventoryData?.total_present_products || 0;
      const prevVal = inventoryData?.previous_total_present_products || 0;
      const { trend: invTrend, trendDirection: invDirection } = calcTrend(currentVal, prevVal);
      
      const currentRevenue = revenue?.current_month_revenue || 0;
      const prevRevenue = revenue?.previous_month_revenue || 0;
      const { trend: revTrend, trendDirection: revDirection } = calcTrend(currentRevenue, prevRevenue);

      setDashboardCards(cards => cards.map(card => {
        switch(card.key) {
          case "total_inventory":
            return { ...card, value: currentVal, trend: invTrend, trendDirection: invDirection };
          case "revenue":
            return { ...card, value: `₹${(currentRevenue/100000).toFixed(1)}L`, trend: revTrend, trendDirection: revDirection };
          default:
            return card;
        }
      }));

      // Set inventory data for cards
      setInventoryData(products.slice(0, 8).map(prod => ({
        item: prod.name,
        available: (prod.warehouse_qty || 0) +
          (prod.depot_qty && typeof prod.depot_qty === "object"
            ? Object.values(prod.depot_qty).reduce((a, b) => a + b, 0)
            : 0),
        critical: prod.low_stock_threshold !== undefined &&
          ((prod.warehouse_qty || 0) + (prod.depot_qty && typeof prod.depot_qty === "object"
            ? Object.values(prod.depot_qty).reduce((a, b) => a + b, 0)
            : 0)) <= prod.low_stock_threshold,
        icon: "box",
        category: prod.category,
        price: prod.price || 0
      })));

      // Set sales chart data
      const salesTrend = revenue?.daily_trend || [];
      setSalesData({
        labels: salesTrend.map(d => new Date(d.date).toLocaleDateString('en-US', { day: 'numeric' })),
        sales: salesTrend.map(d => d.amount || 0),
        orders: salesTrend.map(d => d.orders_count || 0)
      });

      // Set orders status data
      setOrdersData({
        labels: ['Pending', 'Processing', 'Completed', 'Cancelled'],
        pending: [orders?.pending || 0],
        completed: [orders?.completed || 0],
        cancelled: [orders?.cancelled || 0]
      });

      setLoading(false);
    })
    .catch(e => {
      console.error("Dashboard data fetch failed:", e);
      setLoading(false);
    });

    // Fetch initial attendance data
    fetchAttendanceData("all");
  }, []);

  // Dynamic energy usage trend/stats (Authorization header inline)
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const windowDays = 7;
    const today = new Date().toISOString().slice(0, 10);

    if (energyMode === "all") {
      fetch(`${API_BASE}/generators-utilities/reports?start=1970-01-01&end=${today}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(res => {
          const trendArr = res?.trend || [];
          const totalAllTime = trendArr.reduce((a, b) => a + (b.energy || 0), 0);
          setDashboardCards(cards =>
            cards.map(card =>
              card.key === "energy_used"
                ? { ...card, value: totalAllTime, note: "All Time (Total kWh)", trend: "+0%", trendDirection: undefined }
                : card
            )
          );
          setEnergyData({
            labels: trendArr.map(t => t.date?.slice(0, 10)),
            usage: trendArr.map(t => t.energy || 0),
            cost: trendArr.map(t => t.cost || 0),
            totalUsage: totalAllTime
          });
        })
        .catch(e => console.error("Energy fetch failed:", e.message));
      return;
    }

    const prevStart = new Date();
    prevStart.setDate(prevStart.getDate() - 2 * windowDays + 1);
    fetch(`${API_BASE}/generators-utilities/reports?start=${encodeURIComponent(prevStart.toISOString().slice(0, 10))}&end=${today}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(res => {
        const trendArr = res?.trend || [];
        const prevTrend = trendArr.slice(0, windowDays);
        const currTrend = trendArr.slice(windowDays, windowDays * 2);
        const totalPrev = prevTrend.reduce((a, b) => a + (b.energy || 0), 0);
        const totalNow = currTrend.reduce((a, b) => a + (b.energy || 0), 0);
        const { trend, trendDirection } = calcTrend(totalNow, totalPrev);
        setDashboardCards(cards => cards.map(card => {
          if (card.key === "energy_used") {
            return { ...card, value: totalNow, note: `Last ${windowDays} days`, trend, trendDirection }
          }
          return card;
        }));
        setEnergyData({
          labels: currTrend.map(t => t.date?.slice(0,10)),
          usage: currTrend.map(t => t.energy || 0),
          cost: currTrend.map(t => t.cost || 0),
          totalUsage: totalNow
        });
      })
      .catch(e => console.error("Energy fetch failed:", e.message));
  }, [energyMode]);

  // Chart rendering with beautiful modern designs
  useEffect(() => {
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          labels: { 
            font: { size: 12, family: "Inter, sans-serif" }, 
            color: "#374151",
            usePointStyle: true,
            padding: 20
          } 
        },
        tooltip: { 
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          titleColor: "#1f2937",
          bodyColor: "#374151",
          borderColor: "#e5e7eb",
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true
        }
      },
      scales: {
        x: { 
          grid: { display: false }, 
          ticks: { font: { size: 11 }, color: "#6b7280" },
          border: { display: false }
        },
        y: { 
          grid: { color: "#f3f4f6", lineWidth: 1 }, 
          ticks: { font: { size: 11 }, color: "#6b7280" },
          border: { display: false },
          beginAtZero: true
        }
      }
    };

    // Energy Usage Chart
    if (energyRef.current && energyData.labels.length) {
      if (energyChartRef.current) energyChartRef.current.destroy();
      energyChartRef.current = new Chart(energyRef.current, {
        type: "line",
        data: {
          labels: energyData.labels,
          datasets: [
            {
              label: "Energy Used (kWh)",
              data: energyData.usage,
              borderColor: "#3b82f6",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              borderWidth: 3,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "#3b82f6",
              pointBorderColor: "#ffffff",
              pointBorderWidth: 2,
              pointRadius: 5
            },
            {
              label: "Cost (₹)",
              data: energyData.cost,
              borderColor: "#f59e0b",
              backgroundColor: "rgba(245, 158, 11, 0.1)",
              borderWidth: 3,
              fill: false,
              tension: 0.4,
              pointBackgroundColor: "#f59e0b",
              pointBorderColor: "#ffffff",
              pointBorderWidth: 2,
              pointRadius: 5
            }
          ]
        },
        options: chartOptions
      });
    }

    // Attendance Chart (Area Chart)
    if (attendanceRef.current && attendanceData.labels.length) {
      if (attendanceChartRef.current) attendanceChartRef.current.destroy();
      attendanceChartRef.current = new Chart(attendanceRef.current, {
        type: "line",
        data: {
          labels: attendanceData.labels,
          datasets: [
            {
              label: "Present",
              data: attendanceData.present,
              borderColor: "#10b981",
              backgroundColor: "rgba(16, 185, 129, 0.2)",
              borderWidth: 3,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "#10b981",
              pointBorderColor: "#ffffff",
              pointBorderWidth: 2,
              pointRadius: 4
            },
            {
              label: "Absent",
              data: attendanceData.absent,
              borderColor: "#ef4444",
              backgroundColor: "rgba(239, 68, 68, 0.2)",
              borderWidth: 3,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "#ef4444",
              pointBorderColor: "#ffffff",
              pointBorderWidth: 2,
              pointRadius: 4
            }
          ]
        },
        options: chartOptions
      });
    }

    // Sales Trend Chart (Bar + Line)
    if (salesRef.current && salesData.labels.length) {
      if (salesChartRef.current) salesChartRef.current.destroy();
      salesChartRef.current = new Chart(salesRef.current, {
        type: "bar",
        data: {
          labels: salesData.labels,
          datasets: [
            {
              label: "Sales (₹)",
              data: salesData.sales,
              backgroundColor: "rgba(139, 69, 19, 0.8)",
              borderColor: "#8b4513",
              borderWidth: 0,
              borderRadius: 6,
              yAxisID: 'y'
            },
            {
              label: "Orders",
              type: "line",
              data: salesData.orders,
              borderColor: "#ec4899",
              backgroundColor: "rgba(236, 72, 153, 0.1)",
              borderWidth: 3,
              fill: false,
              tension: 0.4,
              pointBackgroundColor: "#ec4899",
              pointBorderColor: "#ffffff",
              pointBorderWidth: 2,
              pointRadius: 5,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          ...chartOptions,
          scales: {
            ...chartOptions.scales,
            y1: {
              type: 'linear',
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { font: { size: 11 }, color: "#ec4899" },
              border: { display: false }
            }
          }
        }
      });
    }

    // Orders Status Chart (Doughnut)
    if (ordersRef.current && ordersData.labels.length) {
      if (ordersChartRef.current) ordersChartRef.current.destroy();
      ordersChartRef.current = new Chart(ordersRef.current, {
        type: "doughnut",
        data: {
          labels: ordersData.labels,
          datasets: [{
            data: [
              ordersData.pending[0] || 0,
              ordersData.completed[0] || 0,
              ordersData.cancelled[0] || 0,
              Math.max(0, (ordersData.completed[0] || 0) * 0.3) // Processing (estimated)
            ],
            backgroundColor: [
              "#f59e0b",
              "#10b981", 
              "#ef4444",
              "#6366f1"
            ],
            borderWidth: 0,
            cutout: "70%"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { 
              position: "bottom",
              labels: { 
                font: { size: 11 }, 
                padding: 15,
                usePointStyle: true
              }
            }
          }
        }
      });
    }

    return () => {
      if (energyChartRef.current) energyChartRef.current.destroy();
      if (attendanceChartRef.current) attendanceChartRef.current.destroy();
      if (salesChartRef.current) salesChartRef.current.destroy();
      if (ordersChartRef.current) ordersChartRef.current.destroy();
    };
  }, [energyData, attendanceData, salesData, ordersData]);

  function handleInventoryClick() {
    navigate("/inventory");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 px-4 lg:px-6 pb-8">
      {loading && (
        <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      )}

      {/* Dashboard Header with Gradient */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-2xl shadow-lg mb-8 text-white">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Dashboard Overview</h1>
            <p className="text-blue-100">Welcome back! Here's what's happening today.</p>
          </div>
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <select
              className="bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded-lg px-4 py-2 text-white font-medium focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
              value={energyMode}
              onChange={e => setEnergyMode(e.target.value)}
            >
              <option value="period" className="text-gray-800">Last 7 Days</option>
              <option value="all" className="text-gray-800">All Time</option>
            </select>
            <div className="text-sm text-blue-100">{new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* Dashboard Cards with Modern Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {dashboardCards.map((stat) => (
          <div key={stat.title}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 ${stat.iconColor} rounded-xl flex items-center justify-center shadow-lg`}>
                <i className={`fas fa-${stat.icon} text-white text-lg`} />
              </div>
              {stat.trend && stat.trend !== "—" && (
                <span className={`flex items-center text-sm font-semibold px-3 py-1 rounded-full ${
                  stat.trendDirection === "positive" 
                    ? "text-green-700 bg-green-100" 
                    : "text-red-700 bg-red-100"
                }`}>
                  <i className={`fas fa-arrow-${stat.trendDirection === "positive" ? "up" : "down"} mr-1 text-xs`} />
                  {stat.trend}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{stat.note}</p>
              <h3 className="text-lg font-semibold text-gray-900">{stat.title}</h3>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics Grid with Modern Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Energy Usage Chart */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Energy Usage & Cost</h3>
              <p className="text-sm text-gray-500">{energyMode === "all" ? "All Time Trend" : "Last 7 Days"}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Usage</span>
              <div className="w-3 h-3 bg-yellow-500 rounded-full ml-3"></div>
              <span className="text-sm text-gray-600">Cost</span>
            </div>
          </div>
          <div className="h-64">
            <canvas ref={energyRef} />
          </div>
        </div>

        {/* Attendance Trend Chart */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Attendance Trend</h3>
              <p className="text-sm text-gray-500">
                {attendanceFilter === "all" ? "All time attendance data" : `Last ${attendanceFilter} days`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <select
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={attendanceFilter}
                onChange={e => setAttendanceFilter(e.target.value)}
              >
                <option value="all">All Time</option>
                <option value="7">Last 7 Days</option>
                <option value="14">Last 14 Days</option>
                <option value="30">Last 30 Days</option>
              </select>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Present</span>
                <div className="w-3 h-3 bg-red-500 rounded-full ml-3"></div>
                <span className="text-sm text-gray-600">Absent</span>
              </div>
            </div>
          </div>
          <div className="h-64">
            <canvas ref={attendanceRef} />
          </div>
        </div>

        {/* Sales & Orders Chart */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Sales & Orders</h3>
              <p className="text-sm text-gray-500">Revenue and order trends</p>
            </div>
          </div>
          <div className="h-64">
            <canvas ref={salesRef} />
          </div>
        </div>

        {/* Order Status Chart */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Order Status</h3>
              <p className="text-sm text-gray-500">Current order distribution</p>
            </div>
          </div>
          <div className="h-64 flex items-center justify-center">
            <canvas ref={ordersRef} style={{ maxWidth: '250px', maxHeight: '250px' }} />
          </div>
        </div>
      </div>

      {/* Inventory Overview with Modern Card Design */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Inventory Overview</h3>
            <p className="text-gray-500">Current stock levels and alerts</p>
          </div>
          <button
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
            onClick={handleInventoryClick}
          >
            <i className="fas fa-external-link-alt mr-2"></i>
            View All Items
          </button>
        </div>
        
        {inventoryData.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <i className="fas fa-boxes text-2xl text-gray-400"></i>
            </div>
            <p className="text-gray-500">No inventory data available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {inventoryData.map((item) => (
              <div
                key={item.item}
                className={`p-4 rounded-xl border-2 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1 cursor-pointer ${
                  item.critical 
                    ? "border-red-200 bg-gradient-to-br from-red-50 to-pink-50 hover:border-red-300" 
                    : "border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 hover:border-blue-300"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    item.critical ? "bg-red-500" : "bg-blue-500"
                  } text-white shadow-lg`}>
                    <i className={`fas fa-${item.icon} text-sm`} />
                  </div>
                  {item.critical && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      LOW
                    </span>
                  )}
                </div>
                <h4 className="font-semibold text-gray-900 text-sm mb-1 truncate">{item.item}</h4>
                <p className="text-2xl font-bold text-gray-900 mb-1">{item.available}</p>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">{item.category}</span>
                  {item.price > 0 && (
                    <span className="text-green-600 font-medium">₹{item.price}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
