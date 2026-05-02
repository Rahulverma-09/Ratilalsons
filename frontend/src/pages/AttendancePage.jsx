import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";

const API_BASE_URL = "http://localhost:8000";

// Helper: determine if user has HR or admin role
function checkIsHRAdmin(user) {
  if (!user) return false;
  const allRoles = [];
  if (user.role) allRoles.push(String(user.role).toLowerCase());
  if (user.roles) {
    const roles = Array.isArray(user.roles) ? user.roles : [user.roles];
    roles.forEach((r) => {
      if (typeof r === "string") allRoles.push(r.toLowerCase());
      else if (r && r.name) allRoles.push(r.name.toLowerCase());
      else if (r && r.id) allRoles.push(r.id.toLowerCase());
    });
  }
  return allRoles.some((r) =>
    ["admin", "administrator", "hr", "hr_admin", "hr_manager", "human_resources"].includes(r)
  );
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const STATUS_OPTIONS = ["present", "absent", "late", "half_day", "leave"];

const STATUS_COLORS = {
  present: "bg-green-100 text-green-800",
  absent: "bg-red-100 text-red-800",
  late: "bg-yellow-100 text-yellow-800",
  half_day: "bg-orange-100 text-orange-800",
  leave: "bg-blue-100 text-blue-800",
};

const AttendancePage = () => {
  // ─── Current user / role ──────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null);
  const [isHRAdmin, setIsHRAdmin] = useState(false);

  // ─── Employee self-attendance ────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [checkInLocation, setCheckInLocation] = useState(null);
  const [checkOutLocation, setCheckOutLocation] = useState(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [geoAddress, setGeoAddress] = useState("");
  const [geoTime, setGeoTime] = useState(null);
  const [geoError, setGeoError] = useState(null);

  // ─── HR/Admin – employee list ────────────────────────────────
  const [employees, setEmployees] = useState([]);

  // ─── HR/Admin – view all records ────────────────────────────
  const [adminRecords, setAdminRecords] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminFilter, setAdminFilter] = useState({
    employee_id: "",
    start_date: new Date().toISOString().split("T")[0].slice(0, 7) + "-01",
    end_date: new Date().toISOString().split("T")[0],
    status: "",
  });
  const [adminPage, setAdminPage] = useState(1);
  const [adminTotal, setAdminTotal] = useState(0);

  // ─── HR/Admin – mark attendance modal ───────────────────────
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [markForm, setMarkForm] = useState({
    employee_id: "",
    attendance_date: new Date().toISOString().split("T")[0],
    status: "present",
    checkin_time: "",
    checkout_time: "",
    notes: "",
  });
  const [isMarking, setIsMarking] = useState(false);

  // ─── Month/year filter for employee's own records ────────────
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const today = new Date().toISOString().split("T")[0];

  // ─── Fetch current user on mount ────────────────────────────
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) { setIsLoading(false); return; }
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData);
          const hrAdmin = checkIsHRAdmin(userData);
          setIsHRAdmin(hrAdmin);
          if (hrAdmin) fetchEmployees();
          detectLocation();
        } else {
          toast.error("Failed to load user data");
        }
      } catch {
        toast.error("Error loading user data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchCurrentUser();
  }, []);

  // Fetch employee's own records when month/year changes
  useEffect(() => {
    if (currentUser) {
      const userId = currentUser.user_id || currentUser.id || currentUser._id;
      fetchMyAttendance(userId, selectedMonth, selectedYear);
    }
  }, [currentUser, selectedMonth, selectedYear]);

  // Fetch admin records when filter changes
  useEffect(() => {
    if (isHRAdmin) fetchAdminRecords();
  }, [isHRAdmin, adminFilter, adminPage]);

  // ─── Fetch employee's own attendance ─────────────────────────
  const fetchMyAttendance = async (userId, month, year) => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(
        `${API_BASE_URL}/api/attendance/my-records?month=${month}&year=${year}&limit=31`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setAttendance(data.data);
          const todayRecord = data.data.find(
            (rec) => (rec.attendance_date || rec.date) === today
          );
          setTodayAttendance(todayRecord || null);
        } else {
          setAttendance([]);
          setTodayAttendance(null);
        }
      } else {
        setAttendance([]);
        setTodayAttendance(null);
      }
    } catch {
      toast.error("Error loading attendance records");
      setAttendance([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Fetch all employees (for HR/Admin) ──────────────────────
  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE_URL}/api/auth/users?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees(Array.isArray(data) ? data : data.users || []);
      }
    } catch {
      // non-critical
    }
  };

  // ─── Fetch all records for HR/Admin ──────────────────────────
  const fetchAdminRecords = useCallback(async () => {
    setAdminLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const params = new URLSearchParams({ page: adminPage, limit: 50 });
      if (adminFilter.employee_id) params.append("employee_id", adminFilter.employee_id);
      if (adminFilter.start_date) params.append("start_date", adminFilter.start_date);
      if (adminFilter.end_date) params.append("end_date", adminFilter.end_date);
      if (adminFilter.status) params.append("status", adminFilter.status);

      const res = await fetch(`${API_BASE_URL}/api/attendance/admin/all?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAdminRecords(data.data || []);
          setAdminTotal(data.pagination?.total_records || 0);
        }
      }
    } catch {
      toast.error("Error loading attendance records");
    } finally {
      setAdminLoading(false);
    }
  }, [adminFilter, adminPage]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCheckInLocation({ latitude, longitude });
        setCheckOutLocation({ latitude, longitude });
        setGeoTime(new Date());
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { "Accept-Language": "en" } }
          );
          if (response.ok) {
            const data = await response.json();
            setGeoAddress(data.display_name || "Unknown location");
            setGeoError(null);
          } else {
            setGeoAddress(`Lat: ${latitude}, Long: ${longitude}`);
          }
        } catch {
          setGeoAddress(`Lat: ${latitude}, Long: ${longitude}`);
        }
      },
      () => setGeoError("Location permission denied or unavailable")
    );
  };

  const handleCheckIn = async () => {
    if (!checkInLocation) { toast.error("Location not detected"); return; }
    setIsCheckingIn(true);
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`${API_BASE_URL}/api/attendance/checkin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          location: {
            latitude: checkInLocation.latitude,
            longitude: checkInLocation.longitude,
            address: geoAddress,
          },
          source: "web_dashboard",
        }),
      });
      const resData = await response.json();
      if (response.ok && resData.success) {
        toast.success("Checked in successfully");
        const userId = currentUser?.user_id || currentUser?.id;
        fetchMyAttendance(userId, selectedMonth, selectedYear);
      } else {
        toast.error(resData.detail || "Check-in failed");
      }
    } catch {
      toast.error("Check-in failed");
    }
    setIsCheckingIn(false);
  };

  const handleCheckOut = async () => {
    if (!checkOutLocation) { toast.error("Location not detected"); return; }
    setIsCheckingOut(true);
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`${API_BASE_URL}/api/attendance/checkout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          location: {
            latitude: checkOutLocation.latitude,
            longitude: checkOutLocation.longitude,
            address: geoAddress,
          },
          source: "web_dashboard",
        }),
      });
      const resData = await response.json();
      if (response.ok && resData.success) {
        toast.success("Checked out successfully");
        const userId = currentUser?.user_id || currentUser?.id;
        fetchMyAttendance(userId, selectedMonth, selectedYear);
      } else {
        toast.error(resData.detail || "Check-out failed");
      }
    } catch {
      toast.error("Check-out failed");
    }
    setIsCheckingOut(false);
  };

  // ─── HR/Admin: mark attendance for an employee ───────────────
  const handleMarkAttendance = async () => {
    if (!markForm.employee_id) { toast.error("Please select an employee"); return; }
    if (!markForm.attendance_date) { toast.error("Please select a date"); return; }
    setIsMarking(true);
    try {
      const token = localStorage.getItem("access_token");
      const payload = {
        employee_id: markForm.employee_id,
        attendance_date: markForm.attendance_date,
        status: markForm.status,
        notes: markForm.notes,
      };
      if (markForm.checkin_time)
        payload.checkin_time = `${markForm.attendance_date}T${markForm.checkin_time}:00`;
      if (markForm.checkout_time)
        payload.checkout_time = `${markForm.attendance_date}T${markForm.checkout_time}:00`;

      const res = await fetch(`${API_BASE_URL}/api/attendance/admin/mark-attendance`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Attendance marked successfully");
        setShowMarkModal(false);
        setMarkForm({
          employee_id: "",
          attendance_date: today,
          status: "present",
          checkin_time: "",
          checkout_time: "",
          notes: "",
        });
        fetchAdminRecords();
      } else {
        toast.error(data.detail || "Failed to mark attendance");
      }
    } catch {
      toast.error("Failed to mark attendance");
    }
    setIsMarking(false);
  };

  // Utility for formatting time & date
  const formatTime = (val) => {
    if (!val) return "-";
    try { return new Date(val).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }); }
    catch { return "-"; }
  };
  const formatDate = (val) => {
    if (!val) return "-";
    try { return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
    catch { return val; }
  };
  const calculateDuration = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return "N/A";
    const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    if (diffMs <= 0) return "N/A";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };
  const statusLabel = (s) =>
    ({ present: "Present", absent: "Absent", late: "Late", half_day: "Half Day", leave: "On Leave" }[s] || s || "—");

  const totalAdminPages = Math.ceil(adminTotal / 50);

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-indigo-700">Attendance</h1>
          {currentUser && (
            <p className="text-sm text-gray-500 mt-0.5">
              {currentUser.full_name || currentUser.username}
              {isHRAdmin && (
                <span className="ml-2 inline-block bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  HR / Admin
                </span>
              )}
            </p>
          )}
        </div>
        {isHRAdmin && (
          <button
            onClick={() => setShowMarkModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Mark Employee Attendance
          </button>
        )}
      </div>

      {/* ── Today's Check-In / Check-Out (own) ── */}
      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Today — {formatDate(today)}</h2>

        {/* Location bar */}
        {geoError ? (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{geoError}</div>
        ) : geoAddress ? (
          <div className="flex items-center justify-between text-sm bg-green-50 text-green-700 rounded-lg px-3 py-2 mb-4">
            <span>📍 {geoAddress.slice(0, 60)}{geoAddress.length > 60 ? "…" : ""}</span>
            <button onClick={detectLocation} className="underline text-xs ml-3">Refresh</button>
          </div>
        ) : (
          <div className="text-sm text-gray-400 mb-4">Detecting location…</div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-indigo-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Status</p>
            <p className={`font-bold text-sm ${todayAttendance ? "" : "text-gray-400"}`}>
              {todayAttendance ? statusLabel(todayAttendance.status) : "—"}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Check In</p>
            <p className="font-bold text-sm text-green-700">
              {todayAttendance ? formatTime(todayAttendance.checkin_time || todayAttendance.check_in) : "—"}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">Check Out</p>
            <p className="font-bold text-sm text-purple-700">
              {todayAttendance ? formatTime(todayAttendance.checkout_time || todayAttendance.check_out) : "—"}
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          {!(todayAttendance?.checkin_time || todayAttendance?.check_in) ? (
            <button
              onClick={handleCheckIn}
              disabled={isCheckingIn || !checkInLocation}
              className={`px-6 py-2.5 rounded-lg text-white font-semibold text-sm ${
                isCheckingIn || !checkInLocation ? "bg-gray-300 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {isCheckingIn ? "Checking in…" : "▶ Check In"}
            </button>
          ) : (
            <span className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-500 text-sm">Already Checked In</span>
          )}

          {!(todayAttendance?.checkout_time || todayAttendance?.check_out) ? (
            <button
              onClick={handleCheckOut}
              disabled={isCheckingOut || !(todayAttendance?.checkin_time || todayAttendance?.check_in)}
              className={`px-6 py-2.5 rounded-lg text-white font-semibold text-sm ${
                isCheckingOut || !(todayAttendance?.checkin_time || todayAttendance?.check_in)
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isCheckingOut ? "Checking out…" : "■ Check Out"}
            </button>
          ) : (
            <span className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-500 text-sm">Already Checked Out</span>
          )}
        </div>
      </div>

      {/* ── My Attendance History ── */}
      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-gray-700">My Attendance History</h2>
          <div className="flex gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Loading…</div>
        ) : attendance.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Check In</th>
                  <th className="px-3 py-2 text-left">Check Out</th>
                  <th className="px-3 py-2 text-left">Hours</th>
                  <th className="px-3 py-2 text-left">Location</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {attendance.map((rec, idx) => (
                  <tr key={rec._id || idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{formatDate(rec.attendance_date || rec.date)}</td>
                    <td className="px-3 py-2">{formatTime(rec.checkin_time || rec.check_in)}</td>
                    <td className="px-3 py-2">{formatTime(rec.checkout_time || rec.check_out)}</td>
                    <td className="px-3 py-2">
                      {rec.working_hours
                        ? `${rec.working_hours}h`
                        : calculateDuration(rec.checkin_time, rec.checkout_time)}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-[140px] truncate">
                      {(typeof rec.location === "string" ? rec.location : rec.location?.address) || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[rec.status] || "bg-gray-100 text-gray-700"}`}>
                        {statusLabel(rec.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">No records for this month</div>
        )}
      </div>

      {/* ── HR/Admin: All Employees Attendance ── */}
      {isHRAdmin && (
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-base font-semibold text-gray-700 mb-4">All Employees Attendance</h2>

          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <select
              value={adminFilter.employee_id}
              onChange={(e) => { setAdminFilter((f) => ({ ...f, employee_id: e.target.value })); setAdminPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm col-span-2 md:col-span-1"
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.user_id || emp.id} value={emp.user_id || emp.id}>
                  {emp.full_name || emp.username}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={adminFilter.start_date}
              onChange={(e) => { setAdminFilter((f) => ({ ...f, start_date: e.target.value })); setAdminPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={adminFilter.end_date}
              onChange={(e) => { setAdminFilter((f) => ({ ...f, end_date: e.target.value })); setAdminPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />

            <select
              value={adminFilter.status}
              onChange={(e) => { setAdminFilter((f) => ({ ...f, status: e.target.value })); setAdminPage(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </div>

          {adminLoading ? (
            <div className="text-center py-8 text-gray-400">Loading…</div>
          ) : adminRecords.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
                      <th className="px-3 py-2 text-left">Employee</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Check In</th>
                      <th className="px-3 py-2 text-left">Check Out</th>
                      <th className="px-3 py-2 text-left">Hours</th>
                      <th className="px-3 py-2 text-left">Source</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {adminRecords.map((rec, idx) => (
                      <tr key={rec._id || idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">
                          {rec.employee_name || rec.employee_id}
                          {rec.employee_department && (
                            <span className="block text-xs text-gray-400">{rec.employee_department}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{formatDate(rec.attendance_date || rec.date)}</td>
                        <td className="px-3 py-2">{formatTime(rec.checkin_time || rec.check_in)}</td>
                        <td className="px-3 py-2">{formatTime(rec.checkout_time || rec.check_out)}</td>
                        <td className="px-3 py-2">
                          {rec.working_hours
                            ? `${rec.working_hours}h`
                            : calculateDuration(rec.checkin_time, rec.checkout_time)}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 capitalize">
                          {(rec.source || "—").replace(/_/g, " ")}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[rec.status] || "bg-gray-100 text-gray-700"}`}>
                            {statusLabel(rec.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalAdminPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-sm">
                  <span className="text-gray-500">{adminTotal} total records</span>
                  <div className="flex gap-2">
                    <button
                      disabled={adminPage === 1}
                      onClick={() => setAdminPage((p) => p - 1)}
                      className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                    >←</button>
                    <span className="px-3 py-1">{adminPage} / {totalAdminPages}</span>
                    <button
                      disabled={adminPage === totalAdminPages}
                      onClick={() => setAdminPage((p) => p + 1)}
                      className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                    >→</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">No records found for the selected filters</div>
          )}
        </div>
      )}

      {/* ── Mark Attendance Modal (HR/Admin) ── */}
      {showMarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <motion.div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-800">Mark Employee Attendance</h3>
              <button onClick={() => setShowMarkModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="space-y-4">
              {/* Employee */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Employee *</label>
                <select
                  value={markForm.employee_id}
                  onChange={(e) => setMarkForm((f) => ({ ...f, employee_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select employee…</option>
                  {employees.map((emp) => (
                    <option key={emp.user_id || emp.id} value={emp.user_id || emp.id}>
                      {emp.full_name || emp.username}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Date *</label>
                <input
                  type="date"
                  value={markForm.attendance_date}
                  onChange={(e) => setMarkForm((f) => ({ ...f, attendance_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Status *</label>
                <select
                  value={markForm.status}
                  onChange={(e) => setMarkForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{statusLabel(s)}</option>
                  ))}
                </select>
              </div>

              {/* Times (only relevant if present/late/half_day) */}
              {["present", "late", "half_day"].includes(markForm.status) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Check-In Time</label>
                    <input
                      type="time"
                      value={markForm.checkin_time}
                      onChange={(e) => setMarkForm((f) => ({ ...f, checkin_time: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Check-Out Time</label>
                    <input
                      type="time"
                      value={markForm.checkout_time}
                      onChange={(e) => setMarkForm((f) => ({ ...f, checkout_time: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea
                  value={markForm.notes}
                  onChange={(e) => setMarkForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Optional reason / notes…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowMarkModal(false)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAttendance}
                disabled={isMarking}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white ${
                  isMarking ? "bg-indigo-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {isMarking ? "Saving…" : "Mark Attendance"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;

