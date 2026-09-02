import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  FaUserCircle, FaRupeeSign, FaPlus, FaEdit, FaTrash, FaTimes, FaCheck,
  FaFileAlt, FaListAlt, FaSearch
} from 'react-icons/fa';

const API_BASE_URL = 'http://127.0.0.1:8000';
const PAGE_SIZE = 10;

const PayrollAdmin = () => {
  const [activeTab, setActiveTab] = useState('payrollData'); // Default tab: payrollData
  const [employees, setEmployees] = useState([]);
  const [payrollData, setPayrollData] = useState([]);
  const [salaryStructures, setSalaryStructures] = useState([]);
  const [payrollPage, setPayrollPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [editingPayrollRecord, setEditingPayrollRecord] = useState(null);
  const [payrollForm, setPayrollForm] = useState({
    employee_id: '',
    employee_name: '',
    employee_email: '',
    month: new Date().toISOString().slice(0, 7),
    gross_salary: '',
    deductions: '',
    created_by: 'Admin',
    created_on: new Date().toISOString().split('T')[0],
  });

  const [showStructureModal, setShowStructureModal] = useState(false);
  const [editingStructure, setEditingStructure] = useState(null);
  const [structureForm, setStructureForm] = useState({
    employee_id: '',
    employee_name: '',
    basic_salary: '',
    hra: '',
    incentive: '',
    meal: '',
    bonus: '',
    professional_tax: '',
    pf_percentage: '12',
    esi_percentage: '',
    advance_salary: '',
    loan: '',
    notice_recovery: '',
  });

  // Only employees who have a salary structure created
  const employeesWithStructure = useMemo(() => {
    return employees.filter((emp) =>
      salaryStructures.some(
        (struct) =>
          String(struct.employee_id) === String(emp.id) ||
          String(struct.employee_id) === String(emp._id) ||
          (struct.employee_name && emp.full_name && struct.employee_name.trim().toLowerCase() === emp.full_name.trim().toLowerCase()) ||
          (struct.employee_name && emp.username && struct.employee_name.trim().toLowerCase() === emp.username.trim().toLowerCase())
      )
    );
  }, [employees, salaryStructures]);

  // Handle employee selection in payroll modal & auto-fill gross and deductions from salary structure
  const handleEmployeePayrollSelect = (empId) => {
    const emp = employees.find((x) => String(x.id) === String(empId) || String(x._id) === String(empId));
    const struct = salaryStructures.find(
      (s) =>
        String(s.employee_id) === String(empId) ||
        (emp && s.employee_name && emp.full_name && s.employee_name.trim().toLowerCase() === emp.full_name.trim().toLowerCase()) ||
        (emp && s.employee_name && emp.username && s.employee_name.trim().toLowerCase() === emp.username.trim().toLowerCase())
    );

    let gross = '';
    let deductions = '';

    if (struct) {
      const basic = parseFloat(struct.basic_salary) || 0;
      const hra = parseFloat(struct.hra) || 0;
      const incentive = parseFloat(struct.incentive) || 0;
      const meal = parseFloat(struct.meal) || 0;
      const bonus = parseFloat(struct.bonus) || 0;
      gross = struct.gross_salary !== undefined ? struct.gross_salary : (basic + hra + incentive + meal + bonus);

      const ptax = parseFloat(struct.professional_tax) || 0;
      const pfPct = parseFloat(struct.pf_percentage) || 0;
      const pfAmt = struct.pf_amount !== undefined ? parseFloat(struct.pf_amount) : (pfPct > 0 ? (basic * pfPct) / 100 : (parseFloat(struct.pf) || 0));

      const esiPct = parseFloat(struct.esi_percentage) || 0;
      const esiAmt = struct.esi_amount !== undefined ? parseFloat(struct.esi_amount) : (esiPct > 0 ? (basic * esiPct) / 100 : 0);

      const advance = parseFloat(struct.advance_salary) || 0;
      const loan = parseFloat(struct.loan) || 0;
      const noticeRec = parseFloat(struct.notice_recovery) || 0;

      deductions = struct.total_deductions !== undefined ? struct.total_deductions : (ptax + pfAmt + esiAmt + advance + loan + noticeRec);
    }

    setPayrollForm((prev) => ({
      ...prev,
      employee_id: empId,
      employee_name: emp ? (emp.full_name || emp.username) : (struct ? struct.employee_name : prev.employee_name),
      employee_email: emp ? emp.email : prev.employee_email,
      gross_salary: gross !== '' ? gross : '',
      deductions: deductions !== '' ? deductions : '',
    }));
  };

  // Helper to format Month/Year
  const formatMonthDisplay = (monthStr) => {
    if (!monthStr) return '-';
    try {
      const [year, month] = monthStr.split('-');
      if (year && month) {
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      }
    } catch (e) { }
    return monthStr;
  };

  // Fetch employees, structures, and records on mount
  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('access_token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch employees
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/users`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setEmployees(data);
        }
      } catch (err) {
        console.error('Failed to fetch employees:', err);
      }

      // Fetch salary structures
      try {
        const res = await fetch(`${API_BASE_URL}/api/payroll/structures`, { headers });
        if (res.ok) {
          const resData = await res.json();
          const list = Array.isArray(resData) ? resData : (resData.data || []);
          if (Array.isArray(list)) setSalaryStructures(list);
        }
      } catch (err) {
        console.error('Failed to fetch salary structures:', err);
      }

      // Fetch payroll slips/records
      try {
        const res = await fetch(`${API_BASE_URL}/api/payroll/admin/all-payment-slips?page=1&limit=200`, { headers });
        if (res.ok) {
          const resData = await res.json();
          const records = resData?.data?.records || (Array.isArray(resData) ? resData : []);
          if (Array.isArray(records)) {
            const mappedRecords = records.map((slip, idx) => ({
              id: slip.id || slip._id || `pay-${idx}`,
              _id: slip._id || slip.id,
              sr_no: idx + 1,
              employee_id: slip.employee_id || '',
              employee_name: slip.employee_name || slip.employee_info?.name || 'Employee',
              employee_email: slip.employee_email || slip.employee_info?.email || '',
              role: slip.role || slip.employee_info?.department || 'Staff',
              month: slip.month || slip.period || new Date().toISOString().slice(0, 7),
              gross_salary: slip.gross_salary !== undefined ? slip.gross_salary : (slip.calculation?.gross_pay ?? slip.calculation?.total_earnings ?? 0),
              deductions: slip.deductions !== undefined ? slip.deductions : (slip.calculation?.total_deductions ?? 0),
              net_pay: slip.net_pay !== undefined ? slip.net_pay : (slip.calculation?.net_pay ?? 0),
              created_by: slip.created_by || 'Admin',
              created_on: slip.created_on || (slip.created_at ? slip.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
            }));
            setPayrollData(mappedRecords);
          }
        }
      } catch (err) {
        console.error('Failed to fetch payroll records:', err);
      }
    };

    fetchData();
  }, []);

  // Filtered Payroll Data
  const filteredPayrollData = useMemo(() => {
    if (!searchTerm.trim()) return payrollData;
    const term = searchTerm.toLowerCase();
    return payrollData.filter(
      (item) =>
        (item.employee_name && item.employee_name.toLowerCase().includes(term)) ||
        (item.employee_email && item.employee_email.toLowerCase().includes(term)) ||
        (item.month && item.month.toLowerCase().includes(term)) ||
        (item.created_by && item.created_by.toLowerCase().includes(term))
    );
  }, [payrollData, searchTerm]);

  // Paginated Payroll Data
  const totalPages = Math.ceil(filteredPayrollData.length / PAGE_SIZE) || 1;
  const safePage = Math.min(Math.max(1, payrollPage), totalPages);
  const paginatedPayrollData = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredPayrollData.slice(start, start + PAGE_SIZE);
  }, [filteredPayrollData, safePage]);

  // Handle Payroll Modal Submit
  const handlePayrollSave = async (e) => {
    e.preventDefault();
    const gross = parseFloat(payrollForm.gross_salary) || 0;
    const ded = parseFloat(payrollForm.deductions) || 0;
    const net = gross - ded;

    let selectedEmp = employees.find((emp) => String(emp.id) === String(payrollForm.employee_id) || String(emp._id) === String(payrollForm.employee_id));
    const empName = selectedEmp ? (selectedEmp.full_name || selectedEmp.username) : payrollForm.employee_name || 'Employee';
    const empEmail = selectedEmp ? selectedEmp.email : payrollForm.employee_email || '';

    const payload = {
      id: editingPayrollRecord ? (editingPayrollRecord.id || editingPayrollRecord._id) : undefined,
      employee_id: payrollForm.employee_id,
      employee_name: empName,
      employee_email: empEmail,
      role: selectedEmp ? selectedEmp.role || 'Staff' : 'Staff',
      month: payrollForm.month || new Date().toISOString().slice(0, 7),
      period: payrollForm.month || new Date().toISOString().slice(0, 7),
      gross_salary: gross,
      deductions: ded,
      net_pay: net,
      calculation: {
        gross_pay: gross,
        total_earnings: gross,
        total_deductions: ded,
        net_pay: net,
      },
      created_by: payrollForm.created_by || 'Admin',
      created_on: payrollForm.created_on || new Date().toISOString().split('T')[0],
      status: 'approved',
    };

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/api/payroll/records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const saved = await res.json();
        if (saved?.data?.id) {
          payload.id = saved.data.id;
        }
      }
    } catch (err) {
      console.warn('Backend record save notice:', err);
    }

    if (editingPayrollRecord) {
      setPayrollData((prev) =>
        prev.map((item) =>
          item.id === editingPayrollRecord.id || item._id === editingPayrollRecord.id
            ? { ...item, ...payload }
            : item
        )
      );
      toast.success('Payroll record updated successfully!');
    } else {
      payload.id = payload.id || `pay-${Date.now()}`;
      payload.sr_no = payrollData.length + 1;
      setPayrollData((prev) => [payload, ...prev]);
      toast.success('Payroll record added successfully!');
    }
    setShowPayrollModal(false);
    setEditingPayrollRecord(null);
  };

  // Handle Delete Payroll Record
  const handleDeletePayrollRecord = async (id) => {
    if (window.confirm('Are you sure you want to delete this payroll record?')) {
      try {
        const token = localStorage.getItem('access_token');
        if (id && !String(id).startsWith('pay-')) {
          await fetch(`${API_BASE_URL}/api/payroll/records/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      } catch (e) {
        console.warn('Backend delete error:', e);
      }
      setPayrollData((prev) => prev.filter((item) => item.id !== id && item._id !== id));
      toast.success('Payroll record deleted!');
    }
  };

  // Handle Structure Modal Submit
  const handleStructureSave = async (e) => {
    e.preventDefault();
    let selectedEmp = employees.find((emp) => String(emp.id) === String(structureForm.employee_id));
    const empName = selectedEmp ? (selectedEmp.full_name || selectedEmp.username) : structureForm.employee_name || 'Selected Employee';
    const empPos = selectedEmp ? (selectedEmp.position || selectedEmp.role || 'Staff') : 'Staff';

    const basic = parseFloat(structureForm.basic_salary) || 0;
    const hra = parseFloat(structureForm.hra) || 0;
    const incentive = parseFloat(structureForm.incentive) || 0;
    const meal = parseFloat(structureForm.meal) || 0;
    const bonus = parseFloat(structureForm.bonus) || 0;

    const totalAdditions = basic + hra + incentive + meal + bonus;

    const ptax = parseFloat(structureForm.professional_tax) || 0;
    const pfPct = parseFloat(structureForm.pf_percentage) || 0;
    const pfAmt = (basic * pfPct) / 100;

    const esiPct = parseFloat(structureForm.esi_percentage) || 0;
    const esiAmt = (basic * esiPct) / 100;

    const advance = parseFloat(structureForm.advance_salary) || 0;
    const loan = parseFloat(structureForm.loan) || 0;
    const noticeRec = parseFloat(structureForm.notice_recovery) || 0;

    const totalDeductions = ptax + pfAmt + esiAmt + advance + loan + noticeRec;
    const netSalary = totalAdditions - totalDeductions;

    const newStruct = {
      id: editingStructure ? (editingStructure.id || editingStructure._id) : `struct-${Date.now()}`,
      employee_id: structureForm.employee_id,
      employee_name: empName,
      position: empPos,
      basic_salary: basic,
      hra: hra,
      incentive: incentive,
      meal: meal,
      bonus: bonus,
      professional_tax: ptax,
      pf_percentage: pfPct,
      pf_amount: pfAmt,
      esi_percentage: esiPct,
      esi_amount: esiAmt,
      advance_salary: advance,
      loan: loan,
      notice_recovery: noticeRec,
      gross_salary: totalAdditions,
      total_deductions: totalDeductions,
      net_salary: netSalary,
    };

    // Attempt backend persistence
    try {
      const token = localStorage.getItem('access_token');
      const isEdit = editingStructure && editingStructure.id && !editingStructure.id.startsWith('struct-');
      const endpoint = isEdit
        ? `${API_BASE_URL}/api/payroll/structures/${editingStructure.id}`
        : `${API_BASE_URL}/api/payroll/structures`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newStruct)
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.data?.id) {
          newStruct.id = data.data.id;
        }
      }
    } catch (err) {
      console.warn('Backend structure save notice:', err);
    }

    if (editingStructure) {
      setSalaryStructures((prev) =>
        prev.map((item) => ((item.id === editingStructure.id || item._id === editingStructure.id) ? newStruct : item))
      );
      toast.success('Salary structure updated successfully!');
    } else {
      setSalaryStructures((prev) => [newStruct, ...prev]);
      toast.success('Salary structure created successfully!');
    }
    setShowStructureModal(false);
    setEditingStructure(null);
  };

  // Delete Salary Structure
  const handleDeleteStructure = async (id) => {
    if (window.confirm('Are you sure you want to delete this salary structure?')) {
      try {
        const token = localStorage.getItem('access_token');
        if (id && !String(id).startsWith('struct-')) {
          await fetch(`${API_BASE_URL}/api/payroll/structures/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      } catch (e) {
        console.warn('Backend structure delete notice:', e);
      }
      setSalaryStructures((prev) => prev.filter((item) => item.id !== id && item._id !== id));
      toast.success('Salary structure deleted!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50/30 p-4 sm:p-8 max-w-8xl mx-auto">
      {/* Top Header */}
      <motion.div
        className="py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-left text-violet-700 leading-tight">
            Payroll Management
          </h1>
          <p className="text-gray-500 mt-1 text-left text-xs sm:text-sm">
            Manage employee payroll data, salary structures, and payslips.
          </p>
        </div>
      </motion.div>

      {/* Main Tabs Navigation */}
      <div className="bg-white shadow-lg rounded-2xl border border-gray-100 mb-8 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <motion.button
            onClick={() => setActiveTab('payrollData')}
            className={`flex-1 py-4 px-6 font-bold text-sm focus:outline-none transition-all ${activeTab === 'payrollData'
              ? 'bg-violet-50 border-b-2 border-violet-600 text-violet-700 shadow-md'
              : 'text-gray-600 hover:text-violet-700 hover:bg-violet-50'
              }`}
            whileTap={{ scale: 0.98 }}
          >
            Payroll Data
          </motion.button>
          <motion.button
            onClick={() => setActiveTab('salaryStructure')}
            className={`flex-1 py-4 px-6 font-bold text-sm focus:outline-none transition-all ${activeTab === 'salaryStructure'
              ? 'bg-emerald-50 border-b-2 border-emerald-600 text-emerald-700 shadow-md'
              : 'text-gray-600 hover:text-emerald-700 hover:bg-emerald-50'
              }`}
            whileTap={{ scale: 0.98 }}
          >
            Salary Structure
          </motion.button>
          <motion.button
            onClick={() => setActiveTab('salarySlip')}
            className={`flex-1 py-4 px-6 font-bold text-sm focus:outline-none transition-all ${activeTab === 'salarySlip'
              ? 'bg-blue-50 border-b-2 border-blue-600 text-blue-700 shadow-md'
              : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50'
              }`}
            whileTap={{ scale: 0.98 }}
          >
            Salary Slip
          </motion.button>
        </div>
      </div>

      {/* TAB 1: PAYROLL DATA */}
      {activeTab === 'payrollData' && (
        <motion.div
          key="payrollData"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
            <motion.button
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all text-sm flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setEditingPayrollRecord(null);
                setPayrollForm({
                  employee_id: '',
                  employee_name: '',
                  employee_email: '',
                  month: new Date().toISOString().slice(0, 7),
                  gross_salary: '',
                  deductions: '',
                  created_by: 'Admin',
                  created_on: new Date().toISOString().split('T')[0],
                });
                setShowPayrollModal(true);
              }}
            >
              <FaPlus /> Add Payroll Record
            </motion.button>

            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by employee name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm"
              />
            </div>
          </div>

          {/* Payroll Data Table */}
          <div className="bg-white shadow-lg rounded-2xl border border-violet-100 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200 bg-violet-50/50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-violet-800 flex items-center gap-2">
                <FaListAlt /> Payroll Data Records
              </h3>
              <span className="text-xs font-semibold text-violet-600 bg-violet-100 px-3 py-1 rounded-full">
                Total Records: {filteredPayrollData.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full text-sm">
                <thead className="bg-gradient-to-r from-violet-50 to-indigo-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-violet-700 uppercase tracking-wider">SR NO</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-violet-700 uppercase tracking-wider">Employee Details</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-violet-700 uppercase tracking-wider">Payroll Month</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-violet-700 uppercase tracking-wider">Gross Salary</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-violet-700 uppercase tracking-wider">Deduction</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-violet-700 uppercase tracking-wider">Net Pay</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-violet-700 uppercase tracking-wider">Created By</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-violet-700 uppercase tracking-wider">Created On</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-violet-700 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {paginatedPayrollData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-400">
                        No payroll data records found.
                      </td>
                    </tr>
                  ) : (
                    paginatedPayrollData.map((item, idx) => (
                      <motion.tr
                        key={item.id || idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="hover:bg-violet-50/40 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-600">
                          {idx + 1 + (safePage - 1) * PAGE_SIZE}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm mr-3">
                              {item.employee_name ? item.employee_name.charAt(0) : 'E'}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 text-sm">{item.employee_name}</div>
                              <div className="text-xs text-gray-500">{item.employee_email || item.role || 'Staff'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-violet-700">
                          <span className="bg-violet-50 text-violet-700 px-2.5 py-1 rounded-md border border-violet-200 text-xs font-bold">
                            {formatMonthDisplay(item.month)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">
                          ₹{(parseFloat(item.gross_salary) || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">
                          ₹{(parseFloat(item.deductions) || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-emerald-600">
                          ₹{(parseFloat(item.net_pay) || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-700">
                            {item.created_by || 'Admin'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.created_on || new Date().toISOString().split('T')[0]}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                          <div className="flex items-center justify-center space-x-2">
                            <motion.button
                              className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all"
                              onClick={() => {
                                setEditingPayrollRecord(item);
                                setPayrollForm({
                                  employee_id: item.employee_id || '',
                                  employee_name: item.employee_name || '',
                                  employee_email: item.employee_email || '',
                                  month: item.month || new Date().toISOString().slice(0, 7),
                                  gross_salary: item.gross_salary || '',
                                  deductions: item.deductions || '',
                                  created_by: item.created_by || 'Admin',
                                  created_on: item.created_on || new Date().toISOString().split('T')[0],
                                });
                                setShowPayrollModal(true);
                              }}
                              whileTap={{ scale: 0.9 }}
                              title="Edit"
                            >
                              <FaEdit className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all"
                              onClick={() => handleDeletePayrollRecord(item.id)}
                              whileTap={{ scale: 0.9 }}
                              title="Delete"
                            >
                              <FaTrash className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredPayrollData.length > PAGE_SIZE && (
              <div className="flex items-center justify-between w-full mt-4 px-6 pb-6 border-t border-gray-100 pt-4">
                <motion.button
                  onClick={() => setPayrollPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${safePage > 1
                    ? 'bg-gradient-to-r from-violet-500 to-violet-700 text-white hover:from-violet-600 hover:to-violet-800 shadow-md'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  style={{ minWidth: 100 }}
                  whileTap={{ scale: 0.96 }}
                >
                  Previous
                </motion.button>
                <span className="text-base font-semibold text-gray-700">
                  Page {safePage} of {totalPages}
                </span>
                <motion.button
                  onClick={() => setPayrollPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${safePage < totalPages
                    ? 'bg-gradient-to-r from-violet-500 to-violet-700 text-white hover:from-violet-600 hover:to-violet-800 shadow-md'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  style={{ minWidth: 100 }}
                  whileTap={{ scale: 0.96 }}
                >
                  Next
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* TAB 2: SALARY STRUCTURE */}
      {activeTab === 'salaryStructure' && (
        <motion.div
          key="salaryStructure"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          {/* Top Bar for Salary Structure */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
            <motion.button
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all text-sm flex items-center justify-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setEditingStructure(null);
                setStructureForm({
                  employee_id: '',
                  employee_name: '',
                  basic_salary: '',
                  hra: '',
                  incentive: '',
                  meal: '',
                  bonus: '',
                  professional_tax: '',
                  pf_percentage: '12',
                  esi_percentage: '',
                  advance_salary: '',
                  loan: '',
                  notice_recovery: '',
                });
                setShowStructureModal(true);
              }}
            >
              <FaPlus /> Create Salary Structure
            </motion.button>
          </div>

          {/* Salary Structures Cards Container */}
          {salaryStructures.length === 0 ? (
            <div className="bg-white shadow-lg rounded-2xl border border-emerald-100 p-12 text-center text-gray-400">
              No salary structures created yet. Click "+ Create Salary Structure" above to add one.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {salaryStructures.map((struct) => {
                const basic = parseFloat(struct.basic_salary) || 0;
                const hra = parseFloat(struct.hra) || 0;
                const incentive = parseFloat(struct.incentive) || 0;
                const meal = parseFloat(struct.meal) || 0;
                const bonus = parseFloat(struct.bonus) || 0;

                const gross = struct.gross_salary || (basic + hra + incentive + meal + bonus);

                const ptax = parseFloat(struct.professional_tax) || 0;
                const pfPct = parseFloat(struct.pf_percentage) || 0;
                const pfAmt = struct.pf_amount !== undefined ? parseFloat(struct.pf_amount) : (pfPct > 0 ? (basic * pfPct) / 100 : (parseFloat(struct.pf) || 0));

                const esiPct = parseFloat(struct.esi_percentage) || 0;
                const esiAmt = struct.esi_amount !== undefined ? parseFloat(struct.esi_amount) : (esiPct > 0 ? (basic * esiPct) / 100 : 0);

                const advance = parseFloat(struct.advance_salary) || 0;
                const loan = parseFloat(struct.loan) || 0;
                const noticeRec = parseFloat(struct.notice_recovery) || 0;

                const deductions = struct.total_deductions || (ptax + pfAmt + esiAmt + advance + loan + noticeRec);
                const netPay = struct.net_salary || (gross - deductions);

                return (
                  <motion.div
                    key={struct.id || struct._id}
                    whileHover={{ y: -4 }}
                    className="bg-white rounded-2xl shadow-lg border border-emerald-100 p-6 flex flex-col justify-between transition-all"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                            {struct.employee_name ? struct.employee_name.charAt(0) : 'E'}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 text-base leading-tight">
                              {struct.employee_name || 'Employee'}
                            </h3>
                            <p className="text-xs text-emerald-600 font-medium mt-0.5">
                              {struct.position || 'Staff Member'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingStructure(struct);
                              setStructureForm({
                                employee_id: struct.employee_id || '',
                                employee_name: struct.employee_name || '',
                                basic_salary: struct.basic_salary !== undefined ? struct.basic_salary : '',
                                hra: struct.hra !== undefined ? struct.hra : '',
                                incentive: struct.incentive !== undefined ? struct.incentive : '',
                                meal: struct.meal !== undefined ? struct.meal : '',
                                bonus: struct.bonus !== undefined ? struct.bonus : '',
                                professional_tax: struct.professional_tax !== undefined ? struct.professional_tax : '',
                                pf_percentage: struct.pf_percentage !== undefined ? struct.pf_percentage : (struct.basic_salary && struct.pf ? ((struct.pf / struct.basic_salary) * 100).toFixed(2) : ''),
                                esi_percentage: struct.esi_percentage !== undefined ? struct.esi_percentage : '',
                                advance_salary: struct.advance_salary !== undefined ? struct.advance_salary : '',
                                loan: struct.loan !== undefined ? struct.loan : '',
                                notice_recovery: struct.notice_recovery !== undefined ? struct.notice_recovery : '',
                              });
                              setShowStructureModal(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Structure"
                          >
                            <FaEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStructure(struct.id || struct._id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Structure"
                          >
                            <FaTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Section 1: Addition Head */}
                      <div className="mb-4 bg-emerald-50/40 rounded-xl p-3 border border-emerald-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Addition Head</span>
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            +₹{gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs text-gray-700">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Basic Salary</span>
                            <span className="font-semibold text-gray-800">₹{basic.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">HRA</span>
                            <span className="font-semibold text-emerald-600">₹{hra.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Incentive</span>
                            <span className="font-semibold text-emerald-600">₹{incentive.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Meal</span>
                            <span className="font-semibold text-emerald-600">₹{meal.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Bonus</span>
                            <span className="font-semibold text-emerald-600">₹{bonus.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Deduction Head */}
                      <div className="mb-4 bg-rose-50/40 rounded-xl p-3 border border-rose-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Deduction Head</span>
                          <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                            -₹{deductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs text-gray-700">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Professional Tax</span>
                            <span className="font-semibold text-rose-600">₹{ptax.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">PF {pfPct > 0 && `(${pfPct}%)`}</span>
                            <span className="font-semibold text-rose-600">₹{pfAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">ESI {esiPct > 0 && `(${esiPct}%)`}</span>
                            <span className="font-semibold text-rose-600">₹{esiAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Advance Salary</span>
                            <span className="font-semibold text-rose-600">₹{advance.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Loan</span>
                            <span className="font-semibold text-rose-600">₹{loan.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Notice Recovery</span>
                            <span className="font-semibold text-rose-600">₹{noticeRec.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Summary */}
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl p-4 shadow-md flex items-center justify-between mt-2">
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-100">Net Payable Salary</div>
                        <div className="text-xl font-black">₹{netPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </div>
                      <div className="text-right text-[11px] text-emerald-50 space-y-0.5">
                        <div>Gross: <span className="font-bold">₹{gross.toLocaleString()}</span></div>
                        <div>Deductions: <span className="font-bold text-rose-200">₹{deductions.toLocaleString()}</span></div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* TAB 3: SALARY SLIP (SHOW NOTHING FOR NOW) */}
      {activeTab === 'salarySlip' && (
        <motion.div
          key="salarySlip"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-white shadow-lg rounded-2xl border border-gray-100 p-16 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-4 text-2xl">
            <FaFileAlt />
          </div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">Salary Slips</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            No salary slips available at the moment.
          </p>
        </motion.div>
      )}

      {/* MODAL: ADD / EDIT PAYROLL RECORD */}
      {showPayrollModal && (
        <AnimatePresence>
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <button
                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-xl font-bold"
                onClick={() => setShowPayrollModal(false)}
              >
                ×
              </button>
              <h3 className="text-xl font-bold text-violet-700 mb-4 text-center">
                {editingPayrollRecord ? 'Edit Payroll Record' : 'Add Payroll Record'}
              </h3>

              <form onSubmit={handlePayrollSave} className="space-y-4">
                {/* Select Employee */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Select Employee <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-violet-600 font-medium">
                      (Employees with active salary structure)
                    </span>
                  </div>

                  {employeesWithStructure.length === 0 && !editingPayrollRecord ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                      <p className="font-bold mb-1">No employees with salary structure found</p>
                      <p className="text-amber-700 mb-2">Please create a salary structure for your employees first before generating payroll records.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPayrollModal(false);
                          setActiveTab('salaryStructure');
                        }}
                        className="bg-amber-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-amber-700 text-xs transition-colors"
                      >
                        Go to Salary Structure Tab
                      </button>
                    </div>
                  ) : (
                    <select
                      className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none bg-white font-medium shadow-xs"
                      value={payrollForm.employee_id}
                      onChange={(e) => handleEmployeePayrollSelect(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Employee --</option>
                      {employeesWithStructure.map((emp) => (
                        <option key={emp.id || emp._id} value={emp.id || emp._id}>
                          {emp.full_name || emp.username} ({emp.email || 'No Email'})
                        </option>
                      ))}
                      {editingPayrollRecord && !employeesWithStructure.some(e => String(e.id) === String(editingPayrollRecord.employee_id) || String(e._id) === String(editingPayrollRecord.employee_id)) && (
                        <option value={editingPayrollRecord.employee_id}>
                          {editingPayrollRecord.employee_name} ({editingPayrollRecord.employee_email || 'Current'})
                        </option>
                      )}
                    </select>
                  )}
                </div>

                {/* Select Month */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Select Month <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="month"
                    className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none bg-white font-medium shadow-xs"
                    value={payrollForm.month}
                    onChange={(e) => setPayrollForm({ ...payrollForm, month: e.target.value })}
                    required
                  />
                </div>

                {/* Gross Salary & Deductions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Gross Salary (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 60000"
                      className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none bg-emerald-50/40 font-semibold text-emerald-800 shadow-xs"
                      value={payrollForm.gross_salary}
                      onChange={(e) => setPayrollForm({ ...payrollForm, gross_salary: e.target.value })}
                      required
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">Auto-filled from addition heads</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Total Deductions (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 5000"
                      className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none bg-rose-50/40 font-semibold text-rose-800 shadow-xs"
                      value={payrollForm.deductions}
                      onChange={(e) => setPayrollForm({ ...payrollForm, deductions: e.target.value })}
                      required
                    />
                    <span className="text-[10px] text-gray-400 mt-1 block">Auto-filled from deduction heads</span>
                  </div>
                </div>

                {/* Net Pay live preview */}
                <div className="bg-gradient-to-r from-violet-50 to-indigo-50 p-4 rounded-xl border border-violet-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-violet-700 tracking-wider block">Calculated Net Pay</span>
                    <span className="text-xl font-black text-violet-900">
                      ₹{((parseFloat(payrollForm.gross_salary) || 0) - (parseFloat(payrollForm.deductions) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <div>Gross: <span className="font-semibold text-gray-800">₹{(parseFloat(payrollForm.gross_salary) || 0).toLocaleString()}</span></div>
                    <div>Deductions: <span className="font-semibold text-rose-600">₹{(parseFloat(payrollForm.deductions) || 0).toLocaleString()}</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Created By</label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none bg-gray-50"
                      value={payrollForm.created_by}
                      onChange={(e) => setPayrollForm({ ...payrollForm, created_by: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Created On</label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none bg-white"
                      value={payrollForm.created_on}
                      onChange={(e) => setPayrollForm({ ...payrollForm, created_on: e.target.value })}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!payrollForm.employee_id}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <FaCheck className="w-4 h-4" />
                  {editingPayrollRecord ? 'Save Changes' : 'Add Record'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* MODAL: CREATE / EDIT SALARY STRUCTURE WITH 2 SECTIONS */}
      {showStructureModal && (() => {
        const modalBasic = parseFloat(structureForm.basic_salary) || 0;
        const modalHra = parseFloat(structureForm.hra) || 0;
        const modalIncentive = parseFloat(structureForm.incentive) || 0;
        const modalMeal = parseFloat(structureForm.meal) || 0;
        const modalBonus = parseFloat(structureForm.bonus) || 0;

        const modalTotalAdditions = modalBasic + modalHra + modalIncentive + modalMeal + modalBonus;

        const modalPtax = parseFloat(structureForm.professional_tax) || 0;
        const modalPfPct = parseFloat(structureForm.pf_percentage) || 0;
        const modalPfAmt = (modalBasic * modalPfPct) / 100;

        const modalEsiPct = parseFloat(structureForm.esi_percentage) || 0;
        const modalEsiAmt = (modalBasic * modalEsiPct) / 100;

        const modalAdvance = parseFloat(structureForm.advance_salary) || 0;
        const modalLoan = parseFloat(structureForm.loan) || 0;
        const modalNotice = parseFloat(structureForm.notice_recovery) || 0;

        const modalTotalDeductions = modalPtax + modalPfAmt + modalEsiAmt + modalAdvance + modalLoan + modalNotice;
        const modalNetPay = modalTotalAdditions - modalTotalDeductions;

        return (
          <AnimatePresence>
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl p-6 sm:p-8 relative max-h-[92vh] overflow-y-auto border border-emerald-100"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
              >
                <button
                  className="absolute top-5 right-5 text-gray-400 hover:text-red-500 text-2xl font-bold w-9 h-9 rounded-full bg-gray-100 hover:bg-red-50 flex items-center justify-center transition-colors"
                  onClick={() => setShowStructureModal(false)}
                >
                  ×
                </button>

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">₹</span>
                    {editingStructure ? 'Edit Salary Structure' : 'Create Salary Structure'}
                  </h3>
                  <p className="text-gray-500 text-xs mt-1">Configure addition (earnings) and deduction heads for the employee</p>
                </div>

                <form onSubmit={handleStructureSave} className="space-y-6">
                  {/* Select Employee */}
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Select Employee <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-medium shadow-sm"
                      value={structureForm.employee_id}
                      onChange={(e) => {
                        const empId = e.target.value;
                        const emp = employees.find((x) => String(x.id) === String(empId));
                        setStructureForm((prev) => ({
                          ...prev,
                          employee_id: empId,
                          employee_name: emp ? (emp.full_name || emp.username) : prev.employee_name,
                        }));
                      }}
                      required
                    >
                      <option value="">-- Choose Employee --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name || emp.username} ({emp.email || 'No Email'})
                        </option>
                      ))}
                      {!employees.length && (
                        <option value="custom">Custom Employee</option>
                      )}
                    </select>
                  </div>

                  {/* SECTION 1: ADDITION HEAD */}
                  <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-200 shadow-sm">
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-emerald-200/70">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                        <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Addition Head (Earnings)</h4>
                      </div>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100/90 px-3 py-1 rounded-full border border-emerald-200">
                        Total Additions: ₹{modalTotalAdditions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Basic Salary */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Basic Salary (₹) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          placeholder="e.g. 40000"
                          className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white shadow-xs"
                          value={structureForm.basic_salary}
                          onChange={(e) => setStructureForm({ ...structureForm, basic_salary: e.target.value })}
                          required
                        />
                      </div>

                      {/* HRA */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          HRA (₹)
                        </label>
                        <input
                          type="number"
                          step="any"
                          placeholder="e.g. 16000"
                          className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white shadow-xs"
                          value={structureForm.hra}
                          onChange={(e) => setStructureForm({ ...structureForm, hra: e.target.value })}
                        />
                      </div>

                      {/* Incentive */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Incentive (₹)
                        </label>
                        <input
                          type="number"
                          step="any"
                          placeholder="e.g. 5000"
                          className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white shadow-xs"
                          value={structureForm.incentive}
                          onChange={(e) => setStructureForm({ ...structureForm, incentive: e.target.value })}
                        />
                      </div>

                      {/* Meal */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Meal (₹)
                        </label>
                        <input
                          type="number"
                          step="any"
                          placeholder="e.g. 2500"
                          className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white shadow-xs"
                          value={structureForm.meal}
                          onChange={(e) => setStructureForm({ ...structureForm, meal: e.target.value })}
                        />
                      </div>

                      {/* Bonus */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Bonus (₹)
                        </label>
                        <input
                          type="number"
                          step="any"
                          placeholder="e.g. 3000"
                          className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white shadow-xs"
                          value={structureForm.bonus}
                          onChange={(e) => setStructureForm({ ...structureForm, bonus: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: DEDUCTION HEAD */}
                  <div className="bg-rose-50/50 rounded-2xl p-5 border border-rose-200 shadow-sm">
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-rose-200/70">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                        <h4 className="text-sm font-bold text-rose-900 uppercase tracking-wider">Deduction Head</h4>
                      </div>
                      <span className="text-xs font-bold text-rose-800 bg-rose-100/90 px-3 py-1 rounded-full border border-rose-200">
                        Total Deductions: ₹{modalTotalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {/* Row 1: Professional Tax */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Professional Tax (₹)
                          </label>
                          <input
                            type="number"
                            step="any"
                            placeholder="e.g. 200"
                            className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none bg-white shadow-xs"
                            value={structureForm.professional_tax}
                            onChange={(e) => setStructureForm({ ...structureForm, professional_tax: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Row 2: PF (% and Calculated Amount) & ESI (% and Calculated Amount) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Provident Fund (PF) */}
                        <div className="bg-white/80 p-3.5 rounded-xl border border-rose-200/80">
                          <label className="block text-xs font-bold text-gray-800 mb-2">
                            Provident Fund (PF)
                          </label>
                          <div className="grid grid-cols-2 gap-2 items-center">
                            <div>
                              <span className="text-[11px] text-gray-500 font-medium block mb-1">PF Rate (%)</span>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="any"
                                  placeholder="e.g. 12"
                                  className="w-full border border-gray-300 rounded-lg p-2 pr-7 text-sm font-semibold focus:ring-2 focus:ring-rose-400 focus:outline-none bg-white"
                                  value={structureForm.pf_percentage}
                                  onChange={(e) => setStructureForm({ ...structureForm, pf_percentage: e.target.value })}
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
                              </div>
                            </div>
                            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-right">
                              <span className="text-[10px] text-gray-500 font-medium block uppercase tracking-wider">Calculated Amount</span>
                              <span className="font-bold text-rose-700 text-sm">
                                ₹{modalPfAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* ESI */}
                        <div className="bg-white/80 p-3.5 rounded-xl border border-rose-200/80">
                          <label className="block text-xs font-bold text-gray-800 mb-2">
                            Employee State Insurance (ESI)
                          </label>
                          <div className="grid grid-cols-2 gap-2 items-center">
                            <div>
                              <span className="text-[11px] text-gray-500 font-medium block mb-1">ESI Rate (%)</span>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="any"
                                  placeholder="e.g. 0.75"
                                  className="w-full border border-gray-300 rounded-lg p-2 pr-7 text-sm font-semibold focus:ring-2 focus:ring-rose-400 focus:outline-none bg-white"
                                  value={structureForm.esi_percentage}
                                  onChange={(e) => setStructureForm({ ...structureForm, esi_percentage: e.target.value })}
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">%</span>
                              </div>
                            </div>
                            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-right">
                              <span className="text-[10px] text-gray-500 font-medium block uppercase tracking-wider">Calculated Amount</span>
                              <span className="font-bold text-rose-700 text-sm">
                                ₹{modalEsiAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Advance Salary, Loan, Notice Recovery */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Advance Salary (₹)
                          </label>
                          <input
                            type="number"
                            step="any"
                            placeholder="e.g. 0"
                            className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none bg-white shadow-xs"
                            value={structureForm.advance_salary}
                            onChange={(e) => setStructureForm({ ...structureForm, advance_salary: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Loan (₹)
                          </label>
                          <input
                            type="number"
                            step="any"
                            placeholder="e.g. 0"
                            className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none bg-white shadow-xs"
                            value={structureForm.loan}
                            onChange={(e) => setStructureForm({ ...structureForm, loan: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Notice Recovery (₹)
                          </label>
                          <input
                            type="number"
                            step="any"
                            placeholder="e.g. 0"
                            className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none bg-white shadow-xs"
                            value={structureForm.notice_recovery}
                            onChange={(e) => setStructureForm({ ...structureForm, notice_recovery: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SUMMARY FOOTER CARD */}
                  <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <span className="text-[11px] font-bold text-emerald-100 uppercase tracking-wider block">Net Payable Salary (Gross - Deductions)</span>
                      <span className="text-2xl sm:text-3xl font-black text-white">
                        ₹{modalNetPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <div className="bg-white/20 backdrop-blur-xs px-3 py-2 rounded-xl text-center">
                        <span className="block text-[10px] text-emerald-100 uppercase">Gross Additions</span>
                        <span className="text-white font-bold">₹{modalTotalAdditions.toLocaleString()}</span>
                      </div>
                      <div className="bg-white/20 backdrop-blur-xs px-3 py-2 rounded-xl text-center">
                        <span className="block text-[10px] text-rose-200 uppercase">Total Deductions</span>
                        <span className="text-rose-100 font-bold">₹{modalTotalDeductions.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowStructureModal(false)}
                      className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:from-emerald-700 hover:to-green-700 transition-all text-sm flex items-center gap-2"
                    >
                      <FaCheck className="w-4 h-4" />
                      {editingStructure ? 'Save Structure Changes' : 'Create Salary Structure'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        );
      })()}
    </div>
  );
};

export default PayrollAdmin;
