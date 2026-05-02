import React, { useState, useEffect } from 'react';

// Haversine distance calculation function (unchanged)
function haversineDistance(lat1, lon1, lat2, lon2) {
  function toRad(x) {
    return x * Math.PI / 180;
  }
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Office location and constants
const officeLocation = {
  geo_lat: 28.628747,
  geo_long: 77.381403,
};
const OFFICE_RADIUS_KM = 5;

// InfoModal component for notifications (unchanged)
function InfoModal({ open, onClose, title, message, status }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 relative">
        <button
          type="button"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="flex flex-col items-center mb-4">
          {status === "success" && (
            <svg className="w-12 h-12 text-green-500 mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M9 12l2 2l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          )}
          {status === "error" && (
            <svg className="w-12 h-12 text-red-500 mb-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" />
              <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {status === "info" && (
            <svg className="w-12 h-12 text-blue-500 mb-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" />
              <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">{title}</h3>
          <div className="text-gray-600 text-center whitespace-pre-line">{message}</div>
        </div>
        <button
          className="mt-4 w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-xl hover:bg-indigo-700 transition"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}

const EmployeeManagementModule = () => {
  const [employees, setEmployees] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [infoModal, setInfoModal] = useState({ open: false, title: '', message: '', status: 'info' });

  // Check permission - simplified
  const hasPermission = (permission) => {
    if (!currentUser || !currentUser.roles) return false;
    const roles = Array.isArray(currentUser.roles) ? currentUser.roles : [currentUser.roles];
    return roles.some(role =>
      typeof role === 'string'
        ? role.toLowerCase().includes(permission)
        : (role.name && role.name.toLowerCase().includes(permission))
    );
  };

  // Fetch current user from localStorage on mount
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
      } catch {}
    }
  }, []);

  // Fetch employees list
  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch('http://localhost:8000/api/employees?page=1&limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setEmployees(result.employees || result.data || []);
        } else {
          showInfo('Error', 'Failed to load employees data.', 'error');
        }
      } else {
        showInfo('Unauthorized', 'Please login to access employees data.', 'error');
      }
    } catch (error) {
      showInfo('Error', 'Network error while fetching employees.', 'error');
    }
  };

  // Show info modal
  const showInfo = (title, message, status = "info") => {
    setInfoModal({ open: true, title, message, status });
  };

  // Close info modal
  const closeInfoModal = () => {
    setInfoModal(prev => ({ ...prev, open: false }));
  };

  // Employee attendance action handler (stub)
  const handleEmployeeAttendanceAction = (employeeId, action) => {
    showInfo('Info', `Attendance action "${action}" for employee ${employeeId} is not implemented.`, 'info');
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Employee Management</h2>
        {hasPermission('hr') && (
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <i className="fas fa-plus mr-2"></i>Add Employee
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee, index) => (
                <tr key={employee.id || index}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <i className="fas fa-user text-gray-600"></i>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {employee.full_name || employee.name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {employee.employee_id || employee.user_id || 'No ID'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {employee.email || 'No email'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {Array.isArray(employee.role_names)
                      ? employee.role_names.join(', ')
                      : employee.role_names || employee.roles || employee.role || 'No role'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {employee.department || 'No department'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      employee.is_active !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {employee.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          employee.attendance_status?.status === 'present'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {employee.attendance_status?.status || 'absent'}
                        </span>
                      </div>
                      {employee.can_manage_attendance && (
                        <div className="flex space-x-1">
                          {employee.attendance_status?.can_checkin && (
                            <button
                              onClick={() => handleEmployeeAttendanceAction(employee.user_id || employee.employee_id, 'checkin')}
                              className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                              title="Check In"
                            >
                              In
                            </button>
                          )}
                          {employee.attendance_status?.can_checkout && (
                            <button
                              onClick={() => handleEmployeeAttendanceAction(employee.user_id || employee.employee_id, 'checkout')}
                              className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                              title="Check Out"
                            >
                              Out
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-900" title="View">
                        <i className="fas fa-eye"></i>
                      </button>
                      {hasPermission('hr') && (
                        <>
                          <button className="text-green-600 hover:text-green-900" title="Edit">
                            <i className="fas fa-edit"></i>
                          </button>
                          <button className="text-red-600 hover:text-red-900" title="Delete">
                            <i className="fas fa-trash"></i>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Modal */}
      {infoModal.open && (
        <InfoModal
          open={infoModal.open}
          onClose={closeInfoModal}
          title={infoModal.title}
          message={infoModal.message}
          status={infoModal.status}
        />
      )}
    </div>
  );
};

export default EmployeeManagementModule;
