// CustomerDashboard.jsx with CustomerOrders-style UI
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "../contexts/PermissionContext.jsx";
import { CUSTOMER_PORTAL_API, TICKET_API, getAuthHeaders } from "../../config.js";
// Import Lucide icons or use similar SVGs/icons
import { 
  Mail, Phone, ShoppingCart, ChevronUp, TrendingUp, 
  User, Calendar, MapPin, Settings, Lock, Bell, 
  Star, CreditCard, CheckCircle, Menu, X
} from "lucide-react";

const ALL_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: User },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'support', label: 'Support', icon: Phone },
  { id: 'profile', label: 'Profile', icon: Settings }
];

export default function CustomerDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [customerData, setCustomerData] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [supportForm, setSupportForm] = useState({ subject: '', message: '' });
  const [supportTickets, setSupportTickets] = useState([]);

  const { userPermissions = [], roleNames = [] } = usePermissions() || {};
  const navigate = useNavigate();

  // Debug authentication on component mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('user');
    console.log('CustomerDashboard - Auth Debug:', {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'null',
      hasUser: !!user,
      userPermissions: userPermissions.length,
      roleNames: roleNames.length
    });
  }, [userPermissions, roleNames]);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const token = localStorage.getItem('access_token');
        if (!token) {
          console.warn('No access token, redirecting to home');
          window.location.href = '/';
          return;
        }
        
        const response = await fetch(CUSTOMER_PORTAL_API.DASHBOARD, {
          headers: getAuthHeaders()
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            console.warn('Authentication failed, clearing session');
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            setError('Your session has expired. Please refresh the page to login again.');
            setLoading(false);
            return;
          }
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Dashboard data:', data);
        
        const orders = data.recent_orders || data.orders || [];
        const customerInfo = data.customer || data || {};
        
        const calculatedStats = {
          totalOrders: orders.length || customerInfo.orders || 0,
          totalRevenue: orders.reduce((sum, order) => sum + (order.amount || 0), 0) || customerInfo.revenue || 0,
          status: customerInfo.status || 'Active',
          points: customerInfo.points || 0,
          name: customerInfo.name || 'Customer User'
        };
        
        setCustomerData({ ...customerInfo, ...calculatedStats });
        setRecentOrders(orders);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Unable to load dashboard data. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    fetchSupportTickets();
  }, []);

  // Fetch orders when Orders tab is active
  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders();
    }
  }, [activeTab]);

  // Fetch profile when Profile tab is active
  useEffect(() => {
    if (activeTab === 'profile') {
      fetchProfile();
    }
  }, [activeTab]);

  const fetchOrders = async () => {
    try {
      const response = await fetch(CUSTOMER_PORTAL_API.ORDERS, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Authentication failed for orders');
          setError('Session expired. Please login again.');
          return;
        }
        throw new Error(`Orders API error: ${response.status}`);
      }
      
      const data = await response.json();
      setAllOrders(data.orders || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setAllOrders([]);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await fetch(CUSTOMER_PORTAL_API.PROFILE, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Authentication failed for profile');
          setError('Session expired. Please login again.');
          return;
        }
        throw new Error(`Profile API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Profile data:', data);
      setProfile(data.profile || data || {});
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
    }
  };

  const fetchSupportTickets = async () => {
    try {
      console.log('Fetching support tickets...');
      const response = await fetch(`${TICKET_API.TICKETS}?page=1&limit=20`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Authentication failed for support tickets');
          return;
        }
        console.error(`Support tickets API error: ${response.status}`);
        throw new Error(`Support tickets API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Support tickets data:', data);
      const tickets = data.tickets || data.data || data || [];
      setSupportTickets(tickets);
    } catch (err) {
      console.error('Error fetching support tickets:', err);
      setSupportTickets([]);
    }
  };

  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    
    if (!supportForm.subject || !supportForm.message) {
      alert('Please fill in both subject and message');
      return;
    }

    try {
      const response = await fetch(TICKET_API.CREATE, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          subject: supportForm.subject,
          message: supportForm.message,
          priority: 'medium',
          status: 'open'
        })
      });

      if (!response.ok) {
        throw new Error(`Support API error: ${response.status}`);
      }

      const result = await response.json();
      alert(result.message || 'Support ticket submitted successfully!');
      setSupportForm({ subject: '', message: '' });
      fetchSupportTickets();
    } catch (err) {
      console.error('Error submitting support ticket:', err);
      alert('Error submitting support ticket. Please try again.');
    }
  };

  // Filter data based on search
  const filteredOrders = recentOrders.filter(order =>
    order.id?.toLowerCase().includes(search.toLowerCase()) ||
    order.status?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredTickets = supportTickets.filter(ticket =>
    ticket.subject?.toLowerCase().includes(search.toLowerCase()) ||
    ticket.message?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-lg shadow-lg p-6 border border-red-200 max-w-md mx-auto">
          <div className="text-red-500 text-xl mb-4">⚠️ Authentication Error</div>
          <p className="text-gray-700 mb-6">{error}</p>
          <div className="space-y-3">
            <button 
              onClick={() => window.location.reload()} 
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
            <button 
              onClick={() => window.location.href = '/'} 
              className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-screen">
      <div className="max-w-8xl mx-auto p-6">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">
                    Welcome, {customerData?.name || 'Customer'}
                  </h1>
                  <p className="text-blue-100">Manage your orders and account</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="bg-green-400 text-white px-4 py-2 rounded-full text-sm font-medium">
                  ● Online
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('user');
                    navigate('/');
                  }}
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {ALL_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Search Bar */}
          <div className="p-6 bg-gray-50">
            <div className="relative">
              <input
                type="text"
                placeholder="Search orders, tickets, or content..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200">
          {activeTab === 'dashboard' && (
            <div className="p-6">
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {/* Total Orders Card */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">Total Orders</p>
                      <p className="text-3xl font-bold">{customerData?.totalOrders || allOrders.length || recentOrders.length || 0}</p>
                    </div>
                    <ShoppingCart className="w-10 h-10 text-blue-200" />
                  </div>
                </div>

                {/* Total Spending Card */}
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm">Total Spending</p>
                      <p className="text-3xl font-bold">₹{(customerData?.totalRevenue || 0).toLocaleString()}</p>
                    </div>
                    <CreditCard className="w-10 h-10 text-green-200" />
                  </div>
                </div>

                {/* Account Status Card */}
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm">Account Status</p>
                      <p className="text-2xl font-bold capitalize">{customerData?.status || 'Active'}</p>
                    </div>
                    <CheckCircle className="w-10 h-10 text-purple-200" />
                  </div>
                </div>

                {/* Rewards Points Card */}
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100 text-sm">Reward Points</p>
                      <p className="text-3xl font-bold">{customerData?.points || 0}</p>
                    </div>
                    <Star className="w-10 h-10 text-orange-200" />
                  </div>
                </div>
              </div>

              {/* Recent Orders Section */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Recent Orders</h3>
                  <button 
                    onClick={() => setActiveTab('orders')}
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                  >
                    View All →
                  </button>
                </div>

                {filteredOrders.length > 0 ? (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredOrders.slice(0, 5).map((order) => (
                          <tr key={order.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              #{order.id || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {order.date || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                order.status === 'delivered' 
                                  ? 'bg-green-100 text-green-800' 
                                  : order.status === 'pending' 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {(order.status || 'N/A').toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              ₹{(order.amount || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-16 bg-gray-50 rounded-lg">
                    <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-700 mb-2">No Recent Orders</h3>
                    <p className="text-gray-500 mb-6">Your order history will appear here once you make your first purchase</p>
                    <button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-medium transition-all duration-300">
                      Start Shopping
                    </button>
                  </div>
                )}
              </div>

              {/* Recent Activity Section */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h3>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  {customerData?.points > 0 && (
                    <div className="p-4 bg-blue-50 rounded-xl border-l-4 border-blue-500 mb-4">
                      <div className="flex items-start gap-3">
                        <Star className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-semibold text-gray-900">Reward Points Available</p>
                          <p className="text-sm text-gray-600">You have {customerData.points} points to redeem</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {filteredTickets.length > 0 ? (
                    filteredTickets.slice(0, 3).map((ticket, index) => (
                      <div key={ticket.id || index} className="p-4 bg-purple-50 rounded-xl border-l-4 border-purple-500 mb-2">
                        <div className="flex items-start gap-3">
                          <Phone className="w-5 h-5 text-purple-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{ticket.subject}</p>
                            <p className="text-sm text-gray-600">{ticket.message?.substring(0, 100)}{ticket.message?.length > 100 ? '...' : ''}</p>
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              ticket.status === 'open' 
                                ? 'bg-green-100 text-green-700' 
                                : ticket.status === 'pending' 
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {ticket.status?.toUpperCase() || 'PENDING'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No recent activity</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Order History</h2>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  {allOrders.length} {allOrders.length === 1 ? 'Order' : 'Orders'}
                </span>
              </div>

              {allOrders.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {allOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            #{order.id || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {order.date || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              order.status === 'delivered' 
                                ? 'bg-green-100 text-green-800' 
                                : order.status === 'pending' 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {(order.status || 'N/A').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            ₹{(order.amount || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button className="text-blue-600 hover:text-blue-800">View Details</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-20 bg-gray-50 rounded-lg">
                  <ShoppingCart className="w-20 h-20 text-gray-300 mx-auto mb-6" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Orders Yet</h3>
                  <p className="text-gray-500 mb-6">You haven't placed any orders yet. Start exploring our products!</p>
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                    Start Shopping
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && profile && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Profile Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contact Information */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-blue-600" />
                    Contact Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Email Address</p>
                      <p className="font-medium text-gray-900">{profile.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Phone Number</p>
                      <p className="font-medium text-gray-900">{profile.phone}</p>
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-purple-600" />
                    Address Details
                  </h3>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Current Address</p>
                    <p className="font-medium text-gray-900">{profile.address}</p>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button className="p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                    <Settings className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <p className="font-medium text-gray-900">Update Profile</p>
                  </button>
                  <button className="p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                    <Lock className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="font-medium text-gray-900">Change Password</p>
                  </button>
                  <button className="p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
                    <Bell className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <p className="font-medium text-gray-900">Notifications</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'support' && (
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Customer Support</h2>
              <p className="text-gray-600 mb-8">Submit a support ticket, or contact us via email or phone if you need assistance with your account or orders.</p>
              
              <form className="max-w-2xl" onSubmit={handleSupportSubmit}>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                    <input 
                      type="text" 
                      placeholder="Enter the subject of your inquiry" 
                      value={supportForm.subject}
                      onChange={(e) => setSupportForm(prev => ({ ...prev, subject: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                    <textarea 
                      placeholder="Describe your issue or question in detail" 
                      value={supportForm.message}
                      onChange={(e) => setSupportForm(prev => ({ ...prev, message: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      rows={6}
                      required
                    ></textarea>
                  </div>
                  <button 
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Phone className="w-5 h-5" />
                    Submit Ticket
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}