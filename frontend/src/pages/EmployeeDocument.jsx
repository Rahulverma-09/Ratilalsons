
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const UserDocumentUpload = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentType, setDocumentType] = useState('');
  const [description, setDescription] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [currentUser, setCurrentUser] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  // Document types available for upload
  const documentTypes = [
    { value: 'ID Proof', label: 'ID Proof (Aadhar/PAN/Passport)', icon: 'id-card' },
    { value: 'Address Proof', label: 'Address Proof', icon: 'home' },
    { value: 'Educational Certificate', label: 'Educational Certificate', icon: 'graduation-cap' },
    { value: 'Experience Letter', label: 'Experience Letter', icon: 'briefcase' },
    { value: 'Resume', label: 'Resume/CV', icon: 'file-alt' },
    { value: 'Medical Certificate', label: 'Medical Certificate', icon: 'notes-medical' },
    { value: 'Bank Statement', label: 'Bank Statement', icon: 'university' },
    { value: 'Tax Documents', label: 'Tax Documents', icon: 'file-invoice-dollar' },
    { value: 'Other', label: 'Other Documents', icon: 'file' },
  ];

  useEffect(() => {
    // Try both localStorage keys for user data
    let user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id && !user.user_id) {
      user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    }
    setCurrentUser(user);
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      // Try both localStorage keys for user data
      let user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id && !user.user_id) {
        user = JSON.parse(localStorage.getItem('currentUser') || '{}');
      }

      console.log('Current user data for document fetch:', user);
      console.log('Access token exists:', !!token);

      if (!token) {
        showNotification('Authentication required. Please log in again.', 'error');
        setLoading(false);
        return;
      }

      // Start with the primary my-documents endpoint
      let documents = [];

      try {
        console.log('Fetching from my-documents endpoint...');

        const response = await fetch('https://ratilalsons-backend-api.onrender.com/api/employee-docs/employee/my-documents', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('My-documents response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('My-documents response data:', data);

          if (data && Array.isArray(data.documents)) {
            documents = data.documents;
            console.log('Successfully loaded documents from my-documents endpoint:', documents.length);

            // Validate each document has required fields
            documents = documents.map(doc => {
              // Ensure each document has an id field for React key
              if (!doc.id && doc._id) {
                doc.id = doc._id;
              }

              // Log document details for debugging
              console.log('Document details:', {
                id: doc.id,
                document_name: doc.document_name,
                document_type: doc.document_type,
                file_path: doc.file_path,
                uploaded_at: doc.uploaded_at,
                status: doc.status
              });

              return doc;
            });

            setDocuments(documents);
            setLoading(false);
            return;
          } else {
            console.warn('Unexpected data structure from my-documents endpoint:', data);
          }
        } else {
          const errorText = await response.text();
          console.error('My-documents endpoint error:', response.status, errorText);

          // If it's a 403 or 401, show authentication error
          if (response.status === 403 || response.status === 401) {
            showNotification('Authentication failed. Please log in again.', 'error');
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error('My-documents endpoint failed with exception:', error);
      }

      // If primary endpoint failed, try fallback endpoints
      const endpoints = [
        `https://ratilalsons-backend-api.onrender.com/api/employee-docs/employees/${user.id || user.user_id || user.username}/documents`,
        `https://ratilalsons-backend-api.onrender.com/api/api/employees/${user.id || user.user_id || user.username}/documents`,
        `https://ratilalsons-backend-api.onrender.com/api/documents?generated_for=${user.id || user.user_id || user.username}`
      ];

      console.log('Trying fallback endpoints:', endpoints);

      for (const endpoint of endpoints) {
        try {
          console.log('Trying fetch endpoint:', endpoint);
          const response = await fetch(endpoint, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            console.log('Response from', endpoint, ':', data);

            if (Array.isArray(data)) {
              documents = data;
            } else if (data && Array.isArray(data.documents)) {
              documents = data.documents;
            }

            // If we have documents, filter them for current user
            if (documents.length > 0) {
              // Get all possible user identifiers
              const userIdentifiers = [
                user.id,
                user.user_id,
                user._id,
                user.username,
                user.emp_id,
                user.employee_id,
                // For USR- format IDs
                `USR-${user.id}`,
                `USR-${user.user_id}`,
                // For EMP- format IDs  
                `EMP-${user.id}`,
                `EMP-${user.user_id}`,
                // Extract numeric ID and try different formats
                ...(user.id ? [`USR-${String(user.id).replace(/\D/g, '').padStart(6, '0')}`] : []),
                ...(user.user_id ? [`USR-${String(user.user_id).replace(/\D/g, '').padStart(6, '0')}`] : [])
              ].filter(Boolean); // Remove null/undefined values

              console.log('User identifiers to match:', userIdentifiers);

              // Filter documents for current user with comprehensive matching
              const userDocs = documents.filter(doc => {
                const docEmployeeId = doc.employee_id || doc.generated_for || doc.uploaded_by || doc.user_id;
                const matches = userIdentifiers.some(id =>
                  docEmployeeId === id ||
                  docEmployeeId === String(id) ||
                  // Handle partial matches for numeric IDs
                  (docEmployeeId && id && String(docEmployeeId).includes(String(id))) ||
                  (docEmployeeId && id && String(id).includes(String(docEmployeeId)))
                );

                if (matches) {
                  console.log(`Document ${doc._id} matches user:`, {
                    docEmployeeId,
                    matchedWith: userIdentifiers.find(id =>
                      docEmployeeId === id ||
                      docEmployeeId === String(id) ||
                      (docEmployeeId && id && String(docEmployeeId).includes(String(id))) ||
                      (docEmployeeId && id && String(id).includes(String(docEmployeeId)))
                    )
                  });
                }

                return matches;
              });

              console.log('Filtered user documents:', userDocs);

              if (userDocs.length > 0) {
                setDocuments(userDocs);
                break; // Stop trying other endpoints
              }
            }
          }
        } catch (err) {
          console.log('Endpoint', endpoint, 'failed:', err.message);
        }
      }

      if (documents.length === 0) {
        console.log('No documents found for user');
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error in fetchDocuments:', error);
      showNotification('Failed to load documents. Please try refreshing the page.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 5 * 1024 * 1024) {
        showNotification('File size must be less than 5MB', 'error');
        return;
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        showNotification('Only PDF, DOC, DOCX, JPG, and PNG files are allowed', 'error');
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();

    if (!selectedFile || !documentType) {
      showNotification('Please select a file and document type', 'error');
      return;
    }

    setUploading(true);

    try {
      const token = localStorage.getItem('access_token');
      // Try both localStorage keys for user data
      let user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id && !user.user_id) {
        user = JSON.parse(localStorage.getItem('currentUser') || '{}');
      }

      // Use the new employee upload endpoint
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Create URL with query parameters for the new endpoint
      const uploadUrl = new URL('https://ratilalsons-backend-api.onrender.com/api/employee-docs/employee/upload-document');
      uploadUrl.searchParams.append('document_type', documentType);
      if (description) {
        uploadUrl.searchParams.append('description', description);
      }

      console.log('Uploading to new employee endpoint:', uploadUrl.toString());

      const response = await fetch(uploadUrl.toString(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Upload successful:', result);
        showNotification('Document uploaded successfully! It has been submitted for verification.', 'success');
        setShowUploadModal(false);
        resetForm();
        fetchDocuments();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Upload failed:', errorData);
        throw new Error(errorData.detail || `Upload failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      showNotification(`Failed to upload document: ${error.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setDocumentType('');
    setDescription('');
  };

  const showNotification = (message, type) => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 5000);
  };

  // Helper function to determine document status
  const getDocumentStatus = (doc) => {
    if (doc.status) {
      return doc.status.toLowerCase();
    }
    // Determine status based on verification fields
    if (doc.is_verified === true || doc.verified_by) {
      return 'approved';
    }
    if (doc.is_verified === false && doc.verified_by) {
      return 'rejected';
    }
    // Default to pending if no verification info
    return 'pending';
  };

  const getStatusBadge = (doc) => {
    const status = getDocumentStatus(doc);

    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: 'clock', label: 'Pending Review' },
      approved: { bg: 'bg-green-100', text: 'text-green-800', icon: 'check-circle', label: 'Approved' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: 'times-circle', label: 'Rejected' },
      resubmit: { bg: 'bg-orange-100', text: 'text-orange-800', icon: 'redo', label: 'Resubmit Required' }
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        <i className={`fas fa-${config.icon} mr-1.5`}></i>
        {config.label}
      </span>
    );
  };

  const filteredDocuments = filterStatus === 'all'
    ? documents
    : documents.filter(doc => getDocumentStatus(doc) === filterStatus);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 sm:p-6 lg:p-8">
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <i className="fas fa-file-upload text-blue-600 mr-3"></i>
                My Documents
              </h1>
              <p className="text-gray-600 mt-2">Upload and manage your personal documents</p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center"
            >
              <i className="fas fa-plus-circle mr-2"></i>
              Upload Document
            </button>
          </div>

          {/* User Info */}
          <div className="mt-6 flex items-center bg-blue-50 rounded-lg p-4">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {currentUser?.full_name?.charAt(0) || currentUser?.username?.charAt(0) || 'U'}
            </div>
            <div className="ml-4 flex-1">
              <p className="font-semibold text-gray-900">{currentUser?.full_name || currentUser?.username || 'User'}</p>
              <p className="text-xs text-blue-600 font-medium mt-0.5">
                Role: {(() => {
                  if (Array.isArray(currentUser?.roles)) {
                    return currentUser.roles.map(r =>
                      typeof r === 'string' ? r : (r.name || r.id || 'Unknown')
                    ).join(', ');
                  } else if (typeof currentUser?.roles === 'string') {
                    return currentUser.roles;
                  }
                  return 'User';
                })()}
              </p>
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
          {['all', 'pending', 'approved', 'rejected'].map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterStatus(filter)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${filterStatus === filter
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
              {filter !== 'all' && (
                <span className="ml-2 bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-xs">
                  {documents.filter(doc => getDocumentStatus(doc) === filter).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Documents Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <i className="fas fa-spinner fa-spin text-5xl text-blue-600 mb-4"></i>
              <p className="text-gray-600 font-medium">Loading documents...</p>
            </div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <i className="fas fa-inbox text-6xl text-gray-300 mb-4"></i>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Documents Found</h3>
            <p className="text-gray-500 mb-6">
              {filterStatus === 'all'
                ? "You haven't uploaded any documents yet. Start by uploading your first document!"
                : `No ${filterStatus} documents found.`}
            </p>
            {filterStatus === 'all' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                <i className="fas fa-upload mr-2"></i>
                Upload Your First Document
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocuments.map((doc, index) => {
              // Debug: Log document structure for troubleshooting
              console.log(`Document ${index + 1}:`, {
                id: doc.id || doc._id,
                document_name: doc.document_name,
                filename: doc.filename,
                original_filename: doc.original_filename,
                stored_filename: doc.stored_filename,
                file_path: doc.file_path,
                pdf_url: doc.pdf_url,
                document_type: doc.document_type,
                type: doc.type
              });

              return (
                <motion.div
                  key={doc.id || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
                >
                  <div className="p-6">
                    {/* Document Icon & Type */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <i className={`fas fa-${documentTypes.find(t => t.value === (doc.document_type || doc.type))?.icon || 'file'} text-2xl text-blue-600`}></i>
                        </div>
                        <div className="ml-4">
                          <h3 className="font-semibold text-gray-900 text-lg">{doc.document_type || doc.type}</h3>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {new Date(doc.upload_date || doc.timestamp).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {doc.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{doc.description}</p>
                    )}

                    {/* Status Badge */}
                    <div className="mb-4">
                      {getStatusBadge(doc)}
                    </div>

                    {/* Review Comments (if rejected or needs resubmit) */}
                    {doc.hr_comments && (getDocumentStatus(doc) === 'rejected' || getDocumentStatus(doc) === 'resubmit') && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                        <p className="text-xs font-semibold text-red-700 mb-1">
                          <i className="fas fa-comment-alt mr-1"></i>
                          Review Comments:
                        </p>
                        <p className="text-xs text-red-600">{doc.hr_comments}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                      {(() => {
                        // Determine the document URL
                        let documentUrl = null;

                        console.log('Processing document for URL generation:', {
                          file_path: doc.file_path,
                          stored_filename: doc.stored_filename,
                          pdf_url: doc.pdf_url,
                          document_name: doc.document_name,
                          filename: doc.filename
                        });

                        if (doc.file_path) {
                          // The backend now stores just the filename in file_path
                          let filename = doc.file_path;

                          // Remove any directory paths if they still exist (for old records)
                          if (filename.includes('/')) {
                            filename = filename.split('/').pop();
                          }

                          // Remove any leading/trailing slashes or spaces
                          filename = filename.replace(/^\/+|\/+$/g, '').trim();

                          console.log('Original file_path:', doc.file_path);
                          console.log('Final filename:', filename);

                          // Construct URL with just the filename
                          documentUrl = `https://ratilalsons-backend-api.onrender.com/employee_document/${filename}`;

                          console.log('Final document URL:', documentUrl);
                        } else if (doc.stored_filename) {
                          documentUrl = `https://ratilalsons-backend-api.onrender.com/employee_document/${doc.stored_filename}`;
                        } else if (doc.pdf_url) {
                          // Ensure pdf_url starts with /
                          documentUrl = `https://ratilalsons-backend-api.onrender.com${doc.pdf_url.startsWith('/') ? doc.pdf_url : '/' + doc.pdf_url}`;
                        } else if (doc.document_name || doc.filename) {
                          documentUrl = `https://ratilalsons-backend-api.onrender.com/employee_document/${doc.document_name || doc.filename}`;
                        }

                        if (!documentUrl || documentUrl.endsWith('#')) {
                          return (
                            <div className="flex-1 px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium text-center text-sm">
                              <i className="fas fa-exclamation-triangle mr-2"></i>
                              File Not Available
                            </div>
                          );
                        }

                        return (
                          <>
                            <a
                              href={documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition-colors duration-200 text-center text-sm"
                              onClick={async (e) => {
                                console.log(`Attempting to view document at: ${documentUrl}`);
                                console.log('Document object:', doc);

                                // First check if backend is running and serving static files
                                try {
                                  const backendCheck = await fetch('https://ratilalsons-backend-api.onrender.com/', { method: 'HEAD' });
                                  console.log('Backend status:', backendCheck.status);
                                } catch (err) {
                                  console.error('Backend not accessible:', err);
                                  e.preventDefault();
                                  alert('Backend server is not running or not accessible at localhost:8000');
                                  return;
                                }

                                // Test a known file to see if static serving works
                                const testUrls = [
                                  'https://ratilalsons-backend-api.onrender.com/employee_document/USR-000001_Screenshot%202025-10-28%20112536.png',
                                  'https://ratilalsons-backend-api.onrender.com/employee_document/USR-000001_Screenshot 2025-10-28 112536.png',
                                  documentUrl
                                ];

                                console.log('Testing URLs:', testUrls);

                                let workingUrl = null;
                                for (const testUrl of testUrls) {
                                  try {
                                    const response = await fetch(testUrl, { method: 'HEAD' });
                                    console.log(`URL: ${testUrl} - Status: ${response.status}`);
                                    if (response.ok) {
                                      workingUrl = testUrl;
                                      break;
                                    }
                                  } catch (err) {
                                    console.log(`URL failed: ${testUrl} - Error:`, err.message);
                                  }
                                }

                                if (workingUrl) {
                                  console.log('Found working URL:', workingUrl);
                                  // Don't prevent default, let the link work
                                  return;
                                } else {
                                  e.preventDefault();
                                  alert('No accessible document URL found. Check console for details.');
                                }
                              }}
                            >
                              <i className="fas fa-eye mr-2"></i>
                              View
                            </a>
                            <button
                              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors duration-200 text-center text-sm"
                              onClick={async (e) => {
                                e.preventDefault();
                                console.log(`Attempting to download document from: ${documentUrl}`);

                                try {
                                  // Fetch the file as a blob
                                  const response = await fetch(documentUrl);
                                  if (!response.ok) {
                                    throw new Error(`HTTP error! status: ${response.status}`);
                                  }

                                  const blob = await response.blob();

                                  // Create a temporary URL for the blob
                                  const url = window.URL.createObjectURL(blob);

                                  // Create a temporary link element
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.download = doc.document_name || doc.original_filename || doc.filename || 'document.pdf';

                                  // Append to body, click, and remove
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);

                                  // Clean up the blob URL
                                  window.URL.revokeObjectURL(url);

                                  console.log('Download initiated successfully');
                                } catch (error) {
                                  console.error('Download failed:', error);
                                  alert('Failed to download document. Please try again or contact support.');
                                }
                              }}
                            >
                              <i className="fas fa-download mr-2"></i>
                              Download
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => !uploading && setShowUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 sm:p-8">
                {/* Modal Header */}
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <i className="fas fa-cloud-upload-alt text-blue-600 mr-3"></i>
                    Upload Document
                  </h2>
                  <button
                    onClick={() => !uploading && setShowUploadModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    disabled={uploading}
                  >
                    <i className="fas fa-times text-2xl"></i>
                  </button>
                </div>

                {/* Upload Form */}
                <form onSubmit={handleUploadDocument} className="space-y-6">
                  {/* Document Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Document Type *
                    </label>
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      required
                    >
                      <option value="">Select document type</option>
                      {documentTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Choose File *
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-upload"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        required
                      />
                      <label
                        htmlFor="file-upload"
                        className="flex items-center justify-center w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors duration-200 bg-gray-50 hover:bg-blue-50"
                      >
                        <div className="text-center">
                          <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-3"></i>
                          <p className="text-sm text-gray-600">
                            {selectedFile ? (
                              <span className="font-semibold text-blue-600">
                                <i className="fas fa-check-circle mr-2"></i>
                                {selectedFile.name}
                              </span>
                            ) : (
                              <>
                                <span className="font-semibold">Click to upload</span> or drag and drop
                                <br />
                                <span className="text-xs text-gray-500">PDF, DOC, DOCX, JPG, PNG (max 10MB)</span>
                              </>
                            )}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows="3"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                      placeholder="Add any additional notes about this document..."
                    />
                  </div>

                  {/* Info Alert */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex">
                      <i className="fas fa-info-circle text-blue-600 mr-3 mt-0.5"></i>
                      <div>
                        <p className="text-sm font-semibold text-blue-900 mb-1">Document Submission Process</p>
                        <p className="text-xs text-blue-700">
                          Your document will be securely uploaded and sent to the management team for verification. You'll receive confirmation once it's been processed.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => !uploading && setShowUploadModal(false)}
                      className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all duration-300"
                      disabled={uploading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={uploading || !selectedFile || !documentType}
                    >
                      {uploading ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-upload mr-2"></i>
                          Upload Document
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserDocumentUpload;
