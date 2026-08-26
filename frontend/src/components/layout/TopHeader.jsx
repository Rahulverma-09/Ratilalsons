import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBell } from "react-icons/fa";
import { API_URL } from '../../config.js';

const INACTIVITY_ALERTS_API = `${API_URL}/api/alerts/inactivity`;
const ANOMALY_ALERTS_API = `${API_URL}/api/alerts/anomaly/detect`;
const ASSIGNED_TASKS_API = `${API_URL}/api/tasks/assigned`;

const TopHeader = ({
  toggleSidebar,
  currentDateTime = "2025-06-04 12:58:26",
  logout
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [editProfileData, setEditProfileData] = useState({ full_name: '', email: '', new_password: '', confirm_password: '' });
  const [editProfileError, setEditProfileError] = useState('');
  const [editProfileLoading, setEditProfileLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [roleId, setRoleId] = useState(null);
  const [username, setUsername] = useState("");
  const [notifCount, setNotifCount] = useState(0);
  const [jiggle, setJiggle] = useState(false);
  const dropdownRef = useRef(null);
  const profileBtnRef = useRef(null);
  const navigate = useNavigate();

  // ---------- Notification Popup State ----------
  const [showNotifCard, setShowNotifCard] = useState(false);
  const notifBtnRef = useRef(null);

  // Alert/task data
  const [inactivityAlerts, setInactivityAlerts] = useState([]);
  const [anomalyAlerts, setAnomalyAlerts] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Date range for anomaly API
  const [dateParams, setDateParams] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });

  // Fetch alerts for admin
  const fetchAlerts = () => {
    setAlertsLoading(true);
    Promise.all([
      fetch(INACTIVITY_ALERTS_API).then((res) => res.json()).catch(() => []),
      fetch(`${ANOMALY_ALERTS_API}?start=${dateParams.start}&end=${dateParams.end}`).then((res) => res.json()).catch(() => []),
    ])
      .then(([ina, ano]) => {
        const inaArr = Array.isArray(ina) ? ina : [];
        const anoArr = Array.isArray(ano) ? ano : [];
        setInactivityAlerts(inaArr);
        setAnomalyAlerts(anoArr);
        setNotifCount(inaArr.length + anoArr.length);
        setAlertsLoading(false);
      })
      .catch(() => setAlertsLoading(false));
  };

  // Fetch tasks for HR or employee
  const fetchAssignedTasks = () => {
    setAlertsLoading(true);
    const token = localStorage.getItem('access_token');
    fetch(`${ASSIGNED_TASKS_API}?userId=${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(tasks => {
        const tasksArr = Array.isArray(tasks) ? tasks : [];
        setAssignedTasks(tasksArr);
        setNotifCount(tasksArr.length);
        setAlertsLoading(false);
      })
      .catch(() => setAlertsLoading(false));
  }


  // Formatting and sorting
  const formatDate = (v) => (v ? v.split("T")[0] : "");
  const mergedAlerts = [
    ...inactivityAlerts.map((a) => ({
      ...a,
      type: "inactivity",
      date: a.start || a.createdAt || "",
    })),
    ...anomalyAlerts.map((a) => ({
      ...a,
      type: "anomaly",
      date: a.detected || a.createdAt || "",
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const sortedTasks = assignedTasks
    .map(t => ({
      ...t,
      date: t.due_date || t.created_at || "",
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // --- Always check all 3: roleId, userRole, userId
  useEffect(() => {
    console.log('userId:', userId, 'roleId:', roleId, 'userRole:', userRole);
    if (!userRole) return;
    // For admin, userId not needed; for employee/hr, userId needed
    if (userRole === 'admin') {
      fetchAlerts();
    } else if ((userRole === 'employee' || userRole === 'hr') && userId) {
      fetchAssignedTasks();
    }
    // Interval logic
    const t = setInterval(() => {
      if (userRole === 'admin') {
        fetchAlerts();
      } else if ((userRole === 'employee' || userRole === 'hr') && userId) {
        fetchAssignedTasks();
      }
    }, 60000);
    return () => clearInterval(t);
  }, [dateParams.start, dateParams.end, userRole, userId]);

  useEffect(() => {
    if (notifCount > 0) {
      const interval = setInterval(() => {
        setJiggle(true);
        setTimeout(() => setJiggle(false), 4000);
      }, 20000);
      return () => clearInterval(interval);
    }
  }, [notifCount]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        (!profileBtnRef.current || !profileBtnRef.current.contains(event.target)) &&
        (!notifBtnRef.current || !notifBtnRef.current.contains(event.target))
      ) {
        setShowDropdown(false);
        setShowProfileCard(false);
        setShowNotifCard(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Parse localStorage for ID, username, roleId
  useEffect(() => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setUserId(user.user_id || user.id);
        setUsername(user.full_name || user.username || "User");
        let rid = null;
        if (user.role_id) {
          rid = user.role_id;
        } else if (Array.isArray(user.roles) && user.roles.length > 0) {
          rid = user.roles[0];
        }
        setRoleId(rid);
      }
    } catch (error) {
      setUsername("User");
      console.error('Error parsing user data:', error);
    }
  }, []);

  // Looks up role name from API using roleId
  useEffect(() => {
    if (!roleId) return;
    const fetchRoleName = async () => {
      try {
        const res = await fetch(`https://ratilalsons-backend-api.onrender.com/api/roles/${roleId}`);
        if (!res.ok) throw new Error('Failed to fetch role');
        const data = await res.json();
        if (data && data.role_name) {
          setUserRole(data.role_name.toLowerCase());
        } else if (data && data.name) {
          setUserRole(data.name.toLowerCase());
        } else {
          setUserRole('user');
        }
      } catch (err) {
        setUserRole('user');
      }
    };
    fetchRoleName();
  }, [roleId]);

  const handleLogout = (e) => {
    e.preventDefault();
    setShowDropdown(false);
    setShowLogoutModal(true);
    setTimeout(() => {
      setShowLogoutModal(false);
      if (logout) logout();
      navigate('/login', { replace: true });
    }, 1500);
  };

  const handleProfileClick = async (e) => {
    e.preventDefault();
    setShowDropdown(false);
    setProfileLoading(true);
    setProfileError("");
    setShowProfileCard(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("https://ratilalsons-backend-api.onrender.com/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch user details");
      }
      const data = await res.json();
      setUserDetails(data);
      setEditProfileData({
        full_name: data.full_name || '',
        email: data.email || '',
        new_password: '',
        confirm_password: ''
      });
    } catch (err) {
      setProfileError("Could not load user details.");
      setUserDetails(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfileCard = () => setShowProfileCard(false);

  // Bell click handler
  const handleNotifClick = (e) => {
    e.preventDefault();
    setShowNotifCard(!showNotifCard);
    setShowDropdown(false);
    setShowProfileCard(false);
    // Refresh notifications on open
    if (userRole === 'admin') {
      fetchAlerts();
    } else if ((userRole === 'employee' || userRole === 'hr') && userId) {
      fetchAssignedTasks();
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 py-3 px-4 md:px-6 flex justify-between items-center shadow-sm">
      {/* Left section - Hamburger menu and Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => toggleSidebar()}
          className="text-gray-500 hover:text-blue-600 focus:outline-none p-2 rounded-md hover:bg-gray-100 transition-colors md:hidden"
          aria-label="Toggle Sidebar"
        >
          <i className="fas fa-bars text-xl"></i>
        </button>
        <h1 className="text-3xl font-extrabold tracking-wide bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-400 bg-clip-text text-transparent hidden sm:block">
          CRM
        </h1>
        <h1 className="text-2xl font-extrabold tracking-wide bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-400 bg-clip-text text-transparent sm:hidden">
          CRM
        </h1>
      </div>
      {/* Right section - User Profile */}
      <div className="flex items-center gap-2 md:gap-3">

        {/* Notification Bell Button */}
        <button
          className="relative focus:outline-none mr-2 rounded-full p-2 hover:bg-blue-100 transition"
          aria-label="Alerts & Notifications"
          onClick={handleNotifClick}
          ref={notifBtnRef}
        >
          <FaBell
            className={`text-blue-500 ${notifCount > 0 && jiggle ? "bell-animate" : ""}`}
            size={22}
          />
          {notifCount > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white rounded-full text-[10px] px-1.5 py-0.5 font-bold">
              {notifCount}
            </span>
          )}
        </button>

        {/* NOTIFICATION POP CARD */}
        {showNotifCard && (
          <div
            className="absolute z-50 right-2 mt-16 w-full max-w-xs sm:w-80 bg-white border border-blue-200 shadow-xl rounded-xl animate-fadeInNotif"
            style={{
              top: "1.3rem",
              right: "3.0rem",
              minWidth: "220px",
              width: "90vw",
              maxWidth: "280px"
            }}
          >
            <div className="p-4 border-b border-blue-50 font-semibold text-lg text-blue-700 flex items-center">
              <span className="mr-2"><FaBell className="inline" /></span>
              Notifications
            </div>
            <div className="max-h-72 overflow-y-auto">
              {alertsLoading ? (
                <div className="p-4 text-gray-500 text-sm text-center">Loading...</div>
              ) : (
                userRole === 'admin' ? (
                  mergedAlerts.length === 0 ? (
                    <div className="p-4 text-gray-500 text-sm text-center">No notifications yet.</div>
                  ) : (
                    mergedAlerts.map((n, idx) => (
                      <div key={n.id || idx} className="p-3 border-b bg-pink-100 last:border-none border-gray-300 flex flex-col gap-1">
                        <span className="text-gray-900">
                          {n.generator || n.site || n.device || "Alert"}
                        </span>
                        <span className="text-sm text-gray-700">
                          {n.issue || n.anomaly || n.subject || "No description"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(n.date)}
                        </span>
                      </div>
                    ))
                  )
                ) : (userRole === 'employee' || userRole === 'hr') ? (
                  sortedTasks.length === 0 ? (
                    <div className="p-4 text-gray-500 text-sm text-center">No assigned tasks yet.</div>
                  ) : (
                    sortedTasks.map((task, idx) => (
                      <div key={task.id || idx} className="p-3 border-b bg-green-100 last:border-none border-gray-300 flex flex-col gap-1">
                        <span className="text-gray-900">
                          {task.title || "Task"}
                        </span>
                        <span className="text-sm text-gray-700">
                          {task.site_name || task.description || "No description"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(task.due_date || task.created_at)}
                        </span>
                      </div>
                    ))
                  )
                ) : (
                  <div className="p-4 text-gray-500 text-sm text-center">No notifications available.</div>
                )
              )}
            </div>
            <div
              className="px-3 py-2 bg-blue-50 rounded-b-xl text-sm text-blue-700 text-center cursor-pointer hover:bg-blue-100 w-full"
              onClick={() => {
                setShowNotifCard(false);
                if (userRole === 'admin') {
                  navigate('/alerts');
                } else {
                  navigate('/tasks');
                }
              }}
              style={{ minWidth: '130px', width: '100%', zIndex: 60 }}
            >
              See all notifications
            </div>
          </div>
        )}

        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-full px-2 py-1.5 md:px-3"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
              {username.slice(0, 2).toUpperCase()}
            </div>
            <span className="font-medium hidden md:block">{username}</span>
            <i className={`fas fa-chevron-down text-xs text-gray-500 hidden md:block ${showDropdown ? 'rotate-180' : ''}`}></i>
          </button>
          {showDropdown && (
            <div className="
              absolute
              right-2 sm:right-0
              mt-2
              bg-white
              shadow-lg
              rounded-md
              py-1
              z-50
              border border-gray-100
              min-w-0 sm:min-w-[200px]
              px-1 sm:px-0
            ">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-800">{username}</p>
                <p className="text-xs text-gray-500 mt-1">{currentDateTime}</p>
              </div>
              <button
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-sm w-full"
                onClick={handleProfileClick}
                title="Click to view current user profile"
              >
                <i className="fas fa-user w-5 text-gray-500"></i>
                <span>View Profile</span>
              </button>
              <div className="border-t border-gray-100 my-1"></div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-sm text-red-600 w-full"
              >
                <i className="fas fa-sign-out-alt w-5"></i>
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Logout Success Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xs w-[90vw] flex flex-col items-center relative animate-popIn">
            <svg
              className="w-16 h-16 text-green-400 mb-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M9 12l2 2l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <h3 className="text-xl font-bold text-green-700 mb-2 text-center">Logout Successful!</h3>
            <p className="text-gray-600 text-center mb-1">
              You have been logged out.
            </p>
          </div>
          <style>{`
            .animate-popIn {
              animation: popIn 0.45s cubic-bezier(.22,1.25,.36,1) both;
            }
            @keyframes popIn {
              0% { opacity: 0; transform: scale(0.85) translateY(60px);}
              80% { opacity: 1; transform: scale(1.08) translateY(-8px);}
              100% { opacity: 1; transform: scale(1) translateY(0);}
            }
          `}</style>
        </div>
      )}

      {/* Profile Card - Animated, Responsive, User-Friendly with Real Data */}
      {showProfileCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 transition-all animate-fadeIn">
          <div className="relative w-full max-w-xl mx-auto px-2 py-4 sm:px-4">
            <div className="bg-white shadow-2xl rounded-3xl p-4 md:p-8 flex flex-col items-center animate-profilePop border border-blue-300 min-h-[260px] w-full">
              <button
                className="absolute top-2 right-3 text-gray-400 hover:text-gray-600 text-3xl"
                onClick={closeProfileCard}
                aria-label="Close Profile"
              >
                &times;
              </button>
              {profileLoading && (
                <div className="my-8 flex flex-col items-center">
                  <div className="loader mb-2" />
                  <span>Loading...</span>
                </div>
              )}
              {profileError && <div className="text-red-500 mb-2">{profileError}</div>}
              {userDetails && (
                <>
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-cyan-400 rounded-full flex items-center justify-center text-white text-4xl font-extrabold mb-2 shadow-lg select-none">
                    {(userDetails.full_name || userDetails.username || "U")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <h2 className="text-2xl font-bold mb-0.5 text-center capitalize">{userDetails.full_name || userDetails.username}</h2>
                  {userDetails.roles && userDetails.roles.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center mb-3 mt-1">
                      {userDetails.roles && userDetails.roles.length > 0 && (
                        <span className="role-badge">
                          {userDetails.roles[0]}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-2">
                    {userDetails.email && (
                      <div className="flex items-center gap-2">
                        <i className="fas fa-envelope text-gray-400"></i>
                        <span className="text-gray-800 text-sm">{userDetails.email}</span>
                      </div>
                    )}
                    {userDetails.user_id && (
                      <div className="flex items-center gap-2">
                        <i className="fas fa-id-badge text-gray-400"></i>
                        <span className="text-gray-800 text-sm">
                          User ID: <b className="break-all">{userDetails.user_id}</b>
                        </span>
                      </div>
                    )}
                    {userDetails.created_at && (
                      <div className="flex items-center gap-2">
                        <i className="fas fa-calendar-alt text-gray-400"></i>
                        <span className="text-gray-800 text-sm">
                          Joined: {userDetails.created_at.split("T")[0]}
                        </span>
                      </div>
                    )}
                    {userDetails.is_active !== undefined && (
                      <div className="flex items-center gap-2">
                        <i className={`fas fa-circle ${userDetails.is_active ? "text-green-500" : "text-red-500"}`}></i>
                        <span className={`text-sm font-semibold ${userDetails.is_active ? "text-green-700" : "text-red-700"}`}>
                          {userDetails.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="w-full flex justify-center mt-4">
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
                      onClick={() => { setShowProfileCard(false); setShowEditProfileModal(true); }}
                    >Edit Profile</button>
                  </div>
                </>
              )}
            </div>
          </div>
          <style>{`
            .animate-profilePop {
              animation: profilePop 0.6s cubic-bezier(.22,1.25,.36,1) both;
            }
            @keyframes profilePop {
              0% { opacity: 0; transform: scale(0.7) translateY(80px);}
              60% { opacity: 1; transform: scale(1.08) translateY(-8px);}
              100% { opacity: 1; transform: scale(1) translateY(0);}
            }
            .animate-fadeIn {
              animation: fadeIn 0.2s linear both;
            }
            @keyframes fadeIn {
              0% { opacity: 0; }
              100% { opacity: 1; }
            }
            .loader {
              border: 4px solid #f3f3f3;
              border-top: 4px solid #3498db;
              border-radius: 50%;
              width: 32px;
              height: 32px;
              animation: spin 1s linear infinite;
            }
            @keyframes spin {
              0% { transform: rotate(0deg);}
              100% { transform: rotate(360deg);}
            }
          `}</style>
        </div>
      )}

      {/* Edit Profile Modal - New Feature */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 transition-all animate-fadeIn">
          <div className="relative w-full max-w-lg mx-auto mt-8 px-2 py-4 sm:px-4">
            <div className="bg-white shadow-2xl rounded-3xl p-6 flex flex-col items-center border border-blue-300 w-full">
              <button
                className="absolute top-2 right-3 text-gray-400 hover:text-gray-600 text-3xl"
                onClick={() => setShowEditProfileModal(false)}
                aria-label="Close Edit Profile"
              >
                &times;
              </button>
              <h2 className="text-xl font-bold mb-4 text-center">Edit Profile</h2>
              {editProfileError && <div className="text-red-500 mb-2">{editProfileError}</div>}
              <form className="w-full flex flex-col gap-3" onSubmit={async (e) => {
                e.preventDefault();
                setEditProfileError('');
                if (editProfileData.new_password && editProfileData.new_password !== editProfileData.confirm_password) {
                  setEditProfileError('Passwords do not match');
                  return;
                }
                setEditProfileLoading(true);
                try {
                  const token = localStorage.getItem('access_token');
                  const res = await fetch('https://ratilalsons-backend-api.onrender.com/api/auth/update', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      full_name: editProfileData.full_name,
                      email: editProfileData.email,
                      password: editProfileData.new_password || undefined,
                    }),
                  });
                  if (!res.ok) {
                    throw new Error('Failed to update profile');
                  }
                  setShowEditProfileModal(false);
                  setShowProfileCard(false);
                  window.location.reload();
                } catch (err) {
                  setEditProfileError('Could not update profile.');
                } finally {
                  setEditProfileLoading(false);
                }
              }}>
                <label className="font-medium">Full Name
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2 mt-1"
                    value={editProfileData.full_name}
                    onChange={e => setEditProfileData({ ...editProfileData, full_name: e.target.value })}
                    required
                  />
                </label>
                <label className="font-medium">Email
                  <input
                    type="email"
                    className="w-full border rounded px-3 py-2 mt-1"
                    value={editProfileData.email}
                    onChange={e => setEditProfileData({ ...editProfileData, email: e.target.value })}
                    required
                  />
                </label>
                <label className="font-medium">New Password
                  <input
                    type="password"
                    className="w-full border rounded px-3 py-2 mt-1"
                    value={editProfileData.new_password}
                    onChange={e => setEditProfileData({ ...editProfileData, new_password: e.target.value })}
                  />
                </label>
                <label className="font-medium">Confirm Password
                  <input
                    type="password"
                    className="w-full border rounded px-3 py-2 mt-1"
                    value={editProfileData.confirm_password}
                    onChange={e => setEditProfileData({ ...editProfileData, confirm_password: e.target.value })}
                  />
                </label>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 mt-2"
                  disabled={editProfileLoading}
                >{editProfileLoading ? 'Updating...' : 'Update Profile'}</button>
              </form>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bell-jiggle {
          0%, 100% { transform: rotate(0deg);}
          15% { transform: rotate(-17deg);}
          35% { transform: rotate(15deg);}
          55% { transform: rotate(-12deg);}
          65% { transform: rotate(12deg);}
          75% { transform: rotate(-7deg);}
          85% { transform: rotate(7deg);}
          95% { transform: rotate(-2deg);}
        }
        .bell-animate {
          animation: bell-jiggle 1s cubic-bezier(.36,.07,.19,.97) both;
          transform-origin: 50% 0%;
        }
      `}</style>
    </header>
  );
};

export default TopHeader;
