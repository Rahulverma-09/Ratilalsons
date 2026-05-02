// API configuration
const API_CONFIG = {
  // Use empty string for development (Vite proxy), full URL for production
  BASE_URL: import.meta.env.DEV ? '' : 'http://localhost:8000',
};

// Full API URL
export const API_URL = `${API_CONFIG.BASE_URL}`;

// Auth endpoints
export const AUTH_API = {
  LOGIN: `${API_URL}/api/auth/login`,
  LOGOUT: `${API_URL}/api/auth/logout`,
  ME: `${API_URL}/api/auth/me`
};

// User endpoints
export const USER_API = {
  USERS: `${API_URL}/api/auth/users`,
};

// Role endpoints
export const ROLE_API = {
  ROLES: `${API_URL}/api/roles/`
};

// Stock/Inventory endpoints
export const STOCK_API = {
  STOCK: `${API_URL}/stock`,
  ALERTS: `${API_URL}/stock/alerts`,
  LOGS: `${API_URL}/stock/logs`,
  PRODUCTS: `${API_URL}/stock/products`,
  // Vendor-specific endpoints
  VENDOR_CATALOG: `${API_URL}/stock/vendor/catalog`,
  INVENTORY_PRODUCTS: `${API_URL}/stock/inventory`,
  ADD_TO_CATALOG: `${API_URL}/stock/vendor/catalog/add`,
  UPDATE_CATALOG_PRODUCT: `${API_URL}/stock/vendor/catalog/{catalog_id}`,
  REMOVE_FROM_CATALOG: `${API_URL}/stock/vendor/catalog/{catalog_id}`
};

// Customer Portal endpoints
export const CUSTOMER_PORTAL_API = {
  DASHBOARD: `${API_URL}/customer/dashboard`,
  ORDERS: `${API_URL}/customer/orders`,
  PROFILE: `${API_URL}/customer/profile`,
  SUPPORT_TICKETS: `${API_URL}/customer/support-tickets`,
  PRODUCTS: `${API_URL}/customer/products`,
  VENDORS: `${API_URL}/customer/vendors`,
  FEEDBACK: `${API_URL}/customer/feedback`,
  COMPLAINTS: `${API_URL}/customer/complaints`
};

// Auth headers helper function
export const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  if (!token) {
    console.warn('No access token found in localStorage');
    return {
      'Content-Type': 'application/json'
    };
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

// Customer Portal API (camelCase version for CustomerOrders.jsx)
export const customerPortalAPI = {
  getOrders: `${API_URL}/customer/orders`,
  getCart: `${API_URL}/customer/cart`,
  addToCart: `${API_URL}/customer/cart/add`,
  updateCartItem: `${API_URL}/customer/cart/{item_id}`,
  clearCart: `${API_URL}/customer/cart/clear`,
  checkout: `${API_URL}/customer/orders`, // Updated to use POST /orders endpoint
  getOrderDetails: `${API_URL}/customer/orders/{order_id}`
};

// Invoice endpoints
export const INVOICE_API = {
  INVOICES: `${API_URL}/api/invoices/`,
  LIST: `${API_URL}/api/invoices/`,
  CREATE: `${API_URL}/api/invoices/`,
  UPDATE: (id) => `${API_URL}/api/invoices/${id}`,
  DELETE: (id) => `${API_URL}/api/invoices/${id}`,
  GET_INVOICE: (id) => `${API_URL}/api/invoices/${id}`,
  MARK_PAID: (id) => `${API_URL}/api/invoices/${id}/mark-paid`,
  SEND_INVOICE: (id) => `${API_URL}/api/invoices/${id}/send`,
  DOWNLOAD: (id) => `${API_URL}/api/invoices/${id}/download`,
  STATS: `${API_URL}/api/invoices/stats`,
  STATISTICS: `${API_URL}/api/invoices/statistics`,
  // Customer-facing endpoints
  CUSTOMER_INVOICES: (customerId) => `${API_URL}/api/invoices/customer/${customerId}/invoices`,
  CUSTOMER_INVOICE: (invoiceId) => `${API_URL}/api/invoices/customer/invoice/${invoiceId}`,
  CUSTOMER_PAYMENT: (invoiceId) => `${API_URL}/api/invoices/customer/invoice/${invoiceId}/payment`,
  CUSTOMER_DOWNLOAD: (invoiceId) => `${API_URL}/customer/invoice/${invoiceId}/download`
};

// Ticket/Support endpoints
export const TICKET_API = {
  TICKETS: `${API_URL}/api/tickets/`,
  LIST: `${API_URL}/api/tickets/`,
  CREATE: `${API_URL}/api/tickets/`,
  UPDATE: `${API_URL}/api/tickets/update`,
  DELETE: `${API_URL}/api/tickets/delete`,
  ASSIGN: `${API_URL}/api/tickets/assign`,
  CLOSE: `${API_URL}/api/tickets/close`,
  COMMENTS: `${API_URL}/api/tickets/comments`,
  ATTACHMENTS: `${API_URL}/api/tickets/attachments`,
  STATS: `${API_URL}/api/tickets/stats`,
  MY_TICKETS: `${API_URL}/api/tickets/my`,
  GET_TICKET: (id) => `${API_URL}/api/tickets/${id}`,
  UPDATE_TICKET: (id) => `${API_URL}/api/tickets/${id}`,
  DELETE_TICKET: (id) => `${API_URL}/api/tickets/${id}`,
  ADD_RESPONSE: (id) => `${API_URL}/api/tickets/${id}/responses`,
  UPDATE_STATUS: (id) => `${API_URL}/api/tickets/${id}/status`,
  ESCALATE: (id) => `${API_URL}/api/tickets/${id}/escalate`,
  ASSIGN_TICKET: (id) => `${API_URL}/api/tickets/${id}/assign`,
  CLOSE_TICKET: (id) => `${API_URL}/api/tickets/${id}/close`,
  ASSIGNED_TO_ME: `${API_URL}/api/tickets/assigned/me`
};

export default {
  API_URL,
  AUTH_API,
  USER_API,
  ROLE_API,
  STOCK_API,
  CUSTOMER_PORTAL_API,
  customerPortalAPI,
  INVOICE_API,
  TICKET_API,
  getAuthHeaders
};
