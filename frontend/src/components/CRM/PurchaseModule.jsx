// PurchaseModule.jsx with API Integration
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CUSTOMER_PORTAL_API, getAuthHeaders } from "../../config.js";

const PAGE_SIZE = 10;

function PurchaseTopTitle({ search, setSearch }) {
  return (
    <motion.div
      className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between"
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
    >
      <div>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-left text-green-700 leading-7 drop-shadow">
          Vendor Products Catalog
        </h2>
        <p className="text-gray-500 mt-1 text-left text-xs sm:text-sm md:text-base">
          Browse and purchase products from our verified vendors.
        </p>
      </div>
      <div className="mt-3 sm:mt-0 sm:ml-4 w-full sm:w-auto flex justify-start sm:justify-end">
        <motion.input
          type="text"
          placeholder="Search vendor products or SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 w-full sm:w-64 text-sm shadow-inner"
          whileFocus={{ scale: 1.03, borderColor: "#22c55e" }}
        />
      </div>
    </motion.div>
  );
}

function PaginationControl({ pagination, onPageChange }) {
  if (!pagination || pagination.total <= PAGE_SIZE) return null;
  
  return (
    <div className="flex items-center justify-between w-full mt-1">
      <motion.button
        onClick={() => onPageChange(pagination.page - 1)}
        disabled={!pagination.has_prev}
        className={`px-4 py-2 rounded shadow font-semibold transition
          ${pagination.has_prev
            ? "bg-gradient-to-r from-green-500 to-green-700 text-white hover:from-green-600 hover:to-green-800"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"}
        `}
        style={{ minWidth: 90, fontSize: "0.95rem" }}
        whileTap={{ scale: 0.96 }}
      >
        Previous
      </motion.button>
      <span className="text-sm sm:text-base text-gray-700 font-medium">
        {`Page ${pagination.page} of ${pagination.pages}`}
      </span>
      <motion.button
        onClick={() => onPageChange(pagination.page + 1)}
        disabled={!pagination.has_next}
        className={`px-4 py-2 rounded shadow font-semibold transition
          ${pagination.has_next
            ? "bg-gradient-to-r from-green-500 to-green-700 text-white hover:from-green-600 hover:to-green-800"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"}
        `}
        style={{ minWidth: 90, fontSize: "0.95rem" }}
        whileTap={{ scale: 0.96 }}
      >
        Next
      </motion.button>
    </div>
  );
}

function PurchaseTable({ products, loading, pagination, onAddToCart, onPageChange }) {
  const [quantities, setQuantities] = useState({});

  // Handle quantity input change
  const handleQuantityChange = (id, value) => {
    if (/^\d*$/.test(value)) { // allow only numbers
      setQuantities((q) => ({ ...q, [id]: value }));
    }
  };

  const handleAddToCart = () => {
    // Filter out zero or empty quantities before adding to cart
    const entries = Object.entries(quantities).filter(([_, val]) => parseInt(val) > 0);
    if (entries.length === 0) {
      alert('Please select quantities for products you want to purchase');
      return;
    }
    onAddToCart(entries);
    setQuantities({}); // clear after adding
  };

  return (
    <motion.div
      className="bg-white shadow-lg rounded-2xl mb-6 border border-green-100"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
    >
      <div className="px-6 py-3 border-b flex justify-between items-center">
        <h3 className="text-lg font-bold text-green-700">Vendor Catalog Products</h3>
        <button
          onClick={handleAddToCart}
          className="bg-gradient-to-r from-green-600 to-green-400 hover:from-green-700 hover:to-green-500 text-white font-bold rounded-lg px-4 py-2 text-sm shadow"
        >
          Add to Cart
        </button>
      </div>
      
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
            <p className="text-gray-500">Loading products...</p>
          </div>
        ) : (
          <table className="min-w-[900px] w-full text-[0.92rem]">
            <thead className="bg-gradient-to-r from-green-50 to-green-100">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-green-700 uppercase">Product</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-green-700 uppercase">Vendor</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-green-700 uppercase">SKU</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-green-700 uppercase">Price</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-green-700 uppercase">Stock</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-green-700 uppercase">Quantity to Buy</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">No vendor products found.</td>
                </tr>
              )}
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-green-50 transition">
                  <td className="px-4 py-2 whitespace-nowrap text-gray-900 font-medium">
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.category || 'General'}</div>
                    </div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                    <div className="font-medium">{p.vendor_name || 'Unknown Vendor'}</div>
                    <div className="text-xs text-gray-500">{p.vendor_email || ''}</div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-500">{p.sku || "-"}</td>
                  <td className="px-4 py-2 text-center text-green-700 font-semibold">₹{p.price?.toFixed(2)}</td>
                  <td className="px-4 py-2 text-center text-green-700 font-semibold">{p.stock_quantity || p.warehouse_qty || 0}</td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="text"
                      value={quantities[p.id] || ""}
                      onChange={(e) => handleQuantityChange(p.id, e.target.value)}
                      placeholder="0"
                      max={p.stock_quantity || p.warehouse_qty || 0}
                      className="w-16 text-center border border-gray-300 rounded px-1 py-1 shadow-inner focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      <div className="mt-4 mb-2 px-6">
        <PaginationControl pagination={pagination} onPageChange={onPageChange} />
      </div>
    </motion.div>
  );
}

export default function PurchasePage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  // Fetch products when component mounts or search/page changes
  useEffect(() => {
    fetchProducts();
  }, [search, page]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = [];
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      params.push(`page=${page}`);
      params.push(`limit=${PAGE_SIZE}`);
      
      // Fetch vendor catalog products instead of regular products
      const response = await fetch(`${CUSTOMER_PORTAL_API.VENDOR_CATALOG || (CUSTOMER_PORTAL_API.PRODUCTS + '/vendor-catalog')}?${params.join('&')}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
        setPagination(data.pagination);
      } else {
        console.error('Failed to fetch products');
        setProducts([]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (items) => {
    // items: array of [productId, quantityStrings]
    const newItems = items.map(([id, qty]) => {
      const product = products.find((p) => p.id === id);
      const quantity = parseInt(qty);
      
      // Check if quantity exceeds available stock
      const availableStock = product.stock_quantity || product.warehouse_qty || 0;
      if (quantity > availableStock) {
        alert(`Quantity for ${product.name} exceeds available stock (${availableStock})`);
        return null;
      }
      
      return product ? { ...product, quantity } : null;
    }).filter(Boolean);

    // Merge with existing cart, summing quantities if product exists
    setCart((prev) => {
      const updated = [...prev];
      newItems.forEach((newItem) => {
        const existingIndex = updated.findIndex((p) => p.id === newItem.id);
        if (existingIndex !== -1) {
          const newQuantity = updated[existingIndex].quantity + newItem.quantity;
          const availableStock = newItem.stock_quantity || newItem.warehouse_qty || 0;
          if (newQuantity > availableStock) {
            alert(`Total quantity for ${newItem.name} would exceed available stock (${availableStock})`);
            return;
          }
          updated[existingIndex].quantity = newQuantity;
        } else {
          updated.push(newItem);
        }
      });
      return updated;
    });
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateCartQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    const product = cart.find(item => item.id === productId);
    const availableStock = product.stock_quantity || product.warehouse_qty || 0;
    if (newQuantity > availableStock) {
      alert(`Quantity exceeds available stock (${availableStock})`);
      return;
    }
    
    setCart(prev => prev.map(item => 
      item.id === productId 
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handlePurchase = async () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    const orderData = {
      items: cart.map(item => ({
        product_id: item.id,
        quantity: item.quantity
      }))
    };

    try {
      setPlacing(true);
      const response = await fetch(CUSTOMER_PORTAL_API.ORDERS, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Order ${result.order_id} placed successfully! Total: ₹${result.total_amount.toLocaleString()}`);
        setCart([]);
        // Refresh products to update stock
        await fetchProducts();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to place order');
      }
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <motion.div className="bg-gray-50 min-h-screen p-4 sm:p-8 max-w-8xl mx-auto">
      <PurchaseTopTitle search={search} setSearch={setSearch} />
      <PurchaseTable
        products={products}
        loading={loading}
        pagination={pagination}
        onAddToCart={handleAddToCart}
        onPageChange={handlePageChange}
      />
      
      {/* Shopping Cart */}
      {cart.length > 0 && (
        <motion.div 
          className="fixed bottom-4 right-4 bg-white p-4 rounded-xl shadow-lg max-w-sm w-full border border-green-300 max-h-96 overflow-y-auto"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h4 className="font-bold text-green-700 mb-2 flex justify-between items-center">
            Your Cart
            <span className="text-sm bg-green-100 px-2 py-1 rounded-full">
              {cart.length} item{cart.length > 1 ? 's' : ''}
            </span>
          </h4>
          
          <ul className="max-h-48 overflow-y-auto mb-2 space-y-2">
            {cart.map((item) => (
              <li key={item.id} className="bg-gray-50 p-2 rounded text-sm">
                <div className="font-medium text-gray-800 truncate">{item.name}</div>
                <div className="text-xs text-gray-500 mb-1">by {item.vendor_name || 'Unknown Vendor'}</div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-gray-600">₹{item.price}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                      className="w-6 h-6 bg-red-100 text-red-600 rounded-full text-xs hover:bg-red-200"
                    >
                      -
                    </button>
                    <span className="px-2 font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                      className="w-6 h-6 bg-green-100 text-green-600 rounded-full text-xs hover:bg-green-200"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="text-right text-gray-700 font-medium">
                  ₹{(item.price * item.quantity).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
          
          <div className="border-t pt-2 mb-2">
            <div className="flex justify-between items-center font-bold text-lg">
              <span>Total:</span>
              <span className="text-green-700">₹{calculateTotal().toLocaleString()}</span>
            </div>
          </div>
          
          <button
            onClick={handlePurchase}
            disabled={placing}
            className={`w-full font-semibold rounded px-4 py-2 transition ${
              placing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-green-400 text-white hover:from-green-700 hover:to-green-500'
            }`}
          >
            {placing ? 'Placing Order...' : 'Proceed to Purchase'}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}