import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HRDocumentReview = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    status: '',
    hr_comments: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [currentUser, setCurrentUser] = useState(null);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser(user);
    fetchDocuments();
  }, [filterStatus]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');

      // Fetch documents based on filter
      const url = filterStatus === 'all'
        ? 'https://ratilalsons-backend-api.onrender.com/api/documents'
        : `https://ratilalsons-backend-api.onrender.com/api/documents?status=${filterStatus}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(data);

        // Calculate stats
        const stats = {
          pending: data.filter(d => d.status === 'pending').length,
          approved: data.filter(d => d.status === 'approved').length,
          rejected: data.filter(d => d.status === 'rejected').length,
          total: data.length
        };
        setStats(stats);
      }
    } catch (error) {
      showNotification('Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClick = (document) => {
    setSelectedDocument(document);
    setReviewForm({
      status: '',
      hr_comments: ''
    });
    setShowReviewModal(true);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();

    if (!reviewForm.status) {
      showNotification('Please select a review status', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem('access_token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      const formData = new FormData();
      formData.append('status', reviewForm.status);
      formData.append('hr_comments', reviewForm.hr_comments);
      formData.append('reviewed_by', user.full_name || user.username || 'HR');

      const response = await fetch(`https://ratilalsons-backend-api.onrender.com/api/documents/review/${selectedDocument.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        showNotification(`Document ${reviewForm.status} successfully!`, 'success');
        setShowReviewModal(false);
        fetchDocuments();
      } else {
        throw new Error('Review failed');
      }
    } catch (error) {
      showNotification('Failed to submit review. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 5000);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: 'clock' },
      approved: { bg: 'bg-green-100', text: 'text-green-800', icon: 'check-circle' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: 'times-circle' },
      resubmit: { bg: 'bg-orange-100', text: 'text-orange-800', icon: 'redo' }
    };

    const config = statusConfig[status?.toLowerCase()] || statusConfig.pending;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        <i className={`fas fa-${config.icon} mr-1.5`}></i>
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6 lg:p-8">
      {/* Notification */}
      <AnimatePresence>
        {notification.show && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-50"
          >
            <div className={`rounded-lg shadow-lg p-4 ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white max-w-md`}>
              <div className="flex items-center">
                <i className={`fas fa-${notification.type === 'success' ? 'check-circle' : 'exclamation-circle'} text-xl mr-3`}></i>
                <p className="font-medium">{notification.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <i className="fas fa-clipboard-check text-indigo-600 mr-3"></i>
                HR Document Review
              </h1>
              <p className="text-gray-600 mt-2">Review and approve employee documents</p>
            </div>
            <div className="hidden sm:flex items-center bg-indigo-50 rounded-lg p-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {currentUser?.full_name?.charAt(0) || 'HR'}
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Reviewer</p>
                <p className="font-semibold text-gray-900">{currentUser?.full_name || 'HR Team'}</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-700 font-medium">Pending</p>
                  <p className="text-2xl font-bold text-yellow-900 mt-1">{stats.pending}</p>
                </div>
                <i className="fas fa-clock text-3xl text-yellow-500"></i>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 font-medium">Approved</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">{stats.approved}</p>
                </div>
                <i className="fas fa-check-circle text-3xl text-green-500"></i>
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700 font-medium">Rejected</p>
                  <p className="text-2xl font-bold text-red-900 mt-1">{stats.rejected}</p>
                </div>
                <i className="fas fa-times-circle text-3xl text-red-500"></i>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-indigo-700 font-medium">Total</p>
                  <p className="text-2xl font-bold text-indigo-900 mt-1">{stats.total}</p>
                </div>
                <i className="fas fa-file-alt text-3xl text-indigo-500"></i>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filter Tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="bg-white rounded-xl shadow-md p-2 flex flex-wrap gap-2">
          {['pending', 'approved', 'rejected', 'all'].map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterStatus(filter)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${filterStatus === filter
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Documents Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-lg overflow-hidden"
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <i className="fas fa-spinner fa-spin text-5xl text-indigo-600 mb-4"></i>
              <p className="text-gray-600 font-medium">Loading documents...</p>
            </div>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center">
            <i className="fas fa-inbox text-6xl text-gray-300 mb-4"></i>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Documents Found</h3>
            <p className="text-gray-500">
              {filterStatus === 'pending'
                ? 'No documents pending review at the moment.'
                : `No ${filterStatus} documents found.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Document Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Uploaded By
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Upload Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc, index) => (
                  <motion.tr
                    key={doc.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-gray-50 transition-colors duration-200"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <i className="fas fa-file-alt text-2xl text-indigo-500 mr-3"></i>
                        <div>
                          <p className="font-semibold text-gray-900">{doc.type}</p>
                          {doc.description && (
                            <p className="text-sm text-gray-500 truncate max-w-xs">{doc.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{doc.uploaded_by || doc.uploaded_by_id || 'uploaded_by_name'}</p>
                      <p className="text-sm text-gray-500">ID: {doc.generated_for}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(doc.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(doc.status || 'pending')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <a
                          href={`https://ratilalsons-backend-api.onrender.com${doc.pdf_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 text-sm font-medium"
                          title="View Document"
                        >
                          <i className="fas fa-eye"></i>
                        </a>
                        {doc.status === 'pending' && (
                          <button
                            onClick={() => handleReviewClick(doc)}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 text-sm font-medium"
                            title="Review Document"
                          >
                            <i className="fas fa-clipboard-check mr-1"></i>
                            Review
                          </button>
                        )}
                        {doc.status !== 'pending' && doc.hr_comments && (
                          <button
                            onClick={() => {
                              setSelectedDocument(doc);
                              setShowReviewModal(true);
                            }}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-sm font-medium"
                            title="View Details"
                          >
                            <i className="fas fa-info-circle"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Review Modal */}
      <AnimatePresence>
        {showReviewModal && selectedDocument && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => !submitting && setShowReviewModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 sm:p-8">
                {/* Modal Header */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Review Document</h2>
                    <p className="text-gray-600 mt-1">{selectedDocument.type}</p>
                  </div>
                  <button
                    onClick={() => !submitting && setShowReviewModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    disabled={submitting}
                  >
                    <i className="fas fa-times text-2xl"></i>
                  </button>
                </div>

                {/* Document Details */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-gray-600">Uploaded By:</span>
                    <span className="text-sm text-gray-900">{selectedDocument.uploaded_by || selectedDocument.uploaded_by_id || 'Unknown User'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-gray-600">Upload Date:</span>
                    <span className="text-sm text-gray-900">
                      {new Date(selectedDocument.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-gray-600">Current Status:</span>
                    <span>{getStatusBadge(selectedDocument.status)}</span>
                  </div>
                  {selectedDocument.description && (
                    <div>
                      <span className="text-sm font-semibold text-gray-600">Description:</span>
                      <p className="text-sm text-gray-900 mt-1">{selectedDocument.description}</p>
                    </div>
                  )}
                  {selectedDocument.hr_comments && (
                    <div className="pt-3 border-t border-gray-200">
                      <span className="text-sm font-semibold text-gray-600">Previous HR Comments:</span>
                      <p className="text-sm text-gray-900 mt-1">{selectedDocument.hr_comments}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Reviewed by: {selectedDocument.reviewed_by} on {new Date(selectedDocument.reviewed_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Document Preview Link */}
                <div className="mb-6">
                  <a
                    href={`https://ratilalsons-backend-api.onrender.com${selectedDocument.pdf_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full px-4 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 text-center font-medium"
                  >
                    <i className="fas fa-external-link-alt mr-2"></i>
                    Open Document in New Tab
                  </a>
                </div>

                {/* Review Form - Only show if pending */}
                {selectedDocument.status === 'pending' && (
                  <form onSubmit={handleSubmitReview} className="space-y-6">
                    {/* Review Decision */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Review Decision *
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setReviewForm({ ...reviewForm, status: 'approved' })}
                          className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${reviewForm.status === 'approved'
                            ? 'bg-green-600 text-white shadow-lg'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                        >
                          <i className="fas fa-check-circle mr-2"></i>
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewForm({ ...reviewForm, status: 'rejected' })}
                          className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${reviewForm.status === 'rejected'
                            ? 'bg-red-600 text-white shadow-lg'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                        >
                          <i className="fas fa-times-circle mr-2"></i>
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewForm({ ...reviewForm, status: 'resubmit' })}
                          className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${reviewForm.status === 'resubmit'
                            ? 'bg-orange-600 text-white shadow-lg'
                            : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                            }`}
                        >
                          <i className="fas fa-redo mr-2"></i>
                          Resubmit
                        </button>
                      </div>
                    </div>

                    {/* Comments */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Comments {reviewForm.status !== 'approved' && <span className="text-red-500">*</span>}
                      </label>
                      <textarea
                        value={reviewForm.hr_comments}
                        onChange={(e) => setReviewForm({ ...reviewForm, hr_comments: e.target.value })}
                        rows="4"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 resize-none"
                        placeholder={
                          reviewForm.status === 'approved'
                            ? 'Add any notes (optional)...'
                            : 'Please provide feedback for the employee...'
                        }
                        required={reviewForm.status !== 'approved'}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-4">
                      <button
                        type="button"
                        onClick={() => !submitting && setShowReviewModal(false)}
                        className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all duration-300"
                        disabled={submitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={submitting || !reviewForm.status}
                      >
                        {submitting ? (
                          <>
                            <i className="fas fa-spinner fa-spin mr-2"></i>
                            Submitting...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-check mr-2"></i>
                            Submit Review
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HRDocumentReview;
