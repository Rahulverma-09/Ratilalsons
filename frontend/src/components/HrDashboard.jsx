import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Haversine distance calculation function
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

// InfoModal component for notifications
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

const HRStaffModuleComplete = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState({});
  const [myAttendance, setMyAttendance] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const navigate = useNavigate();

  // Attendance modal and location states
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [geo, setGeo] = useState({ geo_lat: "", geo_long: "", accuracy: Infinity });
  const [geoError, setGeoError] = useState(false);
  const [geoAddress, setGeoAddress] = useState("");
  const [geoTime, setGeoTime] = useState("");
  const [locationReadings, setLocationReadings] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [infoModal, setInfoModal] = useState({
    open: false,
    title: "",
    message: "",
    status: "info"
  });

  // Helper: Show info modal
  const showInfo = (title, message, status = "info") => {
    setInfoModal({ open: true, title, message, status });
  };

  // Helper: Close info modal
  const closeInfoModal = () => {
    setInfoModal(prev => ({ ...prev, open: false }));
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    setShowLogin(true);
    setActiveTab('dashboard');
  };

  // Fetch current user data
  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        navigate("/login");
        setLoading(false);
        return;
      }
      const response = await fetch("http://localhost:8000/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      if (response.status === 401) {
        localStorage.removeItem("access_token");
        navigate("/login");
        setLoading(false);
        return;
      }
      if (!response.ok) throw new Error("Failed to fetch user");
      const result = await response.json();

      if (result && result.id) {
        setCurrentUser({
          ...result,
          department: result.department ?? '',
          joindate: result.joindate ?? '',
          employeeid: result.employeeid ?? result.user_id ?? '',
          fullname: result.full_name ?? result.name ?? '',
        });
      } else throw new Error("Invalid API response");

    } catch (error) {
      console.error("Error fetching user:", error);
      localStorage.removeItem("access_token");
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  // Check permission helper
  const hasPermission = (permission) => {
    if (!currentUser || !currentUser.roles) return false;
    const roles = Array.isArray(currentUser.roles) ? currentUser.roles : [currentUser.roles];
    return roles.some(role =>
      typeof role === 'string'
        ? role.toLowerCase().includes('admin') || role.toLowerCase().includes('hr')
        : (role.name && (role.name.toLowerCase().includes('admin') || role.name.toLowerCase().includes('hr')))
    );
  };

  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch('http://localhost:8000/api/employees/dashboard-stats', {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const stats = result.stats || result;
          setDashboardStats(stats);
        }
      } else if (response.status === 401) {
        setShowLogin(true);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  // Fetch employees list
  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch('http://localhost:8000/api/employees?page=1&limit=50', {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setEmployees(result.employees || result.data || []);
        }
      } else if (response.status === 401) {
        setShowLogin(true);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  // Fetch my attendance records
  const fetchMyAttendance = async () => {
    if (!currentUser?.id) return;
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await fetch(`http://localhost:8000/api/employees/${currentUser.user_id}/attendance`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (Array.isArray(result)) {
          setMyAttendance(result);
        } else if (result && Array.isArray(result.records)) {
          setMyAttendance(result.records);
        } else if (result && Array.isArray(result.data)) {
          setMyAttendance(result.data);
        } else if (result && result.success && (result.records || result.data)) {
          setMyAttendance(result.records || result.data || []);
        } else {
          setMyAttendance([]);
        }
      } else if (response.status === 401) {
        setShowLogin(true);
      } else {
        setMyAttendance([]);
      }
    } catch (error) {
      setMyAttendance([]);
      console.error('Error fetching my attendance:', error);
    }
  };

  // Handle check-in / check-out for current user
  const handleAttendanceAction = async (action) => {
    if (!currentUser?.id) return;

    if (action === 'checkin') {
      await submitInstantCheckin();
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8000/api/employees/${currentUser.user_id}/attendance/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: `${action} by ${currentUser.full_name || currentUser.name}`,
          location: 'Office'
        })
      });

      if (response.ok) {
        const result = await response.json();
        showInfo(
          "Success",
          `${action === 'checkout' ? 'Checked out' : 'Attendance recorded'} successfully!`,
          "success"
        );
        fetchMyAttendance();
        fetchDashboardStats();
        fetchEmployees();
      } else {
        const error = await response.json();
        showInfo("Error", error.detail || `Failed to ${action}`, "error");
      }
    } catch (error) {
      console.error(`Error during ${action}:`, error);
      showInfo("Error", `Failed to ${action}. Please try again.`, "error");
    }
  };

  // Check-in function
  const submitInstantCheckin = async () => {
    if (!currentUser?.id) return;

    setAttendanceLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `http://localhost:8000/api/employees/${currentUser.user_id}/attendance/checkin`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: `Marked via application`,
            status: "present"
          })
        }
      );

      if (response.ok) {
        showInfo(
          "Checked In Successfully",
          `Your check-in has been recorded.\nTime: ${new Date().toLocaleTimeString()}`,
          "success"
        );

        fetchMyAttendance();
        fetchDashboardStats();
        fetchEmployees();
      } else {
        const err = await response.json();
        showInfo("Error", err.detail || "Failed to check in", "error");
      }
    } catch (err) {
      console.error("Check-in error:", err);
      showInfo("Error", "Failed to check in. Try again.", "error");
    }

    setAttendanceLoading(false);
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser && !showLogin) {
      fetchDashboardStats();
      fetchEmployees();
      fetchMyAttendance();
    }
  }, [currentUser, showLogin]);

  // Helper to format time in IST
  const formatISTTime = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Dashboard Component
  const Dashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Employees</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardStats.total_employees || 0}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <i className="fas fa-users text-blue-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Present Today</p>
              <p className="text-2xl font-bold text-green-600">{dashboardStats.present_today || 0}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <i className="fas fa-check-circle text-green-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Absent Today</p>
              <p className="text-2xl font-bold text-red-600">{dashboardStats.absent_today || 0}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <i className="fas fa-times-circle text-red-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Leaves</p>
              <p className="text-2xl font-bold text-yellow-600">{dashboardStats.pending_leaves || 0}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <i className="fas fa-calendar-alt text-yellow-600"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => handleAttendanceAction('checkin')}
            className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <i className="fas fa-sign-in-alt text-green-600 text-xl mb-2"></i>
            <span className="text-sm font-medium text-green-700">Check In</span>
          </button>
          
          <button
            onClick={() => handleAttendanceAction('checkout')}
            className="flex flex-col items-center p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <i className="fas fa-sign-out-alt text-red-600 text-xl mb-2"></i>
            <span className="text-sm font-medium text-red-700">Check Out</span>
          </button>
          
          <button
            onClick={() => navigate("/hr")} //hr staff management
            className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <i className="fas fa-users text-blue-600 text-xl mb-2"></i>
            <span className="text-sm font-medium text-blue-700">Manage Employees</span>
          </button>
          
          <button
            onClick={() => navigate("/attendance")}
            className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <i className="fas fa-clock text-purple-600 text-xl mb-2"></i>
            <span className="text-sm font-medium text-purple-700">View Attendance</span>
          </button>

        </div>
      </div>

      {/* Recent Attendance */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">My Recent Attendance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {myAttendance.slice(0, 5).map((record, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(record.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatISTTime(record.check_in_time || record.checkin_time)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatISTTime(record.check_out_time || record.checkout_time)}

                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      record.status === 'present' 
                        ? 'bg-green-100 text-green-800'
                        : record.status === 'absent'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {record.status || 'Unknown'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Profile Management Component

  const ProfileManagement = ({ currentUser, fetchCurrentUser, showInfo }) => {
    // State for profile edit modal
    const [editOpen, setEditOpen] = useState(false);
    // Profile edit form state
    const [editForm, setEditForm] = useState({
      full_name: "",
      email: "",
      department: "",
      join_date: "",
    });
    // Loading state for edit operation
    const [editLoading, setEditLoading] = useState(false);

    // Document upload loading state
    const [uploadLoading, setUploadLoading] = useState(false);

    // Leave request modal and form state
    const [leaveOpen, setLeaveOpen] = useState(false);
    const [leaveForm, setLeaveForm] = useState({
      start_date: "",
      end_date: "",
      reason: "",
    });
    const [leaveLoading, setLeaveLoading] = useState(false);

    // Debug: log whenever currentUser changes
    useEffect(() => {
      console.log("currentUser:", currentUser);
    }, [currentUser]);

    // Initialize edit form when user info arrives
    useEffect(() => {
      if (currentUser) {
        setEditForm({
          full_name: currentUser.full_name || currentUser.name || "",
          email: currentUser.email || "",
          department: currentUser.department || "",
          join_date: currentUser.join_date ? currentUser.join_date.split("T")[0] : "",
        });
      }
    }, [currentUser]);

    // Loader if no user data yet
    if (!currentUser) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    // Edit modal open handler
    const handleOpenEdit = () => {
      setEditForm({
        full_name: currentUser.full_name || currentUser.name || "",
        email: currentUser.email || "",
        department: currentUser.department || "",
        join_date: currentUser.join_date ? currentUser.join_date.split("T")[0] : "",
      });
      setEditOpen(true);
    };

    // Edit profile submit handler
    const handleEditProfile = async (e) => {
      e.preventDefault();
      setEditLoading(true);
      try {
        const token = localStorage.getItem("access_token");
        const response = await fetch(
          `http://localhost:8000/api/employees/${currentUser.user_id || currentUser.id}/profile`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(editForm),
          }
        );
        if (response.ok) {
          setEditOpen(false);
          showInfo("Profile updated.", "success");
          fetchCurrentUser();
        } else {
          const err = await response.json();
          showInfo(err.detail || "Failed to update profile", "error");
        }
      } catch {
        showInfo("Failed to update profile. Try again.", "error");
      }
      setEditLoading(false);
    };

    // Document upload handler
    const handleUploadDocument = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      setUploadLoading(true);
      try {
        const token = localStorage.getItem("access_token");
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(
          `http://localhost:8000/api/employees/upload-document?document_type=document`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );
        if (response.ok) {
          showInfo("Document uploaded.", "success");
        } else {
          const err = await response.json();
          showInfo(err.detail || "Failed to upload document", "error");
        }
      } catch {
        showInfo("Failed to upload document. Try again.", "error");
      }
      setUploadLoading(false);
    };

    // Leave modal open handler
    const handleOpenLeave = () => {
      setLeaveForm({ start_date: "", end_date: "", reason: "" });
      setLeaveOpen(true);
    };

    // Leave request submit handler
    const handleLeaveSubmit = async (e) => {
      e.preventDefault();
      setLeaveLoading(true);
      try {
        const token = localStorage.getItem("access_token");
        const response = await fetch(
          `http://localhost:8000/api/attendance/leave/admin/all?page=1&limit=20`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...leaveForm,
              user_id: currentUser.user_id || currentUser.id,
            }),
          }
        );
        if (response.ok) {
          setLeaveOpen(false);
          showInfo("Leave request submitted.", "success");
        } else {
          const err = await response.json();
          showInfo(err.detail || "Failed to submit leave request", "error");
        }
      } catch {
        showInfo("Failed to submit leave request. Try again.", "error");
      }
      setLeaveLoading(false);
    };

    return (
      <div className="space-y-6">
        {/* Profile Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">My Profile</h2>
          <button
            onClick={handleOpenEdit}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <i className="fas fa-edit mr-2"></i>Edit Profile
          </button>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0">
              <div className="h-24 w-24 rounded-full bg-gray-300 flex items-center justify-center">
                <i className="fas fa-user text-gray-600 text-3xl"></i>
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {currentUser.full_name || currentUser.fullname || currentUser.name || "Unknown User"}
                </h3>
                <p className="text-gray-600">{currentUser.email || "No email"}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Employee ID</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {currentUser.user_id || currentUser.employee_id || currentUser.id || "N/A"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Department</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {currentUser.department || "Not assigned"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {Array.isArray(currentUser.roles)
                      ? currentUser.roles.join(", ")
                      : currentUser.role || currentUser.roles || "No role assigned"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Join Date</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {currentUser.join_date
                      ? new Date(currentUser.join_date).toLocaleDateString()
                      : "Not available"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Document Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">My Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer flex flex-col items-center">
              <i className="fas fa-file-upload text-gray-400 text-3xl mb-2"></i>
              <p className="text-sm text-gray-600 mb-2">
                {uploadLoading ? "Uploading..." : "Upload Documents"}
              </p>
              <input
                type="file"
                accept=".pdf,.jpg,.png,.doc,.docx"
                className="hidden"
                onChange={handleUploadDocument}
                disabled={uploadLoading}
              />
            </label>
          </div>
        </div>

        {/* Leave Requests Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              My Leave Requests
            </h3>
            <button
              onClick={handleOpenLeave}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <i className="fas fa-plus mr-2"></i>Request Leave
            </button>
          </div>
          <div className="text-center py-8 text-gray-500">
            <i className="fas fa-calendar-alt text-4xl mb-2"></i>
            <p>No leave requests found</p>
          </div>
        </div>

        {/* Edit Profile Modal */}
        {editOpen && (
          <div
            className="fixed inset-0 flex items-center justify-center z-[200] bg-black/40 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditOpen(false);
            }}
          >
            <form
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative"
              onSubmit={handleEditProfile}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl"
                onClick={() => setEditOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
              <h3 className="text-xl font-bold text-indigo-700 mb-6 text-center">
                Edit Profile
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Full Name</label>
                  <input
                    name="full_name"
                    type="text"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    value={editForm.full_name}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        full_name: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    name="email"
                    type="email"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Department</label>
                  <input
                    name="department"
                    type="text"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    value={editForm.department}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        department: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Join Date</label>
                  <input
                    name="join_date"
                    type="date"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    value={editForm.join_date}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        join_date: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <button
                type="submit"
                className={`mt-6 w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-xl hover:bg-indigo-700 transition ${
                  editLoading && "opacity-60 pointer-events-none"
                }`}
                disabled={editLoading}
              >
                {editLoading ? "Updating..." : "Update Profile"}
              </button>
            </form>
          </div>
        )}

        {/* Leave Request Modal */}
        {leaveOpen && (
          <div
            className="fixed inset-0 flex items-center justify-center z-[200] bg-black/40 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setLeaveOpen(false);
            }}
          >
            <form
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative"
              onSubmit={handleLeaveSubmit}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl"
                onClick={() => setLeaveOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
              <h3 className="text-xl font-bold text-indigo-700 mb-6 text-center">
                Request Leave
              </h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Date</label>
                  <input
                    name="start_date"
                    type="date"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    value={leaveForm.start_date}
                    onChange={(e) =>
                      setLeaveForm((prev) => ({
                        ...prev,
                        start_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Date</label>
                  <input
                    name="end_date"
                    type="date"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    value={leaveForm.end_date}
                    onChange={(e) =>
                      setLeaveForm((prev) => ({
                        ...prev,
                        end_date: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Reason</label>
                  <textarea
                    name="reason"
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm resize-none"
                    value={leaveForm.reason}
                    onChange={(e) =>
                      setLeaveForm((prev) => ({
                        ...prev,
                        reason: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className={`mt-6 w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-xl hover:bg-indigo-700 transition ${
                  leaveLoading && "opacity-60 pointer-events-none"
                }`}
                disabled={leaveLoading}
              >
                {leaveLoading ? "Submitting..." : "Submit Leave Request"}
              </button>
            </form>
          </div>
        )}
      </div>
    );
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'chart-pie', component: Dashboard },
    { id: 'profile', label: 'My Profile', icon: 'user', component: ProfileManagement },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || Dashboard;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">Welcome back, {currentUser?.full_name || currentUser?.name || 'User'}</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <i className={`fas fa-${tab.icon}`}></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'profile' ? (
          <ProfileManagement
            currentUser={currentUser}
            fetchCurrentUser={fetchCurrentUser}
            showInfo={showInfo}
          />
        ) : (
          <Dashboard
            dashboardStats={dashboardStats}
            // pass other Dashboard-specific props if needed
          />
        )}
      </div>
      
      {/* Info Modal */}
      {infoModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" 
            onClick={() => closeInfoModal()}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 relative"
            onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl"
              onClick={closeInfoModal}
              aria-label="Close"
            >
              ×
            </button>
            <div className="flex flex-col items-center mb-4">
              {infoModal.status === "success" && (
                <svg className="w-12 h-12 text-green-500 mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path d="M9 12l2 2l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
              {infoModal.status === "error" && (
                <svg className="w-12 h-12 text-red-500 mb-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" />
                  <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <h3 className="text-lg font-medium">{infoModal.title}</h3>
            </div>
            <div className="whitespace-pre-line text-center">
              {infoModal.message}
            </div>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                onClick={closeInfoModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRStaffModuleComplete;
