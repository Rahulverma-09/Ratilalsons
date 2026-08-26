import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_URL } from "../../config";

// Vendor Products Management UI - now shows catalog products with ability to add from inventory

export default function VendorProducts() {
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Pagination
  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);

  // Search
  const [inventorySearch, setInventorySearch] = useState("");
  
  // Local storage key for vendor catalog
  const VENDOR_CATALOG_KEY = 'vendor_catalog_products';

  // Auth headers
  const getHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
    'Content-Type': 'application/json'
  });
  
  // Function to save catalog to localStorage
  const saveCatalogToStorage = (catalog) => {
    try {
      localStorage.setItem(VENDOR_CATALOG_KEY, JSON.stringify(catalog));
      console.log('Catalog saved to localStorage');
    } catch (e) {
      console.error('Error saving catalog to localStorage:', e);
    }
  };

  // Form state for catalog entry
  const [catalogForm, setCatalogForm] = useState({
    custom_price: "",
    min_order_qty: "1",
    max_order_qty: "",
    description_override: ""
  });
  const [formError, setFormError] = useState("");



  // API Functions for catalog management
  const fetchCatalogProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('No authentication token found. Please login again.');
        setCatalogProducts([]);
        return;
      }
      
      // Try to fetch vendor catalog first, fallback to empty array if not found
      try {
        const response = await fetch(`${API_URL}/vendor/catalog`, {
          headers: getHeaders()
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Fetched catalog products:', data);
          const catalogData = Array.isArray(data) ? data : [];
          setCatalogProducts(catalogData);
          saveCatalogToStorage(catalogData);
        } else {
          // Catalog endpoint doesn't exist or is empty, keep existing catalog
          console.log('No catalog endpoint found, keeping existing catalog');
        }
      } catch (err) {
        console.log('Catalog API not available, starting with empty catalog');
        setCatalogProducts([]);
      }
      
    } catch (err) {
      console.error('Error fetching catalog:', err);
      setError(`Failed to fetch catalog: ${err.message}`);
      setCatalogProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryProducts = async (search = "", page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_SIZE.toString()
      });
      if (search && search.trim()) {
        params.append('search', search.trim());
      }

      console.log('Fetching inventory from:', `${API_URL}/stock/products?${params}`);
      const response = await fetch(`${API_URL}/stock/products?${params}`, {
        headers: getHeaders()
      });

      console.log('Inventory response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch inventory`);
      }

      const data = await response.json();
      console.log('Inventory data:', data);
      
      // Handle different response formats and apply client-side filtering if needed
      let products = [];
      if (Array.isArray(data)) {
        products = data;
      } else if (data.products && Array.isArray(data.products)) {
        products = data.products;
      }

      // If search term exists, apply additional client-side filtering
      if (search && search.trim()) {
        const searchLower = search.trim().toLowerCase();
        products = products.filter(product => 
          (product.name && product.name.toLowerCase().includes(searchLower)) ||
          (product.category && product.category.toLowerCase().includes(searchLower)) ||
          (product.brand && product.brand.toLowerCase().includes(searchLower)) ||
          (product.sku && product.sku.toLowerCase().includes(searchLower)) ||
          (product.description && product.description.toLowerCase().includes(searchLower))
        );
      }

      setInventoryProducts(products);
      
      if (Array.isArray(data)) {
        return { page, total: products.length };
      } else if (data.pagination) {
        return data.pagination;
      } else {
        return { page, total: products.length };
      }
    } catch (err) {
      console.error('Error fetching inventory products:', err);
      setError(`Failed to fetch inventory: ${err.message}`);
      setInventoryProducts([]);
      return { page, total: 0 };
    } finally {
      setLoading(false);
    }
  };

  const addToCatalog = async (inventoryProductId, catalogData) => {
    try {
      setLoading(true);
      
      // Find the inventory product
      const inventoryProduct = inventoryProducts.find(p => (p.id || p.product_id) === inventoryProductId);
      
      if (!inventoryProduct) {
        throw new Error('Product not found in inventory');
      }
      
      // Check if product is already in catalog
      const isAlreadyInCatalog = catalogProducts.some(p => 
        (p.product_id || p.id) === (inventoryProduct.id || inventoryProduct.product_id)
      );
      
      if (isAlreadyInCatalog) {
        alert(`"${inventoryProduct.name}" is already in your catalog!`);
        return { success: false, error: 'Product already in catalog' };
      }
      
      // For now, we'll simulate adding to catalog by adding it to our catalog state
      const catalogEntry = {
        catalog_id: `cat-${Date.now()}`,
        product_id: inventoryProduct.id || inventoryProduct.product_id,
        name: inventoryProduct.name,
        category: inventoryProduct.category,
        brand: inventoryProduct.brand,
        sku: inventoryProduct.sku,
        price: inventoryProduct.price,
        custom_price: catalogData.custom_price,
        warehouse_qty: inventoryProduct.warehouse_qty,
        description: inventoryProduct.description,
        min_order_qty: catalogData.min_order_qty,
        max_order_qty: catalogData.max_order_qty,
        description_override: catalogData.description_override,
        is_active: catalogData.is_active
      };
      
      // Add to catalog state
      const newCatalog = [...catalogProducts, catalogEntry];
      setCatalogProducts(newCatalog);
      saveCatalogToStorage(newCatalog);
      setShowInventoryModal(false);
      
      // Show success message
      alert(`"${inventoryProduct.name}" has been added to your catalog!`);
      
      return { success: true };
      
    } catch (err) {
      console.error('Error adding to catalog:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const updateCatalogProduct = async (productId, catalogData) => {
    try {
      setLoading(true);
      
      // Update in catalog state
      const newCatalog = catalogProducts.map(p => {
        if ((p.catalog_id || p.id) === productId) {
          return {
            ...p,
            custom_price: catalogData.custom_price,
            min_order_qty: catalogData.min_order_qty,
            max_order_qty: catalogData.max_order_qty,
            description_override: catalogData.description_override,
            is_active: catalogData.is_active
          };
        }
        return p;
      });
      
      setCatalogProducts(newCatalog);
      saveCatalogToStorage(newCatalog);
      
      alert('Catalog entry updated successfully!');
      return { success: true };
      
    } catch (err) {
      console.error('Error updating catalog entry:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const removeFromCatalog = async (catalogId) => {
    try {
      setLoading(true);
      
      // Remove from catalog state
      const newCatalog = catalogProducts.filter(p => (p.catalog_id || p.id) !== catalogId);
      setCatalogProducts(newCatalog);
      saveCatalogToStorage(newCatalog);
      
      alert('Product removed from catalog successfully!');
      return { success: true };
      
    } catch (err) {
      console.error('Error removing from catalog:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Load catalog products on component mount
  useEffect(() => {
    // First try to load from localStorage
    const savedCatalog = localStorage.getItem(VENDOR_CATALOG_KEY);
    if (savedCatalog) {
      try {
        const parsedCatalog = JSON.parse(savedCatalog);
        if (Array.isArray(parsedCatalog)) {
          setCatalogProducts(parsedCatalog);
          console.log('Loaded catalog from localStorage:', parsedCatalog);
        }
      } catch (e) {
        console.error('Error parsing saved catalog:', e);
      }
    }
    
    // Then try to fetch from API (this will override localStorage if successful)
    fetchCatalogProducts();
  }, []);

  // Load inventory when inventory modal opens
  useEffect(() => {
    if (showInventoryModal) {
      fetchInventoryProducts(inventorySearch, inventoryPage);
    }
  }, [showInventoryModal]);

  // Reset form when modal shows/hides or editing product changes
  React.useEffect(() => {
    if (editingProduct) {
      setCatalogForm({
        custom_price: editingProduct.custom_price?.toString() || editingProduct.price?.toString() || "",
        min_order_qty: editingProduct.min_order_qty?.toString() || "1",
        max_order_qty: editingProduct.max_order_qty?.toString() || "",
        description_override: editingProduct.description_override || editingProduct.description || ""
      });
    } else {
      setCatalogForm({
        custom_price: "",
        min_order_qty: "1",
        max_order_qty: "",
        description_override: ""
      });
    }
    setFormError("");
  }, [editingProduct, showAddModal]);

  const catalogFormFields = [
    { label: "Custom Price (₹)", key: "custom_price", type: "number", required: false, placeholder: "Leave empty to use original price" },
    { label: "Minimum Order Quantity", key: "min_order_qty", type: "number", required: true, placeholder: "Minimum quantity customers can order" },
    { label: "Maximum Order Quantity", key: "max_order_qty", type: "number", required: false, placeholder: "Maximum quantity (optional)" },
    { label: "Description Override", key: "description_override", type: "textarea", required: false, placeholder: "Custom description for customers" }
  ];

  // Pagination calculations for catalog products
  const paginatedCatalogProducts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return catalogProducts.slice(start, start + PAGE_SIZE);
  }, [catalogProducts, page]);

  const totalPages = Math.ceil(catalogProducts.length / PAGE_SIZE);

  const handleCatalogFormChange = (key, value) => {
    setCatalogForm(f => ({ ...f, [key]: value }));
  };

  const validateCatalogForm = () => {
    // Check required fields
    if (!catalogForm.min_order_qty || parseInt(catalogForm.min_order_qty) < 1) {
      setFormError("Minimum order quantity must be at least 1");
      return false;
    }
    
    // Validate custom price
    if (catalogForm.custom_price && (isNaN(catalogForm.custom_price) || parseFloat(catalogForm.custom_price) < 0)) {
      setFormError("Custom price must be a valid positive number");
      return false;
    }
    
    // Validate max order quantity
    if (catalogForm.max_order_qty && (isNaN(catalogForm.max_order_qty) || parseInt(catalogForm.max_order_qty) < parseInt(catalogForm.min_order_qty))) {
      setFormError("Maximum order quantity must be greater than minimum order quantity");
      return false;
    }
    
    setFormError("");
    return true;
  };

  const handleCatalogSave = async (e) => {
    e.preventDefault();
    if (!validateCatalogForm()) return;

    // Prepare data for API
    const catalogData = {
      custom_price: catalogForm.custom_price ? parseFloat(catalogForm.custom_price) : null,
      min_order_qty: parseInt(catalogForm.min_order_qty) || 1,
      max_order_qty: catalogForm.max_order_qty ? parseInt(catalogForm.max_order_qty) : null,
      description_override: catalogForm.description_override?.trim() || null,
      is_active: true
    };

    let result;
    if (editingProduct) {
      result = await updateCatalogProduct(editingProduct.catalog_id || editingProduct.id, catalogData);
    } else {
      setFormError("Cannot add new product from this modal. Use 'Add from Inventory' button.");
      return;
    }

    if (result.success) {
      setShowAddModal(false);
      setEditingProduct(null);
    } else {
      setFormError(result.error);
    }
  };

  const handleRemove = async (product) => {
    if (window.confirm(`Are you sure you want to remove "${product.name}" from your catalog? This will not delete it from inventory.`)) {
      const result = await removeFromCatalog(product.catalog_id || product.id);
      if (!result.success) {
        alert('Failed to remove from catalog: ' + result.error);
      }
    }
  };

  return (
    <motion.div
      className="bg-gray-50 min-h-screen p-4 sm:p-8 max-w-8xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Title and Add button */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-green-700 mb-2 select-none">
            Vendor Product Catalog
          </h1>
          <p className="text-gray-600 select-none">
            Select products from inventory to add to your catalog for customers
          </p>
        </div>
        <motion.button
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all text-lg select-none"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowInventoryModal(true)}
          aria-label="Add product from inventory"
        >
          + Add from Inventory
        </motion.button>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div 
          className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-800"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="flex justify-between items-center">
            <span>{error}</span>
            <button 
              onClick={fetchCatalogProducts}
              className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
            >
              Retry
            </button>
          </div>
        </motion.div>
      )}

      {/* Products Table */}
      <motion.div
        className="bg-white shadow-lg rounded-2xl border border-green-100 overflow-x-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gradient-to-r from-green-50 to-green-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-green-700 uppercase tracking-wider select-none">Product Name</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-green-700 uppercase tracking-wider select-none">Category</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-green-700 uppercase tracking-wider select-none">Brand</th>
              <th className="px-4 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider select-none">SKU</th>
              <th className="px-4 py-4 text-right text-xs font-semibold text-green-700 uppercase tracking-wider select-none">Price (₹)</th>
              <th className="px-4 py-4 text-right text-xs font-semibold text-green-700 uppercase tracking-wider select-none">Stock</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-green-700 uppercase tracking-wider select-none">Description</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider select-none">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && catalogProducts.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400 select-none">
                  <div className="flex justify-center items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    <span className="ml-2">Loading catalog...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedCatalogProducts.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400 select-none">
                  No products in catalog yet. Click "Add from Inventory" to select products.
                </td>
              </tr>
            ) : (
              paginatedCatalogProducts.map((p, i) => (
                <tr 
                  key={p.catalog_id || p.id || p.product_id || i} 
                  className="hover:bg-green-50 transition-colors cursor-default"
                >
                  <td className="px-6 py-3 max-w-[200px] truncate" title={p.name}>{p.name}</td>
                  <td className="px-6 py-3 max-w-[120px] truncate" title={p.category}>{p.category || "-"}</td>
                  <td className="px-6 py-3 max-w-[120px] truncate" title={p.brand}>{p.brand || "-"}</td>
                  <td className="px-4 py-3 text-center font-mono">{p.sku || p.id}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    ₹{Number(p.custom_price || p.price || 0).toLocaleString()}
                    {p.custom_price && p.custom_price !== p.price && (
                      <div className="text-xs text-gray-500">Original: ₹{Number(p.price || 0).toLocaleString()}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      (p.warehouse_qty || 0) <= 10 
                        ? 'bg-red-100 text-red-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {p.warehouse_qty || 0}
                    </span>
                  </td>
                  <td className="px-6 py-3 max-w-[300px] truncate" title={p.description || ""}>{p.description || "-"}</td>
                  <td className="px-6 py-3 text-center space-x-2">
                    <motion.button
                      className="text-green-700 font-semibold hover:underline select-none disabled:opacity-50"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setEditingProduct(p); setShowAddModal(true); }}
                      disabled={loading}
                      aria-label={`Edit catalog entry ${p.name}`}
                    >
                      Edit
                    </motion.button>
                    <motion.button
                      className="text-red-600 font-semibold hover:underline select-none disabled:opacity-50"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleRemove(p)}
                      disabled={loading}
                      aria-label={`Remove ${p.name}`}
                    >
                      Remove
                    </motion.button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </motion.div>

      {/* Pagination */}
      <div className="flex justify-center mt-6 space-x-6">
        <motion.button
          className={`px-6 py-3 rounded-xl font-semibold shadow-lg transition ${
            page > 1
              ? "bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700"
              : "bg-gray-300 text-gray-600 cursor-not-allowed"
          } select-none`}
          disabled={page <= 1}
          whileTap={{ scale: 0.96 }}
          onClick={() => setPage(p => Math.max(1, p - 1))}
          aria-label="Previous page"
        >
          Previous
        </motion.button>
        <div className="select-none self-center font-semibold text-green-700 text-lg">
          Page {page} / {totalPages || 1}
        </div>
        <motion.button
          className={`px-6 py-3 rounded-xl font-semibold shadow-lg transition ${
            page < totalPages
              ? "bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700"
              : "bg-gray-300 text-gray-600 cursor-not-allowed"
          } select-none`}
          disabled={page >= totalPages}
          whileTap={{ scale: 0.96 }}
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          aria-label="Next page"
        >
          Next
        </motion.button>
      </div>

      {/* Add/Edit Product Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            key="modal"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 relative border border-green-100"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <motion.button
                className="absolute top-6 right-6 text-gray-500 hover:text-red-500 text-3xl font-bold hover:scale-110 transition-all select-none"
                onClick={() => { setShowAddModal(false); setEditingProduct(null); }}
                whileTap={{ scale: 0.9 }}
                aria-label="Close modal"
              >
                ×
              </motion.button>
              <div className="text-center mb-8 select-none">
                <h3 className="text-3xl font-bold text-green-700 mb-2">
                  {editingProduct ? "Edit Catalog Entry" : "Add to Catalog"}
                </h3>
                <p className="text-gray-600">
                  {editingProduct ? "Modify how this product appears in your catalog" : "Configure product for your catalog"}
                </p>
              </div>
              <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleCatalogSave} noValidate>
                {catalogFormFields.map(f => (
                  <div key={f.key} className="flex flex-col">
                    <label className="mb-2 font-semibold text-gray-700 select-none">
                      {f.label}{f.required && <span className="text-red-500">*</span>}
                    </label>
                    {f.type === "select" ? (
                      <select
                        className="border border-gray-300 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent shadow-inner text-sm"
                        value={catalogForm[f.key]}
                        onChange={e => handleCatalogFormChange(f.key, e.target.value)}
                        required={f.required}
                        aria-required={f.required}
                        aria-label={f.label}
                      >
                        <option value="">Select {f.label}</option>
                        {(f.options || []).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea
                        rows={4}
                        placeholder={f.placeholder}
                        className="border border-gray-300 rounded-lg p-4 resize-y text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                        value={catalogForm[f.key]}
                        onChange={e => handleCatalogFormChange(f.key, e.target.value)}
                        aria-label={f.label}
                      />
                    ) : (
                      <input
                        type={f.type}
                        placeholder={f.placeholder}
                        className="border border-gray-300 rounded-lg p-4 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                        value={catalogForm[f.key]}
                        onChange={e => handleCatalogFormChange(f.key, e.target.value)}
                        required={f.required}
                        aria-required={f.required}
                        aria-label={f.label}
                      />
                    )}
                  </div>
                ))}
                {formError && (
                  <motion.div 
                    className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm col-span-full"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    {formError}
                  </motion.div>
                )}
                <motion.button
                  type="submit"
                  disabled={loading}
                  className="w-full col-span-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all text-lg disabled:cursor-not-allowed"
                  whileTap={{ scale: loading ? 1 : 0.96 }}
                  aria-label={editingProduct ? "Save changes" : "Add product"}
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      {editingProduct ? "Saving..." : "Adding..."}
                    </div>
                  ) : (
                    editingProduct ? "Save Changes" : "Add Product"
                  )}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inventory Selection Modal */}
      <AnimatePresence>
        {showInventoryModal && (
          <motion.div 
            key="inventory-modal"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-green-100"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-green-700">Select from Inventory</h3>
                  <motion.button
                    className="text-gray-500 hover:text-red-500 text-2xl font-bold hover:scale-110 transition-all"
                    onClick={() => setShowInventoryModal(false)}
                    whileTap={{ scale: 0.9 }}
                  >
                    ×
                  </motion.button>
                </div>
                <div className="mt-4">
                  <input
                    type="text"
                    placeholder="Search by product name, category, brand, SKU, or description..."
                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400"
                    value={inventorySearch}
                    onChange={(e) => {
                      setInventorySearch(e.target.value);
                      // Debounce the search to avoid too many API calls
                      clearTimeout(window.searchTimeout);
                      window.searchTimeout = setTimeout(() => {
                        fetchInventoryProducts(e.target.value, 1);
                        setInventoryPage(1); // Reset to first page on new search
                      }, 300);
                    }}
                  />
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                      <span className="ml-2">Searching inventory...</span>
                    </div>
                  </div>
                ) : inventoryProducts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {inventorySearch ? 
                      `No products found matching "${inventorySearch}"` : 
                      "No inventory products found"
                    }
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inventoryProducts.map((product) => {
                      const isInCatalog = catalogProducts.some(p => 
                        (p.product_id || p.id) === (product.id || product.product_id)
                      );
                      
                      return (
                      <div key={product.id || product.product_id} className={`border rounded-lg p-4 transition-colors ${
                        isInCatalog ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-300'
                      }`}>
                        <h4 className="font-semibold text-lg">{product.name}</h4>
                        <p className="text-gray-600 text-sm">{product.category || 'No category'} • {product.brand || 'No brand'}</p>
                        <p className="text-green-600 font-bold mt-2">₹{Number(product.price || 0).toLocaleString()}</p>
                        <p className="text-gray-500 text-xs mt-1">Stock: {product.warehouse_qty || 0}</p>
                        <p className="text-gray-600 text-sm mt-2">{product.description || 'No description'}</p>
                        
                        <motion.button
                          className={`mt-3 w-full py-2 px-4 rounded-lg transition-colors ${
                            isInCatalog 
                              ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                          whileTap={!isInCatalog ? { scale: 0.95 } : {}}
                          onClick={async () => {
                            if (isInCatalog) return;
                            
                            const result = await addToCatalog(product.id || product.product_id, {
                              custom_price: null,
                              min_order_qty: 1,
                              max_order_qty: null,
                              description_override: null,
                              is_active: true
                            });
                            if (result.success) {
                              setShowInventoryModal(false);
                            } else if (result.error !== 'Product already in catalog') {
                              alert('Failed to add to catalog: ' + result.error);
                            }
                          }}
                          disabled={loading || isInCatalog}
                        >
                          {loading ? "Adding..." : isInCatalog ? "Already in Catalog" : "Add to Catalog"}
                        </motion.button>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-gray-200">
                <div className="flex justify-center space-x-4">
                  <motion.button
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                    onClick={() => {
                      const newPage = Math.max(1, inventoryPage - 1);
                      setInventoryPage(newPage);
                      fetchInventoryProducts(inventorySearch, newPage);
                    }}
                    disabled={inventoryPage <= 1}
                    whileTap={{ scale: 0.95 }}
                  >
                    Previous
                  </motion.button>
                  <span className="self-center font-semibold">Page {inventoryPage}</span>
                  <motion.button
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    onClick={() => {
                      const newPage = inventoryPage + 1;
                      setInventoryPage(newPage);
                      fetchInventoryProducts(inventorySearch, newPage);
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Next
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
