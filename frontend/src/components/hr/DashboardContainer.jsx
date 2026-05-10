import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import EmployeeDashboard from './EmployeeDashboard';

const API_BASE_URL = 'https://ratilalsons-backend-api.onrender.com';

const DashboardContainer = () => {
  // State Management
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({});
  const [myAttendance, setMyAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [allEmployeeAttendance, setAllEmployeeAttendance] = useState([]);
  const [error, setError] = useState(null);

  // User Role Information
  const [isAdmin, setIsAdmin] = useState(false);
  const [isHR, setIsHR] = useState(false);

  // Initialize and load data
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // Load data after authentication
  useEffect(() => {
    if (currentUser) {
      checkUserRoles();
      // Debug user permissions
      debugUserPermissions();
      fetchEmployees();
      fetchDashboardStats();
      fetchAttendance();
      fetchLeaveRequests();
    }
  }, [currentUser]);

  // Debug user permissions
  const debugUserPermissions = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/attendance/debug/user-permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('🔧 DEBUG: User permissions check result:', result);
      } else {
        console.error('🔧 DEBUG: Permission check failed:', response.status);
      }
    } catch (error) {
      console.error('🔧 DEBUG: Error checking permissions:', error);
    }
  };

  // Error handling and retry
  const handleRetry = () => {
    setError(null);
    if (currentUser) {
      fetchDashboardStats();
      fetchAttendance();
      fetchLeaveRequests();
    }
  };

  // Check user roles and set permissions
  const checkUserRoles = () => {
    if (!currentUser) return;

    console.log('🔒 Checking roles for user:', currentUser);

    // Admin check
    const hasAdminRole =
      (currentUser.role || '').toLowerCase() === 'admin' ||
      (Array.isArray(currentUser.roles) && currentUser.roles.some(r => r.toLowerCase().includes('admin'))) ||
      !currentUser.reports_to ||
      currentUser.reports_to === null;

    // HR check - more lenient
    const hasHRRole =
      (currentUser.role || '').toLowerCase().includes('hr') ||
      (currentUser.role || '').toLowerCase().includes('human resource') ||
      (currentUser.role || '').toLowerCase() === 'hr' ||
      (Array.isArray(currentUser.roles) && currentUser.roles.some(r => r.toLowerCase().includes('hr'))) ||
      (Array.isArray(currentUser.role_names) && currentUser.role_names.some(r => r.toLowerCase().includes('hr')));

    setIsAdmin(hasAdminRole);
    setIsHR(hasHRRole);

    console.log('🔒 User Role Check - Admin:', hasAdminRole, 'HR:', hasHRRole);
    console.log('🔒 Current user role field:', currentUser.role);
    console.log('🔒 Current user roles array:', currentUser.roles);
    console.log('🔒 Current user role_names:', currentUser.role_names);
  };

  // Helper for permission checks
  const hasPermission = (role) => {
    if (role === 'admin') return isAdmin;
    if (role === 'hr') return isHR;
    return false;
  };

  // Fetch current user information
  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setCurrentUser(userData);
        console.log('👤 Current user loaded:', userData);
      } else {
        console.error('Failed to fetch current user');
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching current user:', error);
      setLoading(false);
    }
  };

  // Fetch employees list (excluding customers)
  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      console.log('📡 Fetching employees');
      // Use the staff endpoint for employee data
      const response = await fetch(`${API_BASE_URL}/api/staff/employees?active_only=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('📡 Raw employee response:', result);

        // Handle the staff API response format
        let filteredEmployees = [];
        if (result.success && result.data) {
          filteredEmployees = result.data;
        } else if (Array.isArray(result)) {
          filteredEmployees = result;
        }

        // Additional filtering to exclude customers
        filteredEmployees = filteredEmployees.filter(emp =>
          !((emp.role || '').toLowerCase() === 'customer')
        );

        setEmployees(filteredEmployees);
        console.log(`✅ ${filteredEmployees.length} employees loaded`);
      } else {
        console.error('Failed to fetch employees', response.status);
        // Fallback to users endpoint
        try {
          const fallbackResponse = await fetch(`${API_BASE_URL}/api/users/?except_role=customer`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (fallbackResponse.ok) {
            const fallbackResult = await fallbackResponse.json();
            const filteredEmployees = Array.isArray(fallbackResult)
              ? fallbackResult.filter(emp => !((emp.role || '').toLowerCase() === 'customer'))
              : [];

            setEmployees(filteredEmployees);
            console.log(`✅ ${filteredEmployees.length} employees loaded (fallback)`);
          }
        } catch (fallbackError) {
          console.error('Fallback fetch also failed:', fallbackError);
        }
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      console.log('📡 Fetching dashboard stats from:', `${API_BASE_URL}/api/attendance/admin/dashboard-stats`);

      // Use the correct attendance endpoint for dashboard stats
      const response = await fetch(`${API_BASE_URL}/api/attendance/admin/dashboard-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Dashboard stats response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        setDashboardStats(result.data || result);
        console.log('📊 Dashboard stats loaded:', result);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch dashboard stats', response.status, errorText);

        // Try alternative endpoint
        try {
          console.log('📡 Trying alternative endpoint: /api/attendance/statistics');
          const altResponse = await fetch(`${API_BASE_URL}/api/attendance/statistics`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          console.log('📡 Alternative endpoint status:', altResponse.status);

          if (altResponse.ok) {
            const altResult = await altResponse.json();
            setDashboardStats(altResult.data || altResult);
            console.log('📊 Dashboard stats loaded from alternative endpoint:', altResult);
          } else {
            console.error('Alternative endpoint also failed:', altResponse.status);

            // Try the leave dashboard-stats endpoint
            try {
              console.log('📡 Trying leave dashboard-stats endpoint');
              const leaveStatsResponse = await fetch(`${API_BASE_URL}/api/attendance/leave/dashboard-stats`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });

              if (leaveStatsResponse.ok) {
                const leaveStatsResult = await leaveStatsResponse.json();
                console.log('📊 Leave stats loaded:', leaveStatsResult);
                // Don't set dashboard stats from leave data, just log for debugging
              } else {
                console.error('Leave dashboard-stats failed:', leaveStatsResponse.status);
              }
            } catch (leaveError) {
              console.error('Error with leave stats:', leaveError);
            }
          }
        } catch (altError) {
          console.error('Error with alternative endpoint:', altError);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  // Fetch attendance records
  const fetchAttendance = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      console.log('📡 Fetching attendance from:', `${API_BASE_URL}/api/attendance/admin/all`);

      // Use the correct attendance endpoint
      const response = await fetch(`${API_BASE_URL}/api/attendance/admin/all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Attendance response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Attendance data result:', result);

        // Check if result has the expected structure
        if (result.success && result.data) {
          // Process attendance records for admin/HR view
          setAllEmployeeAttendance(result.data || []);

          // Also set current user's attendance if available
          const currentUserId = currentUser?.user_id || currentUser?.id;
          if (currentUserId && Array.isArray(result.data)) {
            const userAttendance = result.data.filter(record =>
              record.employee_id === currentUserId
            );
            setMyAttendance(userAttendance);
          }
        } else {
          console.log('Unexpected attendance data structure:', result);
          setAllEmployeeAttendance([]);
        }

        console.log('✅ Attendance data loaded');
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch attendance data', response.status, errorText);

        // Try alternative endpoint for personal attendance only
        try {
          console.log('📡 Trying personal attendance endpoint');
          const personalResponse = await fetch(`${API_BASE_URL}/api/attendance/my-records`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          console.log('📡 Personal attendance response status:', personalResponse.status);

          if (personalResponse.ok) {
            const personalResult = await personalResponse.json();
            console.log('✅ Personal attendance loaded:', personalResult);
            setMyAttendance(personalResult.data || personalResult.records || []);
          } else {
            const personalErrorText = await personalResponse.text();
            console.error('Personal attendance failed:', personalResponse.status, personalErrorText);
          }
        } catch (personalError) {
          console.error('Error fetching personal attendance:', personalError);
        }
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  // Fetch leave requests
  const fetchLeaveRequests = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      // Use the unified leave endpoint
      const response = await fetch(`${API_BASE_URL}/api/attendance/leave/admin/all?page=1&limit=20`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();

        if (result.success) {
          setLeaveRequests(result.data || []);
          console.log('✅ Leave requests loaded');
        }
      } else {
        console.error('Failed to fetch leave requests');
      }
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    }
  };

  // Check-in handler
  const handleCheckIn = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const userId = currentUser.user_id || currentUser.id;

      const response = await fetch(`${API_BASE_URL}/api/attendance/checkin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_id: userId,
          date: new Date().toISOString().split('T')[0],
          status: 'present'
        })
      });

      if (response.ok) {
        alert('Check-in recorded successfully!');
        fetchAttendance(); // Refresh attendance data
      } else {
        alert('Failed to record check-in');
      }
    } catch (error) {
      console.error('Error during check-in:', error);
      alert('Error during check-in');
    }
  };

  // Check-out handler
  const handleCheckOut = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const userId = currentUser.user_id || currentUser.id;

      const response = await fetch(`${API_BASE_URL}/api/attendance/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_id: userId,
          date: new Date().toISOString().split('T')[0]
        })
      });

      if (response.ok) {
        alert('Check-out recorded successfully!');
        fetchAttendance(); // Refresh attendance data
      } else {
        alert('Failed to record check-out');
      }
    } catch (error) {
      console.error('Error during check-out:', error);
      alert('Error during check-out');
    }
  };

  // Leave request approval handler
  const handleLeaveApproval = async (requestId, action, reason) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const endpoint = `${API_BASE_URL}/api/attendance/leave/admin/action/${requestId}`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: action,
          remarks: reason
        })
      });

      if (response.ok) {
        alert(`Leave request ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
        fetchLeaveRequests(); // Refresh leave data
      } else {
        alert(`Failed to ${action} leave request`);
      }
    } catch (error) {
      console.error(`Error ${action}ing leave request:`, error);
      alert(`Error ${action}ing leave request`);
    }
  };

  // Submit leave request handler
  const handleSubmitLeaveRequest = async (leaveData) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/attendance/leave/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(leaveData)
      });

      if (response.ok) {
        alert('Leave request submitted successfully!');
        fetchLeaveRequests(); // Refresh leave data
      } else {
        alert('Failed to submit leave request');
      }
    } catch (error) {
      console.error('Error submitting leave request:', error);
      alert('Error submitting leave request');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-3 text-gray-700">Loading dashboard...</p>
      </div>
    );
  }

  // Not authenticated state
  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-red-500 text-xl mb-4">Please log in to access the dashboard</div>
        <button
          onClick={() => window.location.href = '/login'}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Go to Login
        </button>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-red-500 text-xl mb-4">Error Loading Dashboard</div>
        <div className="text-gray-600 mb-4">{error}</div>
        <button
          onClick={handleRetry}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Content Area */}
      <div className="container mx-auto p-4">
        {/* Always show Dashboard content */}
        <div className="space-y-6">
          {(isAdmin || isHR) ? (
            <Dashboard
              dashboardStats={dashboardStats}
              employees={employees}
              hasPermission={hasPermission}
            />
          ) : (
            <EmployeeDashboard
              userDetails={currentUser}
              userAttendance={myAttendance}
              userLeaves={leaveRequests.filter(leave => leave.user_id === (currentUser.user_id || currentUser.id))}
              userActivities={[]} // TODO: Add user activities if available
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardContainer;
