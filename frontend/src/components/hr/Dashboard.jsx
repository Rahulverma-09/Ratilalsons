
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const HRDashboard = ({ dashboardStats = {}, employees = [], hasPermission }) => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAdditionalData();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchAdditionalData = async () => {
    try {
      setLoading(true);
      setError(null);

      await Promise.all([
        fetchLeaveRequests(),
        fetchAttendanceData()
      ]);

    } catch (error) {
      console.error('Error fetching additional dashboard data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveRequests = async () => {
    // Try multiple endpoints for leave requests
    const endpoints = [
      'https://ratilalsons-backend-api.onrender.com/api/attendance/leave/admin/all?page=1&limit=20',
      'https://ratilalsons-backend-api.onrender.com/api/leave-requests/all',
      'https://ratilalsons-backend-api.onrender.com/leave-requests/all'
    ];

    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: getAuthHeaders()
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Leave requests loaded from:', endpoint, data);

          // Handle different response formats
          if (Array.isArray(data)) {
            setLeaveRequests(data);
          } else if (data.data && Array.isArray(data.data)) {
            setLeaveRequests(data.data);
          } else if (data.leave_requests && Array.isArray(data.leave_requests)) {
            setLeaveRequests(data.leave_requests);
          } else {
            setLeaveRequests([]);
          }
          return;
        } else {
          lastError = new Error(`${endpoint} returned ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        lastError = error;
        console.warn(`Failed to fetch from ${endpoint}:`, error);
      }
    }

    console.warn('All leave request endpoints failed, setting empty array');
    setLeaveRequests([]);
  };

  const fetchAttendanceData = async () => {
    try {
      const response = await fetch('https://ratilalsons-backend-api.onrender.com/api/attendance/admin/all', {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        console.warn(`Failed to fetch attendance: ${response.status}`);
        setAttendance([]);
        return;
      }

      const data = await response.json();
      if (data.success && data.data) {
        setAttendance(Array.isArray(data.data) ? data.data : []);
      } else {
        setAttendance([]);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendance([]);
    }
  };

  // Calculate derived statistics from actual data
  const calculateStats = () => {
    // Filter out any customers or inactive users from employees array
    const activeEmployees = employees.filter(emp =>
      emp.is_active !== false &&
      (emp.role || '').toLowerCase() !== 'customer'
    );

    const totalEmployees = activeEmployees.length;
    const pendingLeaves = leaveRequests.filter(req => req.status === 'pending').length;
    const approvedLeaves = leaveRequests.filter(req => req.status === 'approved').length;

    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(att =>
      att.attendance_date === today || att.date === today
    );
    const presentToday = todayAttendance.filter(att => att.status === 'present').length;
    const absentToday = Math.max(0, totalEmployees - presentToday);

    // Department breakdown using filtered employees
    const departmentMap = {};
    activeEmployees.forEach(emp => {
      const dept = emp.department || emp.employee_department || 'Unassigned';
      departmentMap[dept] = (departmentMap[dept] || 0) + 1;
    });

    const departmentBreakdown = Object.entries(departmentMap).map(([dept, count]) => ({
      department: dept,
      count: count,
      percentage: totalEmployees > 0 ? ((count / totalEmployees) * 100).toFixed(1) : 0
    }));

    // Debug logging
    console.log('📊 Dashboard Stats Debug:');
    console.log('Total employees from props:', employees.length);
    console.log('Active employees (filtered):', totalEmployees);
    console.log('Dashboard stats from backend:', dashboardStats);

    // Use actual filtered employee count instead of backend stats
    return {
      totalEmployees: totalEmployees, // Use filtered count instead of dashboardStats.total_active_employees
      presentToday: dashboardStats.present_today || presentToday,
      absentToday: dashboardStats.absent_today || absentToday,
      pendingLeaves,
      approvedLeaves,
      departmentBreakdown,
      attendanceRate: dashboardStats.attendance_percentage ||
        (totalEmployees > 0 ? ((presentToday / totalEmployees) * 100).toFixed(1) : 0)
    };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading HR Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Error Loading Dashboard</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchAdditionalData}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w bg-white-100">
      {/* HR Dashboard Header */}
      <div className="bg-white border-b border-gray-200 mb-8">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-4xl font-bold text-indigo-500">HR Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome! Here's what's happening today.</p>
        </div>
      </div>

      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Insights Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Employees */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Employees</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.totalEmployees}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-users text-blue-600 text-xl"></i>
              </div>
            </div>
          </div>

          {/* Present Today */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Present Today</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.presentToday}</p>
                <p className="text-xs text-gray-500 mt-1">{stats.attendanceRate}% attendance rate</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-check-circle text-green-600 text-xl"></i>
              </div>
            </div>
          </div>

          {/* Absent Today */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Absent Today</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{stats.absentToday}</p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-times-circle text-red-600 text-xl"></i>
              </div>
            </div>
          </div>

          {/* Pending Leave Requests */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Leaves</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{stats.pendingLeaves}</p>
                <p className="text-xs text-gray-500 mt-1">{stats.approvedLeaves} approved</p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <i className="fas fa-calendar-alt text-orange-600 text-xl"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Department Breakdown */}
        {stats.departmentBreakdown.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Department Breakdown</h3>

              <div className="space-y-4">
                {stats.departmentBreakdown.map((dept, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">{dept.department}</span>
                      <span className="text-sm font-bold text-gray-900">{dept.count} ({dept.percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${dept.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Leave Requests */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Recent Leave Requests</h3>
                <span className="text-sm text-gray-500">
                  {leaveRequests.length} total
                </span>
              </div>

              <div className="space-y-4 max-h-64 overflow-y-auto">
                {leaveRequests
                  .sort((a, b) => new Date(b.created_at || b.request_date || '').getTime() - new Date(a.created_at || a.request_date || '').getTime())
                  .slice(0, 5)
                  .map((request, index) => {
                    const employeeName = request.employee_name || request.full_name || request.user_name || request.name || 'Employee';
                    const leaveType = request.leave_type || request.type || 'Leave';
                    const startDate = request.start_date || request.from_date || 'N/A';
                    const endDate = request.end_date || request.to_date || 'N/A';
                    const status = (request.status || 'pending').toLowerCase();

                    // Calculate duration if dates are available
                    let duration = '';
                    if (startDate !== 'N/A' && endDate !== 'N/A') {
                      const start = new Date(startDate);
                      const end = new Date(endDate);
                      const diffTime = Math.abs(end - start);
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                      duration = `${diffDays} day${diffDays > 1 ? 's' : ''}`;
                    }

                    return (
                      <div key={request.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {employeeName}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                            <span className="font-medium text-blue-600">{leaveType}</span>
                            <span>•</span>
                            <span>{startDate} to {endDate}</span>
                            {duration && (
                              <>
                                <span>•</span>
                                <span className="text-orange-600 font-medium">{duration}</span>
                              </>
                            )}
                          </div>
                          {request.reason && (
                            <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                              {request.reason}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                {leaveRequests.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="fas fa-calendar-alt text-gray-400"></i>
                    </div>
                    <p className="font-medium">No leave requests found</p>
                    <p className="text-sm mt-1">Leave requests will appear here when submitted</p>
                  </div>
                )}
              </div>

              {leaveRequests.length > 5 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <Link
                    to="/leave-management"
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View all {leaveRequests.length} requests →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/hr"
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-center group"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-200 transition-colors">
                <i className="fas fa-users text-blue-600 text-xl"></i>
              </div>
              <p className="text-sm font-medium text-gray-900">Manage Employees</p>
              <p className="text-xs text-gray-500 mt-1">{stats.totalEmployees} total</p>
            </Link>

            <Link
              to="/my-attendance"
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-center group"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-green-200 transition-colors">
                <i className="fas fa-clock text-green-600 text-xl"></i>
              </div>
              <p className="text-sm font-medium text-gray-900">Attendance</p>
              <p className="text-xs text-gray-500 mt-1">{stats.attendanceRate}% today</p>
            </Link>

            <Link
              to="/leave-management"
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-center group"
            >
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-yellow-200 transition-colors">
                <i className="fas fa-calendar text-yellow-600 text-xl"></i>
              </div>
              <p className="text-sm font-medium text-gray-900">Leaves</p>
              <p className="text-xs text-gray-500 mt-1">{stats.pendingLeaves} pending</p>
            </Link>

            <Link
              to="/tasks"
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-center group"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3 group-hover:bg-purple-200 transition-colors">
                <i className="fas fa-tasks text-purple-600 text-xl"></i>
              </div>
              <p className="text-sm font-medium text-gray-900">Tasks</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HRDashboard;