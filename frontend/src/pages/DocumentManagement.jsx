import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../config.js';

// Get base URL without /api suffix for static files
const BASE_URL = 'http://localhost:8000';

/**
 * HR Document Management Component
 * 
 * This component displays all employee documents that have been uploaded via the EmployeeDocument component.
 * HR staff can review, approve, or reject employee documents from this dashboard.
 * 
 * Primary API Endpoint: /api/api/employee-docs/documents/all
 * - Fetches all employee documents for HR review
 * - Supports document status filtering (pending, approved, rejected)
 * - Allows HR to update document status and add comments
 */

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
      
      let documents = [];
      let success = false;
      
      // Use the working employee documents endpoint as primary
      const endpoints = [
        { url: `${BASE_URL}/api/employee-docs/documents/all`, name: 'Employee Documents API' }, // Primary working endpoint
        { url: `${BASE_URL}/api/api/employee-docs/documents/all`, name: 'Employee Docs Double API' }, // Alternative with double /api
        { url: `${API_URL}/hr/documents/all`, name: 'HR Documents' }, // HR-specific endpoint
        { url: `${API_URL}/documents/all`, name: 'All Documents' }, // All documents from main collection
        { url: `${BASE_URL}/api/employees/documents/all`, name: 'Employee Documents' }, // Employee documents from employees collection
        { url: `${BASE_URL}/api/documents/all`, name: 'API All Documents' }, // All documents alternative
        { url: `${BASE_URL}/api/documents`, name: 'API Documents' } // Alternative documents endpoint
      ];
      
      // Collect documents from multiple sources
      let allDocuments = [];
      
      for (const endpoint of endpoints) {
        try {
          console.log('Trying endpoint:', endpoint.url, '(' + endpoint.name + ')');
          const response = await fetch(endpoint.url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const result = await response.json();
            console.log('API Response from', endpoint.name, ':', result);
            
            let data = [];
            
            // Handle different response formats
            if (Array.isArray(result)) {
              data = result;
              console.log('Response is direct array with', data.length, 'items');
            } else if (result && typeof result === 'object') {
              if (result.success && Array.isArray(result.documents)) {
                data = result.documents;
                console.log('Found documents in result.documents:', data.length);
              } else if (Array.isArray(result.documents)) {
                data = result.documents;
                console.log('Found documents in result.documents (no success flag):', data.length);
              } else if (Array.isArray(result.data)) {
                data = result.data;
                console.log('Found documents in result.data:', data.length);
              } else {
                console.log('Response object structure:', Object.keys(result));
                console.log('Result.success:', result.success);
                console.log('Result.documents type:', typeof result.documents);
              }
            } else {
              console.log('Unexpected response format:', typeof result);
            }
            
            if (data.length > 0) {
              console.log('Found', data.length, 'documents from', endpoint.name);
              // Add source identifier to each document
              data.forEach(doc => {
                doc._source = endpoint.name;
              });
              allDocuments = allDocuments.concat(data);
            }
            
            // For the primary endpoint (Employee Documents API), always stop after successful response
            if (endpoint.name === 'Employee Documents API') {
              success = true;
              console.log('Got response from primary endpoint:', endpoint.name, ', stopping further requests');
              console.log('Data received:', data.length, 'documents');
              break;
            }
            
            // For other endpoints, only stop if we got actual data
            if (data.length > 0) {
              success = true;
              console.log('Successfully got', data.length, 'documents from', endpoint.name, ', stopping further requests');
              break;
            } else {
              console.log('Got successful response but no data from', endpoint.name, ', trying next endpoint');
            }
          } else {
            console.log('Endpoint', endpoint.url, 'failed with status:', response.status);
            if (response.status === 403) {
              console.log('Access denied - may require HR privileges');
              const errorText = await response.text();
              console.log('Error response:', errorText);
            }
          }
        } catch (err) {
          console.log('Endpoint', endpoint.url, 'error:', err.message);
        }
      }
      
      // Use all collected documents
      documents = allDocuments;
      console.log('Total documents collected from all sources:', documents.length);
      
      // Ensure data is an array and process documents
      if (!Array.isArray(documents)) {
        console.warn('Documents data is not an array:', documents);
        documents = [];
      }
      
      // Process documents to ensure consistent structure
      const processedDocs = documents.map((doc, index) => {
        const processed = {
          id: doc.id || doc._id || doc.document_id || `doc_${index}`,
          document_type: doc.document_type || doc.type || 'Document',
          document_name: doc.document_name || doc.filename || doc.original_filename || doc.name || 'Unknown Document',
          filename: doc.filename || doc.original_filename || doc.document_name,
          original_filename: doc.original_filename || doc.filename || doc.document_name,
          stored_filename: doc.stored_filename,
          uploaded_by: doc.uploaded_by || doc.uploaded_by_name || doc.generated_for || 'Unknown User',
          uploaded_by_name: doc.uploaded_by_name || doc.uploaded_by || doc.generated_for || 'Unknown User',
          employee_id: doc.employee_id || doc.generated_for || doc.user_id,
          upload_date: doc.upload_date || doc.uploaded_at || doc.timestamp || doc.created_at,
          created_at: doc.created_at || doc.upload_date,
          status: doc.status || 'pending',
          hr_comments: doc.hr_comments || doc.comments,
          reviewed_by: doc.reviewed_by,
          reviewed_at: doc.reviewed_at,
          file_path: doc.file_path || doc.pdf_url,
          pdf_url: doc.pdf_url || doc.file_path,
          file_size: doc.file_size,
          content_type: doc.content_type,
          description: doc.description || doc.linked_lead,
          _source: doc._source
        };
        
        // Handle ObjectId conversion
        if (processed.id && typeof processed.id === 'object' && processed.id.$oid) {
          processed.id = processed.id.$oid;
        }
        if (typeof processed.id === 'object') {
          processed.id = String(processed.id);
        }
        
        return processed;
      });
      
      // Remove duplicates based on document ID or name+employee combination
      const uniqueDocs = [];
      const seenIds = new Set();
      
      for (const doc of processedDocs) {
        const uniqueKey = doc.id || `${doc.document_name}_${doc.employee_id}_${doc.upload_date}`;
        if (!seenIds.has(uniqueKey)) {
          seenIds.add(uniqueKey);
          uniqueDocs.push(doc);
        }
      }
      
      documents = uniqueDocs;
      console.log('Processed and deduplicated documents:', documents.length);
      
      // Filter documents based on status if not 'all'
      const filteredDocs = filterStatus === 'all' 
        ? documents 
        : documents.filter(doc => doc.status === filterStatus);
        
      setDocuments(filteredDocs);
      
      // Calculate stats from all documents
      const stats = {
        pending: documents.filter(d => d.status === 'pending').length,
        approved: documents.filter(d => d.status === 'approved').length,
        rejected: documents.filter(d => d.status === 'rejected').length,
        total: documents.length
      };
      setStats(stats);
      
      if (documents.length === 0) {
        console.warn('No documents found from any endpoint');
      } else {
        console.log('Successfully loaded', documents.length, 'documents from multiple sources');
      }
      
    } catch (error) {
      console.error('Error fetching documents:', error);
      showNotification('Failed to load documents', 'error');
      setDocuments([]);
      setStats({ pending: 0, approved: 0, rejected: 0, total: 0 });
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
      const documentId = selectedDocument.id || selectedDocument._id;
      
      // Try multiple review endpoints
      const reviewEndpoints = [
        `${BASE_URL}/api/employee-docs/documents/${documentId}/review`,
        `${BASE_URL}/api/api/employee-docs/documents/${documentId}/review`,
        `${API_URL}/hr/documents/${documentId}/review`,
        `${BASE_URL}/api/documents/${documentId}/review`
      ];
      
      let success = false;
      
      for (const endpoint of reviewEndpoints) {
        try {
          console.log('Trying review endpoint:', endpoint);
          
          const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              status: reviewForm.status,
              hr_comments: reviewForm.hr_comments,
              reviewed_by: user.full_name || user.username || 'HR',
              reviewed_at: new Date().toISOString()
            })
          });

          if (response.ok) {
            showNotification(`Document ${reviewForm.status} successfully!`, 'success');
            setShowReviewModal(false);
            fetchDocuments();
            success = true;
            break;
          } else {
            console.log('Review endpoint', endpoint, 'failed with status:', response.status);
          }
        } catch (err) {
          console.log('Review endpoint', endpoint, 'error:', err.message);
        }
      }
      
      if (!success) {
        throw new Error('All review endpoints failed');
      }
      
    } catch (error) {
      console.error('Review error:', error);
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

  const handleDocumentView = async (document) => {
    try {
      const documentUrl = getDocumentUrl(document);
      if (!documentUrl) {
        showNotification('Document URL not available', 'error');
        return;
      }

      // Open in new tab
      window.open(documentUrl, '_blank');
    } catch (error) {
      console.error('Error opening document:', error);
      showNotification('Failed to open document', 'error');
    }
  };

  const handleDocumentDownload = async (doc) => {
    try {
      console.log('=== Download Debug Info ===');
      console.log('Document object:', doc);
      
      // Get the document URL
      const documentUrl = getDocumentUrl(doc);
      console.log('Generated URL:', documentUrl);
      
      if (!documentUrl) {
        showNotification('Document URL not available', 'error');
        return;
      }

      // Method 1: Try fetch + blob (most reliable for forcing download)
      console.log('Method 1: Fetch + Blob download');
      try {
        const response = await fetch(documentUrl);
        console.log('Fetch response status:', response.status);
        
        if (response.ok) {
          const blob = await response.blob();
          console.log('Blob size:', blob.size, 'bytes');
          
          if (blob.size > 0) {
            const blobUrl = window.URL.createObjectURL(blob);
            const filename = doc.document_name || doc.filename || doc.original_filename || 'document';
            
            const link = window.document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            link.style.display = 'none';
            window.document.body.appendChild(link);
            link.click();
            window.document.body.removeChild(link);
            
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
            showNotification('Document downloaded successfully!', 'success');
            return;
          }
        }
      } catch (fetchError) {
        console.log('Method 1 failed:', fetchError.message);
      }

      // Method 2: Direct download using hidden iframe
      console.log('Method 2: iframe download');
      try {
        const filename = doc.document_name || doc.filename || doc.original_filename || 'document';
        
        // Create hidden iframe for download
        const iframe = window.document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = documentUrl;
        window.document.body.appendChild(iframe);
        
        // Remove iframe after download starts
        setTimeout(() => {
          window.document.body.removeChild(iframe);
        }, 3000);
        
        showNotification('Download initiated via iframe method', 'success');
        return;
      } catch (iframeError) {
        console.log('Method 2 failed:', iframeError.message);
      }

      // Method 3: Window.open with download suggestion
      console.log('Method 3: Window.open');
      try {
        // Open in new window/tab - browser will handle it
        const newWindow = window.open(documentUrl, '_blank');
        if (newWindow) {
          showNotification('Document opened in new tab. Use browser\'s download option if needed.', 'info');
        } else {
          throw new Error('Popup blocked');
        }
        return;
      } catch (openError) {
        console.log('Method 3 failed:', openError.message);
      }

      // Method 4: Last resort - copy URL to clipboard
      console.log('Method 4: Copy URL to clipboard');
      try {
        await navigator.clipboard.writeText(documentUrl);
        showNotification('Document URL copied to clipboard. Paste in browser to download.', 'info');
      } catch (clipboardError) {
        console.log('Method 4 failed:', clipboardError.message);
        showNotification('All download methods failed. Please contact support.', 'error');
      }
      
    } catch (error) {
      console.error('=== Download completely failed ===', error);
      showNotification('Failed to download document. Please try again.', 'error');
    }
  };

  const getDocumentUrl = (document) => {
    console.log('Getting document URL for:', document);
    
    // Handle different URL formats
    if (document.file_path) {
      // If file_path starts with http, use as is
      if (document.file_path.startsWith('http')) {
        return document.file_path;
      }
      
      // If file_path starts with /, it's already a path from root
      if (document.file_path.startsWith('/')) {
        return `${BASE_URL}${document.file_path}`;
      }
      
      // Handle Windows-style paths (backslashes) and convert to forward slashes
      let cleanPath = document.file_path.replace(/\\/g, '/');
      
      // Remove any leading ./ or just use the path as is
      cleanPath = cleanPath.replace(/^\.\//, '');
      
      // If the path already starts with employee_document/, use it directly
      // Otherwise, we need to add the employee_document/ prefix
      if (cleanPath.startsWith('employee_document/')) {
        return `${BASE_URL}/${cleanPath}`;
      } else {
        // This handles cases where file_path might just be the filename
        return `${BASE_URL}/employee_document/${cleanPath}`;
      }
    }
    
    if (document.pdf_url) {
      if (document.pdf_url.startsWith('http')) {
        return document.pdf_url;
      }
      if (document.pdf_url.startsWith('/')) {
        return `${BASE_URL}${document.pdf_url}`;
      }
      // Handle Windows-style paths and convert to forward slashes
      let cleanPath = document.pdf_url.replace(/\\/g, '/');
      cleanPath = cleanPath.replace(/^\.\//, '');
      
      if (cleanPath.startsWith('employee_document/')) {
        return `${BASE_URL}/${cleanPath}`;
      } else {
        return `${BASE_URL}/employee_document/${cleanPath}`;
      }
    }
    
    // Use stored_filename if available
    if (document.stored_filename) {
      return `${BASE_URL}/employee_document/${document.stored_filename}`;
    }
    
    // Fallback - construct URL from document info
    if (document.document_name || document.filename || document.original_filename) {
      const filename = document.document_name || document.filename || document.original_filename;
      const employeeId = document.employee_id || document.generated_for || document.uploaded_by || 'unknown';
      
      // Try multiple filename patterns that might exist
      const possibleFilenames = [
        document.stored_filename, // Prioritize stored filename
        `${employeeId}_${filename}`,
        `${employeeId}_${filename.replace(/\s+/g, '_')}`,
        filename
      ].filter(Boolean);
      
      // Return the first potential URL
      const potentialFilename = possibleFilenames[0];
      return `${BASE_URL}/employee_document/${potentialFilename}`;
    }
    
    console.warn('Could not determine document URL for:', document);
    return null;
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
                HR Document Management
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
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                filterStatus === filter
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
                          <p className="font-semibold text-gray-900">{doc.document_type || doc.type}</p>
                          {doc.document_name && (
                            <p className="text-sm text-gray-500 truncate max-w-xs">{doc.document_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">
                        {doc.uploaded_by_name || doc.uploaded_by || doc.uploaded_by_id || 'Unknown User'}
                      </p>
                      <p className="text-sm text-gray-500">ID: {doc.employee_id || doc.generated_for}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(doc.upload_date || doc.timestamp || doc.created_at).toLocaleString('en-US', {
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
                        <button
                          onClick={() => handleDocumentView(doc)}
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 text-sm font-medium"
                          title="View Document"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        <button
                          onClick={() => handleDocumentDownload(doc)}
                          className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors duration-200 text-sm font-medium"
                          title="Download Document"
                        >
                          <i className="fas fa-download"></i>
                        </button>
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
                    <p className="text-gray-600 mt-1">{selectedDocument.document_type || selectedDocument.type}</p>
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
                    <span className="text-sm text-gray-900">
                      {selectedDocument.uploaded_by_name || selectedDocument.uploaded_by || selectedDocument.uploaded_by_id || 'Unknown User'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-gray-600">Upload Date:</span>
                    <span className="text-sm text-gray-900">
                      {new Date(selectedDocument.uploaded_at || selectedDocument.timestamp || selectedDocument.upload_date).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-gray-600">Current Status:</span>
                    <span>{getStatusBadge(selectedDocument.status)}</span>
                  </div>
                  {(selectedDocument.description || selectedDocument.document_name) && (
                    <div>
                      <span className="text-sm font-semibold text-gray-600">Description:</span>
                      <p className="text-sm text-gray-900 mt-1">
                        {selectedDocument.description || selectedDocument.document_name}
                      </p>
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

                {/* Document Preview Links
                <div className="mb-6 space-y-3">
                  <button
                    onClick={() => handleDocumentView(selectedDocument)}
                    className="block w-full px-4 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200 text-center font-medium"
                  >
                    <i className="fas fa-external-link-alt mr-2"></i>
                    Open Document in New Tab
                  </button>
                  <button
                    onClick={() => handleDocumentDownload(selectedDocument)}
                    className="block w-full px-4 py-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors duration-200 text-center font-medium"
                  >
                    <i className="fas fa-download mr-2"></i>
                    Download Document
                  </button>
                </div> */}

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
                          className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                            reviewForm.status === 'approved'
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
                          className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                            reviewForm.status === 'rejected'
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
                          className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                            reviewForm.status === 'resubmit'
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
