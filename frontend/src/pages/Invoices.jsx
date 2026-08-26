import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { 
  FileText, DollarSign, Clock, User2, CheckCircle, XCircle, 
  Loader2, AlertCircle, Download, Printer, Edit3, Trash2, Plus, Send 
} from "lucide-react";
import { usePermissions } from "../components/contexts/PermissionContext.jsx";
import { API_URL, INVOICE_API, getAuthHeaders } from "../config.js";

// Add inline styles for animations
const styles = `
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slide-up {
    from { 
      opacity: 0; 
      transform: translateY(20px) scale(0.95); 
    }
    to { 
      opacity: 1; 
      transform: translateY(0) scale(1); 
    }
  }
  
  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
  
  .animate-slide-up {
    animation: slide-up 0.4s ease-out;
  }
  
  .glass-effect {
    backdrop-filter: blur(10px);
    background: rgba(255, 255, 255, 0.9);
  }
  
  @media print {
    aside, .gap-4, button, nav, header, [role="navigation"] {
      display: none !important;
    }
    body, .min-h-screen, .bg-gray-50 {
      background: white !important;
    }
    main {
      padding: 0 !important;
      margin: 0 !important;
      width: 100% !important;
    }
    .invoice-card {
      box-shadow: none !important;
      border: none !important;
      padding: 0 !important;
    }
    .print-only {
      display: block !important;
    }
  }
  
  .print-only {
    display: none;
  }
`;

// Inject styles
if (!document.getElementById('invoice-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'invoice-styles';
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(amount || 0);
}

function statusColor(status) {
  const colors = {
    draft: "text-gray-600 bg-gray-50 border-gray-200",
    sent: "text-blue-700 bg-blue-50 border-blue-200",
    paid: "text-green-600 bg-green-50 border-green-200",
    partial: "text-yellow-700 bg-yellow-50 border-yellow-200",
    overdue: "text-red-600 bg-red-50 border-red-200"
  };
  return colors[status?.toLowerCase()] || "text-gray-600 bg-gray-50 border-gray-200";
}

export default function Invoices() {
  const { userPermissions } = usePermissions();
  const { invoice_id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [invoices, setInvoices] = useState([]);
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    status: [],
    overdue: false,
    customer_id: "",
    search: ""
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [contractorName, setContractorName] = useState("");
  const [activeProductIndex, setActiveProductIndex] = useState(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false); // Loading state for invoice creation
  const [newInvoice, setNewInvoice] = useState({
    customer_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_address: '',
    customer_city: '',
    customer_state: '',
    customer_country: '',
    customer_company: '',
    customer_type: '',
    items: [{ description: '', quantity: 1, unit_price: 0, product_id: '', sku: '', category: '', available_qty: 0 }],
    tax_rate: 18,
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
    issue_date: new Date().toISOString().split('T')[0], // Today
    status: 'pending' // Default status is pending
  });

  // Check permissions - allow admin users or users with specific permission
  const userStr = localStorage.getItem("user");
  const userObj = userStr ? JSON.parse(userStr) : null;
  const isAdmin = userObj?.roles?.includes("admin") || false;
  const hasAccountsAccess = isAdmin || userPermissions?.includes("invoices:access") || false;

  // Fetch invoices list
  const fetchInvoices = useCallback(async () => {
    if (!hasAccountsAccess) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page,
        limit: 10
      });
      
      // Add filters if they exist
      if (filters.status && filters.status.length > 0) {
        params.append('status', filters.status[0]); // Backend expects single status
      }
      if (filters.overdue) {
        params.append('overdue', 'true');
      }
      if (filters.customer_id) {
        params.append('customer_id', filters.customer_id);
      }
      
      const res = await fetch(`${INVOICE_API.LIST}?${params}`, {
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
        setTotal(data.total || 0);
      } else {
        console.error('Failed to fetch invoices:', await res.text());
      }
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
    } finally {
      setLoading(false);
    }
  }, [page, filters, hasAccountsAccess]);

  // Fetch single invoice
  const fetchInvoice = useCallback(async () => {
    if (!invoice_id || !hasAccountsAccess) return;
    
    setLoading(true);
    try {
      const res = await fetch(INVOICE_API.GET_INVOICE(invoice_id), {
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        const data = await res.json();
        setCurrentInvoice(data);
      }
    } catch (error) {
      console.error("Failed to fetch invoice:", error);
    } finally {
      setLoading(false);
    }
  }, [invoice_id, hasAccountsAccess]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!hasAccountsAccess) return;
    
    try {
      const res = await fetch(INVOICE_API.STATS, {
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, [hasAccountsAccess]);

  // Fetch all billable entities: Customers, Sites, Staff
  const fetchCustomers = useCallback(async () => {
    if (!hasAccountsAccess) return;

    setLoadingCustomers(true);
    try {
      const res = await fetch(`${API_URL}/api/stock/refs`, {
        headers: getAuthHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        const customers = (data.customers || []).map(c => ({ ...c, _type: 'Customer' }));
        const sites = (data.sites || []).map(s => ({ ...s, _type: 'Site' }));
        const staff = (data.staff || []).map(s => ({ ...s, _type: 'Staff' }));
        setCustomers([...customers, ...sites, ...staff]);
      } else {
        console.error('Failed to fetch refs:', res.status);
        setCustomers([]);
      }
    } catch (error) {
      console.error('Failed to fetch refs:', error);
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  }, [hasAccountsAccess]);

  // Fetch products for selection
  const fetchProducts = useCallback(async () => {
    if (!hasAccountsAccess) return;
    
    setLoadingProducts(true);
    try {
      const res = await fetch(`${API_URL}/api/stock/products`, {
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('Fetched products:', data); // Debug log
        setProducts(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch products:', res.status, res.statusText);
        setProducts([]);
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [hasAccountsAccess]);

  // Handle selection for any entity type (Customer / Site / Staff / Contractor)
  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);

    const addressParts = [
      customer.address || customer.site_location,
      customer.city,
      customer.state,
      customer.country
    ].filter(Boolean);

    setNewInvoice(prev => ({
      ...prev,
      customer_id: customer.id || '',
      customer_name: customer.name || '',
      customer_email: customer.email || '',
      customer_phone: customer.phone || '',
      customer_address: addressParts.join(', ') || '',
      customer_city: customer.city || '',
      customer_state: customer.state || '',
      customer_country: customer.country || '',
      customer_company: customer.company || '',
      customer_type: customer._type || customer.customer_type || 'Customer'
    }));
  };

  // Handle product selection for items
  const handleProductSelect = (index, product) => {
    console.log('Selected product:', product); // Debug log
    setNewInvoice(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? {
          ...item,
          description: product.name || '',
          unit_price: product.price || 0,
          product_id: product.product_id || '',
          sku: product.sku || '',
          category: product.category || '',
          available_qty: product.warehouse_qty || 0,
          depot_qty: product.depot_qty || {}
        } : item
      )
    }));
  };

  useEffect(() => {
    if (invoice_id) {
      fetchInvoice();
    } else {
      fetchStats();
      fetchInvoices();
    }
  }, [invoice_id, fetchInvoice, fetchInvoices, fetchStats]);

  // Fetch customers and products when modal opens
  useEffect(() => {
    if (showCreateModal) {
      fetchCustomers();
      fetchProducts();
    }
  }, [showCreateModal, fetchCustomers, fetchProducts]);



  const sendInvoice = async (invoiceId) => {
    try {
      const res = await fetch(INVOICE_API.SEND_INVOICE(invoiceId), {
        method: "POST",
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        fetchInvoices();
        fetchStats(); // Refresh statistics cards
        if (currentInvoice?.id === invoiceId) {
          fetchInvoice();
        }
        // Show success message
        alert("Invoice sent successfully!");
      } else {
        const errorData = await res.json();
        alert(errorData.detail || "Failed to send invoice");
      }
    } catch (error) {
      console.error("Failed to send invoice:", error);
      alert("Failed to send invoice");
    }
  };

  const markPaid = async (invoiceId) => {
    try {
      const res = await fetch(INVOICE_API.MARK_PAID(invoiceId), {
        method: "POST",
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        fetchInvoices();
        fetchStats(); // Refresh statistics cards
        if (currentInvoice?.id === invoiceId) {
          fetchInvoice();
        }
        alert("Invoice marked as paid successfully!");
      } else {
        const errorData = await res.json();
        alert(errorData.detail || "Failed to mark invoice as paid");
      }
    } catch (error) {
      console.error("Failed to mark paid:", error);
      alert("Failed to mark invoice as paid");
    }
  };

  const deleteInvoice = async (invoiceId) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    
    try {
      const res = await fetch(INVOICE_API.DELETE(invoiceId), {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        fetchInvoices();
        fetchStats();
        if (currentInvoice?.id === invoiceId) {
          navigate("/invoices");
        }
        alert("Invoice deleted successfully!");
      } else {
        const errorData = await res.json();
        alert(errorData.detail || "Failed to delete invoice");
      }
    } catch (error) {
      console.error("Failed to delete invoice:", error);
      alert("Failed to delete invoice");
    }
  };

  const downloadInvoice = async (invoiceId) => {
    try {
      const res = await fetch(INVOICE_API.DOWNLOAD(invoiceId), {
        headers: getAuthHeaders()
      });
      
      if (res.ok) {
        const blob = await res.blob();
        
        if (blob.size > 0) {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Invoice_${invoiceId}.pdf`;
          link.style.display = 'none';
          document.body.appendChild(link);
          
          link.click();
          
          setTimeout(() => {
            if (document.body.contains(link)) {
              document.body.removeChild(link);
            }
            window.URL.revokeObjectURL(url);
          }, 1000);
          
          alert('Invoice PDF downloaded successfully!');
        } else {
          throw new Error('Empty PDF file received');
        }
      } else {
        const errorData = await res.json();
        alert(errorData.detail || "Failed to download invoice");
      }
    } catch (error) {
      console.error("Failed to download invoice:", error);
      alert("Failed to download invoice: " + error.message);
    }
  };

  const printInvoice = () => {
    window.print();
  };

  const editInvoice = (invoice) => {
    setEditingInvoice(invoice);
    setSelectedCustomer({
      id: invoice.customer_id || 'dummy-customer-id',
      name: invoice.customer_name || '',
      email: invoice.customer_email || '',
      phone: invoice.customer_phone || '',
      address: invoice.customer_address || '',
      city: invoice.customer_city || '',
      state: invoice.customer_state || '',
      country: invoice.customer_country || '',
      company: invoice.customer_company || '',
      customer_type: invoice.customer_type || 'regular'
    });
    setNewInvoice({
      customer_id: invoice.customer_id || '',
      customer_name: invoice.customer_name || '',
      customer_email: invoice.customer_email || '',
      customer_phone: invoice.customer_phone || '',
      customer_address: invoice.customer_address || '',
      customer_city: invoice.customer_city || '',
      customer_state: invoice.customer_state || '',
      customer_country: invoice.customer_country || '',
      customer_company: invoice.customer_company || '',
      customer_type: invoice.customer_type || 'regular',
      items: invoice.items?.map(item => ({
        description: item.description || item.name || '',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        product_id: item.product_id || ''
      })) || [{ description: '', quantity: 1, unit_price: 0 }],
      tax_rate: invoice.tax_rate || 18,
      due_date: invoice.due_date ? new Date(invoice.due_date).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      issue_date: invoice.issue_date ? new Date(invoice.issue_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      status: invoice.status || 'pending'
    });
    setShowCreateModal(true);
  };

  const generateInvoice = async () => {
    // Prevent double submission
    if (creatingInvoice) return;
    
    // Allow invoice generation for all entity types
    const selectedType = selectedCustomer?._type;
    const isContractor = selectedCustomer?._type === 'Contractor';
    const billToName = newInvoice.customer_name || selectedCustomer?.name || '';
    const billToType = selectedCustomer?._type || newInvoice.customer_type || 'Customer';

    if (!billToName && !editingInvoice) {
      alert("Please select or enter a bill-to party before generating an invoice.");
      return;
    }

    // Determine if this is a Customer invoice (with pricing) or other entity (without pricing)
    const isCustomerInvoice = billToType === 'Customer';

    setCreatingInvoice(true); // Start loading
    try {
      // Calculate totals (only for Customer invoices)
      const subtotal = isCustomerInvoice 
        ? newInvoice.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
        : 0;
      const tax_amount = isCustomerInvoice ? (subtotal * newInvoice.tax_rate) / 100 : 0;
      const total_amount = isCustomerInvoice ? subtotal + tax_amount : 0;
      
      // Transform items to match backend schema, filtering out empty items
      const transformedItems = newInvoice.items
        .filter(item => item.description && item.description.trim() !== '')
        .map(item => ({
          name: item.description,
          description: item.description,
          quantity: item.quantity,
          unit_price: isCustomerInvoice ? item.unit_price : 0, // Only include price for Customer
          tax_rate: isCustomerInvoice ? newInvoice.tax_rate : 0
        }));
      
      // Validate that we have at least one valid item
      if (transformedItems.length === 0) {
        alert("Please add at least one valid item with description.");
        setCreatingInvoice(false);
        return;
      }
      
      // For Customer invoices, validate that items have prices
      if (isCustomerInvoice) {
        const itemsWithoutPrice = transformedItems.filter(item => !item.unit_price || item.unit_price <= 0);
        if (itemsWithoutPrice.length > 0) {
          alert("Please add prices for all items in Customer invoice.");
          setCreatingInvoice(false);
          return;
        }
      }
      
      // Recalculate totals based on filtered items (for Customer only)
      const filteredSubtotal = isCustomerInvoice 
        ? transformedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
        : 0;
      const filteredTaxAmount = isCustomerInvoice ? (filteredSubtotal * newInvoice.tax_rate) / 100 : 0;
      const filteredTotalAmount = isCustomerInvoice ? filteredSubtotal + filteredTaxAmount : 0;
      
      const invoiceData = {
        customer_id: selectedCustomer?.id || editingInvoice?.customer_id || null,
        customer_name: billToName || newInvoice.customer_name,
        customer_email: newInvoice.customer_email,
        customer_phone: newInvoice.customer_phone,
        customer_address: newInvoice.customer_address,
        customer_type: billToType,
        items: transformedItems,
        subtotal: filteredSubtotal,
        tax_rate: isCustomerInvoice ? newInvoice.tax_rate : 0, // Add tax_rate to invoice level
        tax_amount: filteredTaxAmount,
        total_amount: filteredTotalAmount,
        issue_date: newInvoice.issue_date ? new Date(newInvoice.issue_date).toISOString() : new Date().toISOString(),
        due_date: newInvoice.due_date ? new Date(newInvoice.due_date).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: newInvoice.notes || '',
        status: newInvoice.status || 'pending', // Use status from form, default to pending
        show_pricing: isCustomerInvoice // Flag to indicate if pricing should be shown
      };
      
      const url = editingInvoice ? INVOICE_API.UPDATE(editingInvoice.id) : INVOICE_API.CREATE;
      const method = editingInvoice ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(invoiceData)
      });
      
      if (res.ok) {
        setShowCreateModal(false);
        setEditingInvoice(null);
        setSelectedCustomer(null);
        setContractorName('');
        setProductSearchTerm("");
        setNewInvoice({
          customer_id: '',
          customer_name: '',
          customer_email: '',
          customer_phone: '',
          customer_address: '',
          customer_city: '',
          customer_state: '',
          customer_country: '',
          customer_company: '',
          customer_type: '',
          items: [{ description: '', quantity: 1, unit_price: 0 }],
          tax_rate: 18,
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          issue_date: new Date().toISOString().split('T')[0],
          status: 'pending'
        });
        fetchInvoices();
        fetchStats();
        alert(editingInvoice ? "Invoice updated successfully!" : "Invoice created successfully!");
      } else {
        const errorData = await res.json();
        alert(errorData.detail || "Failed to save invoice");
      }
    } catch (error) {
      console.error("Failed to create invoice:", error);
      alert("Failed to save invoice");
    } finally {
      setCreatingInvoice(false); // Stop loading
    }
  };

  const addItem = () => {
    setNewInvoice(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unit_price: 0, product_id: '', sku: '', category: '', available_qty: 0 }]
    }));
  };

  const removeItem = (index) => {
    setNewInvoice(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index, field, value) => {
    setNewInvoice(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  if (!hasAccountsAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-8">You need invoices:access permission</p>
          <button 
            onClick={() => navigate("/dashboard")}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // List View
  if (!invoice_id) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoices Dashboard</h1>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-gray-100 shadow-lg mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => { fetchInvoices(); fetchStats(); }}
                disabled={loading}
                className="group flex items-center space-x-3 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-medium disabled:transform-none"
              >
                <div className="flex items-center justify-center w-7 h-7 bg-white/20 rounded-lg group-hover:bg-white/30 transition-all duration-200">
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  )}
                </div>
                <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
            
            <button 
              onClick={() => setShowCreateModal(true)}
              className="group flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-medium"
            >
              <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-lg group-hover:bg-white/30 transition-all duration-200">
                <Plus className="w-4 h-4" />
              </div>
              <span>Create New Invoice</span>
            </button>
          </div>
        </div>

        {/* Professional Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="group bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg hover:shadow-2xl border border-gray-100 hover:border-blue-200 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Draft Invoices</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{stats.total_draft || 0}</p>
              </div>
              <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
                <FileText className="text-white w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.total_unpaid || 0}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Revenue</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(stats.total_paid || 0)}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{stats.total_overdue || 0}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center w-full lg:w-auto">
              <div className="relative w-full lg:w-auto">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input 
                  type="text" 
                  placeholder="Search invoices..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full lg:w-64 text-sm"
                />
              </div>

              <select 
                value={filters.status?.[0] || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value ? [e.target.value] : [] }))}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>

              <label className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={filters.overdue}
                  onChange={(e) => setFilters(prev => ({ ...prev, overdue: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-700">Show Overdue</span>
              </label>
            </div>
          </div>
        </div>

        {/* Detailed Invoice Log */}
        <div className="bg-white shadow-lg rounded-2xl mb-6 border border-blue-100 overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center justify-between px-2 sm:px-6 py-3 border-b border-gray-100">
            <h3 className="text-lg font-bold text-blue-700">Detailed Invoice Log</h3>
          </div>
            <div className="overflow-x-auto">
              <table className="min-w-[700px] w-full text-[0.92rem]">
                <thead className="bg-gradient-to-r from-blue-50 to-green-50">
                  <tr>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-blue-700 uppercase">Invoice #</th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase">Entity</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-blue-700 uppercase">Issue Date</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-blue-700 uppercase">Amount</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-blue-700 uppercase">Due Date</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-blue-700 uppercase">Status</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-blue-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="py-20 text-center">
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <div className="relative">
                            <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
                            <div className="absolute inset-0 w-12 h-12 border-4 border-purple-200 rounded-full animate-pulse"></div>
                          </div>
                          <p className="text-lg font-semibold text-slate-600">Loading invoices...</p>
                          <p className="text-sm text-slate-400">Please wait while we fetch your data</p>
                        </div>
                      </td>
                    </tr>
                  ) : invoices.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-24 text-center">
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <FileText className="w-10 h-10 text-slate-400" />
                          </div>
                          <p className="text-xl font-semibold text-slate-600">No invoices found</p>
                          <p className="text-sm text-slate-400 max-w-md">Get started by creating your first invoice or adjust your filters to see existing invoices.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    invoices.map((invoice, index) => (
                      <tr key={invoice.id} className="hover:bg-blue-50 transition">
                        <td className="px-2 sm:px-4 py-3 text-center whitespace-nowrap text-xs sm:text-sm text-gray-500">
                          {invoice.invoice_number}
                        </td>
                        <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                          {invoice.customer_name || 'N/A'}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center whitespace-nowrap text-xs sm:text-sm text-gray-600">
                          {formatDate(invoice.issue_date || invoice.created_at)}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center whitespace-nowrap text-xs sm:text-sm text-gray-700 font-semibold">
                          {formatCurrency(invoice.total_amount)}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center whitespace-nowrap text-xs sm:text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            new Date(invoice.due_date) < new Date() && invoice.status !== 'paid' 
                              ? 'bg-red-100 text-red-700' 
                              : 'text-gray-500'
                          }`}>
                            {formatDate(invoice.due_date)}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center whitespace-nowrap text-xs sm:text-sm">
                          <span className={`${
                            invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                            invoice.status === 'overdue' || (new Date(invoice.due_date) < new Date() && invoice.status !== 'paid') ? 'bg-red-100 text-red-700' :
                            invoice.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                            'bg-blue-100 text-blue-700'
                          } px-2.5 py-1 rounded text-xs font-semibold uppercase`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center whitespace-nowrap text-xs sm:text-sm font-medium">
                          <div className="flex items-center justify-center gap-2 lg:gap-3">
                            <button onClick={() => navigate(`/invoices/${invoice.id}`)} title="View Invoice" className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all">
                              <FileText className="w-4 h-4" />
                            </button>
                            <button onClick={() => editInvoice(invoice)} title="Edit Invoice" className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-all">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {invoice.status !== 'paid' && (
                              <button onClick={() => markPaid(invoice.id)} title="Mark as Paid" className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-all">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => deleteInvoice(invoice.id)} title="Delete Invoice" className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
        </div>

        {/* Enhanced Pagination */}
            {total > 10 && (
              <div className="flex justify-center gap-2 mt-6">
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 text-gray-700 hover:bg-gray-50"
                >
                  Previous
                </button>
                <div className="flex items-center">
                  <span className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-sm font-semibold">
                    Page {page} of {Math.ceil(total / 10)}
                  </span>
                </div>
                <button 
                  disabled={page * 10 >= total}
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 text-gray-700 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}

          {/* Enhanced Create Invoice Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden animate-slide-up">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-8 text-white">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-black">
                          {editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
                        </h2>
                        <p className="text-white/80 mt-1 font-medium">
                          {editingInvoice ? 'Update invoice details' : 'Generate a professional invoice for your customer'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setShowCreateModal(false);
                        setEditingInvoice(null);
                        setSelectedCustomer(null);
                        setContractorName('');
                        setProductSearchTerm("");
                        setNewInvoice({
                          customer_id: '',
                          customer_name: '',
                          customer_email: '',
                          customer_phone: '',
                          customer_address: '',
                          customer_city: '',
                          customer_state: '',
                          customer_country: '',
                          customer_company: '',
                          customer_type: '',
                          items: [{ description: '', quantity: 1, unit_price: 0 }],
                          tax_rate: 18,
                          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                          issue_date: new Date().toISOString().split('T')[0],
                          status: 'pending'
                        });
                      }}
                      className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-white hover:rotate-90 transition-all duration-200"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Modal Content */}
                <div className="p-8 overflow-y-auto max-h-[calc(95vh-120px)]">
                  <div className="space-y-10">

                    {/* Bill-to Type Notice Banner */}
                    <div className="flex items-start gap-4 p-5 bg-blue-50 border-2 border-blue-200 rounded-2xl">
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-blue-800 text-sm mb-1">Invoice Generation for All Entities</p>
                        <p className="text-blue-700 text-sm">
                          You can generate invoices for <strong>Customer, Staff, Site, or Contractor</strong>.
                          <br />
                          <strong>Note:</strong> Pricing details (amount, price) will <strong>only be shown for Customer invoices</strong>. 
                          For other entities, only item lists will be displayed.
                        </p>
                      </div>
                    </div>

                    {/* Enhanced Customer Information */}
                    <div className="bg-gradient-to-br from-slate-50 to-white p-8 rounded-2xl border-2 border-slate-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                          <User2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-800">Bill-to Information</h3>
                          <p className="text-sm text-slate-500 font-medium">Select any entity — Pricing shown only for Customer invoices</p>
                        </div>
                      </div>
                      
                      {/* Bill-to Party Selection */}
                      <div className="mb-6">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Bill To *</label>
                        <div className="relative">
                          <select
                            value={selectedCustomer?._type === 'Contractor' ? '__contractor__' : (selectedCustomer?.id || '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) {
                                setSelectedCustomer(null);
                                setContractorName('');
                                setNewInvoice(prev => ({
                                  ...prev,
                                  customer_id: '', customer_name: '', customer_email: '',
                                  customer_phone: '', customer_address: '', customer_city: '',
                                  customer_state: '', customer_country: '', customer_company: '',
                                  customer_type: ''
                                }));
                              } else if (val === '__contractor__') {
                                setSelectedCustomer({ _type: 'Contractor', id: '', name: '' });
                                setContractorName('');
                                setNewInvoice(prev => ({
                                  ...prev,
                                  customer_id: '', 
                                  customer_name: '', 
                                  customer_email: '',
                                  customer_phone: '',
                                  customer_address: '',
                                  customer_type: 'Contractor'
                                }));
                              } else {
                                const entity = customers.find(c => c.id === val);
                                if (entity) handleCustomerSelect(entity);
                              }
                            }}
                            className="w-full px-4 py-4 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium text-slate-700 hover:border-slate-300 cursor-pointer"
                          >
                            <option value="">— Select bill-to party —</option>

                            {/* Customers group */}
                            {customers.filter(c => c._type === 'Customer').length > 0 && (
                              <optgroup label="👤 Customers">
                                {customers.filter(c => c._type === 'Customer').map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </optgroup>
                            )}

                            {/* Sites group */}
                            {customers.filter(c => c._type === 'Site').length > 0 && (
                              <optgroup label="🏗️ Sites">
                                {customers.filter(c => c._type === 'Site').map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </optgroup>
                            )}

                            {/* Staff group */}
                            {customers.filter(c => c._type === 'Staff').length > 0 && (
                              <optgroup label="👷 Staff">
                                {customers.filter(c => c._type === 'Staff').map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </optgroup>
                            )}

                            {/* Contractor group */}
                            <optgroup label="🔧 Contractor">
                              <option value="__contractor__">Enter Contractor Name manually...</option>
                            </optgroup>
                          </select>

                          {loadingCustomers && (
                            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                            </div>
                          )}
                        </div>

                        {/* Selected party preview - Only show for non-Contractor selections */}
                        {selectedCustomer && selectedCustomer._type !== 'Contractor' && (
                          <div className="mt-3 p-4 bg-purple-50 border-2 border-purple-200 rounded-xl">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                                {selectedCustomer.name ? selectedCustomer.name[0].toUpperCase() : '?'}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-bold text-slate-900 text-lg">{selectedCustomer.name}</p>
                                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    selectedCustomer._type === 'Customer' ? 'bg-blue-100 text-blue-700' :
                                    selectedCustomer._type === 'Site' ? 'bg-green-100 text-green-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {selectedCustomer._type}
                                  </span>
                                </div>
                                {selectedCustomer.email && <p className="text-sm text-slate-600">{selectedCustomer.email}</p>}
                                {selectedCustomer.phone && <p className="text-sm text-slate-600">{selectedCustomer.phone}</p>}
                              </div>
                              <div className="text-emerald-600">
                                <CheckCircle className="w-6 h-6" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Info message for non-Customer types */}
                      {selectedCustomer && selectedCustomer._type && selectedCustomer._type !== 'Customer' && (
                        <div className="mt-4 flex items-start gap-3 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl">
                          <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="font-bold text-yellow-700 text-sm">Invoice for {selectedCustomer._type}</p>
                            <p className="text-yellow-600 text-sm mt-0.5">
                              This invoice will <strong>not show pricing details</strong>. Only item list and quantities will be displayed.
                              Pricing is shown only for Customer invoices.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700">Bill-to Name</label>
                          <input
                            type="text"
                            value={newInvoice.customer_name}
                            onChange={(e) => setNewInvoice(prev => ({ ...prev, customer_name: e.target.value }))}
                            placeholder={selectedCustomer?._type === 'Contractor' ? "Enter contractor name" : "Enter or select name above"}
                            className="w-full px-4 py-4 bg-white border-2 border-slate-200 rounded-xl font-medium text-slate-700 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-200 placeholder-slate-400"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700">Email Address</label>
                          <input
                            type="email"
                            value={newInvoice.customer_email}
                            onChange={(e) => setNewInvoice(prev => ({ ...prev, customer_email: e.target.value }))}
                            placeholder="email@example.com"
                            className="w-full px-4 py-4 bg-white border-2 border-slate-200 rounded-xl font-medium text-slate-700 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-200 placeholder-slate-400"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700">Phone Number</label>
                          <input
                            type="tel"
                            value={newInvoice.customer_phone}
                            onChange={(e) => setNewInvoice(prev => ({ ...prev, customer_phone: e.target.value }))}
                            placeholder="+91 XXXXX XXXXX"
                            className="w-full px-4 py-4 bg-white border-2 border-slate-200 rounded-xl font-medium text-slate-700 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-200 placeholder-slate-400"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700">Address</label>
                          <textarea
                            value={newInvoice.customer_address}
                            onChange={(e) => setNewInvoice(prev => ({ ...prev, customer_address: e.target.value }))}
                            placeholder="Street, City, State"
                            rows={3}
                            className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-medium text-slate-700 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all duration-200 placeholder-slate-400 resize-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Invoice Items */}
                    <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-8 rounded-2xl border-2 border-blue-100">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-slate-800">Invoice Items</h3>
                            <p className="text-sm text-slate-500 font-medium">Add products or services to your invoice</p>
                          </div>
                        </div>
                        <button
                          onClick={addItem}
                          className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-green-600 transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center gap-2"
                        >
                          <Plus className="w-5 h-5" />
                          Add Item
                        </button>
                      </div>
                      
                      <div className="space-y-6">
                        {newInvoice.items.map((item, index) => (
                          <div key={index} className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-sm hover:shadow-md transition-all duration-200">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-slate-400 to-slate-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                                  {index + 1}
                                </div>
                                <span className="font-bold text-slate-700">Item {index + 1}</span>
                              </div>
                              {newInvoice.items.length > 1 && (
                                <button
                                  onClick={() => removeItem(index)}
                                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 transform hover:scale-110"
                                  title="Remove Item"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                            
                            {/* Determine if pricing should be shown based on selected entity type */}
                            {(() => {
                              const selectedType = selectedCustomer?._type || newInvoice.customer_type;
                              const showPricing = selectedType === 'Customer' || !selectedType;
                              
                              return (
                                <div className={`grid grid-cols-1 gap-4 ${showPricing ? 'lg:grid-cols-12' : 'lg:grid-cols-8'}`}>
                                  <div className={showPricing ? 'lg:col-span-6' : 'lg:col-span-6'}>
                                    <label className="block text-sm font-bold text-slate-600 mb-2">Product / Description *</label>
                                    <div className="relative">
                                      <select
                                        value={item.product_id || ''}
                                        onChange={(e) => {
                                          const productId = e.target.value;
                                          if (productId) {
                                            const product = products.find(p => p.product_id === productId);
                                            if (product) {
                                              handleProductSelect(index, product);
                                            }
                                          } else {
                                            // Clear selection
                                            updateItem(index, 'description', '');
                                            updateItem(index, 'unit_price', 0);
                                            updateItem(index, 'product_id', '');
                                          }
                                        }}
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all duration-200 font-medium text-slate-700 hover:border-slate-300 cursor-pointer"
                                      >
                                        <option value="">Choose a product or enter custom...</option>
                                        {products.map((product) => (
                                          <option key={product.product_id} value={product.product_id}>
                                            {product.name} - ₹{product.price || 0} 
                                            {product.sku && ` (${product.sku})`}
                                            {product.warehouse_qty > 0 && ` - Stock: ${product.warehouse_qty}`}
                                          </option>
                                        ))}
                                      </select>
                                      
                                      {/* Loading indicator */}
                                      {loadingProducts && (
                                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                                          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                        </div>
                                      )}
                                      
                                      {/* Selected product preview */}
                                      {item.product_id && (
                                        <div className="mt-3 p-3 bg-blue-50 border-2 border-blue-200 rounded-xl">
                                          <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                              <p className="font-bold text-slate-900">{item.description}</p>
                                              {item.sku && <p className="text-sm text-slate-600">SKU: {item.sku}</p>}
                                              {item.category && <p className="text-sm text-slate-600">Category: {item.category}</p>}
                                              {item.available_qty > 0 && (
                                                <p className="text-sm text-emerald-600 font-medium">Available: {item.available_qty} units</p>
                                              )}
                                            </div>
                                            <div className="text-emerald-600">
                                              <CheckCircle className="w-5 h-5" />
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Manual entry fallback */}
                                      {!item.product_id && (
                                        <div className="mt-3">
                                          <input
                                            type="text"
                                            placeholder="Enter custom product description"
                                            value={item.description}
                                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                                            className="w-full px-4 py-3 bg-amber-50 border-2 border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200 font-medium placeholder-amber-400"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="lg:col-span-2">
                                    <label className="block text-sm font-bold text-slate-600 mb-2">Quantity *</label>
                                    <input
                                      type="number"
                                      placeholder="Qty"
                                      value={item.quantity}
                                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all duration-200 font-medium text-center"
                                      min="1"
                                      required
                                    />
                                  </div>
                                  {showPricing && (
                                    <>
                                      <div className="lg:col-span-2">
                                        <label className="block text-sm font-bold text-slate-600 mb-2">Unit Price *</label>
                                        <input
                                          type="number"
                                          placeholder="Price"
                                          value={item.unit_price}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            // Allow empty string or valid number
                                            updateItem(index, 'unit_price', value === '' ? '' : parseFloat(value) || 0);
                                          }}
                                          onBlur={(e) => {
                                            // On blur, if empty, set to 0
                                            if (e.target.value === '') {
                                              updateItem(index, 'unit_price', 0);
                                            }
                                          }}
                                          className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all duration-200 font-medium"
                                          min="0"
                                          step="0.01"
                                          required
                                        />
                                      </div>
                                      <div className="lg:col-span-2">
                                        <label className="block text-sm font-bold text-slate-600 mb-2">Total</label>
                                        <div className="w-full px-4 py-3 bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-xl font-bold text-emerald-700 text-lg text-center">
                                          ₹{(item.quantity * item.unit_price).toFixed(2)}
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Enhanced Invoice Settings */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-8 rounded-2xl border-2 border-amber-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-800">Invoice Settings</h3>
                          <p className="text-sm text-slate-500 font-medium">Configure tax, dates, and payment terms</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700">Issue Date *</label>
                          <input
                            type="date"
                            value={newInvoice.issue_date}
                            onChange={(e) => setNewInvoice(prev => ({...prev, issue_date: e.target.value}))}
                            className="w-full px-4 py-4 bg-white border-2 border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200 font-medium"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700">Due Date *</label>
                          <input
                            type="date"
                            value={newInvoice.due_date}
                            onChange={(e) => setNewInvoice(prev => ({...prev, due_date: e.target.value}))}
                            min={newInvoice.issue_date}
                            className="w-full px-4 py-4 bg-white border-2 border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200 font-medium"
                            required
                          />
                        </div>
                        {/* Only show Tax Rate for Customer invoices */}
                        {(() => {
                          const selectedType = selectedCustomer?._type || newInvoice.customer_type;
                          const showPricing = selectedType === 'Customer' || !selectedType;
                          return showPricing && (
                            <div className="space-y-2">
                              <label className="block text-sm font-bold text-slate-700">Tax Rate (%)</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={newInvoice.tax_rate === 0 ? '' : newInvoice.tax_rate}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                      setNewInvoice(prev => ({...prev, tax_rate: 0}));
                                    } else {
                                      const numValue = parseFloat(value);
                                      if (!isNaN(numValue)) {
                                        setNewInvoice(prev => ({...prev, tax_rate: numValue}));
                                      }
                                    }
                                  }}
                                  className="w-full px-4 py-4 bg-white border-2 border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200 font-medium"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  placeholder="0"
                                />
                                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-amber-600 font-bold">%</div>
                              </div>
                            </div>
                          );
                        })()}
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700">Payment Status *</label>
                          <select
                            value={newInvoice.status}
                            onChange={(e) => setNewInvoice(prev => ({...prev, status: e.target.value}))}
                            className="w-full px-4 py-4 bg-white border-2 border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200 font-medium text-slate-700 cursor-pointer"
                            required
                          >
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="partial">Partial</option>
                            <option value="overdue">Overdue</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="block text-sm font-bold text-slate-700">Notes (Optional)</label>
                          <textarea
                            value={newInvoice.notes || ''}
                            onChange={(e) => setNewInvoice(prev => ({...prev, notes: e.target.value}))}
                            placeholder="Add any additional notes..."
                            rows={3}
                            className="w-full px-4 py-3 bg-white border-2 border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200 font-medium resize-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Invoice Summary - Only show for Customer invoices */}
                    {(() => {
                      const selectedType = selectedCustomer?._type || newInvoice.customer_type;
                      const showPricing = selectedType === 'Customer' || !selectedType;
                      return showPricing && (
                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-8 rounded-2xl border-2 border-emerald-200">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl flex items-center justify-center">
                              <DollarSign className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-slate-800">Invoice Summary</h3>
                              <p className="text-sm text-slate-500 font-medium">Review your invoice totals</p>
                            </div>
                          </div>
                          {(() => {
                            const subtotal = newInvoice.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
                            const tax_amount = (subtotal * newInvoice.tax_rate) / 100;
                            const total_amount = subtotal + tax_amount;
                            return (
                          <div className="bg-white rounded-2xl p-6 space-y-4">
                            <div className="flex justify-between items-center py-2">
                              <span className="text-slate-600 font-medium">Subtotal:</span>
                              <span className="font-bold text-slate-900 text-lg">₹{subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                              <span className="text-slate-600 font-medium">Tax ({newInvoice.tax_rate}%):</span>
                              <span className="font-bold text-slate-900 text-lg">₹{tax_amount.toFixed(2)}</span>
                            </div>
                            <div className="border-t-2 border-emerald-200 pt-4">
                              <div className="flex justify-between items-center bg-gradient-to-r from-emerald-100 to-green-100 p-4 rounded-xl">
                                <span className="text-2xl font-black text-emerald-800">Total Amount:</span>
                                <span className="text-3xl font-black text-emerald-700">₹{total_amount.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                        </div>
                      );
                    })()}

                    {/* Enhanced Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-end pt-6 border-t-2 border-slate-100">
                      <button
                        onClick={() => {
                          setShowCreateModal(false);
                          setEditingInvoice(null);
                          setSelectedCustomer(null);
                          setProductSearchTerm("");
                          setContractorName('');
                          setNewInvoice({
                            customer_id: '',
                            customer_name: '',
                            customer_email: '',
                            customer_phone: '',
                            customer_address: '',
                            customer_city: '',
                            customer_state: '',
                            customer_country: '',
                            customer_company: '',
                            customer_type: '',
                            items: [{ description: '', quantity: 1, unit_price: 0 }],
                            tax_rate: 18,
                            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                            issue_date: new Date().toISOString().split('T')[0],
                            status: 'pending'
                          });
                        }}
                        className="px-8 py-4 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Cancel
                      </button>
                      <button
                        onClick={generateInvoice}
                        disabled={creatingInvoice}
                        className={`px-10 py-4 font-black rounded-xl transition-all duration-200 flex items-center justify-center gap-3 ${
                          creatingInvoice
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transform hover:scale-105 shadow-2xl hover:shadow-purple-500/25'
                        }`}
                      >
                        {creatingInvoice ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            {editingInvoice ? 'Update Invoice' : 'Generate Invoice'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>
    );
  }

  // Single Invoice View
  return (
    <div className="min-h-screen bg-gray-50">
      {loading ? (
        <div className="flex items-center justify-center min-h-screen p-8">
          <div className="text-center">
            <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900">Loading Invoice</h2>
          </div>
        </div>
      ) : currentInvoice ? (
        <div className="w-full mx-auto flex flex-col lg:flex-row gap-6 pt-6 md:pt-8 px-4 sm:px-6 lg:px-8">
          {/* Sidebar */}
          <aside className="lg:w-[320px] shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <button 
                className="mb-8 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors shadow-sm"
                onClick={() => navigate("/invoices")}
              >
                <span className="text-lg leading-none">←</span> Back to Invoices
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-emerald-50 rounded-2xl flex items-center justify-center shadow-inner">
                  <FileText className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  {currentInvoice.invoice_number}
                </h2>
                <div className="flex justify-center">
                  <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    currentInvoice.status === 'paid' ? 'bg-green-50 text-green-600 border border-green-200' :
                    currentInvoice.status === 'overdue' ? 'bg-red-50 text-red-600 border border-red-200' :
                    currentInvoice.status === 'draft' ? 'bg-gray-50 text-gray-600 border border-gray-200' :
                    'bg-blue-50 text-blue-600 border border-blue-200'
                  }`}>
                    {currentInvoice.status}
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 text-sm">
                    <User2 className="w-4 h-4" />
                    {currentInvoice.customer_type && currentInvoice.customer_type !== 'regular'
                      ? currentInvoice.customer_type
                      : 'Customer'
                    }
                  </h4>
                  <div className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                    <p className="font-semibold text-gray-900">{currentInvoice.customer_name}</p>
                    {currentInvoice.customer_email && <p className="text-xs text-gray-500 mt-0.5">{currentInvoice.customer_email}</p>}
                    {currentInvoice.customer_phone && <p className="text-xs text-gray-500">{currentInvoice.customer_phone}</p>}
                  </div>
                </div>

                {/* Only show Amount for Customer invoices */}
                {(() => {
                  const showPricing = currentInvoice.show_pricing !== false && 
                                     (currentInvoice.customer_type === 'Customer' || 
                                      currentInvoice.customer_type === 'regular' || 
                                      !currentInvoice.customer_type);
                  return showPricing && (
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2 text-sm">
                        <DollarSign className="w-4 h-4" /> Amount
                      </h4>
                      <div className="text-center p-5 bg-teal-50 rounded-xl border border-teal-100">
                        <p className="text-3xl font-bold text-gray-900 tracking-tight">
                          {formatCurrency(currentInvoice.total_amount)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Total (incl. tax)</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-between items-center text-sm pt-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Issue Date</p>
                    <p className="font-medium text-gray-700">{formatDate(currentInvoice.issue_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Due Date</p>
                    <p className={`font-semibold ${
                      new Date(currentInvoice.due_date) < new Date() && currentInvoice.status !== 'paid'
                        ? 'text-red-600' 
                        : 'text-red-500' /* Based on exact UI red text for due date */
                    }`}>
                      {formatDate(currentInvoice.due_date)}
                    </p>
                  </div>
                </div>

                {currentInvoice.status !== 'paid' && (
                  <button 
                    onClick={() => markPaid(currentInvoice.id)}
                    className="w-full border-2 border-emerald-100 bg-emerald-50 text-emerald-700 py-3 px-4 rounded-lg font-medium hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2 mt-4"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark as Paid
                  </button>
                )}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 print:p-0 print:border-none print:shadow-none invoice-card">
              {/* Professional Invoice Header - Visible on screen and print */}
              <div className="mb-10 pb-8 border-b-2 border-slate-100">
                <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                  <div className="flex-1">
                    <img 
                      src="/Ratilal & Sons Logo.png" 
                      alt="Ratilal & Sons" 
                      className="w-56 mb-4 h-auto object-contain"
                    />
                    <div className="mt-2">
                      <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight leading-none">RATILAL & SONS</h2>
                      <p className="text-slate-600 font-semibold italic mt-1">Govt. Approved Contractor & Engineers</p>
                    </div>
                    
                    <div className="mt-6 space-y-1 text-slate-500 text-sm">
                      <p className="font-medium italic text-slate-600">" Ratilal & Sons House "</p>
                      <p className="max-w-md">Plot No. 49, Opp. Hanuman Temple, G.I.D.C., Anjar - Kutch. (Gujarat) 370110</p>
                      <p>Email: rsinfraprojects2014@gmail.com</p>
                      <div className="pt-2 flex flex-wrap gap-x-4 gap-y-1 font-semibold text-slate-700">
                        <span>Gujarat GST: 24BFIPS0859D1ZF</span>
                        <span>Maharastra GST: 27BFIPS0859D1Z9</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-left md:text-right flex flex-col justify-between h-full min-w-[200px]">
                    <div>
                      <p className="font-bold text-slate-900 text-xl leading-tight">Ramesh Sorathiya</p>
                      <p className="font-bold text-blue-600 text-lg">Mo. 81601 19891</p>
                    </div>
                    
                    <div className="mt-12 md:mt-auto pt-6">
                      <div className="inline-block md:text-right">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Tax Invoice</p>
                        <p className="text-3xl font-black text-slate-900 leading-none">{currentInvoice.invoice_number}</p>
                        <div className="mt-3 flex flex-col md:items-end gap-1">
                          <p className="text-sm font-bold text-slate-500">Date: <span className="text-slate-800">{formatDate(currentInvoice.issue_date)}</span></p>
                          <p className="text-sm font-bold text-slate-500">Due: <span className="text-red-500">{formatDate(currentInvoice.due_date)}</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Bill To / Billed To:</p>
                    <p className="font-extrabold text-slate-900 text-xl">{currentInvoice.customer_name}</p>
                    <div className="mt-2 space-y-0.5 text-slate-600 font-medium">
                      <p>{currentInvoice.customer_email}</p>
                      <p>{currentInvoice.customer_phone}</p>
                      <p className="mt-2 text-sm leading-relaxed">{currentInvoice.customer_address}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col justify-end md:items-end">
                    <div className="md:text-right">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Payment Status:</p>
                      <span className={`inline-flex px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border-2 shadow-sm ${
                        currentInvoice.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        currentInvoice.status === 'overdue' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                        'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {currentInvoice.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-12 mb-6">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest border-b-2 border-slate-800 inline-block pb-1">Invoice Items</h3>
              </div>
              
              {/* Check if pricing should be shown based on customer type */}
              {(() => {
                const showPricing = currentInvoice.show_pricing !== false && 
                                   (currentInvoice.customer_type === 'Customer' || 
                                    currentInvoice.customer_type === 'regular' || 
                                    !currentInvoice.customer_type);
                
                return (
                  <>
                    <div className="space-y-0 text-gray-900">
                      {currentInvoice.items?.map((item, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 border-b border-gray-100 bg-white">
                          <div className="flex-1 mb-2 sm:mb-0">
                            <p className="font-medium">{item.description}</p>
                            {showPricing ? (
                              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Qty: {item.quantity} × {formatCurrency(item.unit_price)}</p>
                            ) : (
                              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Qty: {item.quantity}</p>
                            )}
                          </div>
                          {showPricing && (
                            <div className="text-left sm:text-right">
                              <p className="text-lg font-bold">
                                {formatCurrency(item.quantity * item.unit_price)}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {showPricing && (
                      <div className="mt-8">
                        <div className="flex justify-between items-center mb-4 text-base">
                          <span className="font-semibold text-gray-700">Subtotal:</span>
                          <span className="font-bold text-gray-900">
                            {formatCurrency(currentInvoice.subtotal)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-6 text-base">
                          <span className="font-semibold text-gray-700">Tax ({currentInvoice.tax_rate || 0}%):</span>
                          <span className="font-bold text-gray-900">
                            {formatCurrency(currentInvoice.tax_amount)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-6 bg-gray-50 rounded-xl border border-gray-100">
                          <span className="text-2xl font-bold text-gray-900">Total:</span>
                          <span className="text-3xl font-bold text-teal-600">
                            {formatCurrency(currentInvoice.total_amount)}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="flex gap-4 justify-center pb-8">
              <button 
                onClick={() => downloadInvoice(currentInvoice.id)}
                className="flex items-center gap-2 px-8 py-3 bg-blue-500 text-white font-semibold rounded-xl shadow-md hover:bg-blue-600 transition-colors"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
              <button 
                onClick={printInvoice}
                className="flex items-center gap-2 px-8 py-3 bg-slate-600 text-white font-semibold rounded-xl shadow-md hover:bg-slate-700 transition-colors"
              >
                <Printer className="w-5 h-5" />
                Print
              </button>
            </div>
          </main>
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-screen p-8">
          <div className="text-center bg-white p-12 rounded-2xl shadow-sm border border-gray-100">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Invoice Not Found</h2>
            <button 
              onClick={() => navigate("/invoices")}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 mt-4"
            >
              Back to Invoices
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
