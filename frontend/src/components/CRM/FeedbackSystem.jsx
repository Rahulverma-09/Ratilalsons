// FeedbackSystem.jsx with API Integration
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { CUSTOMER_PORTAL_API, getAuthHeaders, API_URL } from "../../config.js";

const FeedbackSystem = () => {
  const [activeTab, setActiveTab] = useState("submit");
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedRating, setSelectedRating] = useState(5);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vendors, setVendors] = useState([]);

  // Fetch vendors on component mount
  useEffect(() => {
    fetchVendors();
  }, []);

  // Fetch feedback when search changes
  useEffect(() => {
    fetchFeedbackHistory();
  }, [search]);

  const fetchVendors = async () => {
    try {
      // Fetch from customer vendors API
      const response = await fetch(CUSTOMER_PORTAL_API.VENDORS, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched vendors:', data.vendors?.length || 0);
        
        // Use vendors from API response
        const vendorList = data.vendors || [];
        setVendors(vendorList);
      } else {
        // Fallback vendors if API fails
        console.warn('Failed to fetch vendors from API, using fallback');
        setVendors([
          { id: 'USR-419', name: 'Madhav Kaushal', username: 'madhav', user_id: 'USR-419' }
        ]);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
      // Fallback vendors on error
      setVendors([
        { id: 'USR-419', name: 'Madhav Kaushal', username: 'madhav', user_id: 'USR-419' }
      ]);
    }
  };

  const fetchFeedbackHistory = async () => {
    try {
      setLoading(true);
      const searchParam = search ? `?search=${encodeURIComponent(search)}` : '';
      const response = await fetch(`${CUSTOMER_PORTAL_API.FEEDBACK}${searchParam}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setFeedbackList(data.feedbacks || []);
      } else {
        console.error('Failed to fetch feedback');
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!feedbackText.trim() && selectedRating === 0) {
      alert('Please provide either feedback text or a rating');
      return;
    }

    const feedbackData = {
      text: feedbackText,
      rating: selectedRating,
      vendor: selectedVendor || 'General',
      product: selectedProduct || 'General'
    };

    try {
      setSubmitting(true);
      const response = await fetch(CUSTOMER_PORTAL_API.FEEDBACK, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(feedbackData)
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Feedback submitted successfully!');
        setFeedbackText('');
        setSelectedRating(5);
        setSelectedVendor('');
        setSelectedProduct('');
        await fetchFeedbackHistory(); // Refresh the list
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getRatingStars = (rating) => {
    return Array(5).fill().map((_, i) => (
      <svg key={i} className={`w-5 h-5 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };

  const handleRatingClick = (rating) => {
    setSelectedRating(rating);
  };

  return (
    <motion.div 
      className="bg-gray-50 p-4 sm:p-8 max-w-8xl mx-auto min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Top Title */}
      <motion.div
        className="py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8"
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      >
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-left text-green-700 leading-7 drop-shadow">
            Vendor Feedback
          </h1>
          <p className="text-gray-500 mt-1 text-left text-xs sm:text-sm md:text-base">
            Share your experience with vendors and products.
          </p>
        </div>
        <div className="mt-3 sm:mt-0 sm:ml-4 w-full sm:w-auto">
          <motion.input
            type="text"
            placeholder="Search vendors, products or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-400 w-full sm:w-80 text-sm shadow-inner"
            whileFocus={{ scale: 1.02, borderColor: "#22c55e" }}
          />
        </div>
      </motion.div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Submit New Feedback */}
        <motion.div
          className="bg-white shadow-lg rounded-2xl border border-green-100 p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-xl font-bold text-green-700 mb-6">Submit New Feedback</h3>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Vendor
              </label>
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              >
                <option value="">Select Vendor ({vendors.length} available)</option>
                {vendors.length === 0 ? (
                  <option disabled>Loading vendors...</option>
                ) : (
                  vendors.map(vendor => (
                    <option key={vendor.id} value={vendor.name}>
                      {vendor.name} ({vendor.username})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Product/Service
              </label>
              <input
                type="text"
                placeholder="Enter product or service name"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Rating</label>
              <div className="flex items-center space-x-1 mb-2">
                {[1,2,3,4,5].map((star) => (
                  <motion.button
                    key={star}
                    type="button"
                    onClick={() => handleRatingClick(star)}
                    className={`w-10 h-10 rounded-lg border-2 focus:outline-none transition-all ${
                      star <= selectedRating 
                        ? 'border-yellow-400 bg-yellow-50' 
                        : 'border-gray-200 hover:border-green-400'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    <svg className={`w-6 h-6 mx-auto ${star <= selectedRating ? 'text-yellow-400' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </motion.button>
                ))}
                <span className="ml-2 text-sm text-gray-600">({selectedRating} stars)</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Your Feedback</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent resize-vertical shadow-inner text-sm"
                rows="5"
                placeholder="Share your experience with this product and vendor..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
              />
            </div>

            <motion.button
              type="submit"
              disabled={submitting}
              className={`w-full font-bold py-4 px-8 rounded-xl shadow-lg transition-all text-lg ${
                submitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white hover:shadow-xl'
              }`}
              whileTap={{ scale: submitting ? 1 : 0.96 }}
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </motion.button>
          </form>
        </motion.div>

        {/* Feedback History */}
        <motion.div
          className="bg-white shadow-lg rounded-2xl border border-green-100 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
            <h3 className="text-lg font-bold text-green-700">Feedback History</h3>
          </div>
          
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                <p className="text-gray-500">Loading feedback...</p>
              </div>
            ) : (
              <table className="min-w-[700px] w-full text-sm">
                <thead className="bg-gradient-to-r from-green-50 to-green-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Vendor</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-4 text-center text-xs font-semibold text-green-700 uppercase tracking-wider">Rating</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Feedback</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {feedbackList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400">
                        {search ? "No feedback found matching your search." : "No feedback submitted yet."}
                      </td>
                    </tr>
                  ) : (
                    feedbackList.map((fb) => (
                      <tr key={fb.id} className="hover:bg-green-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{fb.vendor}</div>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">{fb.product}</td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center space-x-0.5">
                            {getRatingStars(fb.rating)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-700">{fb.date}</td>
                        <td className="px-6 py-4 text-gray-700 max-w-xs truncate" title={fb.text}>
                          {fb.text || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Stats */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="bg-white p-6 rounded-xl shadow-lg border border-green-100 text-center">
          <div className="text-3xl font-bold text-green-700 mb-2">{feedbackList.length}</div>
          <div className="text-sm text-gray-500 font-medium">Total Feedbacks</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border border-green-100 text-center">
          <div className="text-3xl font-bold text-yellow-500 mb-2">
            {feedbackList.length > 0 
              ? (feedbackList.reduce((sum, fb) => sum + fb.rating, 0) / feedbackList.length).toFixed(1)
              : '0.0'
            }
          </div>
          <div className="text-sm text-gray-500 font-medium">Average Rating</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border border-green-100 text-center">
          <div className="text-3xl font-bold text-emerald-600 mb-2">{vendors.length}</div>
          <div className="text-sm text-gray-500 font-medium">Available Vendors</div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default FeedbackSystem;