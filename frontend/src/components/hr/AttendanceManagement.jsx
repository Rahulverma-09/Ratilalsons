import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faBuilding, faCalendarDay, faExclamationTriangle, faEdit, faTrash, faFileExport, faPlus, faEye, faCheck, faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';

import { API_URL } from '../../config';

const API_BASE_URL = API_URL;

// Custom Time Picker Component with AM/PM
const TimePickerCustom = ({ value, onChange, placeholder }) => {
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [ampm, setAmPm] = useState('AM');
  const [isOpen, setIsOpen] = useState(false);
  const [timePickerRef, setTimePickerRef] = useState(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (timePickerRef && !timePickerRef.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, timePickerRef]);

  // Convert 24-hour format to 12-hour format for display
  useEffect(() => {
    if (value && value !== '--:--') {
      try {
        let timeStr = value;
        
        // Handle different time formats
        if (value.includes('T')) {
          const date = new Date(value);
          timeStr = date.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          });
        }
        
        if (timeStr.includes(':')) {
          const [h, m] = timeStr.split(':');
          const hour24 = parseInt(h);
          const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
          const isPM = hour24 >= 12;
          
          setHour(hour12.toString().padStart(2, '0'));
          setMinute(m.padStart(2, '0'));
          setAmPm(isPM ? 'PM' : 'AM');
        }
      } catch (error) {
        console.error('Error parsing time:', error);
      }
    }
  }, [value]);

  // Convert 12-hour format to 24-hour format
  const convertTo24Hour = (h, m, period) => {
    let hour24 = parseInt(h);
    if (period === 'AM' && hour24 === 12) hour24 = 0;
    if (period === 'PM' && hour24 !== 12) hour24 += 12;
    return `${hour24.toString().padStart(2, '0')}:${m}`;
  };

  const handleTimeChange = (newHour, newMinute, newAmPm) => {
    const time24 = convertTo24Hour(newHour, newMinute, newAmPm);
    onChange(time24);
  };

  const formatDisplayTime = () => {
    if (!value || value === '--:--') return placeholder;
    return `${hour}:${minute} ${ampm}`;
  };

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  return (
    <div className="relative" ref={setTimePickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-left bg-white flex items-center justify-between"
      >
        <span className={!value || value === '--:--' ? 'text-gray-400' : 'text-gray-900'}>
          {formatDisplayTime()}
        </span>
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-50"
        >
          <div className="p-4">
            <div className="grid grid-cols-3 gap-4">
              {/* Hour Selector */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Hour</label>
                <select
                  value={hour}
                  onChange={(e) => {
                    const newHour = e.target.value;
                    setHour(newHour);
                    handleTimeChange(newHour, minute, ampm);
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {hours.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Minute Selector */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Min</label>
                <select
                  value={minute}
                  onChange={(e) => {
                    const newMinute = e.target.value;
                    setMinute(newMinute);
                    handleTimeChange(hour, newMinute, ampm);
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {minutes.filter((_, i) => i % 5 === 0).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* AM/PM Selector */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Period</label>
                <select
                  value={ampm}
                  onChange={(e) => {
                    const newAmPm = e.target.value;
                    setAmPm(newAmPm);
                    handleTimeChange(hour, minute, newAmPm);
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
              >
                Done
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

const HRAttendanceDashboard = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [allAttendance, setAllAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  
  // Filter states
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMarkAttendanceModal, setShowMarkAttendanceModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedEmployeeForProfile, setSelectedEmployeeForProfile] = useState(null);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [markAttendanceForm, setMarkAttendanceForm] = useState({
    user_id: '',
    date: new Date().toISOString().split('T')[0],
    check_in: '',
    check_out: '',
    status: 'present',
    notes: ''
  });
  const [viewType, setViewType] = useState('table'); // 'table' or 'analytics'
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState('daily'); // 'daily', 'weekly', 'monthly'
  
  // Stats
  const [stats, setStats] = useState({
    totalPresent: 0,
    totalAbsent: 0,
    lateEntries: 0,
    attendancePercentage: 0,
    onLeave: 0,
    halfDay: 0
  });
  // Server-provided attendance summary (from /api/hr/stats)
  const [attendanceSummaryServer, setAttendanceSummaryServer] = useState(null);

  // Working Hours Settings
  const [workingHours, setWorkingHours] = useState({
    dayShift: {
      startTime: '09:00',
      endTime: '18:00',
      lateThreshold: '09:00',
      halfDayThreshold: '13:00'
    },
    nightShift: {
      startTime: '21:00',
      endTime: '06:00',
      lateThreshold: '21:00',
      halfDayThreshold: '02:00'
    },
    currentShift: 'day' // 'day' or 'night'
  });

  // Helper functions for time parsing and validation
  const parseCheckIn = (checkInValue) => {
    if (!checkInValue) return null;
    
    try {
      let timeString = checkInValue.toString().trim();
      
      // Handle 12-hour format (e.g., "04:15 PM", "9:30 AM")
      if (timeString.includes('AM') || timeString.includes('PM')) {
        const isPM = timeString.includes('PM');
        const cleanTime = timeString.replace(/\s*(AM|PM)\s*/i, '');
        const [h, m] = cleanTime.split(':').map(Number);
        
        let hour24 = h;
        if (isPM && h !== 12) {
          hour24 = h + 12;
        } else if (!isPM && h === 12) {
          hour24 = 0;
        }
        
        return { h: hour24, m: m || 0 };
      }
      
      // If it's a full datetime string, extract just the time part
      if (timeString.includes('T') || timeString.includes(' ')) {
        const date = new Date(timeString);
        if (!isNaN(date.getTime())) {
          return { h: date.getHours(), m: date.getMinutes() };
        }
      }
      
      // Handle 24-hour format (e.g., "16:15", "09:30")
      const [h, m] = timeString.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        return { h, m: m || 0 };
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing check-in time:', checkInValue, error);
      return null;
    }
  };

  const isLateEntry = (checkInTime) => {
    if (!checkInTime) return false;
    
    const parsed = parseCheckIn(checkInTime);
    if (!parsed) return false;
    
    const { h, m } = parsed;
    const checkInMinutes = h * 60 + m;
    
    // Get current shift settings
    const currentShiftSettings = workingHours.currentShift === 'night' 
      ? workingHours.nightShift 
      : workingHours.dayShift;
    
    // Parse late threshold time
    const [lateH, lateM] = currentShiftSettings.lateThreshold.split(':').map(Number);
    const lateThresholdMinutes = lateH * 60 + lateM;
    
    // Handle night shift cross-midnight timing
    if (workingHours.currentShift === 'night') {
      // For night shift, if check-in is after midnight (0-6 hours), consider it as next day
      if (h >= 0 && h < 12) {
        const adjustedCheckInMinutes = checkInMinutes + (24 * 60);
        const adjustedThresholdMinutes = lateThresholdMinutes + (24 * 60);
        return adjustedCheckInMinutes > adjustedThresholdMinutes;
      }
    }
    
    return checkInMinutes > lateThresholdMinutes;
  };

  const shouldMarkHalfDay = (checkInTime) => {
    if (!checkInTime) return false;
    
    const parsed = parseCheckIn(checkInTime);
    if (!parsed) return false;
    
    const { h, m } = parsed;
    const checkInMinutes = h * 60 + m;
    
    // Get current shift settings
    const currentShiftSettings = workingHours.currentShift === 'night' 
      ? workingHours.nightShift 
      : workingHours.dayShift;
    
    // Parse half-day threshold time
    const [halfH, halfM] = currentShiftSettings.halfDayThreshold.split(':').map(Number);
    const halfDayThresholdMinutes = halfH * 60 + halfM;
    
    // Handle night shift cross-midnight timing
    if (workingHours.currentShift === 'night') {
      // For night shift, if check-in is after midnight (0-6 hours), consider it as next day
      if (h >= 0 && h < 12) {
        const adjustedCheckInMinutes = checkInMinutes + (24 * 60);
        const adjustedThresholdMinutes = halfDayThresholdMinutes + (24 * 60);
        return adjustedCheckInMinutes > adjustedThresholdMinutes;
      }
    }
    
    return checkInMinutes > halfDayThresholdMinutes;
  };

  // Function to automatically determine attendance status based on working hours configuration
  const determineAttendanceStatus = (checkInTime, checkOutTime = null, existingStatus = null) => {
    try {
      // If no check-in time, mark as absent
      if (!checkInTime) {
        return 'absent';
      }

      // If there's already a non-default status, respect it unless it's generic 'present'
      if (existingStatus && 
          existingStatus.toLowerCase() !== 'present' && 
          existingStatus !== 'Present' &&
          existingStatus.trim() !== '' &&
          !['leave', 'holiday'].includes(existingStatus.toLowerCase())) {
        return existingStatus;
      }

      // Parse check-in time to get hours and minutes
      const parseTime = (timeValue) => {
        if (!timeValue) return null;
        
        try {
          let timeString = timeValue;
          
          // Handle different time formats
          if (timeString.includes('T')) {
            // ISO datetime format
            const date = new Date(timeString);
            timeString = date.toTimeString().split(' ')[0]; // Gets HH:mm:ss
          } else if (timeString.includes(' ')) {
            // "YYYY-MM-DD HH:mm:ss" format
            timeString = timeString.split(' ')[1];
          }
          
          const [hours, minutes] = timeString.split(':').map(Number);
          return { hours, minutes, totalMinutes: hours * 60 + minutes };
        } catch (error) {
          console.error('[HR Dashboard] Error parsing time:', error, 'Input:', timeValue);
          return null;
        }
      };

      const checkInParsed = parseTime(checkInTime);
      if (!checkInParsed) {
        console.warn('[HR Dashboard] Could not parse check-in time:', checkInTime);
        return 'present'; // Default if parsing fails
      }

      // Get current working hours settings - same logic as MyAttendancePage
      const currentShiftSettings = workingHours.currentShift === 'night' 
        ? workingHours.nightShift 
        : workingHours.dayShift;

      // Parse threshold times
      const [lateHour, lateMin] = currentShiftSettings.lateThreshold.split(':').map(Number);
      const [halfDayHour, halfDayMin] = currentShiftSettings.halfDayThreshold.split(':').map(Number);
      
      const lateThresholdMinutes = lateHour * 60 + lateMin;
      const halfDayThresholdMinutes = halfDayHour * 60 + halfDayMin;
      
      const checkInMinutes = checkInParsed.totalMinutes;

      console.log(`[HR Dashboard] Status determination: CheckIn=${checkInTime} (${checkInMinutes}min), Late=${lateThresholdMinutes}min, HalfDay=${halfDayThresholdMinutes}min`);

      // Determine status based on thresholds - same logic as MyAttendancePage
      if (checkInMinutes > halfDayThresholdMinutes) {
        console.log('[HR Dashboard] Status: half_day (late after half-day threshold)');
        return 'half_day';
      } else if (checkInMinutes > lateThresholdMinutes) {
        console.log('[HR Dashboard] Status: late (late after threshold)');
        return 'late';
      } else {
        console.log('[HR Dashboard] Status: present (on time)');
        return 'present';
      }
    } catch (error) {
      console.error('[HR Dashboard] Error determining attendance status:', error);
      return existingStatus || 'present';
    }
  };

  // Function to sync working hours configuration across components
  const syncWorkingHoursConfig = () => {
    try {
      const savedConfig = localStorage.getItem('workingHoursConfig');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        setWorkingHours(prev => ({ ...prev, ...config }));
        console.log('[DEBUG] Synced working hours config from localStorage:', config);
      }
    } catch (error) {
      console.error('[DEBUG] Error syncing working hours config:', error);
    }
  };

  useEffect(() => {
    console.log('[DEBUG] AttendanceManagement component mounted');
    const fetchCurrentUser = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          console.log('[DEBUG] No token found, redirecting to login');
          toast.error("No access token found. Please login.");
          window.location.href = '/login';
          return;
        }

        console.log('[DEBUG] Fetching current user...');
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const userData = await response.json();
          console.log('[DEBUG] User data:', userData);
          setCurrentUser(userData);
          
          // Check if user is HR/Admin - more comprehensive role checking
          const userRoles = [];
          
          if (Array.isArray(userData.roles)) {
            userData.roles.forEach(role => {
              if (typeof role === 'string') {
                userRoles.push(role.toLowerCase());
              } else if (role && role.name) {
                userRoles.push(role.name.toLowerCase());
              }
            });
          } else if (typeof userData.roles === 'string') {
            userRoles.push(userData.roles.toLowerCase());
          }
          
          if (userData.role && typeof userData.role === 'string') {
            userRoles.push(userData.role.toLowerCase());
          }
          
          if (userData.role_names && Array.isArray(userData.role_names)) {
            userData.role_names.forEach(role => {
              if (typeof role === 'string') {
                userRoles.push(role.toLowerCase());
              }
            });
          }
          
          console.log('[DEBUG] User roles:', userRoles);
          
          // Check for HR or Admin roles with more flexible matching
          const isHR = userRoles.some(role => 
            role === 'hr' ||
            role === 'human resources' ||
            role === 'human_resources' ||
            role === 'hr_admin' ||
            role === 'hrstaff' ||
            role === 'hr_staff' ||
            role.includes('hr') || 
            role.includes('human')
          );
          const isAdmin = userRoles.some(role => 
            role === 'admin' ||
            role === 'administrator' ||
            role === 'superuser' ||
            role === 'super_admin' ||
            role.includes('admin')
          );
          
          // Also check if user has manager or senior roles (temporary workaround)
          const isManager = userRoles.some(role =>
            role === 'manager' ||
            role === 'team_lead' ||
            role === 'team_leader' ||
            role === 'supervisor' ||
            role.includes('manage') ||
            role.includes('lead')
          );
          
          console.log('[DEBUG] Access check - Is HR:', isHR, 'Is Admin:', isAdmin, 'Is Manager:', isManager);
          
          // For development/testing - allow access for any authenticated user temporarily
          // Remove this in production
          const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          
          if (!isHR && !isAdmin && !isManager && !isDevelopment) {
            console.log('[DEBUG] Access denied, user does not have HR/Admin/Manager role');
            console.log('[DEBUG] Available roles:', userRoles);
            toast.error("Access denied. HR, Admin, or Manager privileges required.");
            // Don't redirect, just show error and stop loading
            setHasAccess(false);
            setIsLoading(false);
            return;
          }
          
          if (isDevelopment && !isHR && !isAdmin && !isManager) {
            console.log('[DEBUG] Development mode - allowing access for testing');
            toast.info("Development mode: Access granted for testing");
          }
          
          // User has proper access
          setHasAccess(true);
          console.log('[DEBUG] User has proper access, fetching data...');
          await fetchAllData();
        } else {
          const errorData = await response.json();
          console.error('[DEBUG] Auth error:', errorData);
          toast.error("Authentication failed. Please login again.");
          localStorage.removeItem('access_token');
          window.location.href = '/login';
        }
      } catch (error) {
        console.error("[DEBUG] Error fetching current user:", error);
        toast.error("Network error. Please check your connection.");
      } finally {
        console.log('[DEBUG] Setting loading to false');
        setIsLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  // Load working hours from localStorage on component mount and listen for updates
  useEffect(() => {
    syncWorkingHoursConfig();
    
    // Listen for working hours configuration updates
    const handleConfigUpdate = (event) => {
      if (event.detail) {
        setWorkingHours(prev => ({ ...prev, ...event.detail }));
        console.log('[DEBUG] Received working hours config update:', event.detail);
        // Reprocess attendance data with new configuration
        if (allAttendance.length > 0) {
          const reprocessedData = processAllAttendance(allAttendance);
          setAllAttendance(reprocessedData);
          calculateStats(reprocessedData);
        }
      }
    };
    
    window.addEventListener('workingHoursConfigUpdated', handleConfigUpdate);
    
    return () => {
      window.removeEventListener('workingHoursConfigUpdated', handleConfigUpdate);
    };
  }, []);

  const fetchAllData = async () => {
    try {
      console.log('[DEBUG] Starting to fetch all data...');
      await Promise.all([
        fetchDepartments(),
        fetchAllAttendance(),
        fetchEmployees()
      ]);
    } catch (error) {
      // Don't throw error to prevent component from breaking
      console.error('[DEBUG] Error in fetchAllData:', error);
    }
  };

  // Re-fetch server stats when filters or time range change so cards stay in sync
  useEffect(() => {
    // Only fetch if user is loaded (to ensure token exists)
    if (currentUser) {
      fetchAttendanceStats();
    }
  }, [selectedDepartment, selectedEmployee, startDate, endDate, statusFilter, analyticsTimeRange, currentUser]);

  // Fetch the simple attendance stats endpoint from HR dashboard
  const fetchAttendanceStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      
      const res = await fetch(`${API_BASE_URL}/api/hr/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        console.error('Failed to fetch stats:', res.status, res.statusText);
        return;
      }

      const data = await res.json();
      console.log('Dashboard stats received:', data);

      // Map backend fields to the shape used by the attendance summary cards
      const mapped = {
        present: data.presentToday ?? data.present_today ?? 0,
        absent: data.absentToday ?? data.absent_today ?? 0,
        leave: data.onLeaveToday ?? data.on_leave_today ?? 0,
        halfDay: data.halfDay ?? data.half_day ?? 0,
        total: data.totalEmployees ?? data.total_employees ?? 0,
        lateEntries: data.lateEntries ?? data.late_entries ?? 0,
        attendancePercentage: data.attendancePercentage ?? data.attendance_percentage ?? 0
      };

      console.log('Mapped stats:', mapped);
      setAttendanceSummaryServer(mapped);
    } catch (err) {
      console.error('Failed to fetch attendance stats:', err);
      toast.error('Failed to load attendance statistics');
    }
  };

  // Fetch pre-aggregated dashboard stats from backend
  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) return;
      
      const res = await fetch(`${API_BASE_URL}/api/hr/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const result = await res.json();
        console.log('Dashboard stats result:', result);
        
        // Map them into the local stats shape used by UI
        const mapped = {
          totalPresent: result.presentToday ?? result.present_today ?? 0,
          totalAbsent: result.absentToday ?? result.absent_today ?? 0,
          lateEntries: result.lateEntries ?? result.totalLate ?? 0,
          attendancePercentage: result.attendancePercentage ?? result.attendance_rate ?? 0,
          onLeave: result.onLeaveToday ?? result.on_leave_today ?? 0,
          halfDay: result.halfDay ?? 0
        };

        setStats(mapped);
      } else {
        console.error('Failed to fetch dashboard stats:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    }
  };

  // Helper function to parse time and convert to minutes
  const parseTimeToMinutes = (timeValue) => {
    if (!timeValue) return null;
    try {
      if (typeof timeValue === 'string') {
        // Handle formats like "HH:MM" or "HH:MM:SS"
        const timeMatch = timeValue.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          return hours * 60 + minutes;
        }
        // Handle full datetime string
        const date = new Date(timeValue);
        if (!isNaN(date.getTime())) {
          return date.getHours() * 60 + date.getMinutes();
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  // Helper function to calculate working hours between check-in and check-out
  const calculateWorkingHours = (checkInTime, checkOutTime) => {
    if (!checkInTime || !checkOutTime) return null;
    
    const checkInMinutes = parseTimeToMinutes(checkInTime);
    const checkOutMinutes = parseTimeToMinutes(checkOutTime);
    
    if (checkInMinutes === null || checkOutMinutes === null) return null;
    
    let diffMinutes;
    
    // Handle overnight shifts (when check-out is next day)
    if (checkOutMinutes < checkInMinutes) {
      // Check-out is next day (overnight shift)
      diffMinutes = (24 * 60) - checkInMinutes + checkOutMinutes;
    } else {
      // Normal same-day shift
      diffMinutes = checkOutMinutes - checkInMinutes;
    }
    
    // Convert minutes to hours (with decimal)
    const hours = diffMinutes / 60;
    
    // Return formatted hours (e.g., 8.5 for 8 hours 30 minutes)
    return Math.round(hours * 100) / 100; // Round to 2 decimal places
  };

  // Helper function to format working hours for display
  const formatWorkingHours = (hours) => {
    if (!hours && hours !== 0) return 'N/A';
    
    const totalMinutes = Math.round(hours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    if (mins === 0) {
      return `${hrs} hrs`;
    } else {
      return `${hrs}h ${mins}m`;
    }
  };

  // Process attendance data to normalize field names
  const processAllAttendance = (attendanceData) => {
    console.log('Raw attendance data:', attendanceData);
    
    return attendanceData.map(record => {
      console.log('Processing record:', record);
      
      // Normalize field names for consistent handling - match database structure
      const checkInTime = record.check_in_time || // Database field
                         record.checkin_time || // Backend API field
                         record.check_in || 
                         record.checkin || 
                         record.checkin_display ||
                         record['check-in'];
                         
      const checkOutTime = record.check_out || // Database field
                          record.checkout_time || // Backend API field
                          record.check_out_time ||
                          record.checkout || 
                          record.checkout_display ||
                          record['check-out'] ||
                          record.checkOutTime ||
                          null;
      
      // Normalize date field
      const dateField = record.date || 
                        record.attendance_date || 
                        record.created_at ||
                        record.checkin_date ||
                        new Date().toISOString().split('T')[0]; // fallback to today
      
      const processedRecord = {
        ...record,
        // Ensure date is properly set
        date: dateField,
        // Normalize check-in time field
        check_in: checkInTime,
        // Normalize check-out time field  
        check_out: checkOutTime,
        // Normalize other fields
        employee_id: record.employee_id || record.user_id,
        employee_name: record.employee_name || record.user_name || record.full_name,
        location: record.location || record.location_name,
        // Normalize department field from various possible sources
        department: record.department || record.dept || record.employee_department
      };
      
      console.log('Date field after processing:', processedRecord.date);
      
      console.log('Processed record with check_in:', processedRecord.check_in, 'type:', typeof processedRecord.check_in);
      
      // Store original time values for proper formatting
      if (processedRecord.check_in) {
        console.log('Processing check_in time:', processedRecord.check_in, 'type:', typeof processedRecord.check_in);
        // Keep the original time value for formatTime function to handle properly
        // Don't pre-format here, let formatTime handle it in the display
      }
      
      if (processedRecord.check_out) {
        console.log('Processing check_out time:', processedRecord.check_out, 'type:', typeof processedRecord.check_out);
        console.log('Raw checkout data from record:', {
          check_out: record.check_out,
          checkout: record.checkout,
          checkout_time: record.checkout_time,
          check_out_time: record.check_out_time
        });
        // Keep the original time value for formatTime function to handle properly
        // Don't pre-format here, let formatTime handle it in the display
      } else {
        console.log('No checkout time found for record:', record._id || record.id);
      }
      
      // Only auto-determine status if no status is set or if it's a default value
      // Respect manually updated statuses from the database
      const originalStatus = processedRecord.status;
      let finalStatus = originalStatus;
      
      // Check if this record was recently updated (within last 5 minutes)
      const lastModified = record.last_modified || record.updated_at;
      const recentlyUpdated = lastModified && 
        (new Date().getTime() - new Date(lastModified).getTime()) < 5 * 60 * 1000;
      
      // Only auto-determine if status is missing, null, or default values AND not recently updated
      if (!recentlyUpdated && (!originalStatus || originalStatus === 'pending' || originalStatus === 'unknown')) {
        const determinedStatus = determineAttendanceStatus(
          processedRecord.check_in, 
          processedRecord.check_out, 
          originalStatus
        );
        finalStatus = determinedStatus;
        console.log(`[HR Dashboard] Auto-determining status for record without valid status: Date=${processedRecord.date}, DeterminedStatus=${finalStatus}, CheckIn=${processedRecord.check_in}`);
      } else {
        if (recentlyUpdated) {
          console.log(`[HR Dashboard] Keeping status for recently updated record: Date=${processedRecord.date}, Status=${originalStatus}, LastModified=${lastModified}`);
        } else {
          console.log(`[HR Dashboard] Keeping manual status: Date=${processedRecord.date}, Status=${originalStatus}, CheckIn=${processedRecord.check_in}`);
        }
      }
      
      // Update status
      processedRecord.status = finalStatus;
      processedRecord.original_status = originalStatus; // Keep original for reference
      
      console.log('[DEBUG] Status processing:', {
        original: originalStatus,
        final: finalStatus,
        checkIn: processedRecord.check_in,
        recordId: record._id || record.id,
        recentlyUpdated: recentlyUpdated,
        lastModified: lastModified
      });
      
      // Calculate working hours if both check-in and check-out are available
      if (processedRecord.check_in && processedRecord.check_out) {
        const calculatedHours = calculateWorkingHours(processedRecord.check_in, processedRecord.check_out);
        if (calculatedHours !== null) {
          processedRecord.calculated_working_hours = calculatedHours;
          // Use calculated hours if working_hours field is empty or invalid
          if (!processedRecord.working_hours || isNaN(parseFloat(processedRecord.working_hours))) {
            processedRecord.working_hours = calculatedHours;
          }
        }
      }
      
      return processedRecord;
    });
  };

  const fetchAllAttendance = async () => {
    try {
      console.log('[DEBUG] Fetching attendance data...');
      const token = localStorage.getItem("access_token");
      
      // Add cache-busting parameter to ensure fresh data
      const timestamp = Date.now();
      const response = await fetch(`${API_BASE_URL}/api/attendance/admin/all?_t=${timestamp}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        },
      });

      console.log('[DEBUG] Attendance API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[DEBUG] Attendance data received:', data);
        
        if (data.success && data.data) {
          console.log('[DEBUG] Raw attendance data from API:', data.data.slice(0, 3)); // Log first 3 records for debugging
          
          // Process the attendance data to normalize field names
          const processedData = processAllAttendance(data.data);
          console.log('[DEBUG] Processed attendance data:', processedData.slice(0, 3)); // Log first 3 processed records
          
          // Log status information for debugging
          const statusSummary = processedData.reduce((acc, record) => {
            acc[record.status] = (acc[record.status] || 0) + 1;
            return acc;
          }, {});
          console.log('[DEBUG] Status summary after processing:', statusSummary);
          
          // Update state with new data
          setAllAttendance(processedData);
          calculateStats(processedData);
          
          console.log('[DEBUG] Attendance state updated with', processedData.length, 'records');
        } else {
          console.log('[DEBUG] No attendance data found in response');
          setAllAttendance([]);
        }
      } else {
        const errorData = await response.text();
        console.error('[DEBUG] Attendance API error:', response.status, errorData);
        toast.error(`Failed to load attendance data: ${response.status}`);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      toast.error("Failed to load attendance data");
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem("access_token");
      // Use attendance filter endpoint which is designed for this purpose
      const response = await fetch(`${API_BASE_URL}/api/attendance/admin/filters/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[DEBUG] Employees data received:', data);
        
        // The attendance filter endpoint returns { success: true, data: [...] }
        let employeesList = data.data || [];
        if (!Array.isArray(employeesList)) {
          employeesList = [employeesList];
        }
        
        console.log('[DEBUG] Processed employees from backend:', employeesList.length, 'employees');
        console.log('[DEBUG] First employee structure:', employeesList[0]);
        setEmployees(employeesList);
        
      } else {
        console.error('[DEBUG] Failed to fetch employees:', response.status, response.statusText);
        // Fallback to staff endpoint if attendance endpoint fails
        const fallbackResponse = await fetch(`${API_BASE_URL}/api/staff/employees?active_only=true&limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          console.log('[DEBUG] Fallback employees data received:', fallbackData);
          
          let employeesList = fallbackData.data || fallbackData.employees || fallbackData;
          if (!Array.isArray(employeesList)) {
            employeesList = [employeesList];
          }
          
          // Transform staff endpoint response to match expected structure
          const transformedEmployees = employeesList.map(emp => ({
            employee_id: emp.user_id || emp.employee_id || emp._id,
            name: emp.name || emp.full_name || emp.username || 'Unknown',
            email: emp.email,
            department: emp.department
          }));
          
          console.log('[DEBUG] Transformed employees:', transformedEmployees.length, 'employees');
          setEmployees(transformedEmployees);
        } else {
          toast.error("Failed to load employees data");
        }
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast.error("Failed to load employees data");
    }
  };

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`${API_BASE_URL}/api/hr/departments`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[DEBUG] Departments data received:', data);
        
        if (data.success && data.departments) {
          console.log('[DEBUG] Setting departments:', data.departments);
          setDepartments(data.departments);
        } else {
          console.log('[DEBUG] No departments found, using default');
          setDepartments(['General']);
        }
      } else {
        console.error('[DEBUG] Failed to fetch departments:', response.status, response.statusText);
        // Fallback to extracting from employees if available
        console.log('[DEBUG] Using fallback department extraction');
        setDepartments(['General']);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
      setDepartments(['General']); // Fallback
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`${API_BASE_URL}/api/attendance/leave/admin/all?page=1&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setLeaveRequests(data.leave_requests || data);
      }
    } catch (error) {
      console.error("Error fetching leave requests:", error);
    }
  };

  const calculateStats = (attendanceData) => {
    const today = new Date().toISOString().split('T')[0];
    const rows = Array.isArray(attendanceData) ? attendanceData : [];

    // Normalize and pick records whose date is today (robust to iso/timestamp formats)
    const todayRecords = rows.filter((record) => {
      if (!record) return false;
      const recDateRaw = record.date || record.recorded_at || '';
      let recDate = '';
      try {
        if (typeof recDateRaw === 'string' && recDateRaw.includes('T')) {
          recDate = new Date(recDateRaw).toISOString().split('T')[0];
        } else if (typeof recDateRaw === 'string' && recDateRaw.length >= 10) {
          recDate = recDateRaw.slice(0, 10);
        } else if (recDateRaw instanceof Date) {
          recDate = recDateRaw.toISOString().split('T')[0];
        } else {
          recDate = String(recDateRaw);
        }
      } catch (e) {
        recDate = String(recDateRaw);
      }

      return recDate === today;
    });

    // Helpers to normalize status and check-in time
    const normalizeStatus = (s) => (s || '').toString().toLowerCase();

    const parseCheckIn = (checkIn) => {
      if (!checkIn) return null;
      // If it's an ISO string
      if (typeof checkIn === 'string' && checkIn.includes('T')) {
        try {
          const d = new Date(checkIn);
          return { h: d.getHours(), m: d.getMinutes() };
        } catch (e) {
          // fallthrough
        }
      }

      if (typeof checkIn === 'string' && checkIn.split(':').length >= 2) {
        const parts = checkIn.split(':').map(Number);
        return { h: parts[0], m: parts[1] };
      }

      // Not parseable
      return null;
    };

    const present = todayRecords.filter(r => {
      const st = normalizeStatus(r.status);
      return st === 'present' || st === 'p' || st === 'on_duty' || st === 'checked_in' || st === 'late' || st === 'half_day' || st === 'halfday' || st === 'half-day';
    }).length;

    const absent = todayRecords.filter(r => {
      const st = normalizeStatus(r.status);
      return st === 'absent' || st === 'a';
    }).length;

    const onLeave = todayRecords.filter(r => normalizeStatus(r.status) === 'leave' || normalizeStatus(r.status) === 'on_leave').length;

    const halfDay = todayRecords.filter(r => normalizeStatus(r.status) === 'half_day' || normalizeStatus(r.status) === 'halfday' || normalizeStatus(r.status) === 'half-day').length;

    // Late entries - count records with status 'late' OR records that arrived late (including half day)
    const late = todayRecords.filter(record => {
      const st = normalizeStatus(record.status);
      
      // If status is explicitly 'late', count it
      if (st === 'late') {
        return true;
      }
      
      // For present, half_day, or other attendance records, check if they arrived late based on check-in time
      if (st === 'present' || st === 'p' || st === 'on_duty' || st === 'checked_in' || st === 'half_day' || st === 'halfday' || st === 'half-day') {
        const ci = record.check_in || 
                  record.checkin || 
                  record.checkin_display || 
                  record.check_in_time || 
                  record.checkin_time ||
                  record['check-in'];
        const parsed = parseCheckIn(ci);
        if (!parsed) return false;
        
        const { h, m } = parsed;
        const checkInMinutes = h * 60 + m;
        
        // Get current shift settings
        const currentShiftSettings = workingHours.currentShift === 'night' 
          ? workingHours.nightShift 
          : workingHours.dayShift;
        
        // Parse late threshold time
        const [lateH, lateM] = currentShiftSettings.lateThreshold.split(':').map(Number);
        const lateThresholdMinutes = lateH * 60 + lateM;
        
        // Handle night shift cross-midnight timing
        if (workingHours.currentShift === 'night') {
          // For night shift, if check-in is after midnight (0-6 hours), consider it as next day
          if (h >= 0 && h < 12) {
            const adjustedCheckInMinutes = checkInMinutes + (24 * 60); // Add 24 hours
            const adjustedThresholdMinutes = lateThresholdMinutes + (24 * 60);
            return adjustedCheckInMinutes > adjustedThresholdMinutes;
          }
        }
        
        return checkInMinutes > lateThresholdMinutes;
      }
      
      return false;
    }).length;

    const total = todayRecords.length;
    const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : 0;

    // Debug logging for late entries
    console.log('[DEBUG] calculateStats - Late entries calculation:', {
      totalRecords: total,
      lateCount: late,
      sampleRecords: todayRecords.slice(0, 3).map(r => ({
        status: r.status,
        check_in: r.check_in,
        user_id: r.user_id,
        employee_name: r.employee_name,
        parsed_time: parseCheckIn(r.check_in || r.checkin || r.checkin_display || r.check_in_time || r.checkin_time || r['check-in'])
      })),
      workingHours: workingHours,
      lateThreshold: workingHours.dayShift.lateThreshold,
      currentShift: workingHours.currentShift
    });

    // Additional debugging for late entry detection
    if (todayRecords.length > 0 && late === 0) {
      console.log('[DEBUG] No late entries found, checking first record:', {
        firstRecord: todayRecords[0],
        checkInRaw: todayRecords[0].check_in,
        parsedTime: parseCheckIn(todayRecords[0].check_in),
        status: todayRecords[0].status
      });
    }

    // Debugging: if counts zero but there are rows, log a sample to help diagnose format issues
    if (total > 0 && present === 0) {
      // console.debug('calculateStats sample todayRecords[0]:', todayRecords[0]);
    }

    setStats({
      totalPresent: present,
      totalAbsent: absent,
      lateEntries: late,
      attendancePercentage: percentage,
      onLeave: onLeave,
      halfDay: halfDay
    });
  };

  // Recalculate stats whenever attendance data or filters change
  useEffect(() => {
    try {
      const filtered = getFilteredAttendance();
      // If there are no filtered records but allAttendance has data, still run calculateStats on filtered to show zeros
      calculateStats(filtered);
    } catch (err) {
      console.error('Error calculating filtered stats:', err);
    }
  }, [allAttendance, selectedDepartment, selectedEmployee, startDate, endDate, statusFilter]);

  const getFilteredAttendance = () => {
    console.log('[DEBUG] Filtering attendance data...');
    console.log('[DEBUG] All attendance records:', allAttendance.length);
    console.log('[DEBUG] Selected department:', selectedDepartment);
    console.log('[DEBUG] Selected employee:', selectedEmployee);
    console.log('[DEBUG] Status filter:', statusFilter);
    
    let filtered = [...allAttendance];
    
    if (selectedDepartment !== 'all') {
      const deptEmployees = employees.filter(emp => 
        emp.department && emp.department.toLowerCase() === selectedDepartment.toLowerCase()
      );
      const deptEmployeeIds = deptEmployees.map(emp => emp.user_id || emp.id || emp._id);
      console.log('[DEBUG] Filtering by department:', selectedDepartment, 'Employee IDs:', deptEmployeeIds);
      filtered = filtered.filter(record => deptEmployeeIds.includes(record.user_id));
    }
    
    if (selectedEmployee !== 'all') {
      filtered = filtered.filter(record => record.user_id === selectedEmployee);
    }
    
    if (startDate) {
      filtered = filtered.filter(record => record.date >= startDate);
    }
    
    if (endDate) {
      filtered = filtered.filter(record => record.date <= endDate);
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(record => record.status === statusFilter);
    }

    console.log('[DEBUG] Filtered attendance records:', filtered.length);
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const handleEditAttendance = (record) => {
    setSelectedRecord(record);
    
    // Helper function to convert backend time format to 24-hour format for input
    const convertToTimeInput = (timeStr) => {
      if (!timeStr || timeStr === 'N/A') return '';
      
      try {
        // Handle ISO datetime format
        if (timeStr.includes('T') || timeStr.includes('Z')) {
          const date = new Date(timeStr);
          return date.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
          });
        }
        
        // Handle backend AM/PM format (e.g., "09:00 AM")
        if (timeStr.includes('AM') || timeStr.includes('PM')) {
          const [time, period] = timeStr.split(' ');
          const [hours, minutes] = time.split(':');
          let hour24 = parseInt(hours);
          
          if (period === 'PM' && hour24 !== 12) {
            hour24 += 12;
          } else if (period === 'AM' && hour24 === 12) {
            hour24 = 0;
          }
          
          return `${hour24.toString().padStart(2, '0')}:${minutes}`;
        }
        
        // Handle 24-hour format
        if (timeStr.includes(':')) {
          const timeParts = timeStr.split(':');
          if (timeParts.length >= 2) {
            return `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
          }
        }
        
        return '';
      } catch (error) {
        console.error('Error converting time for input:', error, timeStr);
        return '';
      }
    };
    
    // Get times from backend field names
    const checkinTime = record.checkin_time || record.check_in_time || record.check_in || '';
    const checkoutTime = record.checkout_time || record.check_out_time || record.check_out || '';
    
    console.log('Original times from record:', { checkinTime, checkoutTime });
    
    const formattedCheckin = convertToTimeInput(checkinTime);
    const formattedCheckout = convertToTimeInput(checkoutTime);
    
    console.log('Formatted times for form:', { formattedCheckin, formattedCheckout });
    
    setEditForm({
      date: record.attendance_date || record.date,
      check_in: formattedCheckin,
      check_out: formattedCheckout,
      status: record.status,
      working_hours: record.working_hours || '',
      notes: record.notes || ''
    });
    setShowEditModal(true);
  };

  const submitEditAttendance = async () => {
    try {
      if (!editForm.date || !editForm.status) {
        toast.error('Please fill in all required fields');
        return;
      }
      
      const token = localStorage.getItem("access_token");
      
      // Helper function to convert 24-hour time to 12-hour format with AM/PM
      const convertTo12HourFormat = (timeStr) => {
        if (!timeStr || timeStr === '--:--') return null;
        
        try {
          const [hours, minutes] = timeStr.split(':');
          if (!hours || !minutes) return null;
          
          let hour = parseInt(hours);
          const period = hour >= 12 ? 'PM' : 'AM';
          
          if (hour === 0) {
            hour = 12;
          } else if (hour > 12) {
            hour = hour - 12;
          }
          
          return `${hour.toString().padStart(2, '0')}:${minutes} ${period}`;
        } catch (error) {
          console.error('Error converting time to 12-hour format:', error, timeStr);
          return null;
        }
      };
      
      // Convert times to 12-hour format as expected by backend
      const checkin12Hour = convertTo12HourFormat(editForm.check_in);
      const checkout12Hour = convertTo12HourFormat(editForm.check_out);
      
      console.log('Time conversion:', {
        original_checkin: editForm.check_in,
        converted_checkin: checkin12Hour,
        original_checkout: editForm.check_out,
        converted_checkout: checkout12Hour
      });
      
      // Prepare the update payload matching backend expectations
      const updatePayload = {
        status: editForm.status,
        checkin_time: checkin12Hour,
        checkout_time: checkout12Hour,
        notes: editForm.notes || ''
      };
      
      console.log('Updating attendance with payload:', updatePayload);
      
      const response = await fetch(`${API_BASE_URL}/api/attendance/admin/update/${selectedRecord._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Update response:', result);
        console.log('Updated record data:', result.data);
        
        // Log the specific changes made
        console.log('Status update verification:', {
          sentStatus: updatePayload.status,
          returnedData: result.data,
          recordId: selectedRecord._id
        });
        
        toast.success("Attendance updated successfully");
        setShowEditModal(false);
        setSelectedRecord(null);
        setEditForm({});
        
        // Force refresh of all data to ensure UI is updated
        console.log('Refreshing data after successful update...');
        
        // Clear current data first to force re-render
        setAllAttendance([]);
        
        await Promise.all([
          fetchAllAttendance(),
          fetchAttendanceStats(),
          fetchDashboardStats()
        ]);
        
        // Additional refresh after a short delay to ensure DB consistency
        setTimeout(async () => {
          console.log('Additional delayed refresh...');
          await fetchAllAttendance();
        }, 1500);
        
      } else {
        const errorData = await response.json();
        console.error('Update failed:', errorData);
        toast.error(errorData.detail || "Failed to update attendance");
      }
    } catch (error) {
      console.error("Error updating attendance:", error);
      toast.error("Network error. Please try again.");
    }
  };

  const handleLeaveAction = async (leaveId, action) => {
    try {
      const token = localStorage.getItem("access_token");
      
      const response = await fetch(`${API_BASE_URL}/api/attendance/leave/admin/action/${leaveId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: action,
          reviewed_by: currentUser?.full_name || currentUser?.username || 'HR',
          remarks: `${action}d by HR`
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Leave request ${action}d successfully`);
        await fetchLeaveRequests();
        await fetchAllAttendance();
        await fetchAttendanceStats();
      } else {
        const errorData = await response.json();
        toast.error(errorData.detail || `Failed to ${action} leave request`);
      }
    } catch (error) {
      console.error(`Error ${action}ing leave:`, error);
      toast.error(`Network error. Please try again.`);
    }
  };

  const exportToCSV = () => {
    try {
      const filtered = getFilteredAttendance();
      if (filtered.length === 0) {
        toast.warning("No data to export");
        return;
      }
      
      const headers = ['Date', 'Employee Name', 'Employee ID', 'Department', 'Check In', 'Check Out', 'Working Hours', 'Status', 'Location'];
      const csvData = filtered.map(record => {
        const employee = employees.find(emp => 
          (emp.id === record.user_id) || 
          (emp._id === record.user_id) || 
          (emp.user_id === record.user_id)
        );
        
        return [
          record.date || '',
          record.employee_name || record.user_name || employee?.full_name || employee?.name || 'Unknown',
          record.user_id || '',
          employee?.department || 'Not Assigned',
          record.check_in || '',
          record.check_out || '',
          record.working_hours || '',
          record.status || '',
          record.location || record.location_name || ''
        ];
      });
      
      // Escape commas and quotes in CSV data
      const escapeCsvField = (field) => {
        if (typeof field !== 'string') return field;
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      };
      
      const csvContent = [headers, ...csvData]
        .map(row => row.map(escapeCsvField).join(','))
        .join('\n');
        
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Report exported successfully (${filtered.length} records)`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  };

  const handleViewProfile = async (userId) => {
    try {
      console.log('[DEBUG] Viewing attendance for userId:', userId);
      console.log('[DEBUG] Type of userId:', typeof userId);
      
      if (!userId || userId === 'undefined' || userId === undefined) {
        toast.error("Employee ID not found");
        return;
      }

      const token = localStorage.getItem("access_token");
      
      if (!token) {
        toast.error("Authentication required. Please login again.");
        return;
      }

      // Find employee details from existing data
      const existingEmployee = employees.find(emp => {
        const empId = emp.id || emp._id || emp.user_id || emp.employee_id;
        const empUserId = emp.user_id || emp.id || emp._id || emp.employee_id;
        console.log('[DEBUG] Checking employee:', {empId, empUserId, targetUserId: userId});
        return empId === userId || empUserId === userId || emp.employee_id === userId;
      });

      console.log('[DEBUG] Found employee:', existingEmployee);
      console.log('[DEBUG] Using employee ID for API call:', userId);

      // Use the correct API endpoint for getting specific employee's attendance records
      const apiUrl = `${API_BASE_URL}/api/attendance/admin/employee/${userId}/records?page=1&limit=31`;
      console.log('[DEBUG] API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      console.log('[DEBUG] Attendance API response status:', response.status);

      if (response.ok) {
        const attendanceData = await response.json();
        console.log('[DEBUG] Attendance data received:', attendanceData);

        if (attendanceData.success && attendanceData.data) {
          // Handle the API response structure - data.records contains the attendance array
          let attendanceRecords = [];
          
          if (attendanceData.data.records && Array.isArray(attendanceData.data.records)) {
            attendanceRecords = attendanceData.data.records;
          } else if (Array.isArray(attendanceData.data)) {
            attendanceRecords = attendanceData.data;
          }
          
          console.log('[DEBUG] Parsed attendance records:', attendanceRecords.length);
          console.log('[DEBUG] Sample record:', attendanceRecords[0]);

          if (attendanceRecords.length === 0) {
            toast.error("No attendance records found for this employee");
            return;
          }

          // Sort records by date (newest first)
          const sortedRecords = attendanceRecords.sort((a, b) => {
            const dateA = new Date(a.attendance_date || a.date || a.check_in_time);
            const dateB = new Date(b.attendance_date || b.date || b.check_in_time);
            return dateB - dateA;
          });

          // Calculate employee stats
          const presentDays = sortedRecords.filter(r => r.status === 'present').length;
          const absentDays = sortedRecords.filter(r => r.status === 'absent').length;
          const halfDays = sortedRecords.filter(r => r.status === 'half_day').length;
          const leaveDays = sortedRecords.filter(r => r.status === 'leave').length;

          // Calculate late arrivals
          const lateDays = sortedRecords.filter(r => {
            const checkinTime = r.checkin_time || r.check_in_time || r.check_in;
            if (checkinTime) {
              return isLateEntry(checkinTime);
            }
            return false;
          }).length;

          // Calculate total working hours
          const totalWorkingHours = sortedRecords.reduce((sum, r) => {
            return sum + parseFloat(r.working_hours || 0);
          }, 0);

          const avgWorkingHours = sortedRecords.length > 0 
            ? (totalWorkingHours / sortedRecords.length).toFixed(1) 
            : 0;

          // Calculate attendance rate
          const workingDays = sortedRecords.length;
          const attendanceRate = workingDays > 0 
            ? (((presentDays + halfDays) / workingDays) * 100).toFixed(1) 
            : 0;

          console.log('[DEBUG] Employee stats calculated:', {
            presentDays, absentDays, halfDays, leaveDays, lateDays, 
            workingDays, attendanceRate, avgWorkingHours
          });

          setEmployeeProfile({
            ...existingEmployee,
            attendanceHistory: sortedRecords,
            stats: {
              presentDays,
              absentDays,
              halfDays,
              leaveDays,
              lateDays,
              totalDays: workingDays,
              attendanceRate,
              avgWorkingHours,
              totalWorkingHours: totalWorkingHours.toFixed(1)
            }
          });

          setSelectedEmployeeForProfile(existingEmployee);
          setShowProfileModal(true);

        } else {
          console.error('[DEBUG] No attendance data found:', attendanceData);
          toast.error("No attendance records found for this employee");
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[DEBUG] Failed to fetch attendance records:', response.status, errorData);
        toast.error(`Failed to fetch attendance records: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.error("Error fetching employee attendance:", error);
      toast.error("Error loading employee attendance: " + error.message);
    }
  };

  const handleMarkAttendance = () => {
    console.log('[DEBUG] Opening mark attendance modal');
    console.log('[DEBUG] Current employees array:', employees);
    console.log('[DEBUG] Employees count:', employees.length);
    if (employees.length === 0) {
      toast.warning('Loading employees data...');
      fetchEmployees(); // Try to refetch if empty
    }
    setMarkAttendanceForm({
      user_id: '',
      date: new Date().toISOString().split('T')[0],
      check_in: '',
      check_out: '',
      status: 'present',
      notes: 'Manually marked by HR'
    });
    setShowMarkAttendanceModal(true);
  };

  const handleShowSettings = () => {
    setShowSettingsModal(true);
  };

  const handleSaveWorkingHours = () => {
    try {
      // Validate time format for both shifts
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      
      const dayShift = workingHours.dayShift;
      const nightShift = workingHours.nightShift;
      
      if (!timeRegex.test(dayShift.startTime) || 
          !timeRegex.test(dayShift.endTime) || 
          !timeRegex.test(dayShift.lateThreshold) || 
          !timeRegex.test(dayShift.halfDayThreshold) ||
          !timeRegex.test(nightShift.startTime) || 
          !timeRegex.test(nightShift.endTime) || 
          !timeRegex.test(nightShift.lateThreshold) || 
          !timeRegex.test(nightShift.halfDayThreshold)) {
        toast.error('Please enter valid time format (HH:MM) for all fields');
        return;
      }

      // Save to localStorage
      localStorage.setItem('workingHours', JSON.stringify(workingHours));
      
      // Recalculate stats with new settings
      const filtered = getFilteredAttendance();
      calculateStats(filtered);
      
      toast.success('Working hours settings saved successfully');
      setShowSettingsModal(false);
    } catch (error) {
      console.error('Error saving working hours:', error);
      toast.error('Failed to save settings');
    }
  };

  const submitMarkAttendance = async () => {
    if (!markAttendanceForm.user_id) {
      toast.error("Please select an employee");
      return;
    }

    try {
      const token = localStorage.getItem("access_token");
      
      // Convert frontend form to backend expected format
      const backendData = {
        employee_id: markAttendanceForm.user_id, // Backend expects employee_id
        attendance_date: markAttendanceForm.date, // Backend expects attendance_date
        status: markAttendanceForm.status,
        notes: markAttendanceForm.notes || 'Manually marked by HR',
        marked_by: currentUser?.full_name || currentUser?.username || 'HR'
      };
      
      // Add time fields if provided, convert to ISO format
      if (markAttendanceForm.check_in) {
        // Convert HH:MM to ISO datetime for the selected date
        const checkinDateTime = new Date(`${markAttendanceForm.date}T${markAttendanceForm.check_in}:00`);
        backendData.checkin_time = checkinDateTime.toISOString();
      }
      
      if (markAttendanceForm.check_out) {
        // Convert HH:MM to ISO datetime for the selected date  
        const checkoutDateTime = new Date(`${markAttendanceForm.date}T${markAttendanceForm.check_out}:00`);
        backendData.checkout_time = checkoutDateTime.toISOString();
      }
      
      console.log('[DEBUG] Submitting attendance data:', backendData);
      
      const response = await fetch(`${API_BASE_URL}/api/attendance/admin/mark-attendance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(backendData)
       });

      if (response.ok) {
        const result = await response.json();
        console.log('[DEBUG] Attendance marked successfully:', result);
        toast.success("Attendance marked successfully");
        setShowMarkAttendanceModal(false);
        setMarkAttendanceForm({
          user_id: '',
          date: new Date().toISOString().split('T')[0],
          check_in: '',
          check_out: '',
          status: 'present',
          notes: ''
        });
        await fetchAllAttendance();
        await fetchAttendanceStats();
      } else {
        const errorData = await response.json();
        console.error('[DEBUG] Failed to mark attendance:', errorData);
        toast.error(errorData.detail || "Failed to mark attendance");
      }
    } catch (error) {
      console.error("Error marking attendance:", error);
      toast.error("Network error. Please try again.");
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    try {
      // Handle backend AM/PM format directly (e.g., "09:00 AM", "05:30 PM")
      if (timeString.includes('AM') || timeString.includes('PM')) {
        return timeString; // Already in the correct format
      }
      
      // Handle various time string formats
      if (timeString.includes('T') || timeString.includes('Z')) {
        // ISO datetime string
        const date = new Date(timeString);
        return date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
      } else if (timeString.includes(':')) {
        // Time string format (HH:mm or HH:mm:ss)
        const timeParts = timeString.split(':');
        const hours = parseInt(timeParts[0]);
        const minutes = parseInt(timeParts[1]);
        
        // Create a date object to properly format AM/PM
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        
        return date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        });
      }
      return timeString;
    } catch (error) {
      console.error('Error formatting time:', error, 'for timeString:', timeString);
      return timeString || 'N/A';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateString);
        return dateString || 'Invalid Date';
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error, 'for dateString:', dateString);
      return dateString || 'N/A';
    }
  };

  const getStatusBadge = (status, checkInTime = null) => {
    console.log('[DEBUG] getStatusBadge called with:', { status, checkInTime });
    
    const config = {
      present: { bg: 'bg-green-100', text: 'text-green-800', label: 'Present' },
      absent: { bg: 'bg-red-100', text: 'text-red-800', label: 'Absent' },
      half_day: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Half Day' },
      leave: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'On Leave' }
    };
    
    let { bg, text, label } = config[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status || 'Unknown' };
    
    // Check if it's a late entry for present status
    if (status === 'present' && checkInTime && isLateEntry(checkInTime)) {
      bg = 'bg-orange-100';
      text = 'text-orange-800';
      label = 'Present (Late)';
    }
    
    // Check if it should be marked as half day
    if (status === 'present' && checkInTime && shouldMarkHalfDay(checkInTime)) {
      bg = 'bg-yellow-100';
      text = 'text-yellow-800';
      label = 'Half Day (Late Entry)';
    }
    
    console.log('[DEBUG] Status badge result:', { status, label, bg, text });
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  // Get alerts for continuous absences or late check-ins
  const getAlerts = () => {
    const alerts = [];
    
    // Check for continuous absences (3+ consecutive days)
    const employeeAbsences = {};
    allAttendance.forEach(record => {
      if (record.status === 'absent') {
        if (!employeeAbsences[record.user_id]) {
          employeeAbsences[record.user_id] = [];
        }
        employeeAbsences[record.user_id].push(record.date);
      }
    });
    
    Object.entries(employeeAbsences).forEach(([userId, dates]) => {
      dates.sort();
      let consecutive = 1;
      for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(dates[i - 1]);
        const currDate = new Date(dates[i]);
        const diff = (currDate - prevDate) / (1000 * 60 * 60 * 24);
        
        if (diff === 1) {
          consecutive++;
          if (consecutive >= 3) {
            const employee = employees.find(emp => (emp.id || emp._id) === userId);
            alerts.push({
              type: 'danger',
              message: `${employee?.full_name || 'Employee'} has ${consecutive} consecutive absences`,
              icon: 'exclamation-triangle'
            });
            break;
          }
        } else {
          consecutive = 1;
        }
      }
    });
    
    // Check for frequent late check-ins (5+ in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const employeeLateEntries = {};
    allAttendance.forEach(record => {
      if (new Date(record.date) >= thirtyDaysAgo && record.check_in) {
        const [hours, minutes] = record.check_in.split(':').map(Number);
        if (hours > 9 || (hours === 9 && minutes > 30)) {
          employeeLateEntries[record.user_id] = (employeeLateEntries[record.user_id] || 0) + 1;
        }
      }
    });
    
    Object.entries(employeeLateEntries).forEach(([userId, count]) => {
      if (count >= 5) {
        const employee = employees.find(emp => (emp.id || emp._id) === userId);
        alerts.push({
          type: 'warning',
          message: `${employee?.full_name || 'Employee'} has ${count} late check-ins in the last 30 days`,
          icon: 'clock'
        });
      }
    });
    
    return alerts;
  };

  // Analytics Functions
  const getAttendanceByTimeRange = () => {
    const now = new Date();
    let startDate;
    
    switch(analyticsTimeRange) {
      case 'daily':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'weekly':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'monthly':
        startDate = new Date(now.setDate(now.getDate() - 30));
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 7));
    }
    
    return allAttendance.filter(record => new Date(record.date) >= startDate);
  };

  const getAttendanceSummary = () => {
    const records = getAttendanceByTimeRange();
    
    return {
      present: records.filter(r => r.status === 'present').length,
      absent: records.filter(r => r.status === 'absent').length,
      leave: records.filter(r => r.status === 'leave').length,
      halfDay: records.filter(r => r.status === 'half_day').length,
      total: records.length
    };
  };

  const getDepartmentWiseAttendance = () => {
    const deptData = {};
    
    departments.forEach(dept => {
      const deptEmployees = employees.filter(emp => emp.department === dept);
      const deptEmployeeIds = deptEmployees.map(emp => emp.id || emp._id || emp.user_id);
      const deptRecords = getAttendanceByTimeRange().filter(record => 
        deptEmployeeIds.includes(record.user_id)
      );
      
      deptData[dept] = {
        present: deptRecords.filter(r => r.status === 'present').length,
        absent: deptRecords.filter(r => r.status === 'absent').length,
        leave: deptRecords.filter(r => r.status === 'leave').length,
        total: deptRecords.length
      };
    });
    
    return deptData;
  };

  const getLateArrivalsTrend = () => {
    const records = getAttendanceByTimeRange();
    const lateByDate = {};
    
    records.forEach(record => {
      if (record.check_in) {
        const [hours, minutes] = record.check_in.split(':').map(Number);
        if (hours > 9 || (hours === 9 && minutes > 30)) {
          lateByDate[record.date] = (lateByDate[record.date] || 0) + 1;
        }
      }
    });
    
    return Object.entries(lateByDate)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .slice(-7); // Last 7 days
  };

  const getEarlyLeavesTrend = () => {
    const records = getAttendanceByTimeRange();
    const earlyByDate = {};
    
    records.forEach(record => {
      if (record.check_out) {
        const [hours, minutes] = record.check_out.split(':').map(Number);
        if (hours < 17 || (hours === 17 && minutes < 30)) {
          earlyByDate[record.date] = (earlyByDate[record.date] || 0) + 1;
        }
      }
    });
    
    return Object.entries(earlyByDate)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .slice(-7); // Last 7 days
  };

  const getTopPunctualEmployees = () => {
    const employeeScores = {};
    const records = getAttendanceByTimeRange();
    
    records.forEach(record => {
      if (!employeeScores[record.user_id]) {
        employeeScores[record.user_id] = {
          name: record.user_name,
          onTime: 0,
          total: 0
        };
      }
      
      employeeScores[record.user_id].total++;
      
      if (record.check_in) {
        const [hours, minutes] = record.check_in.split(':').map(Number);
        if (hours < 9 || (hours === 9 && minutes <= 30)) {
          employeeScores[record.user_id].onTime++;
        }
      }
    });
    
    return Object.entries(employeeScores)
      .map(([userId, data]) => ({
        userId,
        name: data.name || employees.find(e => (e.id || e._id) === userId)?.full_name || 'Unknown',
        onTimePercentage: ((data.onTime / data.total) * 100).toFixed(1),
        onTime: data.onTime,
        total: data.total
      }))
      .filter(emp => emp.total >= 5) // At least 5 days
      .sort((a, b) => b.onTimePercentage - a.onTimePercentage)
      .slice(0, 5); // Top 5
  };

  const getFrequentAbsentees = () => {
    const employeeAbsences = {};
    const records = getAttendanceByTimeRange();
    
    records.forEach(record => {
      if (record.status === 'absent') {
        if (!employeeAbsences[record.user_id]) {
          employeeAbsences[record.user_id] = {
            name: record.user_name,
            absences: 0,
            total: 0
          };
        }
        employeeAbsences[record.user_id].absences++;
      }
      
      if (employeeAbsences[record.user_id]) {
        employeeAbsences[record.user_id].total++;
      }
    });
    
    return Object.entries(employeeAbsences)
      .map(([userId, data]) => ({
        userId,
        name: data.name || employees.find(e => (e.id || e._id) === userId)?.full_name || 'Unknown',
        absences: data.absences,
        absenceRate: ((data.absences / data.total) * 100).toFixed(1)
      }))
      .filter(emp => emp.absences >= 2) // At least 2 absences
      .sort((a, b) => b.absences - a.absences)
      .slice(0, 5); // Top 5
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading attendance data...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg">
          <div className="text-red-500 mb-4">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-6xl" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You need HR, Admin, or Manager privileges to access the Attendance Management dashboard.
          </p>
          {currentUser && (
            <div className="mb-4 p-3 bg-gray-100 rounded-lg text-left text-sm">
              <p><strong>Current User:</strong> {currentUser.username || currentUser.name || 'Unknown'}</p>
              <p><strong>User ID:</strong> {currentUser.user_id || currentUser.id || 'Unknown'}</p>
              <p><strong>Roles:</strong> {
                JSON.stringify(currentUser.roles || currentUser.role || 'None')
              }</p>
            </div>
          )}
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const filteredAttendance = getFilteredAttendance();
  console.log('[DEBUG] Component render - filteredAttendance length:', filteredAttendance.length);
  console.log('[DEBUG] Component render - allAttendance length:', allAttendance.length);
  const alerts = getAlerts();
  // Prefer server-provided summary when available, otherwise compute from client data
  const attendanceSummary = attendanceSummaryServer || getAttendanceSummary();
  const deptWiseData = getDepartmentWiseAttendance();
  const lateArrivalsTrend = getLateArrivalsTrend();
  const earlyLeavesTrend = getEarlyLeavesTrend();
  const topPunctual = getTopPunctualEmployees();
  const frequentAbsentees = getFrequentAbsentees();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <i className="fas fa-users-cog text-indigo-600 mr-3"></i>
                HR Attendance Dashboard
              </h1>
              <p className="text-gray-600 mt-2">Manage and monitor employee attendance</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleMarkAttendance}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faPlus} />
                Mark Attendance
              </button>
              <button
                onClick={handleShowSettings}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <i className="fas fa-cog"></i>
                Settings
              </button>
              <button
                onClick={exportToCSV}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faFileExport} />
                Export Report
              </button>
            </div>
          </div>

          {/* View Toggle Buttons */}
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setViewType('table')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
                viewType === 'table'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <i className="fas fa-table"></i>
              Table View
            </button>
            <button
              onClick={() => setViewType('analytics')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 ${
                viewType === 'analytics'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <i className="fas fa-chart-bar"></i>
              Analytics & Reports
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 font-medium">Present Today</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">{stats.totalPresent}</p>
                </div>
                <i className="fas fa-user-check text-3xl text-green-500"></i>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700 font-medium">Absent Today</p>
                  <p className="text-2xl font-bold text-red-900 mt-1">{stats.totalAbsent}</p>
                </div>
                <i className="fas fa-user-times text-3xl text-red-500"></i>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-700 font-medium">Late Entries</p>
                  <p className="text-2xl font-bold text-yellow-900 mt-1">{stats.lateEntries}</p>
                </div>
                <i className="fas fa-clock text-3xl text-yellow-500"></i>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 font-medium">On Leave</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{stats.onLeave}</p>
                </div>
                <i className="fas fa-calendar-check text-3xl text-green-500"></i>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-700 font-medium">Half Day</p>
                  <p className="text-2xl font-bold text-orange-900 mt-1">{stats.halfDay}</p>
                </div>
                <i className="fas fa-user-clock text-3xl text-orange-500"></i>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-indigo-700 font-medium">Attendance %</p>
                  <p className="text-2xl font-bold text-indigo-900 mt-1">{stats.attendancePercentage}%</p>
                </div>
                <i className="fas fa-chart-pie text-3xl text-indigo-500"></i>
              </div>
            </div>
          </div>

          {/* Working Hours Info */}
          <div className="mt-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <i className="fas fa-business-time text-2xl text-blue-600"></i>
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    Working Hours Configuration - {workingHours.currentShift === 'day' ? 'Day Shift' : 'Night Shift'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {workingHours.currentShift === 'day' ? (
                      <>
                        Day: {workingHours.dayShift.startTime} - {workingHours.dayShift.endTime} | 
                        Late after: {workingHours.dayShift.lateThreshold} | 
                        Half-day after: {workingHours.dayShift.halfDayThreshold}
                      </>
                    ) : (
                      <>
                        Night: {workingHours.nightShift.startTime} - {workingHours.nightShift.endTime} | 
                        Late after: {workingHours.nightShift.lateThreshold} | 
                        Half-day after: {workingHours.nightShift.halfDayThreshold}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setWorkingHours({...workingHours, currentShift: workingHours.currentShift === 'day' ? 'night' : 'day'})}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    workingHours.currentShift === 'day' 
                      ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' 
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  }`}
                >
                  <i className={`${workingHours.currentShift === 'day' ? 'fas fa-sun' : 'fas fa-moon'} mr-1`}></i>
                  Switch to {workingHours.currentShift === 'day' ? 'Night' : 'Day'}
                </button>
                <button
                  onClick={handleShowSettings}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all duration-200 text-sm font-medium"
                >
                  <i className="fas fa-cog mr-1"></i>
                  Configure
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Alerts Section */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 space-y-3"
          >
            {alerts.map((alert, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-lg border-l-4 flex items-start gap-3 ${
                  alert.type === 'warning' 
                    ? 'bg-yellow-50 border-yellow-500' 
                    : 'bg-red-50 border-red-500'
                }`}
              >
                <i className={`fas fa-${alert.icon} text-xl ${
                  alert.type === 'warning' ? 'text-yellow-600' : 'text-red-600'
                }`}></i>
                <div className="flex-1">
                  <p className={`font-semibold ${
                    alert.type === 'warning' ? 'text-yellow-800' : 'text-red-800'
                  }`}>
                    {alert.type === 'warning' ? 'Warning' : 'Alert'}
                  </p>
                  <p className={`text-sm mt-1 ${
                    alert.type === 'warning' ? 'text-yellow-700' : 'text-red-700'
                  }`}>
                    {alert.message}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {viewType === 'analytics' ? (
        /* Analytics & Reports View */
        <>
          {/* Time Range Selector */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-2xl shadow-lg p-6 mb-6"
          >
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <i className="fas fa-calendar-alt text-indigo-600 mr-2"></i>
              Time Range
            </h2>
            <div className="flex gap-2">
              {['daily', 'weekly', 'monthly'].map(range => (
                <button
                  key={range}
                  onClick={() => setAnalyticsTimeRange(range)}
                  className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 capitalize ${
                    analyticsTimeRange === range
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Attendance Summary Cards */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-lg p-6 mb-6"
          >
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <i className="fas fa-chart-pie text-indigo-600 mr-2"></i>
              Attendance Summary ({analyticsTimeRange})
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <i className="fas fa-user-check text-3xl text-green-500"></i>
                  <span className="text-2xl font-bold text-green-900">{attendanceSummary.present}</span>
                </div>
                <p className="text-sm font-medium text-green-700">Total Present</p>
                <p className="text-xs text-green-600 mt-1">
                  {attendanceSummary.total > 0 ? ((attendanceSummary.present / attendanceSummary.total) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
                <div className="flex items-center justify-between mb-2">
                  <i className="fas fa-user-times text-3xl text-red-500"></i>
                  <span className="text-2xl font-bold text-red-900">{attendanceSummary.absent}</span>
                </div>
                <p className="text-sm font-medium text-red-700">Total Absent</p>
                <p className="text-xs text-red-600 mt-1">
                  {attendanceSummary.total > 0 ? ((attendanceSummary.absent / attendanceSummary.total) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <i className="fas fa-calendar-check text-3xl text-green-500ext-3xl text-blue-500"></i>
                  <span className="text-2xl font-bold text-blue-900">{attendanceSummary.leave}</span>
                </div>
                <p className="text-sm font-medium text-blue-700">On Leave</p>
                <p className="text-xs text-blue-600 mt-1">
                  {attendanceSummary.total > 0 ? ((attendanceSummary.leave / attendanceSummary.total) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
                <div className="flex items-center justify-between mb-2">
                  <i className="fas fa-user-clock text-3xl text-yellow-500"></i>
                  <span className="text-2xl font-bold text-yellow-900">{attendanceSummary.halfDay}</span>
                </div>
                <p className="text-sm font-medium text-yellow-700">Half Day</p>
                <p className="text-xs text-yellow-600 mt-1">
                  {attendanceSummary.total > 0 ? ((attendanceSummary.halfDay / attendanceSummary.total) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
            </div>
            
            {/* Visual Bar Chart */}
            <div className="mt-6">
              <div className="flex items-center gap-2 h-8 rounded-lg overflow-hidden">
                <div 
                  className="bg-green-500 h-full flex items-center justify-center text-white text-xs font-semibold"
                  style={{ width: `${attendanceSummary.total > 0 ? (attendanceSummary.present / attendanceSummary.total) * 100 : 0}%` }}
                >
                  {attendanceSummary.present > 0 && `${attendanceSummary.present}`}
                </div>
                <div 
                  className="bg-red-500 h-full flex items-center justify-center text-white text-xs font-semibold"
                  style={{ width: `${attendanceSummary.total > 0 ? (attendanceSummary.absent / attendanceSummary.total) * 100 : 0}%` }}
                >
                  {attendanceSummary.absent > 0 && `${attendanceSummary.absent}`}
                </div>
                <div 
                  className="bg-blue-500 h-full flex items-center justify-center text-white text-xs font-semibold"
                  style={{ width: `${attendanceSummary.total > 0 ? (attendanceSummary.leave / attendanceSummary.total) * 100 : 0}%` }}
                >
                  {attendanceSummary.leave > 0 && `${attendanceSummary.leave}`}
                </div>
                <div 
                  className="bg-yellow-500 h-full flex items-center justify-center text-white text-xs font-semibold"
                  style={{ width: `${attendanceSummary.total > 0 ? (attendanceSummary.halfDay / attendanceSummary.total) * 100 : 0}%` }}
                >
                  {attendanceSummary.halfDay > 0 && `${attendanceSummary.halfDay}`}
                </div>
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>Total Records: {attendanceSummary.total}</span>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Late Arrivals Trend */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <i className="fas fa-clock text-yellow-600 mr-2"></i>
                Late Arrivals Trend (Last 7 Days)
              </h2>
              
              <div className="space-y-3">
                {lateArrivalsTrend.length > 0 ? (
                  lateArrivalsTrend.map(([date, count]) => (
                    <div key={date} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-24">{formatDate(date)}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
                        <div 
                          className="bg-yellow-500 h-full flex items-center justify-end pr-3 text-white text-sm font-semibold transition-all duration-500"
                          style={{ width: `${Math.min((count / Math.max(...lateArrivalsTrend.map(d => d[1]))) * 100, 100)}%` }}
                        >
                          {count}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No late arrivals in this period</p>
                )}
              </div>
            </motion.div>

            {/* Early Leaves Trend */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <i className="fas fa-sign-out-alt text-orange-600 mr-2"></i>
                Early Leaves Trend (Last 7 Days)
              </h2>
              
              <div className="space-y-3">
                {earlyLeavesTrend.length > 0 ? (
                  earlyLeavesTrend.map(([date, count]) => (
                    <div key={date} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-24">{formatDate(date)}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
                        <div 
                          className="bg-orange-500 h-full flex items-center justify-end pr-3 text-white text-sm font-semibold transition-all duration-500"
                          style={{ width: `${Math.min((count / Math.max(...earlyLeavesTrend.map(d => d[1]))) * 100, 100)}%` }}
                        >
                          {count}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No early leaves in this period</p>
                )}
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Top Punctual Employees */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <i className="fas fa-trophy text-yellow-500 mr-2"></i>
                Top Punctual Employees
              </h2>
              
              <div className="space-y-3">
                {topPunctual.length > 0 ? (
                  topPunctual.map((employee, index) => (
                    <div key={employee.userId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold">
                        {employee.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{employee.name}</p>
                        <p className="text-xs text-gray-600">{employee.onTime} on-time / {employee.total} days</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">{employee.onTimePercentage}%</p>
                        <p className="text-xs text-gray-500">On-time</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No data available</p>
                )}
              </div>
            </motion.div>

            {/* Frequent Absentees */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-2xl shadow-lg p-6"
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <i className="fas fa-exclamation-triangle text-red-600 mr-2"></i>
                Employees with Frequent Absences
              </h2>
              
              <div className="space-y-3">
                {frequentAbsentees.length > 0 ? (
                  frequentAbsentees.map((employee, index) => (
                    <div key={employee.userId} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                      <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="w-10 h-10 bg-red-200 rounded-full flex items-center justify-center text-red-600 font-semibold">
                        {employee.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{employee.name}</p>
                        <p className="text-xs text-gray-600">{employee.absences} absences</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600">{employee.absenceRate}%</p>
                        <p className="text-xs text-gray-500">Absence Rate</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No frequent absences found</p>
                )}
              </div>
            </motion.div>
          </div>
        </>
      ) : (
        <>
      {/* Filters Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-lg p-6 mb-6"
      >
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <i className="fas fa-filter text-indigo-600 mr-2"></i>
          Filters
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Position</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id || emp._id} value={emp.id || emp._id}>
                  {emp.full_name || emp.username}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="half_day">Half Day</option>
            </select>
          </div>
        </div>
        
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              setSelectedDepartment('all');
              setSelectedEmployee('all');
              setStartDate('');
              setEndDate('');
              setStatusFilter('all');
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            <i className="fas fa-redo mr-2"></i>
            Reset Filters
          </button>
        </div>
      </motion.div>

      {/* Attendance Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-lg overflow-hidden"
      >
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center justify-between">
            <span>
              <i className="fas fa-table text-indigo-600 mr-2"></i>
              Attendance Records ({filteredAttendance.length})
            </span>
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Check In</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Check Out</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Working Hours</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAttendance.length > 0 ? (
                  filteredAttendance.map((record, index) => {
                    console.log('[DEBUG] Rendering record:', record, 'Date field:', record.date);
                    console.log('[DEBUG] Record user_id:', record.user_id, 'type:', typeof record.user_id);
                    console.log('[DEBUG] Looking for employee with user_id:', record.user_id);
                    console.log('[DEBUG] Available employees:', employees.map(e => ({ id: e.id, _id: e._id, user_id: e.user_id, name: e.full_name })));
                    
                    const employee = employees.find(emp => {
                      const empId = emp.id || emp._id || emp.user_id;
                      console.log('[DEBUG] Comparing', empId, '===', record.user_id, '?', empId === record.user_id);
                      return empId === record.user_id;
                    });
                    
                    console.log('[DEBUG] Found employee:', employee);
                    
                    return (
                      <motion.tr
                        key={`${record._id || index}-${record.status}-${record.last_modified || Date.now()}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatDate(record.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold text-sm mr-2">
                              {(record.employee_name || employee?.full_name || employee?.username || 'U').charAt(0)}
                            </div>
                            <span className="text-sm text-gray-900">
                              {record.employee_name || record.user_name || employee?.full_name || employee?.username || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {(() => {
                            console.log('[DEBUG] Employee for record:', record.user_id, 'found:', employee);
                            console.log('[DEBUG] Employee department field:', employee?.department);
                            
                            // Try multiple possible department field names
                            const department = employee?.department || 
                                             employee?.dept || 
                                             employee?.position ||
                                             record.department ||
                                             record.dept ||
                                             'N/A';
                            
                            return department;
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatTime(record.check_in)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatTime(record.check_out)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {record.working_hours ? (
                            <div>
                              <span className="font-semibold">
                                {typeof record.working_hours === 'number' 
                                  ? formatWorkingHours(record.working_hours)
                                  : `${record.working_hours} hrs`
                                }
                              </span>
                              {record.calculated_working_hours && record.calculated_working_hours !== record.working_hours && (
                                <div className="text-xs text-green-600">
                                  Calculated: {formatWorkingHours(record.calculated_working_hours)}
                                </div>
                              )}
                            </div>
                          ) : (
                            record.check_in && record.check_out ? (
                              <div>
                                <span className="text-green-600 font-semibold">
                                  {formatWorkingHours(record.calculated_working_hours)}
                                </span>
                                <div className="text-xs text-gray-500">Auto-calculated</div>
                              </div>
                            ) : (
                              <span className="text-gray-400">N/A</span>
                            )
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(record.status, record.check_in)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                const employeeId = record.employee_id || record.user_id || record.id || record._id;
                                console.log('[DEBUG] View button clicked for record:', record);
                                console.log('[DEBUG] Using employee ID:', employeeId);
                                handleViewProfile(employeeId);
                              }}
                              className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium flex items-center gap-1"
                              title="View Profile"
                            >
                              <FontAwesomeIcon icon={faEye} />
                              <span className="hidden sm:inline">View</span>
                            </button>
                            <button
                              onClick={() => handleEditAttendance(record)}
                              className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium flex items-center gap-1"
                              title="Edit Attendance"
                            >
                              <FontAwesomeIcon icon={faEdit} />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center">
                      <i className="fas fa-inbox text-5xl text-gray-300 mb-3"></i>
                      <p className="text-gray-500 font-medium">No attendance records found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Leave Requests Section */}
      {leaveRequests.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg p-6 mt-6"
        >
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <i className="fas fa-clipboard-list text-indigo-600 mr-2"></i>
            Pending Leave Requests ({leaveRequests.filter(r => r.status === 'pending').length})
          </h2>
          
          <div className="space-y-3">
            {leaveRequests.filter(r => r.status === 'pending').map((leave, index) => (
              <motion.div
                key={leave._id || index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                        {(leave.user_name || 'U').charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{leave.user_name || 'Employee'}</p>
                        <p className="text-sm text-gray-500">{leave.leave_type || 'Leave Request'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                      <div>
                        <i className="fas fa-calendar mr-2 text-gray-400"></i>
                        {formatDate(leave.start_date)} - {formatDate(leave.end_date)}
                      </div>
                      <div>
                        <i className="fas fa-clock mr-2 text-gray-400"></i>
                        {leave.days || 0} days
                      </div>
                    </div>
                    {leave.reason && (
                      <p className="text-sm text-gray-600 mt-2 italic">
                        <i className="fas fa-comment-alt mr-2 text-gray-400"></i>
                        {leave.reason}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLeaveAction(leave._id, 'approve')}
                      className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium flex items-center gap-2"
                    >
                      <FontAwesomeIcon icon={faCheck} />
                      Approve
                    </button>
                    <button
                      onClick={() => handleLeaveAction(leave._id, 'reject')}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium flex items-center gap-2"
                    >
                      <FontAwesomeIcon icon={faTimes} />
                      Reject
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Edit Attendance Modal */}
      <AnimatePresence>
        {showEditModal && selectedRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 sm:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Edit Attendance</h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <FontAwesomeIcon icon={faTimes} className="text-2xl" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      value={editForm.date}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Check In Time</label>
                      <TimePickerCustom
                        value={editForm.check_in}
                        onChange={(newCheckIn) => {
                          let updatedForm = { ...editForm, check_in: newCheckIn };
                          
                          // Auto-calculate working hours if both times are present
                          if (newCheckIn && editForm.check_out) {
                            const calculatedHours = calculateWorkingHours(newCheckIn, editForm.check_out);
                            if (calculatedHours !== null) {
                              updatedForm.working_hours = calculatedHours;
                            }
                          }
                          
                          setEditForm(updatedForm);
                        }}
                        placeholder="Select check-in time"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Check Out Time</label>
                      <TimePickerCustom
                        value={editForm.check_out}
                        onChange={(newCheckOut) => {
                          let updatedForm = { ...editForm, check_out: newCheckOut };
                          
                          // Auto-calculate working hours if both times are present
                          if (editForm.check_in && newCheckOut) {
                            const calculatedHours = calculateWorkingHours(editForm.check_in, newCheckOut);
                            if (calculatedHours !== null) {
                              updatedForm.working_hours = calculatedHours;
                            }
                          }
                          
                          setEditForm(updatedForm);
                        }}
                        placeholder="Select check-out time"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="half_day">Half Day</option>
                        <option value="leave">On Leave</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Working Hours</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editForm.working_hours}
                        onChange={(e) => setEditForm({ ...editForm, working_hours: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="e.g., 8.5"
                      />
                    </div>
                  </div>

                  {/* Display calculated working hours */}
                  {editForm.check_in && editForm.check_out && editForm.working_hours && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-calculator text-green-600"></i>
                        <span className="text-sm font-medium text-green-800">Calculated Working Hours:</span>
                        <span className="text-lg font-bold text-green-900">
                          {formatWorkingHours(editForm.working_hours)}
                        </span>
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        From {editForm.check_in} to {editForm.check_out}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows="3"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                      placeholder="Add any notes or remarks..."
                    />
                  </div>
                </div>

                <div className="flex gap-4 mt-6">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all duration-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitEditAttendance}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    <i className="fas fa-save mr-2"></i>
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mark Attendance Modal */}
      <AnimatePresence>
        {showMarkAttendanceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowMarkAttendanceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 sm:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Mark Attendance Manually</h2>
                  <button
                    onClick={() => setShowMarkAttendanceModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <FontAwesomeIcon icon={faTimes} className="text-2xl" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-semibold text-gray-700">
                        Select Employee <span className="text-red-500">*</span>
                      </label>
                      {employees.length === 0 && (
                        <button
                          type="button"
                          onClick={fetchEmployees}
                          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          <i className="fas fa-refresh mr-1"></i>
                          Reload
                        </button>
                      )}
                    </div>
                    <select
                      value={markAttendanceForm.user_id}
                      onChange={(e) => {
                        console.log('[DEBUG] Employee selected:', e.target.value);
                        setMarkAttendanceForm({ ...markAttendanceForm, user_id: e.target.value });
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    >
                      <option value="">
                        {employees.length === 0 ? 'Loading employees...' : 'Choose an employee...'}
                      </option>
                      {employees.length === 0 ? (
                        <option value="" disabled>No employees available</option>
                      ) : (
                        employees.map((emp, index) => {
                          const employeeId = emp.employee_id || emp.user_id || emp.id || emp._id;
                          const employeeName = emp.name || emp.full_name || emp.username || 'Unknown';
                          console.log('[DEBUG] Rendering employee option:', { employeeId, employeeName, emp });
                          return (
                            <option key={employeeId || index} value={employeeId}>
                              {employeeName} {emp.department ? `(${emp.department})` : ''}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                      <input
                        type="date"
                        value={markAttendanceForm.date}
                        onChange={(e) => setMarkAttendanceForm({ ...markAttendanceForm, date: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                      <select
                        value={markAttendanceForm.status}
                        onChange={(e) => setMarkAttendanceForm({ ...markAttendanceForm, status: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="half_day">Half Day</option>
                        <option value="leave">On Leave</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Check In</label>
                      <input
                        type="time"
                        value={markAttendanceForm.check_in}
                        onChange={(e) => {
                          const newCheckIn = e.target.value;
                          let updatedForm = { ...markAttendanceForm, check_in: newCheckIn };
                          
                          // Auto-calculate working hours if both times are present
                          if (newCheckIn && markAttendanceForm.check_out) {
                            const calculatedHours = calculateWorkingHours(newCheckIn, markAttendanceForm.check_out);
                            if (calculatedHours !== null) {
                              updatedForm.working_hours = calculatedHours;
                            }
                          }
                          
                          setMarkAttendanceForm(updatedForm);
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Check Out</label>
                      <input
                        type="time"
                        value={markAttendanceForm.check_out}
                        onChange={(e) => {
                          const newCheckOut = e.target.value;
                          let updatedForm = { ...markAttendanceForm, check_out: newCheckOut };
                          
                          // Auto-calculate working hours if both times are present
                          if (markAttendanceForm.check_in && newCheckOut) {
                            const calculatedHours = calculateWorkingHours(markAttendanceForm.check_in, newCheckOut);
                            if (calculatedHours !== null) {
                              updatedForm.working_hours = calculatedHours;
                            }
                          }
                          
                          setMarkAttendanceForm(updatedForm);
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Display calculated working hours */}
                  {markAttendanceForm.check_in && markAttendanceForm.check_out && markAttendanceForm.working_hours && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-clock text-blue-600"></i>
                        <span className="text-sm font-medium text-blue-800">Calculated Working Hours:</span>
                        <span className="text-lg font-bold text-blue-900">
                          {formatWorkingHours(markAttendanceForm.working_hours)}
                        </span>
                      </div>
                      <p className="text-xs text-blue-600 mt-1">
                        From {markAttendanceForm.check_in} to {markAttendanceForm.check_out}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                    <textarea
                      value={markAttendanceForm.notes}
                      onChange={(e) => setMarkAttendanceForm({ ...markAttendanceForm, notes: e.target.value })}
                      rows="3"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                      placeholder="Add notes (e.g., Manually marked by HR)..."
                    />
                  </div>

                  <div className="flex gap-4 mt-6">
                    <button
                      onClick={() => setShowMarkAttendanceModal(false)}
                      className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all duration-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitMarkAttendance}
                      disabled={!markAttendanceForm.user_id}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className="fas fa-check mr-2"></i>
                      Mark Attendance
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Employee Profile Modal */}
      <AnimatePresence>
        {showProfileModal && employeeProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowProfileModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 sm:p-8">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                      {(employeeProfile.full_name || employeeProfile.username || 'U').charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{employeeProfile.full_name || employeeProfile.username}</h2>
                      <p className="text-gray-600">{employeeProfile.department || 'Department'} • {employeeProfile.position || 'Position'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowProfileModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <i className="fas fa-times text-2xl"></i>
                  </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-600 font-medium">Present Days</p>
                        <p className="text-2xl font-bold text-green-800">{employeeProfile.stats.presentDays}</p>
                      </div>
                      <i className="fas fa-check-circle text-green-500 text-xl"></i>
                    </div>
                  </div>
                  
                  <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-red-600 font-medium">Absent Days</p>
                        <p className="text-2xl font-bold text-red-800">{employeeProfile.stats.absentDays}</p>
                      </div>
                      <i className="fas fa-times-circle text-red-500 text-xl"></i>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-yellow-600 font-medium">Late Arrivals</p>
                        <p className="text-2xl font-bold text-yellow-800">{employeeProfile.stats.lateDays}</p>
                      </div>
                      <i className="fas fa-clock text-yellow-500 text-xl"></i>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-600 font-medium">Attendance Rate</p>
                        <p className="text-2xl font-bold text-blue-800">{employeeProfile.stats.attendanceRate}%</p>
                      </div>
                      <i className="fas fa-chart-line text-blue-500 text-xl"></i>
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Records</p>
                    <p className="text-lg font-bold text-gray-900">{employeeProfile.stats.totalDays}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Avg. Working Hours</p>
                    <p className="text-lg font-bold text-gray-900">{employeeProfile.stats.avgWorkingHours} hrs</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Working Hours</p>
                    <p className="text-lg font-bold text-gray-900">{employeeProfile.stats.totalWorkingHours} hrs</p>
                  </div>
                </div>

                {/* Attendance History */}
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <i className="fas fa-history text-indigo-600 mr-2"></i>
                    Attendance History ({employeeProfile.attendanceHistory.length} Records)
                  </h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Check In</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Check Out</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Hours</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {employeeProfile.attendanceHistory.length > 0 ? (
                          employeeProfile.attendanceHistory.slice(0, 30).map((record, index) => {
                            // Map field names properly
                            const checkinTime = record.checkin_time || record.check_in_time || record.check_in;
                            const checkoutTime = record.checkout_time || record.check_out_time || record.check_out;
                            const attendanceDate = record.attendance_date || record.date;
                            
                            return (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900">{formatDate(attendanceDate)}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{formatTime(checkinTime)}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{formatTime(checkoutTime)}</td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {record.working_hours ? `${record.working_hours} hrs` : 'N/A'}
                                </td>
                                <td className="px-4 py-3">{getStatusBadge(record.status, checkinTime)}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                              <i className="fas fa-calendar-times text-3xl mb-2 block"></i>
                              No attendance records found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowProfileModal(false)}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all duration-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSettingsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-4 max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center">
                  <i className="fas fa-cog text-purple-600 mr-2"></i>
                  Working Hours Settings
                </h2>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-lg"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {/* Active Shift Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Active Shift
                  </label>
                  <div className="flex gap-3">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="currentShift"
                        value="day"
                        checked={workingHours.currentShift === 'day'}
                        onChange={e => setWorkingHours({...workingHours, currentShift: e.target.value})}
                        className="mr-2"
                      />
                      <i className="fas fa-sun text-yellow-600 mr-1"></i>
                      Day Shift
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="currentShift"
                        value="night"
                        checked={workingHours.currentShift === 'night'}
                        onChange={e => setWorkingHours({...workingHours, currentShift: e.target.value})}
                        className="mr-2"
                      />
                      <i className="fas fa-moon text-indigo-600 mr-1"></i>
                      Night Shift
                    </label>
                  </div>
                </div>

                {/* Day Shift Settings */}
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <h3 className="text-base font-medium text-yellow-800 mb-2 flex items-center">
                    <i className="fas fa-sun mr-2"></i>
                    Day Shift Configuration
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={workingHours.dayShift.startTime}
                        onChange={e => setWorkingHours({
                          ...workingHours, 
                          dayShift: {...workingHours.dayShift, startTime: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={workingHours.dayShift.endTime}
                        onChange={e => setWorkingHours({
                          ...workingHours, 
                          dayShift: {...workingHours.dayShift, endTime: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Late Entry Threshold
                      </label>
                      <input
                        type="time"
                        value={workingHours.dayShift.lateThreshold}
                        onChange={e => setWorkingHours({
                          ...workingHours, 
                          dayShift: {...workingHours.dayShift, lateThreshold: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Half Day Threshold
                      </label>
                      <input
                        type="time"
                        value={workingHours.dayShift.halfDayThreshold}
                        onChange={e => setWorkingHours({
                          ...workingHours, 
                          dayShift: {...workingHours.dayShift, halfDayThreshold: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Night Shift Settings */}
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                  <h3 className="text-base font-medium text-indigo-800 mb-2 flex items-center">
                    <i className="fas fa-moon mr-2"></i>
                    Night Shift Configuration
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Time (Evening)
                      </label>
                      <input
                        type="time"
                        value={workingHours.nightShift.startTime}
                        onChange={e => setWorkingHours({
                          ...workingHours, 
                          nightShift: {...workingHours.nightShift, startTime: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Time (Morning)
                      </label>
                      <input
                        type="time"
                        value={workingHours.nightShift.endTime}
                        onChange={e => setWorkingHours({
                          ...workingHours, 
                          nightShift: {...workingHours.nightShift, endTime: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Late Entry Threshold
                      </label>
                      <input
                        type="time"
                        value={workingHours.nightShift.lateThreshold}
                        onChange={e => setWorkingHours({
                          ...workingHours, 
                          nightShift: {...workingHours.nightShift, lateThreshold: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Half Day Threshold
                      </label>
                      <input
                        type="time"
                        value={workingHours.nightShift.halfDayThreshold}
                        onChange={e => setWorkingHours({
                          ...workingHours, 
                          nightShift: {...workingHours.nightShift, halfDayThreshold: e.target.value}
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-indigo-600 mt-1">
                    <i className="fas fa-info-circle mr-1"></i>
                    Night shift spans midnight. End time is on the following day.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all duration-300 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveWorkingHours}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg text-sm"
                >
                  Save Settings
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

        </>
      )}
    </div>
  );
};

export default HRAttendanceDashboard;

