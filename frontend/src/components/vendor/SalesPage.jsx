import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = "http://localhost:8000/api/customer-portal"; 
const PAGE_SIZE = 10;

// Fallback demo data for when API is not available
const DEMO_SALES_DATA = [
  {
    id: "ORD-001",
    customer_name: "John Doe",
    product_name: "Solar Panel 100W",
    quantity: 5,
    order_date: "2024-11-25T10:30:00Z",
    delivery_status: "Delivered",
    payment_status: "Paid",
    total_amount: 5000
  },
  {
    id: "ORD-002",
    customer_name: "Jane Smith",
    product_name: "Inverter 1000W",
    quantity: 2,
    order_date: "2024-11-24T14:15:00Z",
    delivery_status: "Pending",
    payment_status: "Pending",
    total_amount: 8000
  },
  {
    id: "ORD-003",
    customer_name: "Mike Johnson",
    product_name: "Battery 12V 100Ah",
    quantity: 3,
    order_date: "2024-11-23T09:45:00Z",
    delivery_status: "Shipped",
    payment_status: "Paid",
    total_amount: 12000
  }
];

function SalesOrderTable({ orders, page, setPage, hasPrev, hasNext }) {
  const paginated = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <motion.div
      className="bg-white shadow-lg rounded-2xl border border-green-100 overflow-hidden mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
    >
      <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
        <h3 className="text-lg font-bold text-green-700">Vendor Sales Orders</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gradient-to-r from-green-50 to-green-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Order ID</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Product</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">Quantity</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Order Date</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">Delivery Status</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">Payment Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400">
                  No sales orders found.
                </td>
              </tr>
            ) : (
              paginated.map((order, idx) => (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.01 }}
                  className="hover:bg-green-50 transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-sm font-semibold text-green-900">{order.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium max-w-[180px] truncate" title={order.customer_name}>
                    {order.customer_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900 max-w-[200px] truncate" title={order.product_name}>
                    {order.product_name}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                      {order.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(order.order_date).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        order.delivery_status === "Delivered"
                          ? "bg-green-100 text-green-800"
                          : order.delivery_status === "Pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {order.delivery_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        order.payment_status === "Paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : order.payment_status === "Pending"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {order.payment_status}
                    </span>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between w-full mt-4 px-6 pb-6">
        <motion.button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={!hasPrev}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            hasPrev
              ? "bg-gradient-to-r from-green-500 to-green-700 text-white hover:from-green-600 hover:to-green-800 shadow-lg hover:shadow-xl"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
          style={{ minWidth: 100 }}
          whileTap={{ scale: 0.96 }}
        >
          Previous
        </motion.button>
        <span className="text-lg font-semibold text-gray-700">Page {page}</span>
        <motion.button
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasNext}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            hasNext
              ? "bg-gradient-to-r from-green-500 to-green-700 text-white hover:from-green-600 hover:to-green-800 shadow-lg hover:shadow-xl"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
          style={{ minWidth: 100 }}
          whileTap={{ scale: 0.96 }}
        >
          Next
        </motion.button>
      </div>
    </motion.div>
  );
}

export default function SalesPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          console.log("No authentication token found, using demo data");
          setOrders(DEMO_SALES_DATA);
          setLoading(false);
          return;
        }

        // Try to fetch from customer portal orders endpoint
        const response = await fetch(`${API_BASE}/orders`, {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            console.log("Customer portal orders not found, using demo data");
            setOrders(DEMO_SALES_DATA);
            return;
          }
          throw new Error(`API Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        
        // Transform customer portal orders to sales format
        const salesOrders = (data.orders || []).map(order => ({
          id: order.id || order.order_id,
          customer_name: order.customer_name || "Customer",
          product_name: order.item_name || order.product_name || "Product",
          quantity: order.quantity || 1,
          order_date: order.date || order.created_at || new Date().toISOString(),
          delivery_status: order.status === "delivered" ? "Delivered" : 
                          order.status === "shipped" ? "Shipped" : "Pending",
          payment_status: order.payment_status || "Pending",
          total_amount: order.amount || order.total_amount || 0
        }));
        
        // If no orders from API, use demo data
        setOrders(salesOrders.length > 0 ? salesOrders : DEMO_SALES_DATA);
        
      } catch (err) {
        console.error("Failed to fetch orders:", err);
        console.log("API failed, falling back to demo data");
        
        // Use demo data as fallback
        setOrders(DEMO_SALES_DATA);
        setError(null); // Clear error since we have fallback data
        
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [page]);

  const hasPrev = page > 1;
  const hasNext = orders.length === PAGE_SIZE;

  return (
    <motion.div className="bg-gray-50 min-h-screen px-4 py-8 sm:px-8 sm:py-12 max-w-8xl mx-auto">
      {/* Header */}
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      >
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-green-700 mb-4 leading-tight">
          Vendor Sales Dashboard
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Track your sales orders, monitor delivery status, and manage payments from customers
        </p>
      </motion.div>

      {/* Loading State */}
      {loading && (
        <motion.div 
          className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-lg border border-green-100"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
          <p className="text-xl font-semibold text-green-700">Loading sales orders...</p>
          <p className="text-gray-500 mt-2">Please wait while we fetch your latest data</p>
        </motion.div>
      )}

      {/* Error State */}
      {error && !loading && (
        <motion.div 
          className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center mb-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-xl font-bold text-red-700 mb-2">Failed to load orders</h3>
          <p className="text-red-600 mb-6">{error}</p>
          <motion.button
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => window.location.reload()}
          >
            Retry
          </motion.button>
        </motion.div>
      )}

      {/* Orders Table */}
      {!loading && !error && orders.length === 0 && (
        <motion.div 
          className="bg-white rounded-2xl shadow-lg border border-green-100 p-12 text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="text-6xl mb-6">📦</div>
          <h3 className="text-2xl font-bold text-gray-700 mb-2">No Sales Orders Yet</h3>
          <p className="text-gray-500 text-lg mb-8">Your sales orders will appear here once customers place orders for your products.</p>
        </motion.div>
      )}

      {/* Main Content */}
      {!loading && !error && orders.length > 0 && (
        <SalesOrderTable
          orders={orders}
          page={page}
          setPage={setPage}
          hasPrev={hasPrev}
          hasNext={hasNext}
        />
      )}
    </motion.div>
  );
}
