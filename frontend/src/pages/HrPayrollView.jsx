import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import {
  FaUserCircle, FaBriefcase, FaRupeeSign, FaFileAlt, FaEdit, FaDownload, FaPlus,
  FaFilter, FaSearch, FaChevronDown, FaTimes, FaCalendarAlt, FaClock,
  FaMinusCircle, FaCheckCircle, FaExclamationTriangle, FaUserClock, FaSpinner
} from 'react-icons/fa';

// ErrorBoundary should NOT be rendered inside PayrollDashboard!
import ErrorBoundary from '../components/ErrorBoundary';

const API_BASE_URL = 'https://ratilalsons-backend-api.onrender.com';

const PayrollDashboard = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filterRole, setFilterRole] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [payrollPeriod, setPayrollPeriod] = useState('2025-12');
  const [showAddSalaryStructure, setShowAddSalaryStructure] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusData, setBonusData] = useState({
    employee_id: '',
    type: 'bonus',
    amount: '',
    reason: '',
    period: '2025-12'
  });
  const [showDraftPayslipModal, setShowDraftPayslipModal] = useState(false);
  const [draftPayslipData, setDraftPayslipData] = useState(null);
  const [payrollConfig, setPayrollConfig] = useState({
    hra_rate: 40,
    allowance_rate: 20,
    pf_rate: 12,
    professional_tax: 200,
    tds_threshold: 50000,
    tds_rate: 10,
    working_days: 26,
    active_period: '2025-12'
  });
  const [salaryStructures, setSalaryStructures] = useState([]);

  // Professional payroll calculations using admin config
  const calculatePayrollSummary = (employee) => {
    const baseSalary = employee.salary || 0;
    const attendanceRate = (employee.attendance || 95) / 100;
    const workingDays = payrollConfig.working_days || 26;
    const payableDays = Math.floor(workingDays * attendanceRate);
    const dailyRate = baseSalary / workingDays;

    const grossPay = dailyRate * payableDays;
    const hra = grossPay * (payrollConfig.hra_rate / 100); // Use admin config
    const allowances = grossPay * (payrollConfig.allowance_rate / 100); // Use admin config
    const totalEarnings = grossPay + hra + allowances;

    const pf = totalEarnings * (payrollConfig.pf_rate / 100); // Use admin config
    const professionalTax = payrollConfig.professional_tax || 200; // Use admin config
    const tdsThreshold = payrollConfig.tds_threshold || 50000;
    const tdsRate = payrollConfig.tds_rate / 100 || 0.1;
    const tds = totalEarnings > tdsThreshold ? Math.max(0, (totalEarnings - tdsThreshold) * tdsRate) : 0; // Corrected TDS calculation
    const totalDeductions = pf + professionalTax + tds;

    return {
      grossPay: Math.round(grossPay),
      hra: Math.round(hra),
      allowances: Math.round(allowances),
      totalEarnings: Math.round(totalEarnings),
      pf: Math.round(pf),
      professionalTax,
      tds: Math.round(tds),
      totalDeductions: Math.round(totalDeductions),
      netPay: Math.round(totalEarnings - totalDeductions)
    };
  };

  // Only fetch ONCE on mount—no recursion
  useEffect(() => {
    fetchPayrollConfig();
    fetchEmployees();
    fetchPendingApprovals();
    // eslint-disable-next-line
  }, []);

  // Fetch admin-configured payroll settings
  const fetchPayrollConfig = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      // Fetch payroll config
      const configRes = await fetch(`${API_BASE_URL}/api/payroll/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (configRes.ok) {
        const configData = await configRes.json();
        setPayrollConfig(configData.data || payrollConfig);
      }

      // Fetch salary structures
      const structuresRes = await fetch(`${API_BASE_URL}/api/payroll/structures`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (structuresRes.ok) {
        const structuresData = await structuresRes.json();
        setSalaryStructures(structuresData.data || []);
      }
    } catch (error) {
      console.error('Error fetching payroll config:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      if (!token) {
        toast.error('Authentication required');
        setLoading(false);
        return;
      }

      const staffResponse = await fetch(`${API_BASE_URL}/api/staff/employees`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      let employeesData = [];
      if (staffResponse.ok) {
        const staffData = await staffResponse.json();
        employeesData = Array.isArray(staffData.data) ? staffData.data :
          Array.isArray(staffData) ? staffData :
            staffData.employees || [];
      }

      // Enhanced employee data with professional payroll structure
      const enhancedEmployees = employeesData
        .filter(emp =>
          !emp.position?.toLowerCase().includes('admin') &&
          !emp.position?.toLowerCase().includes('customer') &&
          !emp.position?.toLowerCase().includes('vendor')
        )
        .map(emp => ({
          ...emp,
          id: emp.userid || emp.employeeid || `EMP${Math.random().toString(36).substr(2, 9)}`,
          name: emp.name || emp.fullname || 'Unknown',
          department: emp.department || 'General'
        }));

      setEmployees(enhancedEmployees);
      toast.success(`Loaded ${enhancedEmployees.length} employees`);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  // New HR-specific functions
  const fetchPendingApprovals = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/api/payroll/hr/pending-approvals`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPendingApprovals(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
    }
  };

  const generateDraftPayslip = async (employeeData) => {
    try {
      const token = localStorage.getItem('access_token');

      // Calculate payroll first
      const calcResponse = await fetch(`${API_BASE_URL}/api/payroll/calculate/${employeeData.userid}?period=${payrollPeriod}&attendance_days=26`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (calcResponse.ok) {
        const calcData = await calcResponse.json();

        // Generate draft payslip
        const draftResponse = await fetch(`${API_BASE_URL}/api/payroll/hr/generate-draft-payslip`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(calcData.data)
        });

        if (draftResponse.ok) {
          const draftData = await draftResponse.json();
          setDraftPayslipData(draftData.data);
          setShowDraftPayslipModal(true);
          toast.success('Draft payslip generated successfully!');
        } else {
          toast.error('Failed to generate draft payslip');
        }
      } else {
        toast.error('Failed to calculate payroll');
      }
    } catch (error) {
      console.error('Error generating draft payslip:', error);
      toast.error('Error generating draft payslip');
    }
  };

  const addBonusDeduction = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/api/payroll/hr/bonus-deduction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bonusData)
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message);
        setShowBonusModal(false);
        setBonusData({
          employee_id: '',
          type: 'bonus',
          amount: '',
          reason: '',
          period: '2025-12'
        });
        fetchPendingApprovals(); // Refresh pending approvals
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to add bonus/deduction');
      }
    } catch (error) {
      console.error('Error adding bonus/deduction:', error);
      toast.error('Error adding bonus/deduction');
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !filterRole || emp.position === filterRole;
    return matchesSearch && matchesRole;
  }).map(emp => ({
    ...emp,
    payrollSummary: calculatePayrollSummary(emp) // Calculate dynamically with current config
  })).sort((a, b) => {
    let aVal = a[sortBy], bVal = b[sortBy];
    if (sortBy === 'salary') {
      aVal = Number(aVal); bVal = Number(bVal);
    } else {
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
    }
    return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  const handleGeneratePayslip = async (employee) => {
    // Use the new draft payslip generation function
    await generateDraftPayslip(employee);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-lg text-gray-600">Loading Payroll Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 mb-8 border border-white/50"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Payroll Management
            </h1>
            <p className="text-gray-600 text-lg">Professional payroll processing for employees</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setShowAddSalaryStructure(true)}
              className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-green-700 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
            >
              <FaPlus /> New Salary Structure
            </button>
            <button
              onClick={() => fetchEmployees()}
              className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-indigo-600 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
            >
              <FaDownload /> Bulk Payslips
            </button>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      >
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-white/50 hover:shadow-2xl transition-all duration-300 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Total Payroll</p>
              <p className="text-3xl font-bold text-gray-900">
                ₹{employees.reduce((sum, emp) => sum + (emp.payrollSummary?.netPay || 0), 0).toLocaleString()}
              </p>
              <p className="text-sm text-emerald-600 mt-1 font-semibold">This Month</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <FaRupeeSign className="text-3xl text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-white/50 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Active Employees</p>
              <p className="text-3xl font-bold text-gray-900">{employees.filter(e => e.status === 'Active').length}</p>
              <p className="text-sm text-emerald-600 mt-1 font-semibold">On Payroll</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl">
              <FaUserCircle className="text-3xl text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-white/50 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Avg Salary</p>
              <p className="text-3xl font-bold text-gray-900">
                ₹{Math.round(employees.reduce((sum, emp) => sum + (emp.salary || 0), 0) / Math.max(1, employees.length)).toLocaleString()}
              </p>
              <p className="text-sm text-blue-600 mt-1 font-semibold">Monthly</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
              <FaBriefcase className="text-3xl text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-white/50 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Attendance</p>
              <p className="text-3xl font-bold text-gray-900">
                {Math.round(employees.reduce((sum, emp) => sum + (emp.attendance || 0), 0) / Math.max(1, employees.length))}%
              </p>
              <p className="text-sm text-purple-600 mt-1 font-semibold">Average</p>
            </div>
            <div className="p-4 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl">
              <FaClock className="text-3xl text-purple-600" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filters & Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/50 mb-8"
      >
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FaFilter className="text-indigo-600" /> Employee Payroll List
          </h3>
          <div className="flex gap-3">
            <input
              type="month"
              value={payrollConfig.active_period || payrollPeriod}
              onChange={(e) => {
                setPayrollPeriod(e.target.value);
                setPayrollConfig({ ...payrollConfig, active_period: e.target.value });
              }}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/50 backdrop-blur-sm"
            />
            <button
              onClick={() => { setSearchTerm(''); setFilterRole(''); }}
              className="px-6 py-3 bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 font-semibold transition-colors flex items-center gap-2"
            >
              Reset Filters
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="relative">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/50 backdrop-blur-sm"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/50 backdrop-blur-sm appearance-none"
          >
            <option value="">All Positions</option>
            {[...new Set(employees.map(emp => emp.position))].sort().map(pos => (
              <option key={pos} value={pos}>{pos} ({employees.filter(e => e.position === pos).length})</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/50 backdrop-blur-sm appearance-none"
          >
            <option value="name">Name</option>
            <option value="department">Department</option>
            <option value="salary">Salary</option>
            <option value="attendance">Attendance</option>
            <option value="netPay">Net Pay</option>
          </select>
        </div>
      </motion.div>

      {/* Employees Table */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden border border-white/50">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-indigo-50 to-blue-50">
              <tr>
                <th className="px-8 py-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Position</th>
                <th className="px-6 py-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Department</th>
                <th className="px-8 py-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Gross Pay</th>
                <th className="px-8 py-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Net Pay</th>
                <th className="px-6 py-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Attendance</th>
                <th className="px-8 py-6 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmployees.map((employee, index) => {
                const payroll = employee.payrollSummary || {};
                return (
                  <motion.tr
                    key={employee.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-indigo-50/50 transition-all duration-200 cursor-pointer group"
                    onClick={() => {
                      setSelectedEmployee(employee);
                      setShowDetails(true);
                    }}
                  >
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-14 w-14 flex-shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                          <span className="text-white font-bold text-xl">
                            {employee.name?.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-lg font-semibold text-gray-900 group-hover:text-indigo-900">
                            {employee.name}
                          </div>
                          <div className="text-sm text-gray-500">{employee.email || 'No email'}</div>
                          <div className="text-xs text-gray-400">ID: {employee.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-semibold rounded-full">
                        {employee.position}
                      </span>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded-lg">
                        {employee.department}
                      </span>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="text-lg font-bold text-gray-900">
                        ₹{payroll.totalEarnings?.toLocaleString() || '0'}
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-green-600 bg-clip-text text-transparent">
                        ₹{payroll.netPay?.toLocaleString() || '0'}
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className={`text-sm font-semibold px-3 py-1 rounded-full ${payroll.attendance >= 95 ? 'bg-emerald-100 text-emerald-800' :
                        payroll.attendance >= 90 ? 'bg-blue-100 text-blue-800' :
                          payroll.attendance >= 85 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                        }`}>
                        {employee.attendance}%
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap text-right space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGeneratePayslip(employee);
                        }}
                        disabled={reportGenerating}
                        className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded-xl transition-all duration-200"
                        title="Generate Payslip"
                      >
                        {reportGenerating ? (
                          <FaSpinner className="animate-spin" />
                        ) : (
                          <FaFileAlt />
                        )}
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Details Modal */}
      <AnimatePresence>
        {showDetails && selectedEmployee && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetails(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white/95 backdrop-blur-md rounded-3xl max-w-7xl w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-white/50"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Professional Payslip Preview */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-8 text-white rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <span className="text-2xl font-bold">{selectedEmployee.name?.split(' ').map(n => n[0]).join('')}</span>
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold">{selectedEmployee.name}</h2>
                      <p className="text-indigo-100">{selectedEmployee.position} - {selectedEmployee.department}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleGeneratePayslip(selectedEmployee)}
                      disabled={reportGenerating}
                      className="bg-white/20 backdrop-blur-sm px-6 py-3 rounded-2xl font-semibold text-white hover:bg-white/30 transition-all duration-300 flex items-center gap-2"
                    >
                      {reportGenerating ? <FaSpinner className="animate-spin" /> : <FaDownload />}
                      Download Payslip
                    </button>
                    <button
                      onClick={() => setShowDetails(false)}
                      className="p-2 hover:bg-white/20 rounded-2xl transition-colors"
                    >
                      <FaTimes />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Earnings Breakdown */}
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <FaRupeeSign className="text-emerald-600" /> Earnings Breakdown
                  </h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Gross Salary', value: selectedEmployee.payrollSummary?.grossPay, color: 'emerald' },
                      { label: `HRA (${payrollConfig.hra_rate}%)`, value: selectedEmployee.payrollSummary?.hra, color: 'blue' },
                      { label: `Allowances (${payrollConfig.allowance_rate}%)`, value: selectedEmployee.payrollSummary?.allowances, color: 'indigo' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex justify-between items-center p-4 bg-gradient-to-r from-white to-gray-50 rounded-2xl shadow-sm">
                        <span className="font-medium text-gray-700">{label}</span>
                        <span className={`font-bold text-${color}-600 text-xl`}>
                          ₹{value?.toLocaleString() || '0'}
                        </span>
                      </div>
                    ))}
                    <div className="p-6 bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl border-2 border-emerald-200 shadow-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-bold text-emerald-900">Total Earnings</span>
                        <span className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                          ₹{selectedEmployee.payrollSummary?.totalEarnings?.toLocaleString() || '0'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Deductions Breakdown */}
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <FaMinusCircle className="text-red-600" /> Deductions
                  </h3>
                  <div className="space-y-4">
                    {[
                      { label: `Provident Fund (${payrollConfig.pf_rate}%)`, value: selectedEmployee.payrollSummary?.pf, color: 'red' },
                      { label: 'Professional Tax', value: selectedEmployee.payrollSummary?.professionalTax, color: 'orange' },
                      { label: `TDS (${payrollConfig.tds_rate}%)`, value: selectedEmployee.payrollSummary?.tds, color: 'rose' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex justify-between items-center p-4 bg-gradient-to-r from-white to-gray-50 rounded-2xl shadow-sm">
                        <span className="font-medium text-gray-700">{label}</span>
                        <span className={`font-bold text-${color}-600 text-xl`}>
                          ₹{value?.toLocaleString() || '0'}
                        </span>
                      </div>
                    ))}
                    <div className="p-6 bg-gradient-to-r from-red-50 to-rose-50 rounded-2xl border-2 border-red-200 shadow-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-bold text-red-900">Total Deductions</span>
                        <span className="text-3xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
                          ₹{selectedEmployee.payrollSummary?.totalDeductions?.toLocaleString() || '0'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Pay & Summary */}
              <div className="p-8 bg-gradient-to-r from-emerald-50 to-green-50 border-t-4 border-emerald-500 rounded-b-3xl">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
                  <div>
                    <p className="text-2xl text-emerald-800 font-semibold mb-2">Net Take Home Pay</p>
                    <p className="text-5xl font-black bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 bg-clip-text text-transparent tracking-tight">
                      ₹{selectedEmployee.payrollSummary?.netPay?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    <div className="text-center p-4 rounded-2xl bg-white/60 backdrop-blur-sm">
                      <div className="text-2xl font-bold text-gray-900">{payrollConfig.working_days} days</div>
                      <div className="text-gray-600">Working Days</div>
                    </div>
                    <div className="text-center p-4 rounded-2xl bg-white/60 backdrop-blur-sm">
                      <div className="text-2xl font-bold text-gray-900">{payrollConfig.active_period}</div>
                      <div className="text-gray-600">Pay Period</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Salary Structure Modal */}
      <AnimatePresence>
        {showAddSalaryStructure && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddSalaryStructure(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl border border-white/50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900">New Salary Structure</h3>
                <button onClick={() => setShowAddSalaryStructure(false)} className="p-2 hover:bg-gray-100 rounded-2xl">
                  <FaTimes />
                </button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Position</label>
                  <select className="w-full p-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                    <option>Manager</option>
                    <option>Supervisor</option>
                    <option>Employee</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Basic Salary</label>
                  <input type="number" className="w-full p-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-8 rounded-2xl font-bold text-lg hover:from-indigo-700 hover:to-purple-700 shadow-xl hover:shadow-2xl transition-all duration-300">
                  Create Structure
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HR-Specific Sections */}
      {/* Pending Approvals */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 mb-8 border border-white/50"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Pending Approvals</h2>
          <button
            onClick={fetchPendingApprovals}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-700 shadow-lg flex items-center gap-2"
          >
            <FaClock /> Refresh
          </button>
        </div>

        {pendingApprovals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-2xl shadow-sm">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingApprovals.map((approval, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{approval.employee_id}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${approval.type === 'bonus' ? 'bg-green-100 text-green-800' :
                        approval.type === 'incentive' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                        {approval.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-lg font-bold text-emerald-600">₹{approval.amount?.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{approval.reason}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{approval.period}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-semibold rounded-full">
                        {approval.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <FaCheckCircle className="text-6xl text-green-500 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No pending approvals</p>
          </div>
        )}
      </motion.div>

      {/* Bonus/Deduction Management */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 mb-8 border border-white/50"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Bonus & Deduction Management</h2>
          <button
            onClick={() => setShowBonusModal(true)}
            className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-green-700 shadow-lg flex items-center gap-2"
          >
            <FaPlus /> Add Bonus/Deduction
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl border-2 border-green-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-green-900">Bonuses</h3>
              <FaRupeeSign className="text-2xl text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-600">
              {pendingApprovals.filter(a => a.type === 'bonus').length}
            </p>
            <p className="text-sm text-green-700">Pending Approval</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border-2 border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-blue-900">Incentives</h3>
              <FaCheckCircle className="text-2xl text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-600">
              {pendingApprovals.filter(a => a.type === 'incentive').length}
            </p>
            <p className="text-sm text-blue-700">Pending Approval</p>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-pink-50 p-6 rounded-2xl border-2 border-red-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-red-900">Deductions</h3>
              <FaMinusCircle className="text-2xl text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-600">
              {pendingApprovals.filter(a => a.type === 'deduction').length}
            </p>
            <p className="text-sm text-red-700">Pending Approval</p>
          </div>
        </div>
      </motion.div>

      {/* Bonus/Deduction Modal */}
      {showBonusModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-8 m-4 max-w-md w-full shadow-2xl"
          >
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Add Bonus/Deduction</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Employee ID</label>
                <input
                  type="text"
                  value={bonusData.employee_id}
                  onChange={(e) => setBonusData({ ...bonusData, employee_id: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter employee ID"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                <select
                  value={bonusData.type}
                  onChange={(e) => setBonusData({ ...bonusData, type: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="bonus">Bonus</option>
                  <option value="incentive">Incentive</option>
                  <option value="deduction">Deduction</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (₹)</label>
                <input
                  type="number"
                  value={bonusData.amount}
                  onChange={(e) => setBonusData({ ...bonusData, amount: parseFloat(e.target.value) })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Reason</label>
                <textarea
                  value={bonusData.reason}
                  onChange={(e) => setBonusData({ ...bonusData, reason: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 h-24"
                  placeholder="Reason for bonus/deduction"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Period</label>
                <input
                  type="month"
                  value={bonusData.period}
                  onChange={(e) => setBonusData({ ...bonusData, period: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={addBonusDeduction}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 text-white py-3 px-6 rounded-xl font-bold hover:from-emerald-700 hover:to-green-700"
              >
                Submit
              </button>
              <button
                onClick={() => setShowBonusModal(false)}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Draft Payslip Modal */}
      {showDraftPayslipModal && draftPayslipData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-8 m-4 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Draft Payslip Generated</h3>
              <button
                onClick={() => setShowDraftPayslipModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl"
              >
                <FaTimes className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl">
                <h4 className="text-lg font-bold text-blue-900 mb-4">Payroll Summary</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Employee ID</p>
                    <p className="text-lg font-bold">{draftPayslipData.employee_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Period</p>
                    <p className="text-lg font-bold">{draftPayslipData.period}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Earnings</p>
                    <p className="text-lg font-bold text-emerald-600">₹{draftPayslipData.calculation?.total_earnings?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Deductions</p>
                    <p className="text-lg font-bold text-red-600">₹{draftPayslipData.calculation?.total_deductions?.toLocaleString()}</p>
                  </div>
                  <div className="col-span-2 border-t pt-4">
                    <p className="text-sm text-gray-600">Net Pay</p>
                    <p className="text-2xl font-bold text-blue-600">₹{draftPayslipData.calculation?.net_pay?.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <FaExclamationTriangle className="text-yellow-600" />
                  <span className="font-semibold text-yellow-800">Draft Status</span>
                </div>
                <p className="text-sm text-yellow-700">
                  This is a draft payslip. It needs admin approval before payment can be released.
                </p>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDraftPayslipModal(false)}
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PayrollDashboard;
