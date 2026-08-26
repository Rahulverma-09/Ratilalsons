import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { API_URL } from '../../config.js';
import { 
  faCalendarPlus, 
  faCalendarAlt, 
  faCheckCircle, 
  faExclamationTriangle,
  faClock,
  faTimesCircle,
  faPlus,
  faEdit,
  faTrash,
  faFilter,
  faSearch,
  faUser,
  faComments,
  faFileAlt,
  faPaperPlane,
  faHistory,
  faEye
} from '@fortawesome/free-solid-svg-icons';

const MyLeaveRequestsPage = () => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  
  // New leave request form
  const [newLeaveRequest, setNewLeaveRequest] = useState({
    leaveType: 'Annual Leave',
    startDate: '',
    endDate: '',
    reason: '',
    appliedToId: '',
    emergencyContact: '',
    emergencyPhone: '',
    documents: null
  });
  const [hrManagers, setHrManagers] = useState([]);
  const [loadingHRManagers, setLoadingHRManagers] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState(['Annual Leave', 'Sick Leave', 'Casual Leave', 'Emergency Leave']);


  // Fetch HR managers from backend
  const fetchHRManagers = async () => {
    try {
      setLoadingHRManagers(true);
      const token = localStorage.getItem('access_token');
      
      if (!token) return;
      
      const response = await fetch(`${API_URL}/api/attendance/leave/hr-managers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const managers = (data.data || []).map(emp => ({
            id: emp.id || emp.user_id || emp._id,
            name: emp.name || 'Unknown',
            role: emp.role || 'hr',
            email: emp.email || ''
          }));
          setHrManagers(managers);
        }
      }
      
      // If no HR managers found, also try fetching managers and admins
      if (hrManagers.length === 0) {
        // Fallback is no longer needed as new endpoint returns all HR/Admin users
        // const managerResponse = await fetch(`${API_URL}/api/attendance/leave/hr-managers`, {
        //   headers: {
        //     'Authorization': `Bearer ${token}`,
        //     'Content-Type': 'application/json'
        //   }
        // });
        
        // Additional managers fetching removed - new endpoint is comprehensive
        // if (managerResponse.ok) {
        //   const managerData = await managerResponse.json();
        //   if (managerData.success) {
        //     const additionalManagers = (managerData.data || []).map(emp => ({
        //       id: emp._id || emp.id || emp.emp_id,
        //       name: emp.name || emp.full_name || 'Unknown',
        //       role: emp.role || 'manager',
        //       email: emp.email || ''
        //     }));
        //     setHrManagers(prev => [...prev, ...additionalManagers]);
        //   }
        // }
      }
    } catch (error) {
      console.error('Error fetching HR managers:', error);
    } finally {
      setLoadingHRManagers(false);
    }
  };

  // Fetch leave balances from backend (if endpoint exists) or calculate dynamically
  const fetchLeaveBalances = async (userId) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return null;
      
      // Try to fetch user-specific leave balance information
      const response = await fetch(`${API_URL}/api/attendance/leave/balances/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return data.data;
        }
      }
    } catch (error) {
      console.warn('Leave balance endpoint not available, will calculate from requests');
    }
    return null;
  };

  useEffect(() => {
    // Load real data from API
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const token = localStorage.getItem('access_token');
        if (!token) {
          throw new Error('Please login to view leave requests');
        }
        
        // Get user info from localStorage
        const userStr = localStorage.getItem('currentUser') || localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : {};
        const userId = user.id || user.user_id || user.username || 'unknown';
        
        // Fetch leave requests from new attendance endpoint - no extra query params needed
        const response = await fetch(`${API_URL}/api/attendance/leave/my-requests?page=1&limit=50`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch leave requests: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          // Process and set leave requests
          const processedRequests = (data.data || []).map(request => ({
            id: request._id || request.id,
            leaveType: request.leave_type,
            startDate: request.start_date,
            endDate: request.end_date,
            duration: request.days_requested || calculateDuration(request.start_date, request.end_date),
            reason: request.reason,
            status: request.status === 'pending' ? 'Pending' : 
                   request.status === 'approved' ? 'Approved' : 
                   request.status === 'rejected' ? 'Rejected' : 'Pending',
            appliedTo: request.approved_by || 'HR/Manager',
            appliedDate: request.requested_at ? new Date(request.requested_at).toISOString().split('T')[0] : '',
            approvedDate: request.approved_at ? new Date(request.approved_at).toISOString().split('T')[0] : null,
            remarks: request.rejection_reason || request.remarks || null,
            emergencyContact: request.emergency_contact || '',
            emergencyPhone: request.emergency_phone || ''
          }));
          
          setLeaveRequests(processedRequests);
          
          // Try to fetch leave balances from backend, otherwise calculate from requests
          const backendBalances = await fetchLeaveBalances(userId);
          if (backendBalances) {
            setLeaveBalances(backendBalances);
          } else {
            // Calculate dynamic leave balances based on the requests
            const dynamicBalances = await calculateLeaveBalances(processedRequests);
            setLeaveBalances(dynamicBalances);
          }
        } else {
          throw new Error(data.message || 'Failed to load leave requests');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading leave data:', err);
        setError(err.message || 'Failed to load leave data');
        setLoading(false);
      }
    };

    loadData();
    fetchHRManagers();
    fetchLeaveTypes();
  }, []);

  // Fetch available leave types from backend
  const fetchLeaveTypes = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      
      const response = await fetch(`${API_URL}/api/attendance/leave/types`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const types = data.data.map(type => type.name);
          setLeaveTypes(types);
        }
      }
    } catch (error) {
      console.warn('Leave types endpoint not available, using defaults');
    }
  };

  // Fetch company leave policies from backend
  const fetchCompanyPolicies = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return null;
      
      const response = await fetch(`${API_URL}/employees/leave-policies`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return data.policies;
        }
      }
    } catch (error) {
      console.warn('Company policies endpoint not available, using defaults');
    }
    return null;
  };

  // Calculate dynamic leave balances based on approved requests and company policies
  const calculateLeaveBalances = async (requests) => {
    // Try to get company policies first
    const policies = await fetchCompanyPolicies();
    
    // Default values if no policies found
    const defaultPolicies = {
      annual_leave: 21,
      sick_leave: 10,
      casual_leave: 7,
      emergency_leave: 3
    };
    
    const totals = policies || defaultPolicies;
    
    const balances = {
      annualLeave: { total: totals.annual_leave || 21, used: 0, remaining: totals.annual_leave || 21 },
      sickLeave: { total: totals.sick_leave || 10, used: 0, remaining: totals.sick_leave || 10 },
      casualLeave: { total: totals.casual_leave || 7, used: 0, remaining: totals.casual_leave || 7 }
    };
    
    // Calculate used leave days from approved requests
    requests.forEach(request => {
      if (request.status === 'Approved') {
        const leaveType = request.leaveType.toLowerCase();
        const duration = request.duration || 0;
        
        if (leaveType.includes('annual')) {
          balances.annualLeave.used += duration;
        } else if (leaveType.includes('sick')) {
          balances.sickLeave.used += duration;
        } else if (leaveType.includes('casual')) {
          balances.casualLeave.used += duration;
        }
      }
    });
    
    // Calculate remaining days
    balances.annualLeave.remaining = Math.max(0, balances.annualLeave.total - balances.annualLeave.used);
    balances.sickLeave.remaining = Math.max(0, balances.sickLeave.total - balances.sickLeave.used);
    balances.casualLeave.remaining = Math.max(0, balances.casualLeave.total - balances.casualLeave.used);
    
    return balances;
  };

  // Filter requests
  const filteredRequests = leaveRequests.filter(request => {
    const matchesStatus = selectedStatus === 'All' || request.status === selectedStatus;
    const matchesType = selectedType === 'All' || request.leaveType === selectedType;
    const matchesSearch = (request.reason || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (request.leaveType || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  // Get request statistics
  const requestStats = {
    total: leaveRequests?.length || 0,
    pending: leaveRequests?.filter(r => r.status === 'Pending').length || 0,
    approved: leaveRequests?.filter(r => r.status === 'Approved').length || 0,
    rejected: leaveRequests?.filter(r => r.status === 'Rejected').length || 0
  };

  // Handle new request submission
  const handleSubmitRequest = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Please login to submit leave request');
      }
      
      // Get current user info
      const userStr = localStorage.getItem('currentUser') || localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : {};
      const userId = user.id || user.user_id || user.username;
      
      if (!userId) {
        throw new Error('User information not found. Please login again.');
      }
      
      // Prepare request payload
      const requestPayload = {
        user_id: userId,
        leave_type: newLeaveRequest.leaveType.toLowerCase().replace(' ', '_'), // Convert to snake_case
        start_date: newLeaveRequest.startDate,
        end_date: newLeaveRequest.endDate,
        reason: newLeaveRequest.reason,
        is_half_day: false, // Can be enhanced later
        emergency_contact: newLeaveRequest.emergencyContact,
        emergency_phone: newLeaveRequest.emergencyPhone,
        applied_to_id: newLeaveRequest.appliedToId || null, // Include selected manager
        days_requested: calculateDuration(newLeaveRequest.startDate, newLeaveRequest.endDate)
      };
      
      // Submit to API
      const response = await fetch(`${API_URL}/api/attendance/leave/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to submit request: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Create new request object for local state update
        const newRequest = {
          id: result.data._id || result.data.id,
          leaveType: newLeaveRequest.leaveType,
          startDate: newLeaveRequest.startDate,
          endDate: newLeaveRequest.endDate,
          duration: calculateDuration(newLeaveRequest.startDate, newLeaveRequest.endDate),
          reason: newLeaveRequest.reason,
          status: 'Pending',
          appliedTo: 'HR/Manager',
          appliedDate: new Date().toISOString().split('T')[0],
          approvedDate: null,
          remarks: null,
          emergencyContact: newLeaveRequest.emergencyContact,
          emergencyPhone: newLeaveRequest.emergencyPhone
        };
        
        // Update local state
        setLeaveRequests(prev => [newRequest, ...(prev || [])]);
        
        // Recalculate leave balances
        const updatedRequests = [newRequest, ...(leaveRequests || [])];
        const updatedBalances = await calculateLeaveBalances(updatedRequests);
        setLeaveBalances(updatedBalances);
        
        // Close modal and reset form
        setShowNewRequestModal(false);
        setNewLeaveRequest({
          leaveType: leaveTypes[0] || 'Annual Leave',
          startDate: '',
          endDate: '',
          reason: '',
          appliedToId: '',
          emergencyContact: '',
          emergencyPhone: '',
          documents: null
        });
        
        // Show success message
        alert('Leave request submitted successfully! HR will review your request.');
      } else {
        throw new Error(result.message || 'Failed to submit leave request');
      }
      
    } catch (error) {
      console.error('Error submitting leave request:', error);
      alert(`Error: ${error.message}`);
    }
  };

  // Calculate duration between dates
  const calculateDuration = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Check for valid dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    
    const timeDiff = end.getTime() - start.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    return Math.max(0, daysDiff);
  };

  // Get status color and icon
  const getStatusConfig = (status) => {
    const configs = {
      'Pending': { color: 'text-yellow-600 bg-yellow-100', icon: faClock },
      'Approved': { color: 'text-green-600 bg-green-100', icon: faCheckCircle },
      'Rejected': { color: 'text-red-600 bg-red-100', icon: faTimesCircle }
    };
    return configs[status] || configs['Pending'];
  };

  // Get leave type color
  const getLeaveTypeColor = (type) => {
    const colors = {
      'Annual Leave': 'text-blue-600 bg-blue-100',
      'Sick Leave': 'text-red-600 bg-red-100',
      'Casual Leave': 'text-green-600 bg-green-100',
      'Emergency Leave': 'text-orange-600 bg-orange-100'
    };
    return colors[type] || 'text-gray-600 bg-gray-100';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your leave requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-lg shadow-lg mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faCalendarPlus} className="text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">My Leave Requests</h1>
              <p className="text-blue-100 text-sm">Manage your leave applications and track status</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewRequestModal(true)}
            className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors flex items-center space-x-2"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* Leave Balances Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Annual Leave</h3>
            <FontAwesomeIcon icon={faCalendarAlt} className="text-2xl text-blue-500" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total: {leaveBalances.annualLeave?.total || 0}</span>
              <span>Used: {leaveBalances.annualLeave?.used || 0}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${((leaveBalances.annualLeave?.used || 0) / (leaveBalances.annualLeave?.total || 1)) * 100}%` }}
              ></div>
            </div>
            <p className="text-lg font-bold text-blue-600">
              {leaveBalances.annualLeave?.remaining || 0} Days Left
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Sick Leave</h3>
            <FontAwesomeIcon icon={faCalendarAlt} className="text-2xl text-red-500" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total: {leaveBalances.sickLeave?.total || 0}</span>
              <span>Used: {leaveBalances.sickLeave?.used || 0}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-600 h-2 rounded-full"
                style={{ width: `${((leaveBalances.sickLeave?.used || 0) / (leaveBalances.sickLeave?.total || 1)) * 100}%` }}
              ></div>
            </div>
            <p className="text-lg font-bold text-red-600">
              {leaveBalances.sickLeave?.remaining || 0} Days Left
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Casual Leave</h3>
            <FontAwesomeIcon icon={faCalendarAlt} className="text-2xl text-green-500" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total: {leaveBalances.casualLeave?.total || 0}</span>
              <span>Used: {leaveBalances.casualLeave?.used || 0}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${((leaveBalances.casualLeave?.used || 0) / (leaveBalances.casualLeave?.total || 1)) * 100}%` }}
              ></div>
            </div>
            <p className="text-lg font-bold text-green-600">
              {leaveBalances.casualLeave?.remaining || 0} Days Left
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{requestStats.total}</p>
            </div>
            <FontAwesomeIcon icon={faFileAlt} className="text-2xl text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{requestStats.pending}</p>
            </div>
            <FontAwesomeIcon icon={faClock} className="text-2xl text-yellow-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{requestStats.approved}</p>
            </div>
            <FontAwesomeIcon icon={faCheckCircle} className="text-2xl text-green-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{requestStats.rejected}</p>
            </div>
            <FontAwesomeIcon icon={faTimesCircle} className="text-2xl text-red-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Types</option>
            {leaveTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRequests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getLeaveTypeColor(request.leaveType)}`}>
                          {request.leaveType}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {request.startDate} to {request.endDate}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {request.reason.length > 50 ? `${request.reason.substring(0, 50)}...` : request.reason}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">
                      {request.duration} {request.duration === 1 ? 'Day' : 'Days'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusConfig(request.status).color}`}>
                      <FontAwesomeIcon icon={getStatusConfig(request.status).icon} className="mr-1" />
                      {request.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{request.appliedTo}</p>
                      <p className="text-xs text-gray-500">Applied: {request.appliedDate}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => {setSelectedRequest(request); setShowDetailsModal(true);}}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      <FontAwesomeIcon icon={faEye} className="mr-1" />
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Leave Request Modal */}
      {showNewRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">New Leave Request</h3>
                <button
                  onClick={() => setShowNewRequestModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {/* Leave Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type *</label>
                  <select
                    value={newLeaveRequest.leaveType}
                    onChange={(e) => setNewLeaveRequest(prev => ({...prev, leaveType: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {leaveTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                    <input
                      type="date"
                      value={newLeaveRequest.startDate}
                      onChange={(e) => setNewLeaveRequest(prev => ({...prev, startDate: e.target.value}))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                    <input
                      type="date"
                      value={newLeaveRequest.endDate}
                      onChange={(e) => setNewLeaveRequest(prev => ({...prev, endDate: e.target.value}))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Applied To */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apply To</label>
                  <select
                    value={newLeaveRequest.appliedToId}
                    onChange={(e) => setNewLeaveRequest(prev => ({...prev, appliedToId: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select HR/Manager</option>
                    {hrManagers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name} - {manager.role.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  {loadingHRManagers && (
                    <p className="text-xs text-blue-600 mt-1">Loading managers...</p>
                  )}
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                  <textarea
                    value={newLeaveRequest.reason}
                    onChange={(e) => setNewLeaveRequest(prev => ({...prev, reason: e.target.value}))}
                    placeholder="Please provide a detailed reason for your leave request"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                  />
                </div>

                {/* Emergency Contact */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                    <input
                      type="text"
                      value={newLeaveRequest.emergencyContact}
                      onChange={(e) => setNewLeaveRequest(prev => ({...prev, emergencyContact: e.target.value}))}
                      placeholder="Contact person name and relation"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Phone</label>
                    <input
                      type="tel"
                      value={newLeaveRequest.emergencyPhone}
                      onChange={(e) => setNewLeaveRequest(prev => ({...prev, emergencyPhone: e.target.value}))}
                      placeholder="+1-555-0123"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Duration Display */}
                {newLeaveRequest.startDate && newLeaveRequest.endDate && (
                  <div className={`p-3 rounded-lg ${
                    new Date(newLeaveRequest.startDate) <= new Date(newLeaveRequest.endDate) 
                      ? 'bg-blue-50' 
                      : 'bg-red-50'
                  }`}>
                    <p className={`text-sm ${
                      new Date(newLeaveRequest.startDate) <= new Date(newLeaveRequest.endDate) 
                        ? 'text-blue-700' 
                        : 'text-red-700'
                    }`}>
                      <strong>Duration:</strong> {
                        new Date(newLeaveRequest.startDate) <= new Date(newLeaveRequest.endDate)
                          ? `${calculateDuration(newLeaveRequest.startDate, newLeaveRequest.endDate)} days`
                          : 'Invalid date range'
                      }
                    </p>
                  </div>
                )}
                
                {/* Validation warnings */}
                {newLeaveRequest.startDate && new Date(newLeaveRequest.startDate) < new Date().setHours(0,0,0,0) && (
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <p className="text-sm text-yellow-700">
                      <strong>Note:</strong> You are requesting leave for a past date.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 mt-6">
                <button
                  onClick={() => setShowNewRequestModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitRequest}
                  disabled={!newLeaveRequest.leaveType || !newLeaveRequest.startDate || !newLeaveRequest.endDate || !newLeaveRequest.reason || 
                           new Date(newLeaveRequest.startDate) > new Date(newLeaveRequest.endDate)}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Details Modal */}
      {showDetailsModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Leave Request Details</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getLeaveTypeColor(selectedRequest.leaveType)}`}>
                      {selectedRequest.leaveType}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusConfig(selectedRequest.status).color}`}>
                      <FontAwesomeIcon icon={getStatusConfig(selectedRequest.status).icon} className="mr-1" />
                      {selectedRequest.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <p className="text-gray-900">{selectedRequest.startDate}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <p className="text-gray-900">{selectedRequest.endDate}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <p className="text-gray-900">{selectedRequest.duration} {selectedRequest.duration === 1 ? 'Day' : 'Days'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <p className="text-gray-900">{selectedRequest.reason}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Applied To</label>
                    <p className="text-gray-900">{selectedRequest.appliedTo}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Applied Date</label>
                    <p className="text-gray-900">{selectedRequest.appliedDate}</p>
                  </div>
                </div>

                {selectedRequest.emergencyContact && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                      <p className="text-gray-900">{selectedRequest.emergencyContact}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Phone</label>
                      <p className="text-gray-900">{selectedRequest.emergencyPhone}</p>
                    </div>
                  </div>
                )}

                {selectedRequest.approvedDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {selectedRequest.status === 'Approved' ? 'Approved Date' : 'Decision Date'}
                    </label>
                    <p className="text-gray-900">{selectedRequest.approvedDate}</p>
                  </div>
                )}

                {selectedRequest.remarks && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Manager's Remarks</label>
                    <div className={`p-3 rounded-lg ${
                      selectedRequest.status === 'Approved' ? 'bg-green-50 text-green-800' :
                      selectedRequest.status === 'Rejected' ? 'bg-red-50 text-red-800' :
                      'bg-yellow-50 text-yellow-800'
                    }`}>
                      <p>{selectedRequest.remarks}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end pt-6 border-t border-gray-200 mt-6">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLeaveRequestsPage;