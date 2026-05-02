import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Package, DollarSign, TrendingUp, ShoppingCart, Eye, Plus, BarChart3, Star, Calendar, Award } from "lucide-react";

const API_BASE = "https://ratilalsons-backend-api.onrender.com/api/stock";

export default function VendorDashboard() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleViewAllProducts = () => {
    // Navigate to inventory/stock management page
    navigate('/inventory');
  };

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem("access_token");
    fetch(`${API_BASE}/products`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + (p.warehouse_qty || 0), 0);
  const totalValue = products.reduce(
    (sum, p) => sum + (p.warehouse_qty || 0) * (p.price || 0),
    0
  );
  
  // Additional metrics
  const avgPrice = totalProducts > 0 ? totalValue / totalStock : 0;
  const lowStockItems = products.filter(p => (p.warehouse_qty || 0) < 10).length;
  const highValueItems = products.filter(p => (p.price || 0) > 100).length;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.2,
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-6 sm:p-8">
        {/* Header Section with Gradient */}
        <motion.div 
          className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 rounded-3xl shadow-2xl p-8 mb-8 text-white relative overflow-hidden"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white bg-opacity-10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-white bg-opacity-10 rounded-full translate-y-10 -translate-x-10"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <motion.h1 
                  className="text-4xl font-bold mb-3 tracking-tight"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  Vendor Dashboard
                </motion.h1>
                <motion.p 
                  className="text-green-100 text-lg"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  Monitor your inventory, track performance, and manage your products efficiently
                </motion.p>
              </div>
              <motion.div 
                className="hidden lg:block"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="w-20 h-20 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Package className="w-10 h-10 text-white" />
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <motion.div 
            className="flex flex-col items-center justify-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-500"></div>
              <div className="absolute top-0 left-0 animate-spin rounded-full h-16 w-16 border-r-4 border-green-300 animate-pulse"></div>
            </div>
            <p className="text-gray-600 font-semibold mt-4 text-lg">Loading your dashboard...</p>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Main Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <motion.div 
                variants={cardVariants}
                className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden group hover:scale-105 transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white bg-opacity-10 rounded-full -translate-y-12 translate-x-12"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Package className="w-6 h-6" />
                    </div>
                    <span className="text-blue-100 text-sm font-medium">Total</span>
                  </div>
                  <div className="text-3xl font-bold mb-1">{totalProducts}</div>
                  <div className="text-blue-100 font-medium">Products Added</div>
                  <div className="w-full bg-white bg-opacity-20 rounded-full h-2 mt-3">
                    <div className="bg-white bg-opacity-60 h-2 rounded-full" style={{width: '85%'}}></div>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                variants={cardVariants}
                className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden group hover:scale-105 transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white bg-opacity-10 rounded-full -translate-y-12 translate-x-12"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <span className="text-emerald-100 text-sm font-medium">Inventory</span>
                  </div>
                  <div className="text-3xl font-bold mb-1">{totalStock.toLocaleString()}</div>
                  <div className="text-emerald-100 font-medium">Total Stock Qty</div>
                  <div className="w-full bg-white bg-opacity-20 rounded-full h-2 mt-3">
                    <div className="bg-white bg-opacity-60 h-2 rounded-full" style={{width: '92%'}}></div>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                variants={cardVariants}
                className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden group hover:scale-105 transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white bg-opacity-10 rounded-full -translate-y-12 translate-x-12"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <span className="text-purple-100 text-sm font-medium">Value</span>
                  </div>
                  <div className="text-3xl font-bold mb-1">₹{totalValue.toLocaleString()}</div>
                  <div className="text-purple-100 font-medium">Total Stock Value</div>
                  <div className="w-full bg-white bg-opacity-20 rounded-full h-2 mt-3">
                    <div className="bg-white bg-opacity-60 h-2 rounded-full" style={{width: '78%'}}></div>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                variants={cardVariants}
                className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden group hover:scale-105 transition-all duration-300"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white bg-opacity-10 rounded-full -translate-y-12 translate-x-12"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <span className="text-orange-100 text-sm font-medium">Average</span>
                  </div>
                  <div className="text-3xl font-bold mb-1">₹{avgPrice.toFixed(0)}</div>
                  <div className="text-orange-100 font-medium">Avg Product Price</div>
                  <div className="w-full bg-white bg-opacity-20 rounded-full h-2 mt-3">
                    <div className="bg-white bg-opacity-60 h-2 rounded-full" style={{width: '65%'}}></div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <motion.div 
                variants={cardVariants}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{lowStockItems}</div>
                    <div className="text-gray-600 font-medium">Low Stock Items</div>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                variants={cardVariants}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-xl flex items-center justify-center">
                    <Star className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{highValueItems}</div>
                    <div className="text-gray-600 font-medium">Premium Products</div>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                variants={cardVariants}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{new Date().toLocaleDateString('en-IN')}</div>
                    <div className="text-gray-600 font-medium">Last Updated</div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Products Table */}
            <motion.div
              variants={cardVariants}
              className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Latest Products</h2>
                    <p className="text-gray-600">Recent additions to your inventory</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* <button className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:shadow-lg transform hover:scale-105 transition-all duration-200">
                      <Plus className="w-4 h-4" />
                      Add Product
                    </button> */}
                    <button 
                      onClick={handleViewAllProducts}
                      className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gray-50 transition-all duration-200"
                    >
                      <Eye className="w-4 h-4" />
                      View All
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {products.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ShoppingCart className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Products Found</h3>
                    <p className="text-gray-500">Start by adding your first product to see it here.</p>
                    <button 
                      onClick={handleViewAllProducts}
                      className="mt-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white px-6 py-2 rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      Go to Inventory
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">Product Details</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-600">SKU</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-600">Price</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-600">Quantity</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {products
                          .slice(-5)
                          .reverse()
                          .map((product, index) => (
                            <motion.tr
                              key={product.id || product.product_id}
                              className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                            >
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">
                                      {product.name?.charAt(0)?.toUpperCase() || 'P'}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="font-semibold text-gray-900">{product.name}</div>
                                    <div className="text-sm text-gray-500">Product #{product.id || product.product_id}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                                  {product.sku || "N/A"}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className="font-bold text-gray-900">₹{product.price?.toFixed(2) || "0.00"}</span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  (product.warehouse_qty || 0) < 10 
                                    ? 'bg-red-100 text-red-700'
                                    : (product.warehouse_qty || 0) < 50
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {product.warehouse_qty || 0}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  (product.warehouse_qty || 0) === 0
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {(product.warehouse_qty || 0) === 0 ? 'Out of Stock' : 'In Stock'}
                                </span>
                              </td>
                            </motion.tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
