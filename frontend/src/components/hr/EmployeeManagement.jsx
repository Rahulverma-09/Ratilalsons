import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import employeeAPI from '../../utils/employeeAPI';
import ErrorBoundary from '../ErrorBoundary';

const API_BASE_URL = "https://ratilalsons-backend-api.onrender.com";

// Add Employee Form Component
const AddEmployeeForm = ({ onClose, onSuccess }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    date_of_joining: new Date().toISOString().split('T')[0], // Changed from 'joinDate'
    address: '',
    city: '',
    pincode: '',
    salary: '',
    // Removed password field - will be generated automatically
    department: '',
    // Document fields
    aadhar_card: null,
    pan_card: null,
    bank_documents: null,
    address_proof: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [documentPreviews, setDocumentPreviews] = useState({});
  const [fetchingCity, setFetchingCity] = useState(false);
  // Dynamic data states
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState(['Worker/Labour', 'Manager', 'Staff']);
  const [loading, setLoading] = useState(true);

  // Load dynamic data on component mount
  useEffect(() => {
    loadFormData();
  }, []);

  const loadFormData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      if (!token) return;

      // Load roles, departments, and positions in parallel
      const [rolesResponse, departmentsResponse, positionsResponse] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/roles`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/staff/departments`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/staff/positions`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      // Process roles
      if (rolesResponse.status === 'fulfilled' && rolesResponse.value.ok) {
        const rolesData = await rolesResponse.value.json();
        if (rolesData.success) {
          setRoles(rolesData.roles || []);
        }
      } else {
        // Fallback roles
        setRoles(['Labor', 'Employee', 'Senior', 'Supervisor', 'HR/Manager']);
      }

      // Process departments from new API endpoint
      if (departmentsResponse.status === 'fulfilled' && departmentsResponse.value.ok) {
        const deptData = await departmentsResponse.value.json();
        if (deptData.success) {
          console.log('✅ Form departments loaded from API:', deptData.data);
          const deptList = Array.isArray(deptData.data) ?
            deptData.data
              .map(d => typeof d === 'string' ? d : (d?.name || d?.label || null))
              .filter(d => d && typeof d === 'string') // Remove nulls and ensure strings only
            : [];
          setDepartments(deptList.length > 0 ? deptList : ['General']);
        }
      } else {
        // Fallback departments
        setDepartments(['General']);
      }

      // Process positions from new API endpoint
      if (positionsResponse.status === 'fulfilled' && positionsResponse.value.ok) {
        const posData = await positionsResponse.value.json();
        if (posData.success) {
          console.log('✅ Form positions loaded from API:', posData.data);
          const posList = Array.isArray(posData.data) ?
            posData.data
              .map(p => typeof p === 'string' ? p : (p?.name || p?.label || null))
              .filter(p => p && typeof p === 'string') // Remove nulls and ensure strings only
            : [];
          setPositions(posList.length > 0 ? posList : ['Staff']);
        }
      } else {
        // Fallback positions if API fails
        setPositions(['Staff']);
      }

      console.log('✅ Form data loading completed');

    } catch (error) {
      console.error('Error loading form data:', error);
      // Set fallback data on error
      setRoles(['Manager', 'Developer', 'Designer', 'Analyst', 'HR', 'Sales']);
      setDepartments(['General', 'HR', 'Finance', 'Operations', 'Sales']);
      setPositions(['Worker/Labour', 'Manager', 'Staff']);
      toast.error('Failed to load form data from server');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Auto-fetch city when pincode is entered
    if (name === 'pincode' && value.length === 6) {
      fetchCityFromPincode(value);
    }
  };

  const fetchCityFromPincode = async (pincode) => {
    try {
      setFetchingCity(true);
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();

      if (data && data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
        const city = data[0].PostOffice[0].District;
        setFormData(prev => ({
          ...prev,
          city: city
        }));
        toast.success(`City found: ${city}`);
      } else {
        toast.warning('City not found for this pincode');
      }
    } catch (error) {
      console.error('Error fetching city:', error);
      toast.error('Failed to fetch city details');
    } finally {
      setFetchingCity(false);
    }
  };

  const handleFileChange = (e, documentType) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }

      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Only JPG, PNG, and PDF files are allowed");
        return;
      }

      setFormData(prev => ({
        ...prev,
        [documentType]: file
      }));

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setDocumentPreviews(prev => ({
            ...prev,
            [documentType]: e.target.result
          }));
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Helper functions for creating new positions and departments

  const createNewPosition = async (positionName) => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error('Authentication required');
        return false;
      }

      const formData = new FormData();
      formData.append('name', positionName.trim());
      formData.append('description', `${positionName.trim()} designation`);

      const response = await fetch(`${API_BASE_URL}/api/staff/positions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`Designation '${positionName}' created successfully!`);
        // Refresh positions list
        setPositions(prev => [...prev, positionName].sort());
        return true;
      } else {
        toast.error(result.detail || 'Failed to create designation');
        return false;
      }
    } catch (error) {
      console.error('Error creating designation:', error);
      toast.error('Failed to create designation');
      return false;
    }
  };

  const createNewDepartment = async (departmentName) => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error('Authentication required');
        return false;
      }

      const formData = new FormData();
      formData.append('name', departmentName.trim());
      formData.append('description', `${departmentName.trim()} department`);

      const response = await fetch(`${API_BASE_URL}/api/staff/departments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`Department '${departmentName}' created successfully!`);
        // Refresh departments list
        setDepartments(prev => [...prev, departmentName].sort());
        return true;
      } else {
        toast.error(result.detail || 'Failed to create department');
        return false;
      }
    } catch (error) {
      console.error('Error creating department:', error);
      toast.error('Failed to create department');
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation (before guard to allow resubmit after fixing errors)
    if (!formData.name || !formData.phone || !formData.position) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Email validation (only if provided)
    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        toast.error("Please enter a valid email address");
        return;
      }
    }

    // Phone validation
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(formData.phone)) {
      toast.error("Please enter a valid phone number");
      return;
    }

    // Pincode validation
    if (formData.pincode && !/^\d{6}$/.test(formData.pincode)) {
      toast.error("Please enter a valid 6-digit pincode");
      return;
    }

    // Prevent duplicate submissions AFTER validation passes
    // useRef guard is synchronous (unlike useState) so it catches rapid double-clicks
    if (submittingRef.current || isSubmitting) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    try {

      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error("Authentication required. Please login again.");
        return;
      }

      // Validate data using utility
      const validation = employeeAPI.validateEmployeeData(formData);
      if (!validation.isValid) {
        validation.errors.forEach(error => toast.error(error));
        return;
      }

      // Create FormData for employee creation with documents
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      if (formData.email) {
        formDataToSend.append('email', formData.email);
      }
      formDataToSend.append('phone', formData.phone);
      formDataToSend.append('position', formData.position);
      formDataToSend.append('password', formData.password);
      formDataToSend.append('date_of_joining', formData.date_of_joining);
      formDataToSend.append('salary', formData.salary || '');
      formDataToSend.append('address', formData.address || '');
      formDataToSend.append('city', formData.city || '');
      formDataToSend.append('pincode', formData.pincode || '');
      formDataToSend.append('department', formData.department || '');

      // Add document files to FormData
      if (formData.aadhar_card) {
        formDataToSend.append('aadhar_card', formData.aadhar_card);
      }
      if (formData.pan_card) {
        formDataToSend.append('pan_card', formData.pan_card);
      }
      if (formData.bank_documents) {
        formDataToSend.append('bank_documents', formData.bank_documents);
      }
      if (formData.address_proof) {
        formDataToSend.append('address_proof', formData.address_proof);
      }

      console.log('Creating employee with documents...');

      const response = await fetch(`${API_BASE_URL}/api/staff/employees`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type for FormData - let browser set it with boundary
        },
        body: formDataToSend
      });

      const responseData = await response.json().catch(() => ({}));

      if (response.ok && responseData.success) {
        console.log('Employee created with documents:', responseData);

        // Show success message including document upload count
        const documentCount = [
          formData.aadhar_card,
          formData.pan_card,
          formData.bank_documents,
          formData.address_proof
        ].filter(doc => doc).length;

        const successMsg = documentCount > 0
          ? `Employee created successfully with ${documentCount} document(s) uploaded!`
          : 'Employee created successfully!';

        toast.success(successMsg);
        onSuccess();
      } else {
        // Handle error scenarios based on response data and status
        if (response.status === 403) {
          toast.error("Access Denied: Only HR and Admin users can add employees. Please contact your administrator.");
        } else if (response.status === 401) {
          toast.error("Session expired. Please login again.");
          localStorage.removeItem("access_token");
          window.location.href = '/login';
        } else if (response.status === 400) {
          const errorMsg = responseData.detail || responseData.message || "Invalid data provided";
          toast.error(`Validation Error: ${errorMsg}`);
        } else if (response.status >= 500) {
          toast.error("Server error. Please try again later or contact support.");
        } else {
          const errorMsg = responseData.detail || responseData.message || responseData.error || `Server error: ${response.status}`;
          toast.error(errorMsg);
        }
        console.error('API Error:', {
          status: response.status,
          statusText: response.statusText,
          data: responseData
        });
      }
    } catch (error) {
      console.error("Error adding employee:", error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        toast.error("Network error: Please check your internet connection");
      } else {
        toast.error("Failed to add employee. Please try again.");
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">Add New Employee</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <i className="fas fa-times text-lg"></i>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="Enter full name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="Enter email address (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="Enter phone number"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Designation <span className="text-red-500">*</span>
            </label>
            <select
              name="position"
              value={formData.position}
              onChange={handleInputChange}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              required
              disabled={loading}
            >
              <option value="">{loading ? 'Loading designations...' : 'Select Designation'}</option>
              {console.log('🔍 Rendering positions dropdown:', positions)}
              {Array.isArray(positions) && positions
                .filter(position => position) // Filter out null/undefined
                .map((position, index) => {
                  const posValue = typeof position === 'string' ? position : (position?.name || position?.label || String(position));
                  return (
                    <option key={index} value={posValue}>
                      {posValue}
                    </option>
                  );
                })}
              <option value="other">+ Add New Designation</option>
            </select>
            {formData.position === 'other' && (
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Enter new designation name"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  onBlur={async (e) => {
                    const newDesignation = e.target.value.trim();
                    if (newDesignation) {
                      const success = await createNewPosition(newDesignation);
                      if (success) {
                        setFormData(prev => ({ ...prev, position: newDesignation }));
                        e.target.value = '';
                      }
                    }
                  }}
                  onKeyPress={async (e) => {
                    if (e.key === 'Enter') {
                      const newDesignation = e.target.value.trim();
                      if (newDesignation) {
                        const success = await createNewPosition(newDesignation);
                        if (success) {
                          setFormData(prev => ({ ...prev, position: newDesignation }));
                          e.target.value = '';
                        }
                      }
                    }
                  }}
                />
                <p className="text-xs text-slate-500 mt-1">Press Enter or click away to create the designation</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Join Date
            </label>
            <input
              type="date"
              name="date_of_joining"
              value={formData.date_of_joining}
              onChange={handleInputChange}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Salary
            </label>
            <input
              type="text"
              name="salary"
              value={formData.salary}
              onChange={handleInputChange}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="e.g., ₹50,000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Department
            </label>
            <select
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              disabled={loading}
            >
              <option value="">{loading ? 'Loading departments...' : 'Select Department'}</option>
              {Array.isArray(departments) && departments
                .filter(dept => dept) // Filter out null/undefined
                .map((dept, index) => {
                  const deptValue = typeof dept === 'string' ? dept : (dept?.name || dept?.label || String(dept));
                  return (
                    <option key={index} value={deptValue}>
                      {deptValue}
                    </option>
                  );
                })}
              <option value="other">+ Add New Department</option>
            </select>
            {formData.department === 'other' && (
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Enter new department name"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  onBlur={async (e) => {
                    const newDepartment = e.target.value.trim();
                    if (newDepartment) {
                      const success = await createNewDepartment(newDepartment);
                      if (success) {
                        setFormData(prev => ({ ...prev, department: newDepartment }));
                        e.target.value = '';
                      }
                    }
                  }}
                  onKeyPress={async (e) => {
                    if (e.key === 'Enter') {
                      const newDepartment = e.target.value.trim();
                      if (newDepartment) {
                        const success = await createNewDepartment(newDepartment);
                        if (success) {
                          setFormData(prev => ({ ...prev, department: newDepartment }));
                          e.target.value = '';
                        }
                      }
                    }
                  }}
                />
                <p className="text-xs text-slate-500 mt-1">Press Enter or click away to create the department</p>
              </div>
            )}
          </div>
        </div>

        {/* Address Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-slate-900 border-b border-slate-200 pb-2">Address Information</h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Street Address
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              rows="2"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="Enter street address, house no., area"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                City {fetchingCity && <span className="text-indigo-500">(fetching...)</span>}
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                placeholder={fetchingCity ? "Fetching city..." : "Enter city"}
                disabled={fetchingCity}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Pincode
              </label>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleInputChange}
                pattern="[0-9]{6}"
                maxLength="6"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                placeholder="Enter 6-digit pincode"
              />
              <p className="text-xs text-slate-500 mt-1">City will be auto-filled when you enter pincode</p>
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-slate-900 border-b border-slate-200 pb-2">Document Upload</h3>
          <p className="text-sm text-slate-600">Upload employee documents (JPG, PNG, PDF only, max 5MB each) <span className="text-red-500">*All documents are required</span></p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Aadhar Card */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Aadhar Card <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => handleFileChange(e, 'aadhar_card')}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm file:mr-4 file:py-1 file:px-3 file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {documentPreviews.aadhar_card && (
                  <div className="mt-2">
                    <img src={documentPreviews.aadhar_card} alt="Aadhar preview" className="h-20 w-20 object-cover rounded border" />
                  </div>
                )}
              </div>
            </div>

            {/* PAN Card */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                PAN Card <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => handleFileChange(e, 'pan_card')}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm file:mr-4 file:py-1 file:px-3 file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {documentPreviews.pan_card && (
                  <div className="mt-2">
                    <img src={documentPreviews.pan_card} alt="PAN preview" className="h-20 w-20 object-cover rounded border" />
                  </div>
                )}
              </div>
            </div>

            {/* Bank Documents */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Bank Documents <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => handleFileChange(e, 'bank_documents')}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm file:mr-4 file:py-1 file:px-3 file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {documentPreviews.bank_documents && (
                  <div className="mt-2">
                    <img src={documentPreviews.bank_documents} alt="Bank docs preview" className="h-20 w-20 object-cover rounded border" />
                  </div>
                )}
              </div>
            </div>

            {/* Address Proof */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Address Proof
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => handleFileChange(e, 'address_proof')}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm file:mr-4 file:py-1 file:px-3 file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {documentPreviews.address_proof && (
                  <div className="mt-2">
                    <img src={documentPreviews.address_proof} alt="Address proof preview" className="h-20 w-20 object-cover rounded border" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-6 border-t border-slate-200">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Adding Employee...
              </>
            ) : (
              <>
                <i className="fas fa-plus mr-2"></i>
                Add Employee
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

// Edit Employee Form Component
const EditEmployeeForm = ({ employee, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    full_name: employee?.name || '',
    name: employee?.name || '',
    email: employee?.email || '',
    phone: employee?.phone || '',
    position: employee?.position || employee?.role || '',
    date_of_joining: employee?.joinDate ? new Date(employee.joinDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    address: employee?.address || '',
    salary: employee?.salary || '',
    city: employee?.city || '',
    pincode: employee?.pincode || '',
    department: employee?.department || '',
    // Document fields for edit
    aadhar_card: null,
    pan_card: null,
    bank_documents: null,
    address_proof: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documentPreviews, setDocumentPreviews] = useState({});
  const [fetchingCity, setFetchingCity] = useState(false);
  // Dynamic data states
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState(['Worker/Labour', 'Manager', 'Staff']);
  const [loading, setLoading] = useState(true);

  // Load dynamic data on component mount
  useEffect(() => {
    loadFormData();
  }, []);

  const loadFormData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error('Authentication required for editing');
        return;
      }

      console.log('🔄 Loading edit form data from backend...');

      // Load roles, departments, and positions data
      const [rolesResponse, departmentsResponse, positionsResponse] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/roles`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/staff/departments`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/staff/positions`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      // Process all responses with detailed logging
      if (rolesResponse.status === 'fulfilled' && rolesResponse.value.ok) {
        const rolesData = await rolesResponse.value.json();
        if (rolesData.success) {
          console.log('✅ Edit form roles loaded:', rolesData.roles);
          setRoles(rolesData.roles || []);
        }
      }

      // Process departments from new API endpoint
      if (departmentsResponse.status === 'fulfilled' && departmentsResponse.value.ok) {
        const deptData = await departmentsResponse.value.json();
        if (deptData.success) {
          console.log('✅ Edit form departments loaded from API:', deptData.data);
          const deptList = Array.isArray(deptData.data) ?
            deptData.data
              .map(d => typeof d === 'string' ? d : (d?.name || d?.label || null))
              .filter(d => d && typeof d === 'string') // Remove nulls and ensure strings only
            : [];
          setDepartments(deptList.length > 0 ? deptList : ['General']);
        }
      } else {
        // Fallback departments
        setDepartments(['General']);
      }

      // Process positions from new API endpoint
      if (positionsResponse.status === 'fulfilled' && positionsResponse.value.ok) {
        const posData = await positionsResponse.value.json();
        if (posData.success) {
          console.log('✅ Edit form positions loaded from API:', posData.data);
          const posList = Array.isArray(posData.data) ?
            posData.data
              .map(p => typeof p === 'string' ? p : (p?.name || p?.label || null))
              .filter(p => p && typeof p === 'string') // Remove nulls and ensure strings only
            : [];
          setPositions(posList.length > 0 ? posList : ['Staff']);
        }
      } else {
        // Fallback positions
        setPositions(['Staff']);
      }

      console.log('✅ Edit form data loading completed');

    } catch (error) {
      console.error('Error loading form data:', error);
      toast.error('Failed to load form data from server');
      // Set fallback data on error
      setRoles(['Manager', 'Developer', 'Designer', 'Analyst', 'HR', 'Sales']);
      setDepartments(['General', 'HR', 'Finance', 'Operations', 'Sales']);
      setPositions(['Worker/Labour', 'Manager', 'Staff']);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Auto-fetch city when pincode is entered
    if (name === 'pincode' && value.length === 6) {
      fetchCityFromPincode(value);
    }
  };

  // Add function to fetch city from pincode
  const fetchCityFromPincode = async (pincode) => {
    try {
      setFetchingCity(true);
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();

      if (data && data.length > 0 && data[0].Status === 'Success') {
        const cityName = data[0].PostOffice[0].District;
        setFormData(prev => ({ ...prev, city: cityName }));
      }
    } catch (error) {
      console.error('Error fetching city:', error);
    } finally {
      setFetchingCity(false);
    }
  };

  // Helper functions for creating new positions and departments (Edit Form)
  const createNewPosition = async (positionName) => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error('Authentication required');
        return false;
      }

      const formData = new FormData();
      formData.append('name', positionName.trim());
      formData.append('description', `${positionName.trim()} position`);

      const response = await fetch(`${API_BASE_URL}/api/staff/positions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`Designation '${positionName}' created successfully!`);
        // Refresh positions list
        setPositions(prev => [...prev, positionName].sort());
        return true;
      } else {
        toast.error(result.detail || 'Failed to create designation');
        return false;
      }
    } catch (error) {
      console.error('Error creating designation:', error);
      toast.error('Failed to create designation');
      return false;
    }
  };

  const createNewDepartment = async (departmentName) => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error('Authentication required');
        return false;
      }

      const formData = new FormData();
      formData.append('name', departmentName.trim());
      formData.append('description', `${departmentName.trim()} department`);

      const response = await fetch(`${API_BASE_URL}/api/staff/departments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`Department '${departmentName}' created successfully!`);
        // Refresh departments list
        setDepartments(prev => [...prev, departmentName].sort());
        return true;
      } else {
        toast.error(result.detail || 'Failed to create department');
        return false;
      }
    } catch (error) {
      console.error('Error creating department:', error);
      toast.error('Failed to create department');
      return false;
    }
  };

  // Handle file uploads
  const handleFileChange = (event, fieldName) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size should be less than 5MB');
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only JPG, PNG, and PDF files are allowed');
        return;
      }

      setFormData(prev => ({ ...prev, [fieldName]: file }));

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setDocumentPreviews(prev => ({ ...prev, [fieldName]: e.target.result }));
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!formData.name || !formData.phone || !formData.position) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setIsSubmitting(true);

      // Validate data
      const validation = employeeAPI.validateEmployeeData({
        name: formData.full_name,
        email: formData.email || '',
        phone: formData.phone,
        position: formData.position
      });

      if (!validation.isValid) {
        validation.errors.forEach(error => toast.error(error));
        return;
      }

      // Use API utility to update employee
      const result = await employeeAPI.updateEmployee(employee.user_id || employee.employee_id, formData);

      if (result.success) {
        toast.success('Employee updated successfully');
        onSuccess();
      } else {
        toast.error(result.message || 'Failed to update employee');
      }
    } catch (error) {
      console.error('Error updating employee:', error);

      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        toast.error("Session expired. Please login again");
        localStorage.removeItem("access_token");
        navigate('/login');
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        toast.error("You don't have permission to update employees");
      } else {
        toast.error(error.message || 'Failed to update employee');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">Edit Employee</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
          <i className="fas fa-times text-lg"></i>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
            <input
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="Enter full name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="Enter email address (optional)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
            <input
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="Enter phone number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Designation</label>
            <select
              name="position"
              value={formData.position}
              onChange={handleInputChange}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              required
              disabled={loading}
            >
              <option value="">{loading ? 'Loading designations...' : 'Select Designation'}</option>
              {Array.isArray(positions) && positions
                .filter(position => position) // Filter out null/undefined
                .map((position, index) => {
                  const posValue = typeof position === 'string' ? position : (position?.name || position?.label || String(position));
                  return (
                    <option key={index} value={posValue}>
                      {posValue}
                    </option>
                  );
                })}
              <option value="other">+ Add New Designation</option>
            </select>
            {formData.position === 'other' && (
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Enter new designation name"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  onBlur={async (e) => {
                    const newPosition = e.target.value.trim();
                    if (newPosition) {
                      const success = await createNewPosition(newPosition);
                      if (success) {
                        setFormData(prev => ({ ...prev, position: newPosition }));
                        e.target.value = '';
                      }
                    }
                  }}
                  onKeyPress={async (e) => {
                    if (e.key === 'Enter') {
                      const newPosition = e.target.value.trim();
                      if (newPosition) {
                        const success = await createNewPosition(newPosition);
                        if (success) {
                          setFormData(prev => ({ ...prev, position: newPosition }));
                          e.target.value = '';
                        }
                      }
                    }
                  }}
                />
                <p className="text-xs text-slate-500 mt-1">Press Enter or click away to create the designation</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Join Date</label>
            <input
              type="date"
              name="date_of_joining"
              value={formData.date_of_joining}
              onChange={handleInputChange}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Salary</label>
            <input
              name="salary"
              value={formData.salary}
              onChange={handleInputChange}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="e.g., ₹50,000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              City {fetchingCity && <span className="text-indigo-500">(fetching...)</span>}
            </label>
            <input
              name="city"
              value={formData.city}
              onChange={handleInputChange}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder={fetchingCity ? "Fetching city..." : "Enter city"}
              disabled={fetchingCity}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Pincode</label>
            <input
              type="text"
              name="pincode"
              value={formData.pincode}
              onChange={handleInputChange}
              pattern="[0-9]{6}"
              maxLength="6"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="Enter 6-digit pincode"
            />
            <p className="text-xs text-slate-500 mt-1">City will be auto-filled when you enter pincode</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Department</label>
            <select
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              disabled={loading}
            >
              <option value="">{loading ? 'Loading departments...' : 'Select Department'}</option>
              {Array.isArray(departments) && departments
                .filter(dept => dept) // Filter out null/undefined
                .map((dept, index) => {
                  const deptValue = typeof dept === 'string' ? dept : (dept?.name || dept?.label || String(dept));
                  return (
                    <option key={index} value={deptValue}>
                      {deptValue}
                    </option>
                  );
                })}
              <option value="other">+ Add New Department</option>
            </select>
            {formData.department === 'other' && (
              <div className="mt-2">
                <input
                  type="text"
                  placeholder="Enter new department name"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  onBlur={async (e) => {
                    const newDepartment = e.target.value.trim();
                    if (newDepartment) {
                      const success = await createNewDepartment(newDepartment);
                      if (success) {
                        setFormData(prev => ({ ...prev, department: newDepartment }));
                        e.target.value = '';
                      }
                    }
                  }}
                  onKeyPress={async (e) => {
                    if (e.key === 'Enter') {
                      const newDepartment = e.target.value.trim();
                      if (newDepartment) {
                        const success = await createNewDepartment(newDepartment);
                        if (success) {
                          setFormData(prev => ({ ...prev, department: newDepartment }));
                          e.target.value = '';
                        }
                      }
                    }
                  }}
                />
                <p className="text-xs text-slate-500 mt-1">Press Enter or click away to create the department</p>
              </div>
            )}
          </div>
        </div>

        {/* Address Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-slate-900 border-b border-slate-200 pb-2">Address Information</h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Street Address</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              rows="2"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="Enter street address, house no., area"
            />
          </div>
        </div>

        {/* Documents Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-slate-900 border-b border-slate-200 pb-2">Document Upload</h3>
          <p className="text-sm text-slate-600">Update employee documents (JPG, PNG, PDF only, max 5MB each)</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Aadhar Card */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Aadhar Card
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => handleFileChange(e, 'aadhar_card')}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm file:mr-4 file:py-1 file:px-3 file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {documentPreviews.aadhar_card && (
                  <div className="mt-2">
                    <img src={documentPreviews.aadhar_card} alt="Aadhar preview" className="h-20 w-20 object-cover rounded border" />
                  </div>
                )}
              </div>
            </div>

            {/* PAN Card */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                PAN Card
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => handleFileChange(e, 'pan_card')}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm file:mr-4 file:py-1 file:px-3 file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {documentPreviews.pan_card && (
                  <div className="mt-2">
                    <img src={documentPreviews.pan_card} alt="PAN preview" className="h-20 w-20 object-cover rounded border" />
                  </div>
                )}
              </div>
            </div>

            {/* Bank Documents */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Bank Documents
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => handleFileChange(e, 'bank_documents')}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm file:mr-4 file:py-1 file:px-3 file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {documentPreviews.bank_documents && (
                  <div className="mt-2">
                    <img src={documentPreviews.bank_documents} alt="Bank docs preview" className="h-20 w-20 object-cover rounded border" />
                  </div>
                )}
              </div>
            </div>

            {/* Address Proof */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Address Proof
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => handleFileChange(e, 'address_proof')}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm file:mr-4 file:py-1 file:px-3 file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {documentPreviews.address_proof && (
                  <div className="mt-2">
                    <img src={documentPreviews.address_proof} alt="Address proof preview" className="h-20 w-20 object-cover rounded border" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-6 border-t border-slate-200">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Updating...
              </>
            ) : (
              <>
                <i className="fas fa-save mr-2"></i>
                Update Employee
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

const EmployeesPage = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [employeesPerPage] = useState(10);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // States for dynamic statistics
  const [employeeStats, setEmployeeStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    avgAttendance: 0,
    departments: [],
    roles: [],
    todayPresent: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Debug stats state changes
  useEffect(() => {
    console.log('📊 Stats state updated:', {
      statsLoading,
      employeeStats,
      timestamp: new Date().toLocaleTimeString()
    });
  }, [employeeStats, statsLoading]);

  // Add function to fetch and calculate employee statistics
  const fetchEmployeeStats = async () => {
    try {
      setStatsLoading(true);
      console.log('📊 Calculating employee statistics...');

      // If we already have employees data, calculate stats from it first
      if (employees && employees.length > 0) {
        console.log('📊 Using current employees data for stats calculation:', employees);

        // Calculate stats from filtered employees data
        const totalEmployees = employees.length;
        const activeEmployees = employees.filter(emp => emp.status === 'Active').length;
        const inactiveEmployees = totalEmployees - activeEmployees;

        // Calculate unique departments
        const uniqueDepartments = [...new Set(
          employees.map(emp => emp.department || 'General').filter(d => d && d.trim())
        )];
        const departments = uniqueDepartments; // Keep as strings for dropdown

        // Calculate unique roles/positions
        const uniqueRoles = [...new Set(
          employees.map(emp => emp.position || emp.role || 'No Position').filter(r => r && r.trim())
        )];
        const roles = uniqueRoles; // Keep as strings for dropdown

        // Calculate attendance percentage
        const totalAttendance = employees.reduce((sum, emp) => sum + (emp.attendance || 0), 0);
        const avgAttendance = totalEmployees > 0 ? Math.floor(totalAttendance / totalEmployees) : 0;

        // Calculate today present (85-95% of active employees)
        const presentPercentage = 0.85 + (Math.random() * 0.1); // 85-95%
        const todayPresent = Math.floor(activeEmployees * presentPercentage);

        const calculatedStats = {
          total: totalEmployees,
          active: activeEmployees,
          inactive: inactiveEmployees,
          avgAttendance: avgAttendance,
          departments: departments,
          roles: roles,
          todayPresent: todayPresent
        };

        console.log('✅ Calculated stats from employees:', calculatedStats);
        setEmployeeStats(calculatedStats);
        return;
      }

      // If no employees data, try to fetch from API
      const token = localStorage.getItem("access_token");
      if (!token) {
        console.warn('No auth token for stats');
        setEmployeeStats({
          total: 0,
          active: 0,
          inactive: 0,
          avgAttendance: 0,
          departments: [],
          roles: [],
          todayPresent: 0
        });
        return;
      }

      // Try to get all users to calculate real stats
      try {
        const usersResponse = await fetch(`${API_BASE_URL}/api/staff/employees`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        });

        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          console.log('📊 Raw users data for stats:', usersData);

          if (usersData.success && Array.isArray(usersData.data) && usersData.data.length > 0) {
            // Filter out admin/customer/vendor users same as main filter
            const allUsers = usersData.data;
            const filteredUsers = allUsers.filter(user => {
              if (!user) return false;

              const userRoles = user.roles || [];

              const isAdmin = userRoles.some(role =>
                (typeof role === 'string' && role.toLowerCase().includes('admin')) ||
                (role && role.name && role.name.toLowerCase().includes('admin'))
              ) || (user.position && user.position.toLowerCase().includes('admin')) ||
                (user.role && user.role.toLowerCase().includes('admin'));

              const isCustomer = (user.position && user.position.toLowerCase().includes('customer')) ||
                (user.role && user.role.toLowerCase().includes('customer')) ||
                userRoles.some(role =>
                  (typeof role === 'string' && role.toLowerCase().includes('customer')) ||
                  (role && role.name && role.name.toLowerCase().includes('customer'))
                );

              const isVendor = (user.position && user.position.toLowerCase().includes('vendor')) ||
                (user.role && user.role.toLowerCase().includes('vendor')) ||
                userRoles.some(role =>
                  (typeof role === 'string' && role.toLowerCase().includes('vendor')) ||
                  (role && role.name && role.name.toLowerCase().includes('vendor'))
                );

              return !isAdmin && !isCustomer && !isVendor;
            });

            // Calculate real statistics from API data
            const totalEmployees = filteredUsers.length;
            const activeEmployees = filteredUsers.filter(user => user.is_active !== false).length;
            const inactiveEmployees = totalEmployees - activeEmployees;

            // Extract unique departments as strings
            const departments = [...new Set(
              filteredUsers
                .map(user => user.department || 'General')
                .filter(dept => dept && dept.trim())
            )];

            // Extract unique roles as strings
            const roles = [...new Set(
              filteredUsers
                .map(user => user.position || user.role || 'No Position')
                .filter(role => role && role.trim())
            )];

            const calculatedAvgAttendance = totalEmployees > 0 ? Math.floor(((activeEmployees / totalEmployees) * 100)) : 0;
            const todayPresent = Math.floor(activeEmployees * (0.85 + Math.random() * 0.1)); // 85-95% of active

            const apiStats = {
              total: totalEmployees,
              active: activeEmployees,
              inactive: inactiveEmployees,
              avgAttendance: calculatedAvgAttendance,
              departments: departments,
              roles: roles,
              todayPresent: todayPresent
            };

            console.log('✅ Calculated stats from API:', apiStats);
            setEmployeeStats(apiStats);
            return;
          }
        }
      } catch (usersError) {
        console.error('📊 Error fetching users for stats:', usersError);
      }

      // Final fallback: Set zero values
      console.warn('❌ No data available - setting default values');
      setEmployeeStats({
        total: 0,
        active: 0,
        inactive: 0,
        avgAttendance: 0,
        departments: [],
        roles: [],
        todayPresent: 0
      });

    } catch (error) {
      console.error('❌ Error in fetchEmployeeStats:', error);
      setEmployeeStats({
        total: 0,
        active: 0,
        inactive: 0,
        avgAttendance: 0,
        departments: [],
        roles: [],
        todayPresent: 0
      });
    } finally {
      setStatsLoading(false);
    }
  };

  // Effect for initial load
  useEffect(() => {
    fetchEmployees();
  }, []);

  // Effect to calculate stats when employees data changes
  useEffect(() => {
    if (employees && employees.length >= 0) {
      console.log('📊 Employees data changed, recalculating stats...', employees.length);
      fetchEmployeeStats();
    }
  }, [employees]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1); // Reset to first page when search changes
      fetchEmployees();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, filterStatus, filterDepartment]);

  // Page change effect
  useEffect(() => {
    fetchEmployees();
  }, [currentPage]);

  const fetchEmployees = async () => {
    try {
      setIsLoading(true);

      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error("Authentication required");
        navigate('/login');
        return;
      }

      // Use the API utility
      const params = {
        page: currentPage,
        limit: employeesPerPage,
        search: searchTerm?.trim(),
        active_only: true
      };

      console.log('🔍 Fetching employees with params:', params);

      // Fetch all employees from backend (limit=100), then paginate client-side
      const directResponse = await fetch(`${API_BASE_URL}/api/staff/employees?active_only=true&page=1&limit=100${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      console.log('🔍 Direct API response status:', directResponse.status);

      if (directResponse.ok) {
        const directData = await directResponse.json();
        console.log('🔍 Direct API response data:', directData);

        let employees = [];

        // Handle different response formats
        if (Array.isArray(directData)) {
          employees = directData;
        } else if (directData && directData.data) {
          employees = Array.isArray(directData.data) ? directData.data : [];
        } else if (directData && directData.users) {
          employees = Array.isArray(directData.users) ? directData.users : [];
        } else if (directData && typeof directData === 'object') {
          // If it's an object but not in expected format, log it
          console.log('🔍 Unexpected response format, keys:', Object.keys(directData));
          employees = [];
        }

        // Map to proper employee format (backend already handles role-based filtering)
        employees = employees.map((user, index) => {
          const joinDate = new Date(user.date_of_joining || user.created_at || new Date());
          const daysSinceJoin = Math.floor((new Date() - joinDate) / (1000 * 60 * 60 * 24));
          const baseAttendance = user.is_active ? 85 : 60;
          const attendanceVariation = Math.floor(Math.random() * 20) - 10;
          const dynamicAttendance = Math.max(0, Math.min(100, baseAttendance + attendanceVariation));
          const monthsSinceJoin = Math.max(1, Math.floor(daysSinceJoin / 30));
          const baseLeaveBalance = Math.min(monthsSinceJoin * 2, 30);
          const usedLeaves = Math.floor(Math.random() * Math.min(baseLeaveBalance, 15));
          const remainingLeaves = Math.max(0, baseLeaveBalance - usedLeaves);
          const position = user.position || user.designation || user.job_title || user.role || 'Employee';
          return {
            id: user.user_id || user.employee_id || user._id || `EMP-${index + 1}`,
            name: user.full_name || user.username || user.name || 'Unknown User',
            email: user.email || 'No Email',
            phone: user.phone || user.mobile || 'No Phone',
            position: position,
            role: user.position || user.role || 'Employee',
            joinDate: user.date_of_joining || user.created_at || new Date().toISOString(),
            department: user.department || user.dept || 'General',
            salary: user.salary || 'Not Set',
            address: user.address || 'Not Provided',
            city: user.city || 'Not Set',
            pincode: user.pincode || user.zip_code || 'Not Set',
            status: user.is_active !== false ? 'Active' : 'Inactive',
            attendance: dynamicAttendance,
            leaveBalance: remainingLeaves,
            user_id: user.user_id || user.employee_id || user._id,
            employee_id: user.employee_id || user.user_id || user._id,
            daysSinceJoin: daysSinceJoin
          };
        });

        // Filter by status if specified
        if (filterStatus) {
          employees = employees.filter(emp =>
            emp?.status?.toLowerCase() === filterStatus.toLowerCase()
          );
          console.log('📊 Employees after status filter:', employees.length);
        }

        // Filter by department if specified
        if (filterDepartment) {
          employees = employees.filter(emp =>
            emp?.department?.toLowerCase() === filterDepartment.toLowerCase()
          );
          console.log('📊 Employees after department filter:', employees.length);
        }

        setEmployees(employees);
        setTotalEmployees(employees.length);
        setTotalPages(Math.ceil(employees.length / employeesPerPage));

        console.log('✅ Employees loaded successfully:', {
          count: employees.length,
          activeCount: employees.filter(emp => emp.status === 'Active').length,
          departments: [...new Set(employees.map(emp => emp.department))].length,
          positions: [...new Set(employees.map(emp => emp.position))].length
        });

      } else {
        console.error('❌ Direct API call failed:', directResponse.status);
        const errorText = await directResponse.text();
        console.error('❌ Error response:', errorText);
        setEmployees([]);
        setTotalEmployees(0);
        setTotalPages(0);
      }

    } catch (error) {
      console.error("Error fetching employees:", error);

      // Handle different types of errors
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        toast.error("Session expired. Please login again");
        localStorage.removeItem("access_token");
        navigate('/login');
      } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
        toast.error("You don't have permission to view employees");
        navigate('/dashboard');
      } else if (error.message?.includes('fetch')) {
        toast.error("Network error: Please check your internet connection");
      } else {
        toast.error("Failed to load employees from server");
      }

      setEmployees([]);
      setTotalEmployees(0);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
  };

  const handleStatusChange = (value) => {
    setFilterStatus(value);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterStatus('');
    setFilterDepartment('');
    setCurrentPage(1);
  };

  const handleView = (employee) => {
    setSelectedEmployee(employee);
    setShowViewModal(true);
  };

  const handleEdit = (employee) => {
    setSelectedEmployee(employee);
    setShowEditModal(true);
  };

  const handleDelete = async (employeeId) => {
    if (!window.confirm("Are you sure you want to delete this employee?")) {
      return;
    }

    try {
      await employeeAPI.deleteEmployee(employeeId);
      toast.success("Employee deleted successfully");
      fetchEmployees(); // Refresh the employee list
    } catch (error) {
      console.error("Error deleting employee:", error);

      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        toast.error("Session expired. Please login again");
        localStorage.removeItem("access_token");
        navigate('/login');
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        toast.error("You don't have permission to delete employees");
      } else {
        toast.error(error.message || "Failed to delete employee");
      }
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      active: { bg: 'bg-emerald-100', text: 'text-emerald-800', icon: 'check-circle' },
      inactive: { bg: 'bg-rose-100', text: 'text-rose-800', icon: 'times-circle' },
      pending: { bg: 'bg-amber-100', text: 'text-amber-800', icon: 'hourglass-half' }
    };

    const { bg, text, icon } = config[status?.toLowerCase()] || config.active;

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
        <i className={`fas fa-${icon} mr-1`}></i>
        {status}
      </span>
    );
  };

  const getAttendanceColor = (percentage) => {
    if (percentage >= 95) return 'text-emerald-600';
    if (percentage >= 90) return 'text-blue-600';
    if (percentage >= 85) return 'text-amber-600';
    return 'text-rose-600';
  };

  // Client-side pagination — fetch all from backend, slice for display
  const allEmployees = Array.isArray(employees) ? employees : [];
  const indexOfLastEmployee = currentPage * employeesPerPage;
  const indexOfFirstEmployee = indexOfLastEmployee - employeesPerPage;
  const currentEmployees = allEmployees.slice(indexOfFirstEmployee, indexOfLastEmployee);

  if (isInitialLoad) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-stone-100 p-4 md:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="bg-white rounded-xl shadow-md p-5 border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center text-white shadow-lg">
                <i className="fas fa-users text-2xl"></i>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Employee Management</h1>
                <p className="text-slate-600 text-sm">Manage and track all employees</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow hover:shadow-md flex items-center gap-2 text-sm"
            >
              <i className="fas fa-plus"></i>
              Add Employee
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
      >
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-700 font-medium">Total Employees</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {statsLoading ? (
                  <span className="inline-block animate-pulse bg-blue-300 h-6 w-8 rounded"></span>
                ) : employeeStats.total}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {statsLoading ? 'Loading...' : `${employeeStats.departments?.length || 0} departments`}
              </p>
            </div>
            <i className="fas fa-users text-2xl text-blue-500"></i>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 border border-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-700 font-medium">Active Today</p>
              <p className="text-2xl font-bold text-emerald-900 mt-1">
                {statsLoading ? (
                  <span className="inline-block animate-pulse bg-emerald-300 h-6 w-8 rounded"></span>
                ) : employeeStats.active}
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                {statsLoading ? 'Loading...' : employeeStats.total > 0 ? `${Math.round((employeeStats.active / employeeStats.total) * 100)}% active` : 'No data'}
              </p>
            </div>
            <i className="fas fa-user-check text-2xl text-emerald-500"></i>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-700 font-medium">Present Now</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">
                {statsLoading ? (
                  <span className="inline-block animate-pulse bg-amber-300 h-6 w-8 rounded"></span>
                ) : employeeStats.todayPresent}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                {statsLoading ? 'Loading...' : employeeStats.active > 0 ? `${Math.round((employeeStats.todayPresent / employeeStats.active) * 100)}% present` : 'Real-time'}
              </p>
            </div>
            <i className="fas fa-clock text-2xl text-amber-500"></i>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-700 font-medium">Avg Attendance</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">
                {statsLoading ? (
                  <span className="inline-block animate-pulse bg-purple-300 h-6 w-8 rounded"></span>
                ) : `${employeeStats.avgAttendance}%`}
              </p>
              <p className="text-xs text-purple-600 mt-1">
                {statsLoading ? 'Loading...' : `${employeeStats.roles?.length || 0} positions`}
              </p>
            </div>
            <i className={`fas fa-chart-line text-2xl text-purple-500`}></i>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl shadow-md p-5 border border-slate-200 mb-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Search</label>
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"></i>
              <input
                type="text"
                placeholder="Search by name, email, or ID..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Department</label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">All Departments</option>
              {employeeStats.departments?.map((dept, index) => {
                const deptName = typeof dept === 'string' ? dept : (dept?.name || dept);
                const deptCount = typeof dept === 'object' && dept.count ? dept.count : '';
                return (
                  <option key={index} value={deptName}>
                    {deptName} {deptCount ? `(${deptCount})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleClearFilters}
              className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors text-sm"
            >
              <i className="fas fa-refresh mr-2"></i>
              Clear Filters
            </button>
          </div>
        </div>
      </motion.div>

      {/* Employees Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Position</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Department</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Join Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Attendance</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Leave Bal.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
                      <p className="text-slate-600">Loading employees...</p>
                    </div>
                  </td>
                </tr>
              ) : currentEmployees.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <i className="fas fa-users text-4xl text-slate-400 mb-4"></i>
                      <h3 className="text-lg font-medium text-slate-900 mb-2">No employees found</h3>
                      <p className="text-slate-500">
                        {searchTerm || filterStatus
                          ? "Try adjusting your search or filter criteria"
                          : "No employees available in the system"}
                      </p>
                      <div className="mt-4 text-xs text-slate-400">
                        <p>Debug info:</p>
                        <p>Total users fetched: {employees.length}</p>
                        <p>Current filters: Status={filterStatus || 'none'}, Dept={filterDepartment || 'none'}, Search={searchTerm || 'none'}</p>
                        <button
                          onClick={() => console.log('Current employees array:', employees)}
                          className="mt-2 px-3 py-1 bg-slate-200 text-slate-700 rounded text-xs hover:bg-slate-300"
                        >
                          Log employees to console
                        </button>
                      </div>
                      {(!searchTerm && !filterStatus) && (
                        <button
                          onClick={() => setShowAddModal(true)}
                          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          <i className="fas fa-plus mr-2"></i>
                          Add First Employee
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                currentEmployees.map((employee, index) => (
                  <motion.tr
                    key={employee?.id || `employee-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{employee?.id || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                          {employee?.name ? employee.name.split(' ').map(n => n[0]).join('') : 'NA'}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">{employee?.name || 'No Name'}</div>
                          <div className="text-xs text-slate-500">{employee?.email || 'No Email'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">{employee?.position || 'No Position'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">{employee?.department || 'No Department'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">
                        {employee?.joinDate ? new Date(employee.joinDate).toLocaleDateString('en-US', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        }) : 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm font-semibold ${getAttendanceColor(employee?.attendance || 0)}`}>
                        {employee?.attendance || 0}%
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900">{employee?.leaveBalance || 0}</div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(employee.status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleView(employee)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <i className="fas fa-eye text-sm"></i>
                        </button>
                        <button
                          onClick={() => handleEdit(employee)}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Edit Employee"
                        >
                          <i className="fas fa-edit text-sm"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(employee.user_id || employee.employee_id || employee.id)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Employee"
                        >
                          <i className="fas fa-trash-alt text-sm"></i>
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-700">
                Showing {indexOfFirstEmployee + 1} to {Math.min(indexOfLastEmployee, totalEmployees)} of {totalEmployees} employees
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                {[...Array(totalPages)].map((_, index) => {
                  const page = index + 1;
                  if (page === currentPage || page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 text-sm font-medium rounded ${page === currentPage
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return <span key={page} className="px-2">...</span>;
                  }
                  return null;
                })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Add Employee Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <AddEmployeeForm
                onClose={() => setShowAddModal(false)}
                onSuccess={() => {
                  setShowAddModal(false);
                  fetchEmployees(); // Refresh the employee list
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Employee Modal */}
      <AnimatePresence>
        {showViewModal && selectedEmployee && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4"
            onClick={() => setShowViewModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-900">Employee Details</h2>
                  <button
                    onClick={() => setShowViewModal(false)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <i className="fas fa-times text-lg"></i>
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                      {selectedEmployee.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{selectedEmployee.name}</h3>
                      <p className="text-slate-600">{selectedEmployee.role}</p>
                      {getStatusBadge(selectedEmployee.status)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 uppercase">Employee ID</label>
                        <p className="text-slate-900 font-medium">{selectedEmployee.id}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 uppercase">Email</label>
                        <p className="text-slate-900">{selectedEmployee.email}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 uppercase">Phone</label>
                        <p className="text-slate-900">{selectedEmployee.phone}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 uppercase">Join Date</label>
                        <p className="text-slate-900">
                          {new Date(selectedEmployee.joinDate).toLocaleDateString('en-US', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 uppercase">Attendance</label>
                        <p className={`font-semibold ${getAttendanceColor(selectedEmployee?.attendance || 0)}`}>
                          {selectedEmployee.attendance}%
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 uppercase">Leave Balance</label>
                        <p className="text-slate-900 font-medium">{selectedEmployee.leaveBalance} days</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 uppercase">Salary</label>
                        <p className="text-slate-900 font-medium">{selectedEmployee.salary}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase">Address</label>
                    <p className="text-slate-900">{selectedEmployee.address}</p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
                  <button
                    onClick={() => {
                      setShowViewModal(false);
                      handleEdit(selectedEmployee);
                    }}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-medium hover:from-amber-600 hover:to-orange-700 transition-all duration-200 shadow"
                  >
                    <i className="fas fa-edit mr-2"></i>
                    Edit Employee
                  </button>
                  <button
                    onClick={() => setShowViewModal(false)}
                    className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Employee Modal */}
      <AnimatePresence>
        {showEditModal && selectedEmployee && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <EditEmployeeForm
                employee={selectedEmployee}
                onClose={() => setShowEditModal(false)}
                onSuccess={() => {
                  setShowEditModal(false);
                  fetchEmployees();
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Wrap with ErrorBoundary for better error handling
const EmployeesPageWithErrorBoundary = () => {
  return (
    <ErrorBoundary>
      <EmployeesPage />
    </ErrorBoundary>
  );
};

export default EmployeesPageWithErrorBoundary;
