import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaRupeeSign, FaDownload, FaPlus, FaEye } from 'react-icons/fa';

const API_BASE_URL = 'https://ratilalsons-backend-api.onrender.com';

const EmployeePayroll = () => {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [salaryStructure, setSalaryStructure] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [taxDeductions, setTaxDeductions] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    category: 'payroll',
    priority: 'medium'
  });

  useEffect(() => {
    getCurrentUser();
    fetchEmployeeData();
  }, []);

  const getCurrentUser = () => {
    try {
      const userKeys = ["user", "currentUser", "user_info"];
      for (const key of userKeys) {
        const userStr = localStorage.getItem(key);
        if (userStr) {
          try {
            const parsedUser = JSON.parse(userStr);
            if (parsedUser && Object.keys(parsedUser).length > 0) {
              setCurrentUser(parsedUser);
              break;
            }
          } catch (e) {
            console.error(`Error parsing user data from ${key}:`, e);
          }
        }
      }
    } catch (e) {
      console.error("Error getting user info:", e);
    }
  };

  const fetchEmployeeData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const userId = currentUser?.user_id || currentUser?.id || currentUser?.userId;

      if (!userId) {
        console.error('No user ID found');
        return;
      }

      // Fetch salary structure
      const salaryRes = await fetch(`${API_BASE_URL}/api/payroll/employee/salary-structure/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (salaryRes.ok) {
        const salaryData = await salaryRes.json();
        setSalaryStructure(salaryData.data);
      }

      // Fetch payslips
      const payslipsRes = await fetch(`${API_BASE_URL}/api/payroll/employee/payslips/${userId}?limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (payslipsRes.ok) {
        const payslipsData = await payslipsRes.json();
        setPayslips(payslipsData.data.payslips || []);
      }

      // Fetch tax deductions
      const taxRes = await fetch(`${API_BASE_URL}/api/payroll/employee/tax-deductions/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (taxRes.ok) {
        const taxData = await taxRes.json();
        setTaxDeductions(taxData.data);
      }

    } catch (error) {
      console.error('Error fetching employee data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRaiseTicket = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const userId = currentUser?.user_id || currentUser?.id || currentUser?.userId;

      const ticketData = {
        ...newTicket,
        employee_id: userId
      };

      const response = await fetch(`${API_BASE_URL}/api/payroll/employee/raise-ticket`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ticketData)
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Ticket raised successfully! Ticket ID: ${result.data.ticket_id}`);
        setShowTicketModal(false);
        setNewTicket({ subject: '', description: '', category: 'payroll', priority: 'medium' });
      } else {
        throw new Error('Failed to raise ticket');
      }
    } catch (error) {
      console.error('Error raising ticket:', error);
      alert('Failed to raise ticket');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading Your Payroll...</p>
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
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
          My Payroll Dashboard
        </h1>
        <p className="text-gray-600 text-lg">Welcome, {currentUser?.name || 'Employee'}! View your salary details and payslips.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Salary Structure */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/50"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <FaRupeeSign className="text-emerald-600" /> My Salary Structure
          </h2>

          {salaryStructure ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl">
                <span className="text-gray-700 font-medium">Employee Name:</span>
                <span className="text-gray-900 font-bold">{salaryStructure.employee_name}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                <span className="text-gray-700 font-medium">Position:</span>
                <span className="text-gray-900 font-bold">{salaryStructure.position}</span>
              </div>
              {salaryStructure.structure ? (
                <>
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                    <span className="text-gray-700 font-medium">Basic Salary:</span>
                    <span className="text-2xl font-bold text-emerald-600">₹{parseFloat(salaryStructure.structure.basic_salary).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl">
                    <span className="text-gray-700 font-medium">HRA Rate:</span>
                    <span className="text-lg font-bold text-blue-600">{salaryStructure.structure.hra_rate}%</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl">
                    <span className="text-gray-700 font-medium">Allowance Rate:</span>
                    <span className="text-lg font-bold text-indigo-600">{salaryStructure.structure.allowance_rate}%</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                  <span className="text-gray-700 font-medium">Basic Salary:</span>
                  <span className="text-2xl font-bold text-emerald-600">₹{parseFloat(salaryStructure.basic_salary).toLocaleString()}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No salary structure found</p>
          )}
        </motion.div>

        {/* Tax & Deductions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 border border-white/50"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Tax & Deductions Summary</h2>

          {taxDeductions ? (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-sm text-gray-600">Financial Year: {taxDeductions.financial_year}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl text-center">
                  <p className="text-sm text-gray-600">Total PF</p>
                  <p className="text-xl font-bold text-red-600">₹{taxDeductions.summary.total_pf.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl text-center">
                  <p className="text-sm text-gray-600">Total TDS</p>
                  <p className="text-xl font-bold text-orange-600">₹{taxDeductions.summary.total_tds.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl text-center">
                  <p className="text-sm text-gray-600">Professional Tax</p>
                  <p className="text-xl font-bold text-purple-600">₹{taxDeductions.summary.total_professional_tax.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl text-center">
                  <p className="text-sm text-gray-600">Total Deductions</p>
                  <p className="text-xl font-bold text-gray-700">₹{taxDeductions.summary.total_deductions.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No tax information available</p>
          )}
        </motion.div>
      </div>

      {/* Payslips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 mt-8 border border-white/50"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">My Payslips</h2>
          <button
            onClick={() => setShowTicketModal(true)}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 shadow-lg flex items-center gap-2"
          >
            <FaPlus /> Raise Ticket
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-2xl shadow-sm">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Period</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Gross Pay</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Deductions</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Net Pay</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payslips.length > 0 ? payslips.map((payslip) => (
                <tr key={payslip.period} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{payslip.period}</td>
                  <td className="px-6 py-4">
                    <span className="text-lg font-bold text-emerald-600">₹{payslip.calculation.total_earnings.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-lg font-bold text-red-600">₹{payslip.calculation.total_deductions.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-lg font-bold text-blue-600">₹{payslip.calculation.net_pay.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${payslip.status === 'paid' ? 'bg-green-100 text-green-800' :
                      payslip.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                      {payslip.status || 'draft'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-xl transition-all"
                      title="View Details"
                    >
                      <FaEye />
                    </button>
                    <button
                      className="ml-2 p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-xl transition-all"
                      title="Download"
                    >
                      <FaDownload />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    No payslips available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Ticket Modal */}
      {showTicketModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-8 m-4 max-w-md w-full shadow-2xl"
          >
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Raise Payroll Ticket</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Subject</label>
                <input
                  type="text"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  placeholder="Brief description of your issue"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 h-32"
                  placeholder="Detailed description of your payroll issue"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                <select
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={handleRaiseTicket}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-6 rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700"
              >
                Submit Ticket
              </button>
              <button
                onClick={() => setShowTicketModal(false)}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default EmployeePayroll;