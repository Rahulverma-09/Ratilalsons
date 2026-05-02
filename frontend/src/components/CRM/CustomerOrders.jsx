// CustomerOrdersPage.jsx
import React, { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FeedbackSystem from "./FeedbackSystem";
import ComplaintsModule from "./ComplaintsModule";
import { customerPortalAPI, API_URL } from "../../config";

export default function CustomerOrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState("cart");
  const [search, setSearch] = useState("");
  
  // API state management
  const [orders, setOrders] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState({});

  // Auth token (get from localStorage/context)
  const token = localStorage.getItem('access_token');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Fetch customer orders from API
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(customerPortalAPI.getOrders, {
        headers
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (err) {
      setError('Failed to load orders: ' + err.message);
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch shopping cart from API
  const fetchCart = async () => {
    try {
      const response = await fetch(customerPortalAPI.getCart, {
        headers
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch cart');
      }
      
      const data = await response.json();
      setCartItems(data.items || []);
    } catch (err) {
      console.error('Failed to load cart:', err);
    }
  };

  // Add item to cart
  const addToCart = async (productId, quantity = 1) => {
    try {
      const response = await fetch(customerPortalAPI.addToCart, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          product_id: productId,
          quantity: quantity
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add to cart');
      }

      const data = await response.json();
      alert(data.message || 'Item added to cart successfully!');
      
      // Refresh cart
      await fetchCart();
    } catch (err) {
      alert('Failed to add to cart: ' + err.message);
    }
  };

  // Update cart item quantity
  const updateCartItem = async (itemId, quantity) => {
    try {
      const response = await fetch(customerPortalAPI.updateCartItem.replace('{item_id}', itemId), {
        method: 'PUT',
        headers,
        body: JSON.stringify({ quantity })
      });

      if (!response.ok) {
        throw new Error('Failed to update cart');
      }

      // Refresh cart
      await fetchCart();
    } catch (err) {
      alert('Failed to update cart: ' + err.message);
    }
  };

  // Clear cart
  const clearCart = async () => {
    try {
      const response = await fetch(customerPortalAPI.clearCart, {
        method: 'DELETE',
        headers
      });

      if (!response.ok) {
        throw new Error('Failed to clear cart');
      }

      await fetchCart();
      alert('Cart cleared successfully!');
    } catch (err) {
      alert('Failed to clear cart: ' + err.message);
    }
  };

  // Checkout cart
  const checkout = async () => {
    try {
      setLoading(true);
      const response = await fetch(customerPortalAPI.checkout, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        },
        body: new URLSearchParams({
          delivery_address: "123 Main St, City, State 12345", // Get from form
          payment_method: "Credit Card",
          notes: "Standard delivery please"
        })
      });

      if (!response.ok) {
        throw new Error('Checkout failed');
      }

      const data = await response.json();
      alert(`Order placed successfully! Order ID: ${data.order_id}`);
      
      // Refresh orders and clear cart
      await fetchOrders();
      await fetchCart();
    } catch (err) {
      alert('Checkout failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get order details
  const getOrderDetails = async (orderId) => {
    try {
      setLoading(true);
      const response = await fetch(customerPortalAPI.getOrderDetails.replace('{order_id}', orderId), {
        headers
      });

      if (!response.ok) {
        throw new Error('Failed to fetch order details');
      }

      const data = await response.json();
      setOrderDetails(data);
    } catch (err) {
      alert('Failed to load order details: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate invoice from order
  const generateInvoiceFromOrder = async (order, showSuccessMessage = true) => {
    try {
      setInvoiceLoading(prev => ({ ...prev, [order.order_id]: true }));
      
      const invoiceData = {
        customer_name: order.customer_name || 'Customer',
        customer_email: order.customer_email || '',
        customer_phone: order.customer_phone || '',
        customer_address: order.delivery_address || '',
        order_id: order.order_id,
        items: order.items || [{
          description: `Order #${order.order_id}`,
          quantity: 1,
          unit_price: order.total_amount || 0
        }],
        subtotal: order.total_amount || 0,
        tax_rate: 18,
        tax_amount: (order.total_amount || 0) * 0.18,
        total_amount: (order.total_amount || 0) * 1.18,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'draft'
      };
      
      const response = await fetch(`${API_URL}/customer/invoice/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(invoiceData)
      });
      
      if (response.ok) {
        const result = await response.json();
        if (showSuccessMessage) {
          alert('Invoice generated successfully!');
        }
        return result;
      } else {
        throw new Error('Failed to generate invoice');
      }
    } catch (err) {
      console.error('Failed to generate invoice:', err);
      if (showSuccessMessage) {
        alert('Failed to generate invoice. Please try again.');
      }
      throw err; // Re-throw to handle in calling function
    } finally {
      setInvoiceLoading(prev => ({ ...prev, [order.order_id]: false }));
    }
  };

  // Download invoice PDF
  const downloadInvoicePDF = async (order) => {
    try {
      setInvoiceLoading(prev => ({ ...prev, [`download_${order.order_id}`]: true }));
      
      // First generate invoice to get invoice_id (without showing success message)
      const invoiceData = {
        customer_name: order.customer_name || 'Customer',
        customer_email: order.customer_email || '',
        customer_phone: order.customer_phone || '',
        customer_address: order.delivery_address || '',
        order_id: order.order_id,
        items: order.items || [{
          description: `Order #${order.order_id}`,
          quantity: 1,
          unit_price: order.total_amount || 0
        }],
        subtotal: order.total_amount || 0,
        tax_rate: 18,
        tax_amount: (order.total_amount || 0) * 0.18,
        total_amount: (order.total_amount || 0) * 1.18,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'draft'
      };
      
      const invoiceResponse = await fetch(`${API_URL}/customer/invoice/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(invoiceData)
      });

      if (!invoiceResponse.ok) {
        throw new Error('Failed to generate invoice');
      }

      const invoice = await invoiceResponse.json();
      
      if (invoice && invoice.invoice_id) {
        // Download PDF using the download endpoint
        const downloadResponse = await fetch(`${API_URL}/customer/invoice/${invoice.invoice_id}/download`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (downloadResponse.ok) {
          // Get the PDF blob
          const blob = await downloadResponse.blob();
          console.log('PDF blob received:', blob.size, 'bytes, type:', blob.type);
          
          // Check if blob has content
          if (blob.size > 0) {
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Invoice_${order.order_id}.pdf`;
            link.style.display = 'none';
            document.body.appendChild(link);
            
            console.log('Triggering download for:', link.download);
            link.click();
            
            // Cleanup after a short delay
            setTimeout(() => {
              if (document.body.contains(link)) {
                document.body.removeChild(link);
              }
              window.URL.revokeObjectURL(url);
              console.log('Download cleanup completed');
            }, 1000);
            
            alert('Invoice PDF downloaded successfully!');
          } else {
            throw new Error('Empty PDF file received');
          }
        } else {
          throw new Error(`Failed to download PDF: ${downloadResponse.status}`);
        }
      } else {
        throw new Error('Invalid invoice response');
      }
    } catch (err) {
      console.error('Failed to download invoice:', err);
      alert(`Failed to download invoice: ${err.message}`);
    } finally {
      setInvoiceLoading(prev => ({ ...prev, [`download_${order.order_id}`]: false }));
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchOrders();
    fetchCart();
  }, []);

  // Calculate stats from API data
  const totalOrders = orders.length;
  const lastOrderDate = orders.length > 0 ? new Date(orders[0]?.order_date).toLocaleDateString() : "No orders";
  const totalSpent = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const totalCartItems = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalCartValue = cartItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.price || 0)), 0);

  const filteredOrders = orders.filter(
    (order) =>
      order.order_id?.toLowerCase().includes(search.toLowerCase()) ||
      order.status?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCart = cartItems.filter(
    (item) =>
      item.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div 
      className="bg-gray-50 min-h-screen p-4 sm:p-8 max-w-8xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Top Title */}
      <motion.div
        className="py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8"
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      >
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-left text-purple-700 leading-7 drop-shadow">
            Manage All Orders
          </h1>
          <p className="text-gray-500 mt-1 text-left text-xs sm:text-sm md:text-base">
            Manage your cart, orders, feedback and complaints.
          </p>
        </div>
        <div className="mt-3 sm:mt-0 sm:ml-4 w-full sm:w-auto">
          <motion.input
            type="text"
            placeholder="Search orders, products or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-400 w-full sm:w-80 text-sm shadow-inner"
            whileFocus={{ scale: 1.02, borderColor: "#a855f7" }}
          />
        </div>
      </motion.div>

      {/* Stats Cards - Compact Grid */}
      <motion.div 
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="bg-white p-6 rounded-xl shadow-lg border border-purple-100 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h18M3 12h18M3 17h18" />
              </svg>
            </div>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-semibold">Orders</span>
          </div>
          <div className="text-2xl font-bold text-purple-700">{totalOrders}</div>
          <div className="text-sm text-gray-500">Total Orders</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-purple-100 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold">Cart</span>
          </div>
          <div className="text-2xl font-bold text-emerald-700">{totalCartItems}</div>
          <div className="text-sm text-gray-500">Cart Items</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-purple-100 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">Recent</span>
          </div>
          <div className="text-lg font-bold text-blue-700">{lastOrderDate}</div>
          <div className="text-sm text-gray-500">Last Order</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border border-purple-100 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-amber-100 rounded-lg">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 0V4m0 10v6" />
              </svg>
            </div>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">Spent</span>
          </div>
          <div className="text-2xl font-bold text-amber-700">₹{totalSpent.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Total Spent</div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="bg-white shadow-lg rounded-2xl border border-purple-100 mb-6 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <motion.button
            className={`flex-1 py-4 px-6 font-semibold text-sm focus:outline-none transition-all ${
              activeTab === "cart"
                ? "bg-purple-50 border-b-2 border-purple-500 text-purple-700"
                : "text-gray-600 hover:text-purple-700 hover:bg-purple-50"
            }`}
            onClick={() => setActiveTab("cart")}
            whileTap={{ scale: 0.98 }}
          >
            My Cart
          </motion.button>
          <motion.button
            className={`flex-1 py-4 px-6 font-semibold text-sm focus:outline-none transition-all ${
              activeTab === "orders"
                ? "bg-purple-50 border-b-2 border-purple-500 text-purple-700"
                : "text-gray-600 hover:text-purple-700 hover:bg-purple-50"
            }`}
            onClick={() => setActiveTab("orders")}
            whileTap={{ scale: 0.98 }}
          >
            My Orders
          </motion.button>
          <motion.button
            className={`flex-1 py-4 px-6 font-semibold text-sm focus:outline-none transition-all ${
              activeTab === "feedback"
                ? "bg-purple-50 border-b-2 border-purple-500 text-purple-700"
                : "text-gray-600 hover:text-purple-700 hover:bg-purple-50"
            }`}
            onClick={() => setActiveTab("feedback")}
            whileTap={{ scale: 0.98 }}
          >
            Feedback
          </motion.button>
          <motion.button
            className={`flex-1 py-4 px-6 font-semibold text-sm focus:outline-none transition-all ${
              activeTab === "complaints"
                ? "bg-purple-50 border-b-2 border-purple-500 text-purple-700"
                : "text-gray-600 hover:text-purple-700 hover:bg-purple-50"
            }`}
            onClick={() => setActiveTab("complaints")}
            whileTap={{ scale: 0.98 }}
          >
            Complaints
          </motion.button>
        </div>

        {/* My Cart Tab */}
        <AnimatePresence mode="wait">
          {activeTab === "cart" && (
            <motion.div
              key="cart"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
            >
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-purple-700">Shopping Cart</h3>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-700">₹{totalCartValue.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">{filteredCart.length} items</div>
                    </div>
                    {filteredCart.length > 0 && (
                      <div className="flex space-x-2">
                        <motion.button
                          onClick={clearCart}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow hover:shadow-md transition-all"
                          whileTap={{ scale: 0.96 }}
                        >
                          Clear Cart
                        </motion.button>
                        <motion.button
                          onClick={checkout}
                          disabled={loading}
                          className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-semibold text-sm shadow hover:shadow-md transition-all disabled:opacity-50"
                          whileTap={{ scale: 0.96 }}
                        >
                          {loading ? 'Processing...' : 'Checkout All'}
                        </motion.button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[800px] w-full text-sm">
                  <thead className="bg-gradient-to-r from-purple-50 to-purple-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-purple-700 uppercase tracking-wider">Product</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold text-purple-700 uppercase tracking-wider">SKU</th>
                      <th className="px-4 py-4 text-center text-xs font-semibold text-purple-700 uppercase tracking-wider">Qty</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-purple-700 uppercase tracking-wider">Price</th>
                      <th className="px-4 py-4 text-center text-xs font-semibold text-purple-700 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-4 text-center text-xs font-semibold text-purple-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {loading && filteredCart.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-400">
                          <div className="flex justify-center items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                            <span className="ml-2">Loading cart...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredCart.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-400">
                          Your cart is empty or no products match your search.
                        </td>
                      </tr>
                    ) : (
                      filteredCart.map((item) => (
                        <tr key={item.id} className="hover:bg-purple-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                                {item.image ? (
                                  <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded-lg" />
                                ) : (
                                  <span className="text-purple-600 font-bold text-sm">{item.name?.charAt(0) || 'P'}</span>
                                )}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{item.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-gray-500 text-sm">{item.sku}</td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => updateCartItem(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1 || loading}
                                className="bg-gray-200 px-2 py-1 rounded disabled:opacity-50 hover:bg-gray-300"
                              >
                                -
                              </button>
                              <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-semibold">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateCartItem(item.id, item.quantity + 1)}
                                disabled={loading}
                                className="bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-lg font-semibold text-purple-700">₹{item.price?.toLocaleString()}</div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              item.status === "In Stock" 
                                ? "bg-purple-100 text-purple-800" 
                                : item.status === "Low Stock"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <motion.button 
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                onClick={() => updateCartItem(item.id, 0)}
                                disabled={loading}
                                whileTap={{ scale: 0.9 }}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </motion.button>
                              <motion.button 
                                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg font-semibold text-xs shadow hover:shadow-md transition-all disabled:opacity-50"
                                onClick={checkout}
                                disabled={loading}
                                whileTap={{ scale: 0.96 }}
                              >
                                {loading ? 'Processing...' : 'Checkout'}
                              </motion.button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Orders Tab */}
          {activeTab === "orders" && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 120, damping: 18 }}
            >
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-purple-700">Order History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[700px] w-full text-sm">
                  <thead className="bg-gradient-to-r from-purple-50 to-purple-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-purple-700 uppercase tracking-wider">Order ID</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-purple-700 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-purple-700 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold text-purple-700 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-purple-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {loading && filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-400">
                          <div className="flex justify-center items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                            <span className="ml-2">Loading orders...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-400">
                          {error ? (
                            <div className="text-red-500">
                              <div>{error}</div>
                              <button 
                                onClick={fetchOrders}
                                className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                              >
                                Retry
                              </button>
                            </div>
                          ) : (
                            'No orders found matching your search.'
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => (
                        <tr key={order.order_id} className="hover:bg-purple-50 transition-colors">
                          <td className="px-6 py-4 font-semibold text-gray-900">{order.order_id}</td>
                          <td className="px-6 py-4 text-gray-700">{new Date(order.order_date).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-right font-semibold text-purple-700">
                            ₹{order.total_amount?.toLocaleString()}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              order.status === "Delivered"
                                ? "bg-purple-100 text-purple-800"
                                : order.status === "Processing" || order.status === "Shipped"
                                ? "bg-yellow-100 text-yellow-800"
                                : order.status === "Cancelled"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <motion.button
                                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg font-semibold text-xs shadow hover:shadow-md transition-all disabled:opacity-50"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  getOrderDetails(order.order_id);
                                }}
                                disabled={loading}
                                whileTap={{ scale: 0.96 }}
                              >
                                {loading && selectedOrder?.order_id === order.order_id ? 'Loading...' : 'View'}
                              </motion.button>
                              
                              <motion.button
                                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white p-2 rounded-lg shadow hover:shadow-md transition-all disabled:opacity-50"
                                onClick={() => generateInvoiceFromOrder(order)}
                                disabled={invoiceLoading[order.order_id]}
                                whileTap={{ scale: 0.96 }}
                                title="Generate Invoice"
                              >
                                {invoiceLoading[order.order_id] ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )}
                              </motion.button>
                              
                              <motion.button
                                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-2 rounded-lg shadow hover:shadow-md transition-all disabled:opacity-50"
                                onClick={() => downloadInvoicePDF(order)}
                                disabled={invoiceLoading[`download_${order.order_id}`]}
                                whileTap={{ scale: 0.96 }}
                                title="Download Invoice"
                              >
                                {invoiceLoading[`download_${order.order_id}`] ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )}
                              </motion.button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feedback & Complaints */}
        {activeTab === "feedback" && (
          <motion.div
            key="feedback"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8"
          >
            <Suspense fallback={<div className="text-center py-12 text-gray-500">Loading Feedback...</div>}>
              <FeedbackSystem />
            </Suspense>
          </motion.div>
        )}
        {activeTab === "complaints" && (
          <motion.div
            key="complaints"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8"
          >
            <Suspense fallback={<div className="text-center py-12 text-gray-500">Loading Complaints...</div>}>
              <ComplaintsModule customerId={null} />
            </Suspense>
          </motion.div>
        )}
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 relative max-w-6xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <motion.button
                className="absolute top-6 right-6 text-gray-500 hover:text-red-500 text-3xl font-bold hover:scale-110 transition-all"
                onClick={() => setSelectedOrder(null)}
                whileTap={{ scale: 0.9 }}
              >
                ×
              </motion.button>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-purple-700 mb-2">Order Details</h2>
                <div className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                  <span>Order #{selectedOrder.order_id}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    selectedOrder.status === "Delivered" ? "bg-emerald-200 text-emerald-800" :
                    selectedOrder.status === "Processing" || selectedOrder.status === "Shipped" ? "bg-amber-200 text-amber-800" :
                    selectedOrder.status === "Cancelled" ? "bg-red-200 text-red-800" :
                    "bg-gray-200 text-gray-800"
                  }`}>
                    {selectedOrder.status}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                  <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-lg text-gray-900 mb-4">Order Summary</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Date:</span> 
                        <span className="font-semibold">{new Date(selectedOrder.order_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Amount:</span> 
                        <span className="text-2xl font-bold text-purple-700">₹{selectedOrder.total_amount?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Items:</span> 
                        <span className="font-semibold">{selectedOrder.items_count} item(s)</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6 bg-purple-50 rounded-xl border border-purple-200">
                    <h3 className="font-bold text-lg text-purple-800 mb-4">Shipping Details</h3>
                    <div className="space-y-2 text-sm">
                      <div>{selectedOrder.delivery_address || 'Address not specified'}</div>
                      <div>Payment Method: {selectedOrder.payment_method || 'Not specified'}</div>
                      {selectedOrder.notes && <div>Notes: {selectedOrder.notes}</div>}
                    </div>
                  </div>
                </div>
                
                <div>
                  {loading && !orderDetails ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                      <span className="ml-2">Loading order details...</span>
                    </div>
                  ) : orderDetails ? (
                    <div className="p-6 bg-blue-50 rounded-xl border border-blue-200 mb-6">
                      <h3 className="font-bold text-lg text-blue-800 mb-4">Order Items</h3>
                      <div className="space-y-3">
                        {orderDetails.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center p-4 bg-white rounded-lg border">
                            <div className="flex items-center space-x-3">
                              {item.image && (
                                <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded" />
                              )}
                              <div>
                                <div className="font-semibold text-gray-900">{item.name}</div>
                                <div className="text-sm text-gray-600">SKU: {item.sku}</div>
                                <div className="text-sm text-gray-600">Qty: {item.quantity}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-purple-700">₹{item.unit_price?.toLocaleString()}</div>
                              <div className="text-sm text-gray-500">Total: ₹{item.total_price?.toLocaleString()}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {orderDetails.tracking_info && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Tracking Information</h4>
                          <div className="bg-white p-3 rounded">
                            <p className="text-sm"><strong>Tracking Number:</strong> {orderDetails.tracking_info.tracking_number}</p>
                            <p className="text-sm"><strong>Carrier:</strong> {orderDetails.tracking_info.carrier}</p>
                            <p className="text-sm"><strong>Estimated Delivery:</strong> {orderDetails.tracking_info.estimated_delivery}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 text-center text-gray-500">
                      Click "View Details" to load order information
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-100 rounded-xl">
                      <h4 className="font-semibold text-gray-900 mb-2">Payment</h4>
                      <div className="text-sm">
                        <div>{selectedOrder.payment_method || 'Not specified'}</div>
                        {orderDetails?.payment_details && (
                          <div className="text-gray-600">TXN: {orderDetails.payment_details.transaction_id}</div>
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-emerald-100 rounded-xl">
                      <h4 className="font-semibold text-emerald-800 mb-2">Support</h4>
                      <div className="text-sm space-y-1">
                        <div>📞 +91-1800-123-456</div>
                        <div>✉️ support@ratilalcrm.com</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <motion.div
                className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <motion.button
                  className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all text-lg"
                  onClick={() => {
                    setSelectedOrder(null);
                    setOrderDetails(null);
                  }}
                  whileTap={{ scale: 0.96 }}
                >
                  Close
                </motion.button>
                
                <motion.button
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all text-lg disabled:opacity-50"
                  onClick={() => generateInvoiceFromOrder(selectedOrder)}
                  disabled={invoiceLoading[selectedOrder?.order_id]}
                  whileTap={{ scale: 0.96 }}
                >
                  {invoiceLoading[selectedOrder?.order_id] ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Generating...
                    </div>
                  ) : (
                    '📄 Generate Invoice'
                  )}
                </motion.button>
                
                <motion.button
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all text-lg disabled:opacity-50"
                  onClick={() => downloadInvoicePDF(selectedOrder)}
                  disabled={invoiceLoading[`download_${selectedOrder?.order_id}`]}
                  whileTap={{ scale: 0.96 }}
                >
                  {invoiceLoading[`download_${selectedOrder?.order_id}`] ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Downloading...
                    </div>
                  ) : (
                    '💾 Download Invoice'
                  )}
                </motion.button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
