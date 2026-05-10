import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

// --- NAVIGATION SECTION TITLES ---
const NAV_SECTIONS = [
  { key: "alerts", name: "Low Stock Alerts" },
  { key: "catalogue", name: "Product Catalogue" },
  { key: "logs", name: "Stock In/Out Logs" },
];

import { STOCK_API } from "../config.js";

const API_BASE = "https://ratilalsons-backend-api.onrender.com/api/stock";
const PAGE_SIZE = 10;

// --- COMPONENTS ---
function InventoryTopTitle({ search, setSearch }) {
  return (
    <motion.div
      className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between"
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
    >
      <div>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-left text-blue-700 leading-7 drop-shadow">
          Inventory Management
        </h2>
        <p className="text-gray-500 mt-1 text-left text-xs sm:text-sm md:text-base">
          Manage products, stock, and requisitions efficiently.
        </p>
      </div>
      <div className="mt-3 sm:mt-0 sm:ml-4 w-full sm:w-auto flex justify-start sm:justify-end">
        <motion.input
          type="text"
          placeholder="Search products or SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full sm:w-64 text-sm shadow-inner"
          whileFocus={{ scale: 1.03, borderColor: "#3b82f6" }}
        />
      </div>
    </motion.div>
  );
}

function PaginationControl({ page, setPage, hasPrev, hasNext, total }) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between w-full mt-1">
      <motion.button
        onClick={() => setPage((p) => Math.max(1, p - 1))}
        disabled={!hasPrev}
        className={`px-4 py-2 rounded shadow font-semibold transition
          ${hasPrev
            ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"}
        `}
        style={{ minWidth: 90, fontSize: "0.95rem" }}
        whileTap={{ scale: 0.96 }}
      >
        Previous
      </motion.button>
      <span className="text-sm sm:text-base text-gray-700 font-medium">{`Page ${page}`}</span>
      <motion.button
        onClick={() => setPage((p) => p + 1)}
        disabled={!hasNext}
        className={`px-4 py-2 rounded shadow font-semibold transition
          ${hasNext
            ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600"
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

function AddProductModal({ open, onClose, onAdd }) {
  const [form, setForm] = useState({
    name: "",
    sku: "",
    warehouse_qty: "",
    category: "",
    price: "",
    description: "",
    low_stock_threshold: 10,
    depots: [{ name: "", qty: "" }],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addDepotRow = () => {
    setForm((f) => ({ ...f, depots: [...f.depots, { name: "", qty: "" }] }));
  };
  const removeDepotRow = (idx) => {
    setForm((f) => ({
      ...f,
      depots: f.depots.filter((_, i) => i !== idx),
    }));
  };
  const changeDepot = (idx, field, value) => {
    setForm((f) => ({
      ...f,
      depots: f.depots.map((d, i) => (i === idx ? { ...d, [field]: value } : d)),
    }));
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!form.name) {
      setError("Name is required.");
      setLoading(false);
      return;
    }
    const depot_qty = {};
    form.depots.forEach((d) => {
      if (d.name && d.qty && !isNaN(d.qty)) depot_qty[d.name] = Number(d.qty);
    });
    if (
      (!form.warehouse_qty || isNaN(form.warehouse_qty) || Number(form.warehouse_qty) <= 0) &&
      Object.keys(depot_qty).length === 0
    ) {
      setError("At least Warehouse Qty or one Depot Qty is required.");
      setLoading(false);
      return;
    }
    const payload = {
      name: form.name,
      sku: form.sku ? form.sku : undefined,
      warehouse_qty: Number(form.warehouse_qty) || 0,
      depot_qty: depot_qty,
      low_stock_threshold: Number(form.low_stock_threshold) || 10,
      category: form.category,
      price: Number(form.price) || 0,
      description: form.description,
    };

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Something went wrong");
      }
      setForm({
        name: "",
        sku: "",
        warehouse_qty: "",
        depots: [{ name: "", qty: "" }],
        low_stock_threshold: 10,
        category: "",
        price: "",
        description: "",
      });
      onAdd();
      onClose();
    } catch (e) {
      setError(e.message || "Failed to add product");
    }
    setLoading(false);
  };

  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-gradient-to-br from-blue-50 via-white to-blue-100 rounded-2xl w-full max-w-xs sm:max-w-lg md:max-w-2xl shadow-2xl relative border-2 border-blue-400 px-4 sm:px-7 py-6 sm:py-10"
          initial={{ scale: 0.92, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 16, transition: { duration: 0.2 } }}
        >
          <button
            onClick={onClose}
            className="absolute top-2 right-3 text-blue-400 hover:text-red-500 text-2xl font-bold"
          >
            ×
          </button>
          <div className="flex flex-col items-center mb-3">
            <div className="bg-gradient-to-r from-blue-500 to-blue-400 text-white rounded-full w-14 h-14 flex items-center justify-center text-3xl mb-2 shadow-lg">+</div>
            <h2 className="text-lg sm:text-2xl font-bold mb-1 text-blue-700 text-center">Add New Product</h2>
            <p className="text-xs sm:text-sm text-blue-500 mb-2 text-center">
              Fill the form to add a new stock item to your inventory.
            </p>
          </div>
          <form className="space-y-3" onSubmit={handleSubmit} autoComplete="off">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Bulb"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">SKU</label>
                <input
                  name="sku"
                  className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400"
                  value={form.sku}
                  onChange={handleChange}
                  placeholder="Optional or auto-generated"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Category</label>
                <input
                  name="category"
                  className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400"
                  value={form.category}
                  onChange={handleChange}
                  placeholder="e.g. Electric"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Price</label>
                <input
                  name="price"
                  className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="e.g. 1000 per unit"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                name="description"
                className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400"
                value={form.description}
                onChange={handleChange}
                placeholder="Description of product"
                rows={2}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Warehouse Quantity</label>
                <input
                  name="warehouse_qty"
                  className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400"
                  type="number"
                  min="0"
                  value={form.warehouse_qty}
                  onChange={handleChange}
                  placeholder="e.g. 120"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Low Stock Threshold</label>
                <input
                  name="low_stock_threshold"
                  className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400"
                  type="number"
                  min="1"
                  value={form.low_stock_threshold}
                  onChange={handleChange}
                  placeholder="e.g. 10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Depot Stock</label>
              <div>
                {form.depots.map((d, idx) => (
                  <div key={idx} className="flex gap-2 mb-1">
                    <input
                      className="border p-2 rounded w-1/2 bg-blue-50 focus:border-blue-400"
                      placeholder="Depot"
                      value={d.name}
                      onChange={(e) => changeDepot(idx, "name", e.target.value)}
                    />
                    <input
                      className="border p-2 rounded w-1/2 bg-blue-50 focus:border-blue-400"
                      type="number"
                      min="0"
                      placeholder="Qty"
                      value={d.qty}
                      onChange={(e) => changeDepot(idx, "qty", e.target.value)}
                    />
                    <button
                      type="button"
                      className="text-red-500 font-bold"
                      onClick={() => removeDepotRow(idx)}
                      disabled={form.depots.length === 1}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" className="text-xs text-blue-600 underline" onClick={addDepotRow}>
                  + Add Depot
                </button>
              </div>
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <motion.button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-400 text-white font-semibold rounded px-4 py-2 mt-2 shadow-sm hover:from-blue-700 hover:to-blue-500"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {loading ? "Adding..." : "Add Product"}
            </motion.button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// TABLE COMPONENTS -- responsive, animated
function StockOutModal({ open, onClose, products, onSuccess }) {
  const STOCK_HEADS = ["Customer", "Site", "Contractor", "Staff"];

  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productForms, setProductForms] = useState({});
  const [locations, setLocations] = useState([]);
  const [refs, setRefs] = useState({ customers: [], sites: [], staff: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch locations and dropdown refs when modal opens
  useEffect(() => {
    if (!open) return;
    const token = localStorage.getItem("access_token");
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_BASE}/locations`, { headers }).then((r) => r.json()),
      fetch(`${API_BASE}/refs`, { headers }).then((r) => r.json()),
    ]).then(([locData, refData]) => {
      setLocations(locData.locations || []);
      setRefs({
        customers: refData.customers || [],
        sites: refData.sites || [],
        staff: refData.staff || [],
      });
    });
    // reset form
    setSelectedProducts([]);
    setProductForms({});
    setError("");
  }, [open]);

  const handleProductSelect = (e) => {
    const productId = e.target.value;
    if (!productId || selectedProducts.includes(productId)) return;

    setSelectedProducts([...selectedProducts, productId]);
    setProductForms({
      ...productForms,
      [productId]: {
        location: "",
        quantity: "",
        stock_head: "",
        reference_id: "",
        reference_name: "",
        remarks: "",
      }
    });
  };

  const handleRemoveProduct = (productId) => {
    setSelectedProducts(selectedProducts.filter(id => id !== productId));
    const newForms = { ...productForms };
    delete newForms[productId];
    setProductForms(newForms);
  };

  const handleProductFormChange = (productId, field, value) => {
    setProductForms({
      ...productForms,
      [productId]: {
        ...productForms[productId],
        [field]: value,
        // clear reference when head changes
        ...(field === "stock_head" ? { reference_id: "", reference_name: "" } : {}),
      }
    });
  };

  const handleRefSelect = (productId, selectedId, stockHead) => {
    let selectedName = selectedId;
    if (stockHead === "Customer") {
      selectedName = refs.customers.find((c) => c.id === selectedId)?.name || selectedId;
    } else if (stockHead === "Site") {
      selectedName = refs.sites.find((s) => s.id === selectedId)?.name || selectedId;
    } else if (stockHead === "Staff") {
      selectedName = refs.staff.find((s) => s.id === selectedId)?.name || selectedId;
    }
    setProductForms({
      ...productForms,
      [productId]: {
        ...productForms[productId],
        reference_id: selectedId,
        reference_name: selectedName,
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (selectedProducts.length === 0) {
      return setError("Please select at least one product.");
    }

    // Validate all product forms
    for (const productId of selectedProducts) {
      const form = productForms[productId];
      const product = products.find(p => (p.product_id || p.id) === productId);
      const productName = product?.name || 'Unknown Product';

      if (!form.location) return setError(`Select location for ${productName}`);
      if (!form.quantity || isNaN(form.quantity) || Number(form.quantity) <= 0)
        return setError(`Enter valid quantity for ${productName}`);
      if (!form.stock_head) return setError(`Select stock head for ${productName}`);
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");

      // Submit each product stock out
      for (const productId of selectedProducts) {
        const form = productForms[productId];
        const payload = {
          product_id: productId,
          location: form.location,
          quantity: Number(form.quantity),
          stock_head: form.stock_head,
          reference_id: form.reference_id || null,
          reference_name: form.reference_name || null,
          remarks: form.remarks || null,
        };

        const res = await fetch(`${API_BASE}/stock-out`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || `Stock out failed for ${products.find(p => (p.product_id || p.id) === productId)?.name}`);
        }
      }

      onSuccess();
      onClose();
    } catch (e) {
      setError(e.message || "Failed to record stock out");
    }
    setLoading(false);
  };

  if (!open) return null;

  // Render reference input based on stock_head
  const renderReferenceField = (productId, stockHead) => {
    if (!stockHead) return null;
    const form = productForms[productId];

    if (stockHead === "Contractor") {
      return (
        <div className="flex-1">
          <label className="block text-xs font-medium mb-1">Contractor Name</label>
          <input
            className="border p-2 rounded w-full bg-red-50 focus:border-red-400 text-sm"
            value={form.reference_name}
            onChange={(e) => handleProductFormChange(productId, "reference_name", e.target.value)}
            placeholder="e.g. ABC Contractors"
          />
        </div>
      );
    }

    const options =
      stockHead === "Customer"
        ? refs.customers
        : stockHead === "Site"
          ? refs.sites
          : refs.staff;
    return (
      <div className="flex-1">
        <label className="block text-xs font-medium mb-1">{stockHead} Name</label>
        <select
          className="border p-2 rounded w-full bg-red-50 focus:border-red-400 text-sm"
          value={form.reference_id}
          onChange={(e) => handleRefSelect(productId, e.target.value, stockHead)}
        >
          <option value="">-- Select {stockHead} --</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
    );
  };

  const availableProducts = products.filter(p => !selectedProducts.includes(p.product_id || p.id));

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-gradient-to-br from-red-50 via-white to-orange-50 rounded-2xl w-full max-w-4xl shadow-2xl relative border-2 border-red-400 px-4 sm:px-7 py-6 sm:py-10 max-h-[90vh] overflow-y-auto"
          initial={{ scale: 0.92, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 16, transition: { duration: 0.2 } }}
        >
          <button
            onClick={onClose}
            className="absolute top-2 right-3 text-red-400 hover:text-red-600 text-2xl font-bold"
          >
            ×
          </button>
          <div className="flex flex-col items-center mb-4">
            <div className="bg-gradient-to-r from-red-500 to-orange-400 text-white rounded-full w-14 h-14 flex items-center justify-center text-2xl mb-2 shadow-lg font-bold">
              OUT
            </div>
            <h2 className="text-lg sm:text-2xl font-bold mb-1 text-red-700 text-center">Log Stock Out (Multiple Products)</h2>
            <p className="text-xs sm:text-sm text-red-500 mb-2 text-center">
              Select multiple products and enter details for each one.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">
            {/* Product Selection */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Select Products <span className="text-red-500">*</span>
              </label>
              <select
                className="border p-2 rounded w-full bg-red-50 focus:border-red-400"
                onChange={handleProductSelect}
                value=""
              >
                <option value="">-- Add Product --</option>
                {availableProducts.map((p) => (
                  <option key={p.product_id || p.id} value={p.product_id || p.id}>
                    {p.name} {p.sku ? `(${p.sku})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Products Forms */}
            {selectedProducts.length > 0 && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-red-700">Selected Products ({selectedProducts.length})</h3>
                {selectedProducts.map((productId, idx) => {
                  const product = products.find(p => (p.product_id || p.id) === productId);
                  const form = productForms[productId] || {};

                  return (
                    <motion.div
                      key={productId}
                      className="bg-white border-2 border-red-200 rounded-lg p-4 space-y-3"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-gray-800">
                          {product?.name} {product?.sku ? `(${product.sku})` : ""}
                        </h4>
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(productId)}
                          className="text-red-500 hover:text-red-700 font-bold text-xl"
                        >
                          ×
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Location */}
                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Location <span className="text-red-500">*</span>
                          </label>
                          <select
                            className="border p-2 rounded w-full bg-red-50 focus:border-red-400 text-sm"
                            value={form.location}
                            onChange={(e) => handleProductFormChange(productId, "location", e.target.value)}
                            required
                          >
                            <option value="">-- Select Location --</option>
                            {locations.map((loc) => (
                              <option key={loc} value={loc}>{loc}</option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity Out */}
                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Quantity Out <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            className="border p-2 rounded w-full bg-red-50 focus:border-red-400 text-sm"
                            value={form.quantity}
                            onChange={(e) => handleProductFormChange(productId, "quantity", e.target.value)}
                            placeholder="e.g. 10"
                            required
                          />
                        </div>

                        {/* Stock Head */}
                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Stock Head <span className="text-red-500">*</span>
                          </label>
                          <select
                            className="border p-2 rounded w-full bg-red-50 focus:border-red-400 text-sm"
                            value={form.stock_head}
                            onChange={(e) => handleProductFormChange(productId, "stock_head", e.target.value)}
                            required
                          >
                            <option value="">-- Select Head --</option>
                            {STOCK_HEADS.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>

                        {/* Dynamic reference field */}
                        {renderReferenceField(productId, form.stock_head)}
                      </div>

                      {/* Remarks */}
                      <div>
                        <label className="block text-xs font-medium mb-1">Remarks</label>
                        <textarea
                          className="border p-2 rounded w-full bg-red-50 focus:border-red-400 text-sm"
                          value={form.remarks}
                          onChange={(e) => handleProductFormChange(productId, "remarks", e.target.value)}
                          placeholder="Optional notes"
                          rows={2}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {error && <div className="text-red-600 text-sm font-medium bg-red-50 p-3 rounded">{error}</div>}

            <motion.button
              type="submit"
              disabled={loading || selectedProducts.length === 0}
              className={`w-full bg-gradient-to-r from-red-600 to-orange-500 text-white font-semibold rounded px-4 py-3 mt-2 shadow-sm ${loading || selectedProducts.length === 0
                ? "opacity-50 cursor-not-allowed"
                : "hover:from-red-700 hover:to-orange-600"
                }`}
              whileHover={selectedProducts.length > 0 ? { scale: 1.02 } : {}}
              whileTap={selectedProducts.length > 0 ? { scale: 0.98 } : {}}
            >
              {loading ? "Submitting..." : `Submit Stock Out (${selectedProducts.length} ${selectedProducts.length === 1 ? 'Product' : 'Products'})`}
            </motion.button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function EditStockOutModal({ open, onClose, log, products, onSuccess }) {
  const STOCK_HEADS = ["Customer", "Site", "Contractor", "Staff"];
  const [form, setForm] = useState({});
  const [locations, setLocations] = useState([]);
  const [refs, setRefs] = useState({ customers: [], sites: [], staff: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !log) return;
    setForm({
      product_id: log.product_id || "",
      location: log.location || "",
      quantity: log.quantity || "",
      stock_head: log.stock_head || "",
      reference_id: log.reference_id || "",
      reference_name: log.reference_name || log.customer_name || "",
      remarks: log.remarks || "",
    });
    setError("");
    const token = localStorage.getItem("access_token");
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_BASE}/locations`, { headers }).then((r) => r.json()),
      fetch(`${API_BASE}/refs`, { headers }).then((r) => r.json()),
    ]).then(([locData, refData]) => {
      setLocations(locData.locations || []);
      setRefs({ customers: refData.customers || [], sites: refData.sites || [], staff: refData.staff || [] });
    });
  }, [open, log]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]: value,
      ...(name === "stock_head" ? { reference_id: "", reference_name: "" } : {}),
    }));
  };

  const handleRefSelect = (e) => {
    const selectedId = e.target.value;
    let selectedName = selectedId;
    if (form.stock_head === "Customer") selectedName = refs.customers.find((c) => c.id === selectedId)?.name || selectedId;
    else if (form.stock_head === "Site") selectedName = refs.sites.find((s) => s.id === selectedId)?.name || selectedId;
    else if (form.stock_head === "Staff") selectedName = refs.staff.find((s) => s.id === selectedId)?.name || selectedId;
    setForm((f) => ({ ...f, reference_id: selectedId, reference_name: selectedName }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.location) return setError("Select a location.");
    if (!form.quantity || isNaN(form.quantity) || Number(form.quantity) <= 0) return setError("Enter a valid quantity.");
    if (!form.stock_head) return setError("Select a stock head.");
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const logId = log.id || log.log_id;
      const res = await fetch(`${API_BASE}/logs/${logId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          quantity: Number(form.quantity),
          location: form.location,
          stock_head: form.stock_head,
          reference_id: form.reference_id || null,
          reference_name: form.reference_name || null,
          remarks: form.remarks || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Update failed");
      }
      onSuccess();
      onClose();
    } catch (e) {
      setError(e.message || "Failed to update log");
    }
    setLoading(false);
  };

  const renderReferenceField = () => {
    if (!form.stock_head) return null;
    if (form.stock_head === "Contractor") {
      return (
        <div>
          <label className="block text-sm font-medium mb-1">Contractor Name</label>
          <input
            name="reference_name"
            className="border p-2 rounded w-full bg-orange-50 focus:border-orange-400"
            value={form.reference_name}
            onChange={(e) => setForm((f) => ({ ...f, reference_name: e.target.value, reference_id: e.target.value }))}
            placeholder="e.g. ABC Contractors"
          />
        </div>
      );
    }
    const options = form.stock_head === "Customer" ? refs.customers : form.stock_head === "Site" ? refs.sites : refs.staff;
    return (
      <div>
        <label className="block text-sm font-medium mb-1">{form.stock_head} Name</label>
        <select className="border p-2 rounded w-full bg-orange-50 focus:border-orange-400" value={form.reference_id} onChange={handleRefSelect}>
          <option value="">-- Select {form.stock_head} --</option>
          {options.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
        </select>
      </div>
    );
  };

  if (!open || !log) return null;
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-2xl w-full max-w-xs sm:max-w-lg shadow-2xl relative border-2 border-orange-300 px-4 sm:px-7 py-6 sm:py-10"
          initial={{ scale: 0.92, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.97, opacity: 0, y: 16 }}
        >
          <button onClick={onClose} className="absolute top-3 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="flex flex-col items-center mb-4">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-orange-700">Edit Stock Out Entry</h2>
            <p className="text-xs text-gray-400 mt-0.5">Product: <span className="font-semibold text-gray-600">{log.product_name || log.product_id}</span></p>
          </div>
          <form className="space-y-3" onSubmit={handleSubmit} autoComplete="off">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Location <span className="text-red-500">*</span></label>
                <select name="location" className="border p-2 rounded w-full bg-orange-50 focus:border-orange-400" value={form.location} onChange={handleChange} required>
                  <option value="">-- Select Location --</option>
                  {locations.map((loc) => (<option key={loc} value={loc}>{loc}</option>))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Quantity Out <span className="text-red-500">*</span></label>
                <input name="quantity" type="number" min="1" className="border p-2 rounded w-full bg-orange-50 focus:border-orange-400" value={form.quantity} onChange={handleChange} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Stock Head <span className="text-red-500">*</span></label>
              <select name="stock_head" className="border p-2 rounded w-full bg-orange-50 focus:border-orange-400" value={form.stock_head} onChange={handleChange} required>
                <option value="">-- Select Head --</option>
                {STOCK_HEADS.map((h) => (<option key={h} value={h}>{h}</option>))}
              </select>
            </div>
            {renderReferenceField()}
            <div>
              <label className="block text-sm font-medium mb-1">Remarks</label>
              <textarea name="remarks" className="border p-2 rounded w-full bg-orange-50 focus:border-orange-400" value={form.remarks} onChange={handleChange} rows={2} placeholder="Optional notes" />
            </div>
            {error && <div className="text-red-600 text-sm font-medium">{error}</div>}
            <motion.button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded px-4 py-2 mt-2 shadow-sm transition-colors" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              {loading ? "Saving..." : "Save Changes"}
            </motion.button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// TABLE COMPONENTS -- responsive, animated
function EditProductModal({ open, onClose, product, onUpdate }) {
  const [form, setForm] = useState({
    name: "",
    sku: "",
    warehouse_qty: "",
    category: "",
    price: "",
    description: "",
    low_stock_threshold: 10,
    depots: [{ name: "", qty: "" }],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && product) {
      const depotEntries = product.depot_qty ? Object.entries(product.depot_qty).map(([name, qty]) => ({ name, qty: qty.toString() })) : [{ name: "", qty: "" }];
      setForm({
        name: product.name || "",
        sku: product.sku || "",
        warehouse_qty: product.warehouse_qty?.toString() || "",
        category: product.category || "",
        price: product.price?.toString() || "",
        description: product.description || "",
        low_stock_threshold: product.low_stock_threshold || 10,
        depots: depotEntries.length > 0 ? depotEntries : [{ name: "", qty: "" }],
      });
      setError("");
    }
  }, [open, product]);

  const addDepotRow = () => {
    setForm((f) => ({ ...f, depots: [...f.depots, { name: "", qty: "" }] }));
  };
  const removeDepotRow = (idx) => {
    setForm((f) => ({
      ...f,
      depots: f.depots.filter((_, i) => i !== idx),
    }));
  };
  const changeDepot = (idx, field, value) => {
    setForm((f) => ({
      ...f,
      depots: f.depots.map((d, i) => (i === idx ? { ...d, [field]: value } : d)),
    }));
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!form.name) {
      setError("Name is required.");
      setLoading(false);
      return;
    }

    const depot_qty = {};
    form.depots.forEach((d) => {
      if (d.name && d.qty && !isNaN(d.qty)) depot_qty[d.name] = Number(d.qty);
    });

    // Payload for product metadata update
    const productPayload = {
      name: form.name,
      sku: form.sku || null,
      low_stock_threshold: Number(form.low_stock_threshold) || 10,
      category: form.category || null,
      price: Number(form.price) || 0,
      description: form.description || null,
    };

    // Payload for stock update
    const stockPayload = {
      warehouse_qty: Number(form.warehouse_qty) || 0,
      depot_qty: depot_qty,
    };

    try {
      const token = localStorage.getItem("access_token");
      const productId = product.product_id || product.id;

      console.log("Updating product:", productId, productPayload);

      // Update product metadata
      const res = await fetch(`${API_BASE}/products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(productPayload),
      });

      console.log("Product update response status:", res.status);

      if (!res.ok) {
        const err = await res.json();
        console.error("Product update error:", err);
        throw new Error(err.detail || "Failed to update product");
      }

      // Update stock quantities
      console.log("Updating stock:", stockPayload);
      const stockRes = await fetch(`${API_BASE}/products/${productId}/stock`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(stockPayload),
      });

      console.log("Stock update response status:", stockRes.status);

      if (!stockRes.ok) {
        const stockErr = await stockRes.json();
        console.error("Stock update error:", stockErr);
        throw new Error(stockErr.detail || "Failed to update stock quantities");
      }

      const result = await stockRes.json();
      console.log("Update successful:", result);

      onUpdate();
      onClose();
    } catch (e) {
      console.error("Update error:", e);
      setError(e.message || "Failed to update product");
    }
    setLoading(false);
  };

  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-gradient-to-br from-orange-50 via-white to-orange-100 rounded-2xl w-full max-w-xs sm:max-w-lg md:max-w-2xl shadow-2xl relative border-2 border-orange-400 px-4 sm:px-7 py-6 sm:py-10"
          initial={{ scale: 0.92, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 16, transition: { duration: 0.2 } }}
        >
          <button
            onClick={onClose}
            className="absolute top-2 right-3 text-orange-400 hover:text-red-500 text-2xl font-bold"
          >
            ×
          </button>
          <div className="flex flex-col items-center mb-3">
            <div className="bg-gradient-to-r from-orange-500 to-orange-400 text-white rounded-full w-14 h-14 flex items-center justify-center text-3xl mb-2 shadow-lg">✎</div>
            <h2 className="text-lg sm:text-2xl font-bold mb-1 text-orange-700 text-center">Edit Product</h2>
            <p className="text-xs sm:text-sm text-orange-500 mb-2 text-center">
              Update product information and inventory levels.
            </p>
          </div>
          <form className="space-y-3" onSubmit={handleSubmit} autoComplete="off">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  className="border p-2 rounded w-full bg-orange-50 focus:border-orange-400"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Bulb"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">SKU</label>
                <input
                  name="sku"
                  className="border p-2 rounded w-full bg-orange-50 focus:border-orange-400"
                  value={form.sku}
                  onChange={handleChange}
                  placeholder="Optional or auto-generated"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Category</label>
                <input
                  name="category"
                  className="border p-2 rounded w-full bg-orange-50 focus:border-orange-400"
                  value={form.category}
                  onChange={handleChange}
                  placeholder="e.g. Electric"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Price</label>
                <input
                  name="price"
                  className="border p-2 rounded w-full bg-orange-50 focus:border-orange-400"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="e.g. 1000 per unit"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                name="description"
                className="border p-2 rounded w-full bg-orange-50 focus:border-orange-400"
                value={form.description}
                onChange={handleChange}
                placeholder="Description of product"
                rows={2}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Warehouse Quantity</label>
                <input
                  name="warehouse_qty"
                  className="border p-2 rounded w-full bg-orange-50 focus:border-orange-400"
                  type="number"
                  min="0"
                  value={form.warehouse_qty}
                  onChange={handleChange}
                  placeholder="e.g. 120"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Low Stock Threshold</label>
                <input
                  name="low_stock_threshold"
                  className="border p-2 rounded w-full bg-orange-50 focus:border-orange-400"
                  type="number"
                  min="1"
                  value={form.low_stock_threshold}
                  onChange={handleChange}
                  placeholder="e.g. 10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Depot Stock</label>
              <div>
                {form.depots.map((d, idx) => (
                  <div key={idx} className="flex gap-2 mb-1">
                    <input
                      className="border p-2 rounded w-1/2 bg-orange-50 focus:border-orange-400"
                      placeholder="Depot"
                      value={d.name}
                      onChange={(e) => changeDepot(idx, "name", e.target.value)}
                    />
                    <input
                      className="border p-2 rounded w-1/2 bg-orange-50 focus:border-orange-400"
                      type="number"
                      min="0"
                      placeholder="Qty"
                      value={d.qty}
                      onChange={(e) => changeDepot(idx, "qty", e.target.value)}
                    />
                    <button
                      type="button"
                      className="text-red-500 font-bold"
                      onClick={() => removeDepotRow(idx)}
                      disabled={form.depots.length === 1}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" className="text-xs text-orange-600 underline" onClick={addDepotRow}>
                  + Add Depot
                </button>
              </div>
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <motion.button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-600 to-orange-400 text-white font-semibold rounded px-4 py-2 mt-2 shadow-sm hover:from-orange-700 hover:to-orange-500"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {loading ? "Updating..." : "Update Product"}
            </motion.button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ProductInventoryTable({
  products, search, page, setPage, hasPrev, hasNext, onAddProduct, onEditProduct, onDeleteProduct
}) {
  const filtered = products.filter(
    (p) =>
      (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allDepots = Array.from(
    new Set(products.flatMap((p) => (p.depot_qty ? Object.keys(p.depot_qty) : [])))
  );

  return (
    <motion.div
      className="bg-white shadow-lg rounded-2xl mb-6 border border-blue-100"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between px-2 sm:px-6 py-3 border-b">
        <h3 className="text-lg font-bold text-blue-700">Product Catalogue & Inventory</h3>
        <motion.button
          onClick={onAddProduct}
          className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold rounded-lg px-4 py-2 text-sm shadow mt-3 sm:mt-0"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
        >
          + Add Product
        </motion.button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[700px] w-full text-[0.92rem]">
          <thead className="bg-gradient-to-r from-blue-50 to-green-50">
            <tr>
              <th className="px-2 sm:px-4 py-2 text-center text-xs font-semibold text-blue-700 uppercase">Date</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Product</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">SKU</th>
              <th className="px-2 sm:px-4 py-2 text-center text-xs font-semibold text-blue-700 uppercase">Warehouse</th>
              {allDepots.map((depot) => (
                <th key={depot} className="px-2 sm:px-4 py-2 text-center text-xs font-semibold text-blue-700 uppercase">{`Depot ${depot}`}</th>
              ))}
              <th className="px-2 sm:px-4 py-2 text-center text-xs font-semibold text-blue-700 uppercase">Category</th>
              <th className="px-2 sm:px-4 py-2 text-center text-xs font-semibold text-blue-700 uppercase">Description</th>
              <th className="px-2 sm:px-4 py-2 text-center text-xs font-semibold text-blue-700 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {paginated.length === 0 && (
              <tr>
                <td colSpan={9 + allDepots.length} className="py-2 text-center text-gray-400">
                  No products found.
                </td>
              </tr>
            )}
            {paginated.map((p, i) => {
              const productId = p.product_id || p.id;

              return (
                <motion.tr
                  key={productId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, type: "spring", stiffness: 120, damping: 14 }}
                  className="hover:bg-blue-50 transition"
                >
                  <td className="px-2 sm:px-4 py-2 text-center whitespace-nowrap text-xs sm:text-sm text-gray-500">
                    {p.date ? new Date(p.date).toLocaleDateString() : ""}
                  </td>
                  <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">{p.name}</td>
                  <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">{p.sku}</td>
                  <td className="px-2 sm:px-4 py-2 text-center whitespace-nowrap text-xs sm:text-sm">
                    <span
                      className={
                        p.warehouse_qty < (p.low_stock_threshold || 10)
                          ? "bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold"
                          : "bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold"
                      }
                    >
                      {p.warehouse_qty}
                    </span>
                  </td>
                  {/* Depot cells with red/green badge */}
                  {allDepots.map((depot) => {
                    const depotQty = p.depot_qty && p.depot_qty[depot] ? p.depot_qty[depot] : 0;
                    return (
                      <td key={depot} className="px-2 sm:px-4 py-2 text-center whitespace-nowrap text-xs sm:text-sm">
                        <span
                          className={
                            depotQty < (p.low_stock_threshold || 10)
                              ? "bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold"
                              : "bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold"
                          }
                        >
                          {depotQty}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-2 sm:px-4 py-2 text-center whitespace-nowrap text-xs sm:text-sm text-gray-500">{p.category}</td>
                  <td className="px-2 sm:px-4 py-2 text-center whitespace-nowrap text-xs sm:text-sm text-gray-500">{p.description}</td>
                  <td className="px-2 sm:px-4 py-2 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onEditProduct(p)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 text-xs font-medium transition-colors"
                        title="Edit Product"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Edit
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onDeleteProduct(p)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-medium transition-colors"
                        title="Delete Product"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                          <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Delete
                      </motion.button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 mb-2">
        <PaginationControl page={page} setPage={setPage} hasPrev={hasPrev} hasNext={hasNext} total={filtered.length} />
      </div>
    </motion.div>
  );
}

function LowStockAlerts({ alerts, page, setPage, hasPrev, hasNext }) {
  let rows = [];
  if (Array.isArray(alerts)) {
    rows = alerts;
  } else if (alerts && typeof alerts === "object") {
    rows = Object.values(alerts).flat();
  }
  const paginated = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <motion.div
      className="bg-white shadow-lg rounded-2xl mb-6 border border-red-100"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
    >
      <div className="px-2 sm:px-6 py-3 flex items-center gap-2 border-b">
        <svg
          className="h-5 w-5 sm:h-6 sm:w-6 text-red-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.668 1.732-3L13.732 4c-.77-1.332-2.694-1.332-3.464 0L3.34 16c-.77 1.332.192 3 1.732 3z"
          />
        </svg>
        <h3 className="text-lg font-bold text-red-600">Low Stock Alerts</h3>
      </div>
      <div className="px-2 sm:px-6 py-3">
        <div className="grid gap-3">
          {paginated.length === 0 && (
            <span className="text-green-700 text-sm">All stocks are above threshold.</span>
          )}
          {paginated.map((alert, idx) => (
            <motion.div
              key={idx}
              className="bg-red-50 border border-red-200 rounded-xl px-2 sm:px-4 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
            >
              <span className="text-[0.98rem]">
                <b>{alert.product_name}</b> (ID: {alert.product_id})
                {alert.location ? ` [${alert.location}]` : ""}: Low stock -{" "}
                <span className="font-semibold text-red-700">{alert.quantity}</span> (Threshold:{" "}
                <span className="font-semibold">{alert.threshold}</span>)
              </span>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="mt-4 mb-2">
        <PaginationControl page={page} setPage={setPage} hasPrev={hasPrev} hasNext={hasNext} total={rows.length} />
      </div>
    </motion.div>
  );
}

function StockLogs({ logs, search, page, setPage, hasPrev, hasNext, onStockOut, onEditLog }) {
  // Filter logs based on search input on relevant fields
  const filtered = logs.filter((log) =>
    (log.product_name && log.product_name.toLowerCase().includes(search.toLowerCase())) ||
    (log.type && log.type.toLowerCase().includes(search.toLowerCase())) ||
    (log.location && log.location.toLowerCase().includes(search.toLowerCase())) ||
    (log.customer_city && log.customer_city.toLowerCase().includes(search.toLowerCase())) ||
    (log.by && log.by.toLowerCase().includes(search.toLowerCase())) ||
    (log.customer_name && log.customer_name.toLowerCase().includes(search.toLowerCase())) ||
    (log.remarks && log.remarks.toLowerCase().includes(search.toLowerCase())) ||
    (log.customer_id && log.customer_id.toString().includes(search.toLowerCase()))
  );

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <motion.div
      className="bg-white shadow-lg rounded-2xl mb-6 border border-gray-100"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between px-2 sm:px-6 py-3 border-b">
        <h3 className="text-lg font-bold text-blue-700">Stock In/Out Logs</h3>
        <motion.button
          onClick={onStockOut}
          className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold rounded-lg px-4 py-2 text-sm shadow mt-3 sm:mt-0"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
        >
          − Log Stock Out
        </motion.button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[350px] sm:min-w-[600px] md:min-w-[860px] w-full text-xs sm:text-[0.92rem]">
          <thead className="bg-gradient-to-r from-blue-50 to-green-50">
            <tr>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Id</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Product</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Type</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Location</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Qty In</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Added By</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Stock Head</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Issued To</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Qty Out</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Remarks</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {paginated.length === 0 && (
              <tr>
                <td colSpan={10} className="py-2 text-center text-gray-400">
                  No logs found.
                </td>
              </tr>
            )}
            {paginated.map((log, idx) => (
              <motion.tr
                key={log.log_id || log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="hover:bg-gray-50 transition"
              >
                {/* Id column */}
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-blue-500 hover:underline cursor-pointer">
                  {log.type === "out" ? (
                    log.customer_id ? <Link to={`/order-summary/${log.customer_id}`}>{log.customer_id}</Link> : "-"
                  ) : (
                    log.by || "-"
                  )}
                </td>

                {/* Product column */}
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                  {log.product_name || log.product_id}
                </td>

                {/* Type column */}
                <td
                  className={`px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm font-semibold ${log.type === "in" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    } rounded`}
                >
                  {log.type?.toUpperCase()}
                </td>

                {/* Location column */}
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                  {log.type === "out" ? log.customer_city || log.location || "-" : log.location || "-"}
                </td>

                {/* Qty In */}
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                  {log.type === "in" ? log.quantity : "-"}
                </td>

                {/* Added By */}
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                  {log.by || "-"}
                </td>

                {/* Stock Head */}
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm">
                  {log.type === "out" ? (
                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-semibold">
                      {log.stock_head || "Customer"}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>

                {/* Issued To (reference_name or customer_name) */}
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                  {log.type === "out"
                    ? log.reference_name || log.customer_name || "-"
                    : "-"}
                </td>

                {/* Qty Out */}
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                  {log.type === "out" ? log.quantity : "-"}
                </td>

                {/* Remarks */}
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">{log.remarks || "-"}</td>

                {/* Actions */}
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap">
                  {log.type === "out" ? (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onEditLog(log)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 text-xs font-medium transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Edit
                    </motion.button>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 mb-2">
        <PaginationControl page={page} setPage={setPage} hasPrev={hasPrev} hasNext={hasNext} total={filtered.length} />
      </div>
    </motion.div>
  );
}

export default function InventoryManagement() {
  const [activeTab, setActiveTab] = useState("alerts");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Pagination
  const [alertsPage, setAlertsPage] = useState(1);
  const [productsPage, setProductsPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);

  // Modals
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showEditProduct, setShowEditProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showStockOut, setShowStockOut] = useState(false);
  const [editLog, setEditLog] = useState(null);

  // Fetch all products
  const fetchProducts = () => {
    setLoadingProducts(true);
    const token = localStorage.getItem("access_token");
    fetch(`${API_BASE}/products`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .finally(() => setLoadingProducts(false));
  };
  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    setLoadingAlerts(true);
    const token = localStorage.getItem("access_token");
    fetch(`${API_BASE}/alerts`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        if (data.low_stock_alerts) {
          const all = Object.values(data.low_stock_alerts).flat();
          setAlerts(all);
        } else {
          setAlerts([]);
        }
      })
      .finally(() => setLoadingAlerts(false));
  }, []);

  useEffect(() => {
    setLoadingLogs(true);
    const token = localStorage.getItem("access_token");
    fetch(`${API_BASE}/logs`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setLogs(data.logs || []))
      .finally(() => setLoadingLogs(false));
  }, []);

  // Filtered products for search
  const productsFiltered = products.filter(
    (p) =>
      (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  // Filtered logs for search
  const logsFiltered = logs.filter((log) =>
    (log.product_name && log.product_name.toLowerCase().includes(search.toLowerCase())) ||
    (log.type && log.type.toLowerCase().includes(search.toLowerCase())) ||
    (log.location && log.location.toLowerCase().includes(search.toLowerCase())) ||
    (log.customer_city && log.customer_city.toLowerCase().includes(search.toLowerCase())) ||
    (log.by && log.by.toLowerCase().includes(search.toLowerCase())) ||
    (log.customer_name && log.customer_name.toLowerCase().includes(search.toLowerCase())) ||
    (log.remarks && log.remarks.toLowerCase().includes(search.toLowerCase())) ||
    (log.customer_id && log.customer_id.toString().includes(search.toLowerCase()))
  );

  // Pagination controls
  const alertsHasPrev = alertsPage > 1;
  const alertsHasNext = alerts.length > alertsPage * PAGE_SIZE;

  const productsHasPrev = productsPage > 1;
  const productsHasNext = productsFiltered.length > productsPage * PAGE_SIZE;

  const logsHasPrev = logsPage > 1;
  const logsHasNext = logsFiltered.length > logsPage * PAGE_SIZE;

  // Reset pages on search or tab change
  useEffect(() => {
    setProductsPage(1);
  }, [search, activeTab]);

  useEffect(() => {
    setAlertsPage(1);
  }, [activeTab]);

  useEffect(() => {
    setLogsPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "logs") {
      setLoadingLogs(true);
      const token = localStorage.getItem("access_token");
      fetch(`${API_BASE}/logs`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => setLogs(data.logs || []))
        .finally(() => setLoadingLogs(false));
    }
  }, [activeTab]);

  const fetchLogs = () => {
    setLoadingLogs(true);
    const token = localStorage.getItem("access_token");
    fetch(`${API_BASE}/logs`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setLogs(data.logs || []))
      .finally(() => setLoadingLogs(false));
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setShowEditProduct(true);
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem("access_token");
      const productId = product.product_id || product.id;
      const res = await fetch(`${API_BASE}/products/${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to delete product");
      }

      // Refresh products list
      fetchProducts();
      alert("Product deleted successfully!");
    } catch (error) {
      alert(error.message || "Failed to delete product");
    }
  };

  return (
    <motion.div
      className="bg-gray-50 min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
    >
      <AddProductModal open={showAddProduct} onClose={() => setShowAddProduct(false)} onAdd={fetchProducts} />
      <EditProductModal
        open={showEditProduct}
        onClose={() => {
          setShowEditProduct(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        onUpdate={fetchProducts}
      />
      <StockOutModal
        open={showStockOut}
        onClose={() => setShowStockOut(false)}
        products={products}
        onSuccess={() => { fetchLogs(); fetchProducts(); }}
      />
      <EditStockOutModal
        open={!!editLog}
        onClose={() => setEditLog(null)}
        log={editLog}
        products={products}
        onSuccess={() => { setEditLog(null); fetchLogs(); fetchProducts(); }}
      />
      <div className="max-w-full sm:max-w-8xl mx-auto px-2 sm:px-4 lg:px-8 pt-4">
        {activeTab !== "alerts" && <InventoryTopTitle search={search} setSearch={setSearch} />}
        <motion.div
          className="border-b border-gray-200 bg-white mt-3 overflow-x-auto"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        >
          <nav className="-mb-px flex flex-row flex-nowrap space-x-2 sm:space-x-6">
            {NAV_SECTIONS.map((tab) => (
              <motion.button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`${activeTab === tab.key
                  ? "border-b-2 border-blue-500 text-blue-700 font-semibold"
                  : "border-b-2 border-transparent text-gray-700 hover:text-blue-600 hover:border-blue-300"
                  } whitespace-nowrap py-2 px-2 sm:py-3 sm:px-4 font-medium text-xs sm:text-base text-left transition focus:outline-none`}
                style={{ minWidth: 90 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                {tab.name}
              </motion.button>
            ))}
          </nav>
        </motion.div>
        <div className="py-4">
          <AnimatePresence mode="wait">
            {activeTab === "alerts" &&
              (loadingAlerts ? (
                <motion.div key="loading-alerts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Loading...
                </motion.div>
              ) : (
                <LowStockAlerts
                  key="alerts"
                  alerts={alerts}
                  page={alertsPage}
                  setPage={setAlertsPage}
                  hasPrev={alertsHasPrev}
                  hasNext={alertsHasNext}
                />
              ))}
            {activeTab === "catalogue" &&
              (loadingProducts ? (
                <motion.div key="loading-products" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Loading...
                </motion.div>
              ) : (
                <ProductInventoryTable
                  key="catalogue"
                  products={productsFiltered}
                  search={search}
                  page={productsPage}
                  setPage={setProductsPage}
                  hasPrev={productsHasPrev}
                  hasNext={productsHasNext}
                  onAddProduct={() => setShowAddProduct(true)}
                  onEditProduct={handleEditProduct}
                  onDeleteProduct={handleDeleteProduct}
                />
              ))}
            {activeTab === "logs" &&
              (loadingLogs ? (
                <motion.div key="loading-logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Loading...
                </motion.div>
              ) : (
                <StockLogs
                  key="logs"
                  logs={logsFiltered}
                  search={search}
                  page={logsPage}
                  setPage={setLogsPage}
                  hasPrev={logsHasPrev}
                  hasNext={logsHasNext}
                  onStockOut={() => setShowStockOut(true)}
                  onEditLog={(log) => setEditLog(log)}
                />
              ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}


