// ComplaintsModule.jsx with API Integration
import React, { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import { CUSTOMER_PORTAL_API, getAuthHeaders } from "../../config.js";

const ComplaintsModule = ({ customerId }) => {
  const [complaints, setComplaints] = useState([]);
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    vendor: '',
    product: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vendors, setVendors] = useState([]);

  // Fetch vendors and complaints on component mount
  useEffect(() => {
    fetchVendors();
    fetchComplaints();
  }, []);

  // Fetch complaints when search or status changes
  useEffect(() => {
    fetchComplaints();
  }, [search, statusFilter]);

  const fetchVendors = async () => {
    try {
      const response = await fetch(CUSTOMER_PORTAL_API.VENDORS, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setVendors(data.vendors || []);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const params = [];
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      if (statusFilter) params.push(`status=${statusFilter}`);
      const queryString = params.length > 0 ? `?${params.join('&')}` : '';
      
      const response = await fetch(`${CUSTOMER_PORTAL_API.COMPLAINTS}${queryString}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setComplaints(data.complaints || []);
      } else {
        setError('Failed to fetch complaints');
      }
    } catch (error) {
      console.error('Error fetching complaints:', error);
      setError('Error loading complaints');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.subject.trim() || !formData.description.trim()) {
      setError('Subject and description are required');
      return;
    }

    const complaintData = {
      subject: formData.subject,
      description: formData.description,
      vendor: formData.vendor || 'General',
      product: formData.product || 'General'
    };

    try {
      setSubmitting(true);
      setError('');
      
      const response = await fetch(CUSTOMER_PORTAL_API.COMPLAINTS, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(complaintData)
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Complaint submitted successfully!');
        setFormData({
          subject: '',
          description: '',
          vendor: '',
          product: '',
        });
        await fetchComplaints(); // Refresh the list
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to submit complaint');
      }
    } catch (error) {
      console.error('Error submitting complaint:', error);
      setError('Failed to submit complaint. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      open: "bg-red-100 text-red-800",
      "in-progress": "bg-yellow-100 text-yellow-800",
      resolved: "bg-green-100 text-green-800",
      closed: "bg-gray-100 text-gray-800"
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses[status] || statusClasses.open}`}>
        {status}
      </span>
    );
  };

  const filteredComplaints = complaints.filter(
    (comp) =>
      comp.vendor.toLowerCase().includes(search.toLowerCase()) ||
      comp.product.toLowerCase().includes(search.toLowerCase()) ||
      comp.subject.toLowerCase().includes(search.toLowerCase()) ||
      comp.status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div 
      className="bg-gray-50 p-4 sm:p-8 max-w-8xl mx-auto min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div
        className="py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8"
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      >
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-left text-red-700 leading-7 drop-shadow">
            Complaint Management
          </h1>
          <p className="text-gray-500 mt-1 text-left text-xs sm:text-sm md:text-base">
            Submit and track your complaints with vendors.
          </p>
        </div>
        <div className="mt-3 sm:mt-0 sm:ml-4 w-full sm:w-auto flex gap-2">
          <motion.input
            type="text"
            placeholder="Search complaints..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400 w-full sm:w-64 text-sm shadow-inner"
            whileFocus={{ scale: 1.02, borderColor: "#ef4444" }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </motion.div>

      {/* Error Display */}
      {error && (
        <motion.div 
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.div>
      )}

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Submit New Complaint */}
        <motion.div
          className="bg-white shadow-lg rounded-2xl border border-red-100 p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-xl font-bold text-red-700 mb-6">Submit New Complaint</h3>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Subject *
              </label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                placeholder="Brief description of the issue"
                className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Vendor
              </label>
              <select
                name="vendor"
                value={formData.vendor}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
              >
                <option value="">Select Vendor</option>
                {vendors.map(vendor => (
                  <option key={vendor.id} value={vendor.name}>{vendor.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Product/Service
              </label>
              <input
                type="text"
                name="product"
                value={formData.product}
                onChange={handleChange}
                placeholder="Product or service name"
                className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Detailed description of your complaint..."
                className="w-full border border-gray-300 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-vertical shadow-inner text-sm"
                rows="5"
                required
              />
            </div>

            <motion.button
              type="submit"
              disabled={submitting}
              className={`w-full font-bold py-4 px-8 rounded-xl shadow-lg transition-all text-lg ${
                submitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white hover:shadow-xl'
              }`}
              whileTap={{ scale: submitting ? 1 : 0.96 }}
            >
              {submitting ? 'Submitting...' : 'Submit Complaint'}
            </motion.button>
          </form>
        </motion.div>

        {/* Complaint History */}
        <motion.div
          className="bg-white shadow-lg rounded-2xl border border-red-100 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
            <h3 className="text-lg font-bold text-red-700">Complaint History</h3>
          </div>
          
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-2"></div>
                <p className="text-gray-500">Loading complaints...</p>
              </div>
            ) : (
              <table className="min-w-[700px] w-full text-sm">
                <thead className="bg-gradient-to-r from-red-50 to-red-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-red-700 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-red-700 uppercase tracking-wider">Vendor</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-red-700 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-red-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-red-700 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {complaints.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400">
                        {search || statusFilter ? "No complaints found matching your criteria." : "No complaints submitted yet."}
                      </td>
                    </tr>
                  ) : (
                    complaints.map((complaint) => (
                      <tr key={complaint.id} className="hover:bg-red-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{complaint.subject}</div>
                          <div className="text-sm text-gray-500 max-w-xs truncate" title={complaint.description}>
                            {complaint.description}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">{complaint.vendor}</td>
                        <td className="px-6 py-4 text-gray-700">{complaint.product}</td>
                        <td className="px-4 py-4 text-center">
                          {getStatusBadge(complaint.status)}
                        </td>
                        <td className="px-6 py-4 text-gray-700">{complaint.date}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </div>

      {/* Stats */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="bg-white p-6 rounded-xl shadow-lg border border-red-100 text-center">
          <div className="text-3xl font-bold text-red-700 mb-2">{complaints.length}</div>
          <div className="text-sm text-gray-500 font-medium">Total Complaints</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border border-yellow-100 text-center">
          <div className="text-3xl font-bold text-yellow-600 mb-2">
            {complaints.filter(c => c.status === 'open').length}
          </div>
          <div className="text-sm text-gray-500 font-medium">Open</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border border-blue-100 text-center">
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {complaints.filter(c => c.status === 'in-progress').length}
          </div>
          <div className="text-sm text-gray-500 font-medium">In Progress</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border border-green-100 text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">
            {complaints.filter(c => c.status === 'resolved' || c.status === 'closed').length}
          </div>
          <div className="text-sm text-gray-500 font-medium">Resolved</div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ComplaintsModule;