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
    gross_salary: '',
    deductions: '',
    created_by: 'Admin',
    created_on: new Date().toISOString().split('T')[0],
  });

  const [showStructureModal, setShowStructureModal] = useState(false);
  const [editingStructure, setEditingStructure] = useState(null);
  const [structureForm, setStructureForm] = useState({
    employee_id: '',
    basic_salary: '',
    hra: '',
    allowance: '',
    pf: '',
    professional_tax: '',
    tds: '',
  });

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
        const res = await fetch(`${API_BASE_URL}/api/payroll/admin/all-payment-slips?page=1&limit=100`, { headers });
        if (res.ok) {
          const resData = await res.json();
          const records = resData?.data?.records || (Array.isArray(resData) ? resData : []);
          if (Array.isArray(records)) {
            const mappedRecords = records.map((slip, idx) => ({
              id: slip.id || `pay-${idx}`,
              sr_no: idx + 1,
              employee_name: slip.employee_info?.name || slip.employee_name || 'Employee',
              employee_email: slip.employee_info?.email || slip.employee_email || '',
              role: slip.employee_info?.department || slip.role || 'Staff',
              gross_salary: slip.calculation?.gross_pay || slip.gross_salary || 0,
              deductions: slip.calculation?.total_deductions || slip.deductions || 0,
              net_pay: slip.calculation?.net_pay || slip.net_pay || 0,
              created_by: slip.created_by || 'Admin',
              created_on: slip.created_at ? slip.created_at.split('T')[0] : (slip.created_on || new Date().toISOString().split('T')[0]),
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
  const handlePayrollSave = (e) => {
    e.preventDefault();
    const gross = parseFloat(payrollForm.gross_salary) || 0;
    const ded = parseFloat(payrollForm.deductions) || 0;
    const net = gross - ded;

    let selectedEmp = employees.find((emp) => String(emp.id) === String(payrollForm.employee_id));
    const empName = selectedEmp ? (selectedEmp.full_name || selectedEmp.username) : payrollForm.employee_name || 'Employee';
    const empEmail = selectedEmp ? selectedEmp.email : payrollForm.employee_email || '';

    if (editingPayrollRecord) {
      setPayrollData((prev) =>
        prev.map((item) =>
          item.id === editingPayrollRecord.id
            ? {
                ...item,
                employee_name: empName,
                employee_email: empEmail,
                gross_salary: gross,
                deductions: ded,
                net_pay: net,
                created_by: payrollForm.created_by || 'Admin',
                created_on: payrollForm.created_on || new Date().toISOString().split('T')[0],
              }
            : item
        )
      );
      toast.success('Payroll record updated successfully!');
    } else {
      const newRecord = {
        id: `pay-${Date.now()}`,
        sr_no: payrollData.length + 1,
        employee_name: empName,
        employee_email: empEmail,
        role: selectedEmp ? selectedEmp.role || 'Staff' : 'Staff',
        gross_salary: gross,
        deductions: ded,
        net_pay: net,
        created_by: payrollForm.created_by || 'Admin',
        created_on: payrollForm.created_on || new Date().toISOString().split('T')[0],
      };
      setPayrollData((prev) => [newRecord, ...prev]);
      toast.success('Payroll record added successfully!');
    }
    setShowPayrollModal(false);
    setEditingPayrollRecord(null);
  };

  // Handle Delete Payroll Record
  const handleDeletePayrollRecord = (id) => {
    if (window.confirm('Are you sure you want to delete this payroll record?')) {
      setPayrollData((prev) => prev.filter((item) => item.id !== id));
      toast.success('Payroll record deleted!');
    }
  };

  // Handle Structure Modal Submit
  const handleStructureSave = (e) => {
    e.preventDefault();
    let selectedEmp = employees.find((emp) => String(emp.id) === String(structureForm.employee_id));
    const empName = selectedEmp ? (selectedEmp.full_name || selectedEmp.username) : structureForm.employee_name || 'Selected Employee';
    const empPos = selectedEmp ? (selectedEmp.position || selectedEmp.role || 'Staff') : 'Staff';

    const newStruct = {
      id: editingStructure ? editingStructure.id : `struct-${Date.now()}`,
      employee_id: structureForm.employee_id,
      employee_name: empName,
      position: empPos,
      basic_salary: parseFloat(structureForm.basic_salary) || 0,
      hra: parseFloat(structureForm.hra) || 0,
      allowance: parseFloat(structureForm.allowance) || 0,
      pf: parseFloat(structureForm.pf) || 0,
      professional_tax: parseFloat(structureForm.professional_tax) || 0,
      tds: parseFloat(structureForm.tds) || 0,
    };

    if (editingStructure) {
      setSalaryStructures((prev) =>
        prev.map((item) => (item.id === editingStructure.id ? newStruct : item))
      );
      toast.success('Salary structure updated successfully!');
    } else {
      setSalaryStructures((prev) => [...prev, newStruct]);
      toast.success('Salary structure created successfully!');
    }
    setShowStructureModal(false);
    setEditingStructure(null);
  };

  // Delete Salary Structure
  const handleDeleteStructure = (id) => {
    if (window.confirm('Are you sure you want to delete this salary structure?')) {
      setSalaryStructures((prev) => prev.filter((item) => item.id !== id));
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
            className={`flex-1 py-4 px-6 font-bold text-sm focus:outline-none transition-all ${
              activeTab === 'payrollData'
                ? 'bg-violet-50 border-b-2 border-violet-600 text-violet-700 shadow-md'
                : 'text-gray-600 hover:text-violet-700 hover:bg-violet-50'
            }`}
            whileTap={{ scale: 0.98 }}
          >
            Payroll Data
          </motion.button>
          <motion.button
            onClick={() => setActiveTab('salaryStructure')}
            className={`flex-1 py-4 px-6 font-bold text-sm focus:outline-none transition-all ${
              activeTab === 'salaryStructure'
                ? 'bg-emerald-50 border-b-2 border-emerald-600 text-emerald-700 shadow-md'
                : 'text-gray-600 hover:text-emerald-700 hover:bg-emerald-50'
            }`}
            whileTap={{ scale: 0.98 }}
          >
            Salary Structure
          </motion.button>
          <motion.button
            onClick={() => setActiveTab('salarySlip')}
            className={`flex-1 py-4 px-6 font-bold text-sm focus:outline-none transition-all ${
              activeTab === 'salarySlip'
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
                      <td colSpan={8} className="py-12 text-center text-gray-400">
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
                  className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                    safePage > 1
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
                  className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                    safePage < totalPages
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
                  basic_salary: '',
                  hra: '',
                  allowance: '',
                  pf: '',
                  professional_tax: '',
                  tds: '',
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
                const allowance = parseFloat(struct.allowance) || 0;
                const pf = parseFloat(struct.pf) || 0;
                const ptax = parseFloat(struct.professional_tax) || 0;
                const tds = parseFloat(struct.tds) || 0;

                const gross = basic + hra + allowance;
                const deductions = pf + ptax + tds;
                const netPay = gross - deductions;

                return (
                  <motion.div
                    key={struct.id}
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
                              {struct.employee_name}
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
                                basic_salary: struct.basic_salary || '',
                                hra: struct.hra || '',
                                allowance: struct.allowance || '',
                                pf: struct.pf || '',
                                professional_tax: struct.professional_tax || '',
                                tds: struct.tds || '',
                              });
                              setShowStructureModal(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Structure"
                          >
                            <FaEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteStructure(struct.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Structure"
                          >
                            <FaTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Particular Breakdown */}
                      <div className="space-y-2 text-xs mb-5">
                        <div className="flex justify-between py-1 border-b border-gray-50">
                          <span className="text-gray-500 font-medium">Basic Salary</span>
                          <span className="font-semibold text-gray-800">₹{basic.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-50">
                          <span className="text-gray-500 font-medium">HRA</span>
                          <span className="font-semibold text-emerald-600">+₹{hra.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-50">
                          <span className="text-gray-500 font-medium">ALLOWANCE</span>
                          <span className="font-semibold text-emerald-600">+₹{allowance.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-50">
                          <span className="text-gray-500 font-medium">PF</span>
                          <span className="font-semibold text-red-500">-₹{pf.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-50">
                          <span className="text-gray-500 font-medium">PROFESSIONAL TAX</span>
                          <span className="font-semibold text-red-500">-₹{ptax.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-500 font-medium">TDS</span>
                          <span className="font-semibold text-red-500">-₹{tds.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Summary */}
                    <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-3.5 border border-emerald-100 flex items-center justify-between mt-2">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Net Pay</div>
                        <div className="text-lg font-black text-emerald-700">₹{netPay.toLocaleString()}</div>
                      </div>
                      <div className="text-right text-[11px] text-gray-600 space-y-0.5">
                        <div>Gross: <span className="font-semibold text-gray-800">₹{gross.toLocaleString()}</span></div>
                        <div>Deductions: <span className="font-semibold text-red-600">₹{deductions.toLocaleString()}</span></div>
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
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Select Employee <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none"
                    value={payrollForm.employee_id}
                    onChange={(e) => {
                      const empId = e.target.value;
                      const emp = employees.find((x) => String(x.id) === String(empId));
                      setPayrollForm((prev) => ({
                        ...prev,
                        employee_id: empId,
                        employee_name: emp ? (emp.full_name || emp.username) : prev.employee_name,
                        employee_email: emp ? emp.email : prev.employee_email,
                      }));
                    }}
                    required
                  >
                    <option value="">Select Employee</option>
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

                {!employees.length && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Employee Name</label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none"
                      value={payrollForm.employee_name}
                      onChange={(e) => setPayrollForm({ ...payrollForm, employee_name: e.target.value })}
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Gross Salary (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none"
                    value={payrollForm.gross_salary}
                    onChange={(e) => setPayrollForm({ ...payrollForm, gross_salary: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Deductions (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none"
                    value={payrollForm.deductions}
                    onChange={(e) => setPayrollForm({ ...payrollForm, deductions: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Created By</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none bg-gray-50"
                    value={payrollForm.created_by}
                    onChange={(e) => setPayrollForm({ ...payrollForm, created_by: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Created On</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none"
                    value={payrollForm.created_on}
                    onChange={(e) => setPayrollForm({ ...payrollForm, created_on: e.target.value })}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm mt-4"
                >
                  {editingPayrollRecord ? 'Save Changes' : 'Add Record'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* MODAL: CREATE / EDIT SALARY STRUCTURE */}
      {showStructureModal && (
        <AnimatePresence>
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <button
                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-xl font-bold"
                onClick={() => setShowStructureModal(false)}
              >
                ×
              </button>
              <h3 className="text-xl font-bold text-emerald-700 mb-4 text-center">
                {editingStructure ? 'Edit Salary Structure' : 'Create Salary Structure'}
              </h3>

              <form onSubmit={handleStructureSave} className="space-y-3.5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Select Employee <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
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
                    <option value="">Select Employee</option>
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

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Basic Salary (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 40000"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                    value={structureForm.basic_salary}
                    onChange={(e) => setStructureForm({ ...structureForm, basic_salary: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    HRA (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 16000"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                    value={structureForm.hra}
                    onChange={(e) => setStructureForm({ ...structureForm, hra: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    ALLOWANCE (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 9000"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                    value={structureForm.allowance}
                    onChange={(e) => setStructureForm({ ...structureForm, allowance: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    PF (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 4800"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                    value={structureForm.pf}
                    onChange={(e) => setStructureForm({ ...structureForm, pf: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    PROFESSIONAL TAX (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 200"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                    value={structureForm.professional_tax}
                    onChange={(e) => setStructureForm({ ...structureForm, professional_tax: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    TDS (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 1500"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                    value={structureForm.tds}
                    onChange={(e) => setStructureForm({ ...structureForm, tds: e.target.value })}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm mt-4"
                >
                  {editingStructure ? 'Save Structure Changes' : 'Create Salary Structure'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default PayrollAdmin;
