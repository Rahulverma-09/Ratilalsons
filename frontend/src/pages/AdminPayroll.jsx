import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { FaSave, FaPlus, FaTrash, FaEdit, FaCheck, FaTimes, FaRupeeSign, FaPercent } from 'react-icons/fa';

const API_BASE_URL = 'https://ratilalsons-backend-api.onrender.com';

const PayrollAdmin = () => {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({
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
  const [editingStructure, setEditingStructure] = useState(null);
  const [newStructure, setNewStructure] = useState({
    position: '',
    basic_salary: '',
    hra_rate: 40,
    allowance_rate: 20
  });
  const [paymentSlips, setPaymentSlips] = useState([]);
  const [paymentReleases, setPaymentReleases] = useState([]);
  const [showPaymentSlips, setShowPaymentSlips] = useState(false);
  const [showPaymentReleases, setShowPaymentReleases] = useState(false);
  const [paymentFilters, setPaymentFilters] = useState({
    period: '',
    status: ''
  });

  // Fetch admin config and salary structures
  const fetchConfig = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');

      // Fetch payroll config
      const configRes = await fetch(`${API_BASE_URL}/api/payroll/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData.data || config);
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
      console.error('Error fetching config:', error);
      toast.error('Failed to load payroll config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const saveConfig = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/api/payroll/config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        toast.success('Payroll configuration saved successfully!');
      } else {
        toast.error('Failed to save configuration');
      }
    } catch (error) {
      toast.error('Error saving configuration');
    }
  };

  const saveStructure = async (structure) => {
    try {
      const token = localStorage.getItem('access_token');
      const url = editingStructure
        ? `${API_BASE_URL}/api/payroll/structures/${editingStructure.id}`
        : `${API_BASE_URL}/api/payroll/structures`;

      const method = editingStructure ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(structure)
      });

      if (response.ok) {
        toast.success(editingStructure ? 'Structure updated!' : 'Structure created!');
        setEditingStructure(null);
        setNewStructure({ position: '', basic_salary: '', hra_rate: 40, allowance_rate: 20 });
        fetchConfig(); // Refresh data
      }
    } catch (error) {
      toast.error('Error saving structure');
    }
  };

  const deleteStructure = async (id) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/api/payroll/structures/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Structure deleted!');
        fetchConfig();
      }
    } catch (error) {
      toast.error('Error deleting structure');
    }
  };

  const fetchPaymentSlips = async () => {
    try {
      const token = localStorage.getItem('access_token');
      let url = `${API_BASE_URL}/api/payroll/admin/all-payment-slips?page=1&limit=50`;

      if (paymentFilters.period) {
        url += `&period=${paymentFilters.period}`;
      }
      if (paymentFilters.status) {
        url += `&status=${paymentFilters.status}`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentSlips(data.data.records || []);
      } else {
        console.error('Failed to fetch payment slips');
      }
    } catch (error) {
      console.error('Error fetching payment slips:', error);
    }
  };

  const fetchPaymentReleases = async () => {
    try {
      const token = localStorage.getItem('access_token');
      let url = `${API_BASE_URL}/api/payroll/admin/payment-releases?page=1&limit=50`;

      if (paymentFilters.period) {
        url += `&period=${paymentFilters.period}`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentReleases(data.data.releases || []);
      } else {
        console.error('Failed to fetch payment releases');
      }
    } catch (error) {
      console.error('Error fetching payment releases:', error);
    }
  };

  const releasePayment = async (payrollRecordId, paymentMethod = 'bank_transfer', transactionId = '') => {
    try {
      const token = localStorage.getItem('access_token');
      const paymentData = {
        payroll_record_id: payrollRecordId,
        payment_method: paymentMethod,
        transaction_id: transactionId
      };

      const response = await fetch(`${API_BASE_URL}/api/payroll/admin/release-payment/${payrollRecordId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentData)
      });

      if (response.ok) {
        alert('Payment released successfully!');
        fetchPaymentSlips(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`Failed to release payment: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error releasing payment:', error);
      alert('Error releasing payment');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading Payroll Admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 mb-8 border border-white/50"
      >
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
          Payroll Admin Configuration
        </h1>
        <p className="text-gray-600 text-lg">Set global payroll parameters and salary structures</p>
      </motion.div>

      {/* Global Payroll Config */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 mb-8 border border-white/50"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <FaRupeeSign className="text-emerald-600" /> Global Payroll Parameters
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">HRA Rate (%)</label>
            <input
              type="number"
              value={config.hra_rate}
              onChange={(e) => setConfig({ ...config, hra_rate: parseFloat(e.target.value) })}
              className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Allowance Rate (%)</label>
            <input
              type="number"
              value={config.allowance_rate}
              onChange={(e) => setConfig({ ...config, allowance_rate: parseFloat(e.target.value) })}
              className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">PF Rate (%)</label>
            <input
              type="number"
              value={config.pf_rate}
              onChange={(e) => setConfig({ ...config, pf_rate: parseFloat(e.target.value) })}
              className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Professional Tax (₹)</label>
            <input
              type="number"
              value={config.professional_tax}
              onChange={(e) => setConfig({ ...config, professional_tax: parseFloat(e.target.value) })}
              className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">TDS Rate (%)</label>
            <input
              type="number"
              value={config.tds_rate}
              onChange={(e) => setConfig({ ...config, tds_rate: parseFloat(e.target.value) })}
              className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">TDS Threshold (₹)</label>
            <input
              type="number"
              value={config.tds_threshold}
              onChange={(e) => setConfig({ ...config, tds_threshold: parseFloat(e.target.value) })}
              className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Working Days</label>
            <input
              type="number"
              value={config.working_days}
              onChange={(e) => setConfig({ ...config, working_days: parseInt(e.target.value) })}
              className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Active Period</label>
            <input
              type="month"
              value={config.active_period}
              onChange={(e) => setConfig({ ...config, active_period: e.target.value })}
              className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <button
          onClick={saveConfig}
          className="mt-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-8 rounded-2xl font-bold text-lg hover:from-indigo-700 hover:to-purple-700 shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3 mx-auto"
        >
          <FaSave /> Save Global Configuration
        </button>
      </motion.div>

      {/* Salary Structures */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/50"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            Salary Structures
          </h2>
          <button
            onClick={() => setEditingStructure(null)}
            className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-green-700 shadow-lg flex items-center gap-2"
          >
            <FaPlus /> New Structure
          </button>
        </div>

        {/* Salary Structure Form */}
        {(editingStructure || !salaryStructures.length) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-emerald-50 to-green-50 p-8 rounded-2xl border-2 border-emerald-200 mb-8"
          >
            <h3 className="text-xl font-bold text-emerald-900 mb-6">
              {editingStructure ? 'Edit' : 'Create'} Salary Structure
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Position</label>
                <input
                  type="text"
                  placeholder="e.g., Software Engineer"
                  value={editingStructure ? editingStructure.position : newStructure.position}
                  onChange={(e) => editingStructure
                    ? setEditingStructure({ ...editingStructure, position: e.target.value })
                    : setNewStructure({ ...newStructure, position: e.target.value })}
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Basic Salary (₹)</label>
                <input
                  type="number"
                  placeholder="50000"
                  value={editingStructure ? editingStructure.basic_salary : newStructure.basic_salary}
                  onChange={(e) => editingStructure
                    ? setEditingStructure({ ...editingStructure, basic_salary: parseFloat(e.target.value) })
                    : setNewStructure({ ...newStructure, basic_salary: parseFloat(e.target.value) })}
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">HRA Rate (%)</label>
                <input
                  type="number"
                  value={editingStructure ? editingStructure.hra_rate : newStructure.hra_rate}
                  onChange={(e) => editingStructure
                    ? setEditingStructure({ ...editingStructure, hra_rate: parseFloat(e.target.value) })
                    : setNewStructure({ ...newStructure, hra_rate: parseFloat(e.target.value) })}
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Allowance Rate (%)</label>
                <input
                  type="number"
                  value={editingStructure ? editingStructure.allowance_rate : newStructure.allowance_rate}
                  onChange={(e) => editingStructure
                    ? setEditingStructure({ ...editingStructure, allowance_rate: parseFloat(e.target.value) })
                    : setNewStructure({ ...newStructure, allowance_rate: parseFloat(e.target.value) })}
                  className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button
                onClick={() => saveStructure(editingStructure || newStructure)}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 text-white py-4 px-6 rounded-xl font-bold hover:from-emerald-700 hover:to-green-700 shadow-xl flex items-center justify-center gap-2"
              >
                <FaCheck /> {editingStructure ? 'Update' : 'Create'} Structure
              </button>
              <button
                onClick={() => {
                  setEditingStructure(null);
                  setNewStructure({ position: '', basic_salary: '', hra_rate: 40, allowance_rate: 20 });
                }}
                className="px-6 py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors flex items-center gap-2"
              >
                <FaTimes /> Cancel
              </button>
            </div>
          </motion.div>
        )}

        {/* Salary Structures Table */}
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-2xl shadow-sm">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Position</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Basic Salary</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">HRA %</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Allowance %</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {salaryStructures.map((structure) => (
                <tr key={structure.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{structure.position}</td>
                  <td className="px-6 py-4">
                    <span className="text-lg font-bold text-emerald-600">₹{parseFloat(structure.basic_salary).toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                      {structure.hra_rate}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-semibold rounded-full">
                      {structure.allowance_rate}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => setEditingStructure(structure)}
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-xl transition-all"
                      title="Edit"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => deleteStructure(structure.id)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-xl transition-all"
                      title="Delete"
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Payment Management Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 mt-8 border border-white/50"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Payment Management</h2>

        {/* Tab Navigation */}
        <div className="flex space-x-4 mb-8">
          <button
            onClick={() => {
              setShowPaymentSlips(true);
              setShowPaymentReleases(false);
              fetchPaymentSlips();
            }}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${showPaymentSlips
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            All Payment Slips
          </button>
          <button
            onClick={() => {
              setShowPaymentReleases(true);
              setShowPaymentSlips(false);
              fetchPaymentReleases();
            }}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${showPaymentReleases
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Payment Releases
          </button>
        </div>

        {/* Filters */}
        {(showPaymentSlips || showPaymentReleases) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Period</label>
              <input
                type="month"
                value={paymentFilters.period}
                onChange={(e) => setPaymentFilters({ ...paymentFilters, period: e.target.value })}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {showPaymentSlips && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                <select
                  value={paymentFilters.status}
                  onChange={(e) => setPaymentFilters({ ...paymentFilters, status: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            )}
            <div className="flex items-end">
              <button
                onClick={showPaymentSlips ? fetchPaymentSlips : fetchPaymentReleases}
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* Payment Slips Table */}
        {showPaymentSlips && (
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-2xl shadow-sm">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Net Pay</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paymentSlips.length > 0 ? paymentSlips.map((slip) => (
                  <tr key={slip.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{slip.employee_info?.name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">{slip.employee_info?.department || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">{slip.period}</td>
                    <td className="px-6 py-4">
                      <span className="text-lg font-bold text-emerald-600">
                        ₹{slip.calculation?.net_pay?.toLocaleString() || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${slip.status === 'paid' ? 'bg-green-100 text-green-800' :
                        slip.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                        {slip.status || 'draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {slip.status !== 'paid' && (
                        <button
                          onClick={() => {
                            const transactionId = prompt('Enter transaction ID (optional):');
                            releasePayment(slip.id, 'bank_transfer', transactionId || '');
                          }}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
                        >
                          Release Payment
                        </button>
                      )}
                      {slip.status === 'paid' && (
                        <span className="text-green-600 font-semibold">✓ Paid</span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      No payment slips found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Payment Releases Table */}
        {showPaymentReleases && (
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-2xl shadow-sm">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Employee ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Released Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Payment Method</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Transaction ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paymentReleases.length > 0 ? paymentReleases.map((release, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{release.employee_id}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{release.period}</td>
                    <td className="px-6 py-4">
                      <span className="text-lg font-bold text-emerald-600">₹{release.amount?.toLocaleString() || 0}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {new Date(release.released_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                        {release.payment_method || 'bank_transfer'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{release.transaction_id || 'N/A'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      No payment releases found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default PayrollAdmin;
