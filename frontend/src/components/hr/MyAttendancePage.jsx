import { API_URL } from '../../config';
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faClock, 
  faCalendarAlt, 
  faCheckCircle, 
  faTimesCircle,
  faPlay,
  faStop,
  faMapMarkerAlt,
  faUser,
  faFilter,
  faSearch,
  faDownload,
  faChartBar,
  faExclamationTriangle,
  faBusinessTime,
  faHourglass
} from '@fortawesome/free-solid-svg-icons';

// Safe rendering utilities outside component to prevent re-creation
const SafeText = ({ children, fallback = '-' }) => {
  try {
    if (children == null || children === undefined) return fallback;
    return String(children);
  } catch (error) {
    console.error('SafeText error:', error);
    return fallback;
  }
};

const SafeDateFormat = ({ date, options, fallback = 'Invalid Date' }) => {
  try {
    if (!date) return fallback;
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return fallback;
    return dateObj.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error('SafeDateFormat error:', error);
    return fallback;
  }
};

const getLocationText = (location, locationName) => {
  try {
    if (typeof location === 'string' && location) return location;
    if (typeof locationName === 'string' && locationName) return locationName;
    if (location && typeof location === 'object') {
      return location.name || location.address || location.text || 'Office';
    }
    return 'Office';
  } catch (error) {
    console.error('Location parsing error:', error);
    return 'Office';
  }
};

// Function to determine attendance status based on check-in/out times
const determineAttendanceStatus = (checkInTime, checkOutTime = null, existingStatus = null) => {
  try {
    // If no check-in time, mark as absent
    if (!checkInTime) {
      return 'Absent';
    }

    // If there's already a non-default status, respect it unless it's generic 'present'
    if (existingStatus && 
        existingStatus.toLowerCase() !== 'present' && 
        existingStatus !== 'Present' &&
        existingStatus.trim() !== '') {
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
        console.error('Error parsing time:', error, 'Input:', timeValue);
        return null;
      }
    };

    const checkInParsed = parseTime(checkInTime);
    if (!checkInParsed) {
      console.warn('Could not parse check-in time:', checkInTime);
      return 'Present'; // Default if parsing fails
    }

    // Get current working hours settings
    const savedConfig = localStorage.getItem('workingHoursConfig');
    let currentShiftSettings;
    
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        currentShiftSettings = config.currentShift === 'night' ? config.nightShift : config.dayShift;
      } catch (e) {
        // Fallback to default day shift
        currentShiftSettings = {
          startTime: '09:00',
          endTime: '18:00',
          lateThreshold: '09:00',
          halfDayThreshold: '13:00'
        };
      }
    } else {
      // Default day shift settings
      currentShiftSettings = {
        startTime: '09:00',
        endTime: '18:00',
        lateThreshold: '09:00',
        halfDayThreshold: '13:00'
      };
    }

    // Parse threshold times
    const [lateHour, lateMin] = currentShiftSettings.lateThreshold.split(':').map(Number);
    const [halfDayHour, halfDayMin] = currentShiftSettings.halfDayThreshold.split(':').map(Number);
    
    const lateThresholdMinutes = lateHour * 60 + lateMin;
    const halfDayThresholdMinutes = halfDayHour * 60 + halfDayMin;
    
    const checkInMinutes = checkInParsed.totalMinutes;

    console.log(`[DEBUG] Status determination: CheckIn=${checkInTime} (${checkInMinutes}min), Late=${lateThresholdMinutes}min, HalfDay=${halfDayThresholdMinutes}min`);

    // Determine status based on thresholds
    if (checkInMinutes > halfDayThresholdMinutes) {
      console.log('[DEBUG] Status: Half Day (late after half-day threshold)');
      return 'Half Day';
    } else if (checkInMinutes > lateThresholdMinutes) {
      console.log('[DEBUG] Status: Late (late after threshold)');
      return 'Late';
    } else {
      console.log('[DEBUG] Status: Present (on time)');
      return 'Present';
    }
  } catch (error) {
    console.error('Error determining attendance status:', error);
    return existingStatus || 'Present';
  }
};

// Function to sync working hours configuration
const syncWorkingHoursConfig = () => {
  try {
    // Load working hours from localStorage or use defaults
    const savedConfig = localStorage.getItem('workingHoursConfig');
    if (savedConfig) {
      return JSON.parse(savedConfig);
    }
    
    // Default configuration
    const defaultConfig = {
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
      currentShift: 'day'
    };
    
    return defaultConfig;
  } catch (error) {
    console.error('Error syncing working hours config:', error);
    return {
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
      currentShift: 'day'
    };
  }
};

const MyAttendancePage = () => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [currentStatus, setCurrentStatus] = useState('checked-out');
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [location, setLocation] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayRecord, setTodayRecord] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState({
    totalWorkingDays: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    totalWorkingHours: '0h 0m',
    averageWorkingHours: '0h 0m'
  });
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  // ── HR/Admin state ──
  const [isHRAdmin, setIsHRAdmin] = useState(false);
  const [hrEmployees, setHREmployees] = useState([]);
  const [adminRecords, setAdminRecords] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminFilter, setAdminFilter] = useState({
    employee_id: '',
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    status: '',
  });
  const [adminPage, setAdminPage] = useState(1);
  const [adminTotal, setAdminTotal] = useState(0);
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [markForm, setMarkForm] = useState({
    employee_id: '',
    attendance_date: new Date().toISOString().split('T')[0],
    status: 'present',
    checkin_time: '',
    checkout_time: '',
    notes: '',
  });
  const [isMarking, setIsMarking] = useState(false);

  // AM/PM time picker state
  const [checkinPicker, setCheckinPicker] = useState({ hour: '09', minute: '00', ampm: 'AM' });
  const [checkoutPicker, setCheckoutPicker] = useState({ hour: '06', minute: '00', ampm: 'PM' });

  // Convert AM/PM picker → HH:MM (24h) for the API
  const pickerTo24h = ({ hour, minute, ampm }) => {
    let h = parseInt(hour, 10);
    if (ampm === 'AM' && h === 12) h = 0;
    if (ampm === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2, '0')}:${minute}`;
  };

  // Working Hours Settings - should match HR dashboard settings
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
    currentShift: 'day'
  });

  // Helper function to parse check-in time
  const parseCheckIn = (checkInValue) => {
    if (!checkInValue) return null;
    
    try {
      let timeString = checkInValue;
      
      // If it's a full datetime string, extract just the time part
      if (timeString.includes('T') || timeString.includes(' ')) {
        const date = new Date(timeString);
        timeString = date.toTimeString().split(' ')[0]; // Gets HH:mm:ss
      }
      
      const [h, m] = timeString.split(':').map(Number);
      return { h, m };
    } catch (error) {
      console.error('Error parsing check-in time:', error);
      return null;
    }
  };

  // Helper function to check if entry is late
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
    
    return checkInMinutes > lateThresholdMinutes;
  };

  // Helper function to check if should mark as half day
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
    
    return checkInMinutes > halfDayThresholdMinutes;
  };

  useEffect(() => {
    // Initialize with safe defaults to prevent render errors
    const initializeComponent = async () => {
      try {
      // Sync working hours configuration first and ensure it's broadcast to other components
      const configFromSync = syncWorkingHoursConfig();
      setWorkingHours(configFromSync);
      
      // Broadcast configuration to other components
      window.dispatchEvent(new CustomEvent('workingHoursConfigUpdated', { 
        detail: configFromSync 
      }));
      
      // Load current user data immediately - check both possible keys
      const userDataString = localStorage.getItem('user') || localStorage.getItem('user_data') || '{}';
      let userData = {};
      
      try {
        userData = JSON.parse(userDataString);
      } catch (parseError) {
        console.error('Error parsing user data:', parseError);
        userData = {};
      }
      
      const token = localStorage.getItem('access_token');
      
      setCurrentUser(userData || {});
      console.log('Loaded user data:', userData);
      console.log('Token exists:', !!token);
      console.log('Data source:', localStorage.getItem('user') ? 'user key' : localStorage.getItem('user_data') ? 'user_data key' : 'none');
      
      // Validate user authentication on load
      if (!token) {
        setError('No authentication token found. Please login again.');
        setLoading(false);
        return;
      }
      
      // Check if user data has valid ID fields (prioritizing id field first)
      const hasValidUserId = userData?.id || 
                            userData?._id || 
                            userData?.user_id || 
                            userData?.username || 
                            userData?.employee_id ||
                            userData?.email;
      
      if (!hasValidUserId && Object.keys(userData).length > 0) {
        console.warn('No valid user ID found in user data');
        setError('User session invalid. Please logout and login again.');
      }
      
      // Update current time every second
      const timer = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);

      // Load real attendance data
      fetchAttendanceData();

      // Get user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
            console.log('Location obtained:', position.coords);
          },
          (error) => {
            console.log('Location access denied:', error);
          }
        );
      }
      
      // Listen for working hours configuration updates from other components
      const handleConfigUpdate = (event) => {
        if (event.detail) {
          setWorkingHours(prev => ({ ...prev, ...event.detail }));
          console.log('[MyAttendance] Received working hours config update:', event.detail);
          // Re-fetch and reprocess attendance data
          fetchAttendanceData();
        }
      };
      
      window.addEventListener('workingHoursConfigUpdated', handleConfigUpdate);

      return () => {
        clearInterval(timer);
        window.removeEventListener('workingHoursConfigUpdated', handleConfigUpdate);
      };
      } catch (error) {
        console.error('Error in useEffect:', error);
        setError('An error occurred while initializing the page. Please refresh and try again.');
        setLoading(false);
      }
    };
    
    // Call the async initialization function
    initializeComponent();
  }, []);

  // Re-fetch data when month or year changes
  useEffect(() => {
    if (currentUser && (currentUser.id || currentUser._id || currentUser.user_id)) {
      fetchAttendanceData();
    }
  }, [selectedMonth, selectedYear]);

  // ── HR/Admin: check role and load data ──
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('user_data') || '{}');
    const allRoles = [];
    if (user.role) allRoles.push(String(user.role).toLowerCase());
    if (user.roles) {
      const roles = Array.isArray(user.roles) ? user.roles : [user.roles];
      roles.forEach(r => {
        if (typeof r === 'string') allRoles.push(r.toLowerCase());
        else if (r?.name) allRoles.push(r.name.toLowerCase());
        else if (r?.id) allRoles.push(r.id.toLowerCase());
      });
    }
    const adminRoles = ['admin', 'administrator', 'hr', 'hr_admin', 'hr_manager', 'human_resources'];
    const isAdmin = allRoles.some(r => adminRoles.includes(r));
    setIsHRAdmin(isAdmin);
    if (isAdmin) {
      fetchHREmployees();
      fetchAdminAttendance();
    }
  }, []);

  // ── HR/Admin: re-fetch when filter/page changes ──
  useEffect(() => {
    if (isHRAdmin) fetchAdminAttendance();
  }, [isHRAdmin, adminFilter, adminPage]);

  const fetchHREmployees = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('http://localhost:8000/api/auth/users?limit=200', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHREmployees(Array.isArray(data) ? data : data.users || []);
      }
    } catch {}
  };

  const fetchAdminAttendance = async () => {
    setAdminLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams({ page: adminPage, limit: 100 });
      if (adminFilter.employee_id) params.append('employee_id', adminFilter.employee_id);
      if (adminFilter.start_date) params.append('start_date', adminFilter.start_date);
      if (adminFilter.end_date) params.append('end_date', adminFilter.end_date);
      if (adminFilter.status) params.append('status', adminFilter.status);
      const res = await fetch(`http://localhost:8000/api/attendance/admin/all?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAdminRecords(data.data || []);
          setAdminTotal(data.pagination?.total_records || 0);
        }
      }
    } catch {}
    setAdminLoading(false);
  };

  const handleMarkAttendance = async () => {
    if (!markForm.employee_id) { alert('Please select an employee'); return; }
    setIsMarking(true);
    try {
      const token = localStorage.getItem('access_token');
      const payload = {
        employee_id: markForm.employee_id,
        attendance_date: markForm.attendance_date,
        status: markForm.status,
        notes: markForm.notes,
      };
      const timeStatuses = ['present', 'late', 'half_day'];
      if (timeStatuses.includes(markForm.status)) {
        const cin = pickerTo24h(checkinPicker);
        const cout = pickerTo24h(checkoutPicker);
        payload.checkin_time = `${markForm.attendance_date}T${cin}:00`;
        payload.checkout_time = `${markForm.attendance_date}T${cout}:00`;
      }
      const res = await fetch('http://localhost:8000/api/attendance/admin/mark-attendance', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowMarkModal(false);
        setMarkForm({ employee_id: '', attendance_date: new Date().toISOString().split('T')[0], status: 'present', checkin_time: '', checkout_time: '', notes: '' });
        fetchAdminAttendance();
      } else {
        alert(data.detail || 'Failed to mark attendance');
      }
    } catch { alert('Failed to mark attendance'); }
    setIsMarking(false);
  };

  const STATUS_COLORS_HR = {
    present: 'bg-green-100 text-green-800',
    absent: 'bg-red-100 text-red-800',
    late: 'bg-yellow-100 text-yellow-800',
    half_day: 'bg-orange-100 text-orange-800',
    leave: 'bg-blue-100 text-blue-800',
  };
  const statusLabelHR = s => ({ present: 'Present', absent: 'Absent', late: 'Late', half_day: 'Half Day', leave: 'On Leave' }[s] || s || '—');
  const fmtTimeHR = v => { try { return v ? new Date(v).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'; } catch { return '-'; } };
  const fmtDateHR = v => { try { return v ? new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'; } catch { return String(v); } };



  // Fetch attendance data from API
  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('access_token');
      const userData = JSON.parse(localStorage.getItem('user') || localStorage.getItem('user_data') || '{}');
      setCurrentUser(userData);
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Get user ID from multiple possible fields
      const userId = userData?.id || 
                     userData?._id || 
                     userData?.user_id || 
                     userData?.username || 
                     userData?.employee_id ||
                     userData?.email;
      
      console.log('User data fields available:', Object.keys(userData || {}));
      console.log('Attempting to use userId:', userId);
      console.log('Full user data:', userData);
      
      if (!userId) {
        throw new Error('User ID not found. Available data: ' + JSON.stringify(Object.keys(userData || {})));
      }

      // Get today's attendance status using new attendance API
      try {
        const todayResponse = await fetch(
          `${API_URL}/api/attendance/today-status`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (todayResponse.ok) {
          const todayData = await todayResponse.json();
          console.log('[DEBUG] Today data:', todayData);
          
          if (todayData.success && todayData.data) {
            const todayStatus = todayData.data;
            const todayRecord = {
              id: todayStatus.record?._id || `today-${Date.now()}`,
              date: todayStatus.date,
              checkIn: todayStatus.checkin_time ? new Date(todayStatus.checkin_time).toLocaleTimeString() : null,
              checkOut: todayStatus.checkout_time ? new Date(todayStatus.checkout_time).toLocaleTimeString() : null,
              workingHours: todayStatus.working_hours ? `${todayStatus.working_hours}h` : null,
              status: todayStatus.has_checkedin ? 'Present' : 'Absent',
              location: todayStatus.record?.location?.address || 'Office'
            };
            setTodayRecord(todayRecord);
            
            // Determine current status based on check-in/out times
            if (todayStatus.has_checkedin && !todayStatus.has_checkedout) {
              setCurrentStatus('checked-in');
            } else if (todayStatus.has_checkedin && todayStatus.has_checkedout) {
              setCurrentStatus('checked-out');
            } else {
              setCurrentStatus('checked-out');
            }
          } else {
            setCurrentStatus('checked-out');
            setTodayRecord(null);
          }
        }
      } catch (todayError) {
        console.warn('Could not fetch today status:', todayError);
        setCurrentStatus('checked-out');
        setTodayRecord(null);
      }

      // Fetch attendance records using the new attendance API
      const response = await fetch(
        `${API_URL}/api/attendance/my-records?month=${selectedMonth}&year=${selectedYear}&limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        
        // Try to parse as JSON, fallback to text
        let errorMessage = 'Unknown error occurred';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorData.message || 'Failed to fetch attendance data';
        } catch (parseError) {
          // If response is HTML (404 page), provide a more specific error
          if (errorText.includes('<!doctype') || errorText.includes('<html>')) {
            errorMessage = 'API endpoint not found. Please check if the server is running correctly.';
          } else {
            errorMessage = errorText || 'Failed to fetch attendance data';
          }
        }
        
        throw new Error(`${response.status}: ${errorMessage}`);
      }

      const data = await response.json();
      console.log('Attendance data:', data);

      if (data.success && data.data) {
        const records = data.data.map(record => {
          // Extract check-in time in original format for status determination
          const rawCheckIn = record.checkin_time;
          const rawCheckOut = record.checkout_time;
          
          // Format times for display
          const formattedCheckIn = rawCheckIn ? new Date(rawCheckIn).toLocaleTimeString() : null;
          const formattedCheckOut = rawCheckOut ? new Date(rawCheckOut).toLocaleTimeString() : null;
          
          // Determine status using raw check-in time and working hours config
          const determinedStatus = determineAttendanceStatus(
            rawCheckIn,
            rawCheckOut,
            record.status
          );
          
          console.log(`[MyAttendance] Record processing: Date=${record.attendance_date}, OriginalStatus=${record.status}, DeterminedStatus=${determinedStatus}, CheckIn=${rawCheckIn}`);
          
          return {
            id: record._id || record.attendance_id || record.id,
            date: record.attendance_date || record.date,
            checkIn: formattedCheckIn,
            checkOut: formattedCheckOut,
            workingHours: record.total_working_minutes ? 
              `${Math.floor(record.total_working_minutes / 60)}h ${record.total_working_minutes % 60}m` : null,
            status: determinedStatus, // Use determined status instead of direct mapping
            location: getLocationText(record.location, record.location?.address),
            notes: record.notes || '',
            location_name: record.location?.address || record.location_name || 'Office',
            employee_name: record.employee_name || record.user_name || userData?.full_name || userData?.name || 'Employee',
            position: record.position || record.role || userData?.position || userData?.department || 'Employee'
          };
        });

        setAttendanceRecords(records);
        console.log('Processed records:', records);

        // Check today's record with multiple date formats
        const today = new Date().toISOString().split('T')[0];
        const todayRec = records.find(r => {
          // Try exact match first
          if (r.date === today) return true;
          
          // Try parsing the date if it's in different format
          try {
            const recordDate = new Date(r.date).toISOString().split('T')[0];
            return recordDate === today;
          } catch (e) {
            return false;
          }
        });
        
        console.log('Today:', today, 'Found today record:', todayRec);
        if (todayRec) {
          setTodayRecord(todayRec);
          
          if (todayRec.checkIn && !todayRec.checkOut) {
            setCurrentStatus('checked-in');
          } else {
            setCurrentStatus('checked-out');
          }
        }

        // Calculate summary from records since new API might not include it
        const summary = calculateAttendanceSummary(records);
        setAttendanceSummary(summary);
      } else {
        console.log('No data found or success false');
        setAttendanceRecords([]);
        setTodayRecord(null);
      }
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setError(err.message);
      setAttendanceRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate attendance summary
  const calculateAttendanceSummary = (records) => {
    // Process records with automatic status determination
    const processedRecords = records.map(record => {
      const originalStatus = record.status;
      const determinedStatus = determineAttendanceStatus(
        record.checkIn || record.check_in,
        record.checkOut || record.check_out,
        originalStatus
      );
      
      return {
        ...record,
        status: determinedStatus,
        original_status: originalStatus
      };
    });
    
    console.log('[MyAttendance] Processed records with auto status:', processedRecords);
    
    // Calculate actual working days for the current month
    const currentDate = new Date();
    const year = selectedYear || currentDate.getFullYear();
    const month = selectedMonth || (currentDate.getMonth() + 1);
    
    // Get the number of days in the month
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Calculate working days (excluding weekends)
    let workingDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      // Count Monday to Friday (1-5) as working days, exclude Saturday (6) and Sunday (0)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDays++;
      }
    }
    
    // Count actual attendance statuses using processed records
    const presentDays = processedRecords.filter(r => 
      r.status === 'Present' || r.status === 'present'
    ).length;
    
    const lateDays = processedRecords.filter(r => 
      r.status === 'Late' || r.status === 'late'
    ).length;
    
    const halfDays = processedRecords.filter(r => 
      r.status === 'Half Day' || r.status === 'half_day' || r.status === 'halfday'
    ).length;
    
    // Absent days = working days - present days - late days - half days
    const absentDays = Math.max(0, workingDays - presentDays - lateDays - halfDays);
    
    // Calculate total working hours
    let totalMinutes = 0;
    records.forEach(record => {
      if (record.workingHours && typeof record.workingHours === 'string') {
        // Extract hours from string like "8h 30m" or "8h"
        const hoursMatch = record.workingHours.match(/(\d+)h/);
        const minutesMatch = record.workingHours.match(/(\d+)m/);
        
        const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
        const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
        
        totalMinutes += (hours * 60) + minutes;
      } else if (record.working_hours && typeof record.working_hours === 'number') {
        // Handle numeric working hours (in hours)
        totalMinutes += Math.floor(record.working_hours * 60);
      }
    });
    
    const totalHours = Math.floor(totalMinutes / 60);
    const totalMins = totalMinutes % 60;
    
    // Calculate average working hours per working day (including half days)
    const totalWorkingDaysWithHours = presentDays + lateDays + halfDays;
    const avgHours = totalWorkingDaysWithHours > 0 ? Math.floor(totalMinutes / totalWorkingDaysWithHours / 60) : 0;
    const avgMins = totalWorkingDaysWithHours > 0 ? Math.floor((totalMinutes / totalWorkingDaysWithHours) % 60) : 0;
    
    // Calculate effective attendance (half days count as 0.5)
    const effectiveAttendance = presentDays + lateDays + (halfDays * 0.5);
    
    return {
      totalWorkingDays: workingDays,
      presentDays: presentDays,
      absentDays: absentDays,
      lateDays: lateDays,
      halfDays: halfDays,
      totalWorkingHours: `${totalHours}h ${totalMins}m`,
      averageWorkingHours: `${avgHours}h ${avgMins}m`,
      attendancePercentage: workingDays > 0 ? Math.round((effectiveAttendance / workingDays) * 100) : 0
    };
  };

  // Handle check in/out
  const handleCheckInOut = async () => {
    setCheckingIn(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Get fresh user data from localStorage first - check both possible keys
      const freshUserData = JSON.parse(localStorage.getItem('user') || localStorage.getItem('user_data') || '{}');
      console.log('Fresh user data from localStorage:', freshUserData);
      console.log('Fresh user data keys:', Object.keys(freshUserData));
      console.log('Data source:', localStorage.getItem('user') ? 'user key' : localStorage.getItem('user_data') ? 'user_data key' : 'none');
      
      // Update current user if fresh data is available
      if (Object.keys(freshUserData).length > 0) {
        setCurrentUser(freshUserData);
      }
      
      // Use fresh data or current user data
      const userData = Object.keys(freshUserData).length > 0 ? freshUserData : currentUser;
      console.log('Using user data:', userData);
      console.log('Available user fields:', Object.keys(userData || {}));
      
      // Try multiple fields to get user ID, prioritizing id then _id
      const userId = userData?.id || 
                     userData?._id || 
                     userData?.user_id || 
                     userData?.username || 
                     userData?.employee_id ||
                     userData?.full_name ||
                     userData?.name ||
                     userData?.email;
      
      console.log('Resolved user ID:', userId);
      
      if (!userId) {
        throw new Error('User identification failed. Please logout and login again to refresh your session.');
      }

      const isCheckIn = currentStatus === 'checked-out';
      
      // Get current location
      let currentLocation = null;
      try {
        currentLocation = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            resolve(null);
            return;
          }

          const timeoutId = setTimeout(() => {
            reject(new Error('Location request timeout'));
          }, 10000);

          navigator.geolocation.getCurrentPosition(
            (position) => {
              clearTimeout(timeoutId);
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
              });
            },
            (error) => {
              clearTimeout(timeoutId);
              console.warn('Location error:', error);
              resolve(null);
            },
            {
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 30000
            }
          );
        });
      } catch (locationError) {
        console.warn('Could not get location:', locationError);
        currentLocation = null;
      }
      
      const requestPayload = {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        location: currentLocation ? {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          address: 'Current Location' // You might want to get actual address
        } : undefined,
        source: 'manual',
        device_id: 'web_browser',
        notes: isCheckIn ? 'Check-in from web dashboard' : 'Check-out from web dashboard'
      };
      
      console.log('Request payload:', requestPayload);

      // Use new attendance API endpoints
      const endpoint = isCheckIn ? 'checkin' : 'checkout';
      const response = await fetch(`${API_URL}/api/attendance/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Check-in/out error response:', errorData);
        
        // Handle specific error cases
        if (response.status === 401) {
          throw new Error('Authentication expired. Please logout and login again.');
        } else if (response.status === 403) {
          throw new Error('Access denied. Please check your permissions.');
        } else if (response.status === 400) {
          throw new Error(errorData.detail || 'Invalid request. Please check your data and try again.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later or contact support.');
        }
        
        throw new Error(errorData.detail || `Failed to ${isCheckIn ? 'check in' : 'check out'}`);
      }

      const result = await response.json();
      console.log('Success result:', result);

      if (result.success || response.ok) {
        // Update status immediately
        setCurrentStatus(isCheckIn ? 'checked-in' : 'checked-out');
        
        // Show success message
        const message = isCheckIn ? 'Successfully checked in!' : 
          `Successfully checked out! ${result.working_hours ? `Working hours: ${result.working_hours}h` : ''}`;
        
        // Update today's record
        const today = new Date().toISOString().split('T')[0];
        const newRecord = {
          id: result.data?._id || result.data?.attendance_id || `temp-${Date.now()}`,
          date: today,
          checkIn: isCheckIn ? new Date().toLocaleTimeString() : todayRecord?.checkIn || null,
          checkOut: !isCheckIn ? new Date().toLocaleTimeString() : null,
          workingHours: result.working_hours ? `${result.working_hours}h` : null,
          status: 'Present',
          location: currentLocation?.address || 'Office',
          notes: requestPayload.notes
        };
        setTodayRecord(newRecord);
        
        // Refresh attendance data to get latest records
        setTimeout(() => {
          fetchAttendanceData();
        }, 1000);
        
        console.log(message);
      } else {
        throw new Error(result.message || result.detail || 'Operation failed');
      }
      
    } catch (error) {
      console.error('Check in/out error:', error);
      
      // Provide specific guidance based on error type
      let errorMessage = error.message;
      
      if (error.message.includes('User identification failed') || 
          error.message.includes('Authentication expired') ||
          error.message.includes('session')) {
        errorMessage = `${error.message}\n\nSteps to resolve:\n1. Click the logout button\n2. Login again with your credentials\n3. Try checking in/out again`;
      } else if (error.message.includes('User ID not found')) {
        errorMessage = 'Unable to identify your account. Please refresh the page or logout and login again.';
      }
      
      setError(errorMessage);
    } finally {
      setCheckingIn(false);
    }
  };

  // Calculate working hours
  const calculateWorkingHours = (checkInTime, checkOutTime) => {
    const checkIn = new Date(`2000-01-01 ${checkInTime}`);
    const checkOut = new Date(`2000-01-01 ${checkOutTime}`);
    const diff = checkOut - checkIn;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Export attendance report
  const exportAttendanceReport = async () => {
    try {
      setExporting(true);
      const token = localStorage.getItem('access_token');
      const userData = JSON.parse(localStorage.getItem('user') || localStorage.getItem('user_data') || '{}');
      
      if (!token) {
        setError('Please login again to export report');
        return;
      }

      const userId = userData?.id || userData?._id || userData?.user_id || userData?.username || userData?.employee_id;
      
      if (!userId) {
        setError('User ID not found. Please login again.');
        return;
      }

      // Fetch data to export
      const response = await fetch(
        `${API_URL}/api/attendance/my-records?month=${selectedMonth}&year=${selectedYear}&limit=1000`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Export API Error Response:', errorText);
        
        let errorMessage = 'Failed to fetch data for export';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (parseError) {
          if (errorText.includes('<!doctype') || errorText.includes('<html>')) {
            errorMessage = 'API endpoint not found. Please check if the server is running correctly.';
          } else {
            errorMessage = errorText || errorMessage;
          }
        }
        
        throw new Error(`${response.status}: ${errorMessage}`);
      }

      const data = await response.json();
      
      if (data.success && data.data && data.data.length > 0) {
        // Convert attendance records to CSV format
        const exportData = data.data.map(record => ({
          Date: record.date || '-',
          'Check In': record.check_in || '-',
          'Check Out': record.check_out || '-',
          'Working Hours': record.working_hours ? `${Math.floor(record.working_hours)}h ${Math.round((record.working_hours % 1) * 60)}m` : '-',
          Status: record.status || '-',
          Location: record.location || '-',
          Notes: record.notes || '-'
        }));
        
        // Convert data to CSV format
        const csvContent = convertToCSV(exportData);
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
          const url = URL.createObjectURL(blob);
          const filename = `attendance_${userData?.name || 'employee'}_${selectedMonth}_${selectedYear}.csv`;
          link.setAttribute('href', url);
          link.setAttribute('download', filename);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        
        console.log('Report exported successfully');
      } else {
        throw new Error('No data available to export');
      }
    } catch (error) {
      console.error('Export error:', error);
      setError(`Failed to export report: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Helper function to convert data to CSV
  const convertToCSV = (data) => {
    if (!data || data.length === 0) {
      return 'No data available';
    }
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => 
      headers.map(header => {
        const value = row[header] || '';
        // Escape commas and quotes in CSV
        return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
          ? `"${value.replace(/"/g, '""')}"` 
          : value;
      }).join(',')
    );
    
    return [csvHeaders, ...csvRows].join('\n');
  };

  // Get status color and icon with dynamic late entry checking
  const getStatusConfig = (status, checkInTime = null) => {
    if (!status || typeof status !== 'string') {
      status = 'Present'; // Default status
    }
    
    let configs = {
      'Present': { color: 'text-green-600 bg-green-100', icon: faCheckCircle, label: 'Present' },
      'present': { color: 'text-green-600 bg-green-100', icon: faCheckCircle, label: 'Present' },
      'Late': { color: 'text-yellow-600 bg-yellow-100', icon: faExclamationTriangle, label: 'Late' },
      'late': { color: 'text-yellow-600 bg-yellow-100', icon: faExclamationTriangle, label: 'Late' },
      'Half Day': { color: 'text-orange-600 bg-orange-100', icon: faHourglass, label: 'Half Day' },
      'half_day': { color: 'text-orange-600 bg-orange-100', icon: faHourglass, label: 'Half Day' },
      'halfday': { color: 'text-orange-600 bg-orange-100', icon: faHourglass, label: 'Half Day' },
      'Absent': { color: 'text-red-600 bg-red-100', icon: faTimesCircle, label: 'Absent' },
      'absent': { color: 'text-red-600 bg-red-100', icon: faTimesCircle, label: 'Absent' },
      'Holiday': { color: 'text-blue-600 bg-blue-100', icon: faCalendarAlt, label: 'Holiday' }
    };
    
    let config = configs[status] || configs['Present'];
    
    // Apply dynamic status modifications for 'present' status based on check-in time
    if ((status.toLowerCase() === 'present') && checkInTime) {
      // Check if it's a late entry
      if (isLateEntry(checkInTime)) {
        config = {
          color: 'text-orange-600 bg-orange-100',
          icon: faExclamationTriangle,
          label: 'Present (Late)'
        };
      }
      
      // Check if it should be marked as half day (takes precedence over just late)
      if (shouldMarkHalfDay(checkInTime)) {
        config = {
          color: 'text-yellow-600 bg-yellow-100',
          icon: faHourglass,
          label: 'Half Day (Late Entry)'
        };
      }
    }
    
    return config;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your attendance data...</p>
        </div>
      </div>
    );
  }

  // Safety check to prevent rendering errors
  const safeCurrentStatus = currentStatus || 'checked-out';
  const safeAttendanceSummary = attendanceSummary || {
    totalWorkingDays: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    totalWorkingHours: '0h 0m',
    averageWorkingHours: '0h 0m'
  };
  const safeAttendanceRecords = Array.isArray(attendanceRecords) ? attendanceRecords : [];
  const safeCurrentTime = currentTime || new Date();

  // Filter records with safety checks
  const filteredRecords = safeAttendanceRecords.filter(record => {
    if (!record || !record.date) return false;
    try {
      const recordDate = new Date(record.date);
      if (isNaN(recordDate.getTime())) return false;
      const matchesMonth = recordDate.getMonth() + 1 === parseInt(selectedMonth);
      const matchesYear = recordDate.getFullYear() === parseInt(selectedYear);
      const matchesSearch = (record.status || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
                           (record.notes || '').toLowerCase().includes((searchTerm || '').toLowerCase());
      return matchesMonth && matchesYear && matchesSearch;
    } catch (error) {
      console.warn('Error filtering record:', record, error);
      return false;
    }
  }).map(record => {
    // Apply automatic status determination to each record
    const originalStatus = record.status;
    const determinedStatus = determineAttendanceStatus(
      record.checkIn || record.check_in,
      record.checkOut || record.check_out,
      originalStatus
    );
    
    return {
      ...record,
      status: determinedStatus,
      original_status: originalStatus
    };
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6 pb-20">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          <div className="flex items-start">
            <FontAwesomeIcon icon={faExclamationTriangle} className="mr-3 mt-1 flex-shrink-0" />
            <div className="flex-grow">
              <div className="font-medium mb-1">Attendance Error</div>
              <div className="text-sm whitespace-pre-line">{error}</div>
              {(error.includes('login') || error.includes('session') || error.includes('authentication')) && (
                <div className="mt-3 flex space-x-2">
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm"
                  >
                    Refresh Page
                  </button>
                  <button 
                    onClick={() => {
                      localStorage.clear();
                      window.location.href = '/login';
                    }}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                  >
                    Logout & Login Again
                  </button>
                </div>
              )}
            </div>
            <button 
              onClick={() => setError(null)}
              className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-lg shadow-lg mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faClock} className="text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">My Attendance</h1>
              <p className="text-blue-100 text-sm">Track your daily attendance and working hours</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isHRAdmin && (
              <button
                onClick={() => setShowMarkModal(true)}
                className="flex items-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-lg font-semibold text-sm shadow"
              >
                <span>+</span> Mark Employee Attendance
              </button>
            )}
            <div className="text-right">
              <p className="text-sm text-blue-100">Current Time</p>
              <p className="text-lg font-semibold">{safeCurrentTime.toLocaleTimeString()}</p>
              <p className="text-sm text-blue-100">{safeCurrentTime.toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Check In/Out Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Check In/Out Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
              safeCurrentStatus === 'checked-in' ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <FontAwesomeIcon 
                icon={safeCurrentStatus === 'checked-in' ? faStop : faPlay} 
                className={`text-3xl ${
                  safeCurrentStatus === 'checked-in' ? 'text-green-600' : 'text-gray-600'
                }`}
              />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {safeCurrentStatus === 'checked-in' ? 'Currently Checked In' : 'Ready to Check In'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {safeCurrentStatus === 'checked-in' 
                ? `Checked in at: ${todayRecord?.checkIn || 'N/A'}`
                : 'Click the button below to mark your attendance'
              }
            </p>
            
            {/* Show message if already checked in today */}
            {safeCurrentStatus === 'checked-out' && todayRecord && todayRecord.checkIn && !checkingIn && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
                  You have already checked in today at {todayRecord.checkIn}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  You can only check out now
                </p>
              </div>
            )}
            
            <button
              onClick={handleCheckInOut}
              disabled={checkingIn || (safeCurrentStatus === 'checked-out' && todayRecord && todayRecord.checkIn && !todayRecord.checkOut)}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                (currentStatus || 'checked-out') === 'checked-in'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : (todayRecord && todayRecord.checkIn && !todayRecord.checkOut)
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
              } ${checkingIn ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {checkingIn ? (
                <span>Processing...</span>
              ) : (todayRecord && todayRecord.checkIn && !todayRecord.checkOut && safeCurrentStatus === 'checked-out') ? (
                <span>
                  <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
                  Already Checked In Today
                </span>
              ) : (
                <span>
                  <FontAwesomeIcon 
                    icon={(currentStatus || 'checked-out') === 'checked-in' ? faStop : faPlay} 
                    className="mr-2" 
                  />
                  {(currentStatus || 'checked-out') === 'checked-in' ? 'Check Out' : 'Check In'}
                </span>
              )}
            </button>
           
          </div>
        </div>

        {/* Today's Status */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Status</h3>
          {Boolean(todayRecord) ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusConfig(todayRecord?.status || 'Present', todayRecord?.checkIn).color}`}>
                  <FontAwesomeIcon icon={getStatusConfig(todayRecord?.status || 'Present', todayRecord?.checkIn).icon} className="mr-1" />
                  <SafeText>{getStatusConfig(todayRecord?.status || 'Present', todayRecord?.checkIn).label}</SafeText>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Check In</span>
                <span className="text-sm font-medium"><SafeText>{todayRecord?.checkIn || 'Not yet'}</SafeText></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Check Out</span>
                <span className="text-sm font-medium"><SafeText>{todayRecord?.checkOut || 'Not yet'}</SafeText></span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Working Hours</span>
                <span className="text-sm font-medium"><SafeText>{todayRecord?.workingHours || 'In progress'}</SafeText></span>
              </div>
              {Boolean(todayRecord?.location || todayRecord?.location_name) && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Location</span>
                  <span className="text-sm font-medium flex items-center">
                    <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-1 text-gray-400" />
                    <SafeText>{getLocationText(todayRecord?.location, todayRecord?.location_name)}</SafeText>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-4">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl mb-3 text-gray-400" />
              <p className="text-lg font-medium">No attendance record for today</p>
              <p className="text-sm text-gray-400 mt-1">
                <SafeDateFormat 
                  date={new Date()} 
                  options={{
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  }}
                />
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Click "Check In" to mark your attendance
              </p>
            </div>
          )}
        </div>
        
        {/* Monthly Summary */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">This Month Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Working Days</span>
              <span className="text-sm font-bold text-blue-600">{attendanceSummary?.totalWorkingDays || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Present Days</span>
              <span className="text-sm font-bold text-green-600">{attendanceSummary?.presentDays || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Absent Days</span>
              <span className="text-sm font-bold text-red-600">{attendanceSummary?.absentDays || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Late Days</span>
              <span className="text-sm font-bold text-yellow-600">{attendanceSummary?.lateDays || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Half Days</span>
              <span className="text-sm font-bold text-orange-600">{attendanceSummary?.halfDays || 0}</span>
            </div>
            <div className="border-t pt-3 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Attendance %</span>
                <span className="text-sm font-bold text-blue-600">
                  {attendanceSummary?.attendancePercentage || 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
        {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Hours</p>
              <p className="text-2xl font-bold text-blue-600">{attendanceSummary?.totalWorkingHours || '0h 0m'}</p>
            </div>
            <FontAwesomeIcon icon={faBusinessTime} className="text-2xl text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Hours</p>
              <p className="text-2xl font-bold text-green-600">{attendanceSummary?.averageWorkingHours || '0h 0m'}</p>
            </div>
            <FontAwesomeIcon icon={faHourglass} className="text-2xl text-green-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Present Days</p>
              <p className="text-2xl font-bold text-green-600">{attendanceSummary?.presentDays || 0}</p>
            </div>
            <FontAwesomeIcon icon={faCheckCircle} className="text-2xl text-green-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
              <p className="text-2xl font-bold text-blue-600">
                {(() => {
                  const totalDays = attendanceSummary?.totalWorkingDays || 0;
                  const presentDays = attendanceSummary?.presentDays || 0;
                  const lateDays = attendanceSummary?.lateDays || 0;
                  
                  if (totalDays === 0) return '0';
                  
                  // Calculate rate considering late days as 0.5 attendance
                  const effectivePresent = presentDays + (lateDays * 0.5);
                  const rate = Math.round((effectivePresent / totalDays) * 100);
                  
                  return rate;
                })()}%
              </p>
            </div>
            <FontAwesomeIcon icon={faChartBar} className="text-2xl text-blue-500" />
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
              placeholder="Search records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>

          {/* Month Filter */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({length: 12}, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2025, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>

          {/* Year Filter */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: new Date().getFullYear() + 2 - 2023 + 1 }, (_, i) => new Date().getFullYear() + 2 - i).map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>

          {/* Export Button */}
          <button 
            onClick={exportAttendanceReport}
            disabled={exporting}
            className={`ml-auto px-4 py-2 ${
              exporting 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white rounded-lg transition-colors flex items-center`}
          >
            <FontAwesomeIcon 
              icon={exporting ? faHourglass : faDownload} 
              className={`mr-2 ${exporting ? 'animate-spin' : ''}`} 
            />
            {exporting ? 'Exporting...' : 'Export Report'}
          </button>
        </div>
      </div>

      {/* Attendance Records Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Attendance Records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Working Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRecords.map((record) => {
                if (!record) return null;
                return (
                <tr key={record.id || record._id || Math.random()} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        <SafeDateFormat 
                          date={record.date} 
                          options={{
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }}
                          fallback="-"
                        />
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <FontAwesomeIcon icon={faUser} className="text-blue-600 text-sm" />
                        </div>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          <SafeText>{record.employee_name || record.user_name || 'Unknown'}</SafeText>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600">
                      <SafeText>{record.position || record.role || 'Employee'}</SafeText>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      <SafeText>{record.checkIn}</SafeText>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      <SafeText>{record.checkOut}</SafeText>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      <SafeText>{record.workingHours}</SafeText>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusConfig(record.status || 'Present', record.checkIn).color}`}>
                      <FontAwesomeIcon icon={getStatusConfig(record.status || 'Present', record.checkIn).icon} className="mr-1" />
                      <SafeText>{getStatusConfig(record.status || 'Present', record.checkIn).label}</SafeText>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {record.location ? (
                        <span className="flex items-center">
                          <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-1 text-gray-400" />
                          <SafeText>{record.location}</SafeText>
                        </span>
                      ) : (
                        '-'
                      )}
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── HR/Admin: All Employees Attendance ── */}
      {isHRAdmin && (
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">All Employees Attendance</h2>

          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <select
              value={adminFilter.employee_id}
              onChange={e => { setAdminFilter(f => ({ ...f, employee_id: e.target.value })); setAdminPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm col-span-2 md:col-span-1"
            >
              <option value="">All Employees</option>
              {hrEmployees.map(emp => (
                <option key={emp.user_id || emp.id} value={emp.user_id || emp.id}>
                  {emp.full_name || emp.username}
                </option>
              ))}
            </select>
            <input type="date" value={adminFilter.start_date}
              onChange={e => { setAdminFilter(f => ({ ...f, start_date: e.target.value })); setAdminPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input type="date" value={adminFilter.end_date}
              onChange={e => { setAdminFilter(f => ({ ...f, end_date: e.target.value })); setAdminPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <select value={adminFilter.status}
              onChange={e => { setAdminFilter(f => ({ ...f, status: e.target.value })); setAdminPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">All Statuses</option>
              {['present','absent','late','half_day','leave'].map(s => (
                <option key={s} value={s}>{statusLabelHR(s)}</option>
              ))}
            </select>
          </div>

          {adminLoading ? (
            <div className="text-center py-8 text-gray-400">Loading…</div>
          ) : adminRecords.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
                      <th className="px-4 py-3 text-left">Employee</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Check In</th>
                      <th className="px-4 py-3 text-left">Check Out</th>
                      <th className="px-4 py-3 text-left">Hours</th>
                      <th className="px-4 py-3 text-left">Source</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {adminRecords.map((rec, idx) => (
                      <tr key={rec._id || idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">
                          {rec.employee_name || rec.employee_id}
                          {rec.employee_department && <span className="block text-xs text-gray-400">{rec.employee_department}</span>}
                        </td>
                        <td className="px-4 py-3">{fmtDateHR(rec.attendance_date || rec.date)}</td>
                        <td className="px-4 py-3">{fmtTimeHR(rec.checkin_time || rec.check_in)}</td>
                        <td className="px-4 py-3">{fmtTimeHR(rec.checkout_time || rec.check_out)}</td>
                        <td className="px-4 py-3">{rec.working_hours ? `${rec.working_hours}h` : '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 capitalize">{(rec.source || '—').replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS_HR[rec.status] || 'bg-gray-100 text-gray-700'}`}>
                            {statusLabelHR(rec.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {Math.ceil(adminTotal / 100) > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm">
                  <span className="text-gray-500">{adminTotal} total records</span>
                  <div className="flex gap-2">
                    <button disabled={adminPage === 1} onClick={() => setAdminPage(p => p - 1)}
                      className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50">←</button>
                    <span className="px-3 py-1">{adminPage} / {Math.ceil(adminTotal / 100)}</span>
                    <button disabled={adminPage === Math.ceil(adminTotal / 100)} onClick={() => setAdminPage(p => p + 1)}
                      className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50">→</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">No records found for the selected filters</div>
          )}
        </div>
      )}

      {/* ── Mark Attendance Modal ── */}
      {showMarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-800">Mark Employee Attendance</h3>
              <button onClick={() => setShowMarkModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Employee *</label>
                <select value={markForm.employee_id}
                  onChange={e => setMarkForm(f => ({ ...f, employee_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select employee…</option>
                  {hrEmployees.map(emp => (
                    <option key={emp.user_id || emp.id} value={emp.user_id || emp.id}>
                      {emp.full_name || emp.username}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Date *</label>
                <input type="date" value={markForm.attendance_date}
                  onChange={e => setMarkForm(f => ({ ...f, attendance_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Status *</label>
                <select value={markForm.status}
                  onChange={e => setMarkForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {['present','absent','late','half_day','leave'].map(s => (
                    <option key={s} value={s}>{statusLabelHR(s)}</option>
                  ))}
                </select>
              </div>
              {['present','late','half_day'].includes(markForm.status) && (
                <div className="grid grid-cols-2 gap-3">
                  {/* Check-In AM/PM picker */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Check-In</label>
                    <div className="flex gap-1">
                      <select value={checkinPicker.hour}
                        onChange={e => setCheckinPicker(p => ({ ...p, hour: e.target.value }))}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm">
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <select value={checkinPicker.minute}
                        onChange={e => setCheckinPicker(p => ({ ...p, minute: e.target.value }))}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm">
                        {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <select value={checkinPicker.ampm}
                        onChange={e => setCheckinPicker(p => ({ ...p, ampm: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-2 py-2 text-sm font-semibold">
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                  {/* Check-Out AM/PM picker */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Check-Out</label>
                    <div className="flex gap-1">
                      <select value={checkoutPicker.hour}
                        onChange={e => setCheckoutPicker(p => ({ ...p, hour: e.target.value }))}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm">
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <select value={checkoutPicker.minute}
                        onChange={e => setCheckoutPicker(p => ({ ...p, minute: e.target.value }))}
                        className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm">
                        {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <select value={checkoutPicker.ampm}
                        onChange={e => setCheckoutPicker(p => ({ ...p, ampm: e.target.value }))}
                        className="border border-gray-300 rounded-lg px-2 py-2 text-sm font-semibold">
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea value={markForm.notes}
                  onChange={e => setMarkForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Optional notes…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowMarkModal(false)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleMarkAttendance} disabled={isMarking}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white ${isMarking ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {isMarking ? 'Saving…' : 'Mark Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyAttendancePage;
