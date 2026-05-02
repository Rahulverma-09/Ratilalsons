// Employee API utilities for dynamic data fetching
const API_BASE_URL = "https://ratilalsons-backend-api.onrender.com";

/**
 * Get authentication token from localStorage
 * @returns {string|null} Authentication token
 */
const getAuthToken = () => {
  return localStorage.getItem("access_token");
};

/**
 * Base API request function with authentication
 * @param {string} endpoint - API endpoint
 * @param {object} options - Request options
 * @returns {Promise<Response>} Fetch response
 */
const apiRequest = async (endpoint, options = {}) => {
  const token = getAuthToken();
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };

  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });
};

/**
 * Fetch all employees with pagination and filtering
 * @param {object} params - Query parameters
 * @returns {Promise<object>} Employees data with pagination
 */
export const fetchEmployees = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams({
      page: params.page || 1,
      limit: params.limit || 10,
      ...(params.search && { search: params.search }),
      ...(params.department && { department: params.department }),
      ...(params.role && { role: params.role }),
      active_only: params.active_only !== false
    });

    // Try users endpoint (this is what actually works)
    let response = await apiRequest(`/api/staff/employees?${queryParams}`);
    let data;
    
    if (!response.ok) {
      console.warn('Users endpoint failed, trying employees endpoint...');
      // Fallback to employees endpoint
      response = await apiRequest(`/api/staff/employees/?${queryParams}`);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
    }

    data = await response.json();
    
    // Transform data to match frontend expectations
    const transformedEmployees = (data.data || []).map(emp => ({
      id: emp.user_id || emp.id,
      user_id: emp.user_id,
      employee_id: emp.user_id,
      name: emp.full_name || emp.name,
      email: emp.email,
      phone: emp.phone || '',
      role: emp.role_name || emp.position || 'Employee',
      position: emp.position || emp.role_name || 'Employee',
      joinDate: emp.date_of_joining || emp.created_at,
      attendance: Math.floor(Math.random() * 20) + 80, // TODO: Replace with real data
      leaveBalance: Math.floor(Math.random() * 15) + 15, // TODO: Replace with real data
      status: emp.is_active ? 'Active' : 'Inactive',
      address: emp.address || '',
      salary: emp.salary || '',
      city: emp.city || '',
      pincode: emp.pincode || emp.zip_code || '',
      department: emp.department || ''
    }));

    return {
      success: true,
      data: transformedEmployees,
      total: data.total || transformedEmployees.length,
      pages: data.pages || Math.ceil(transformedEmployees.length / (params.limit || 10)),
      page: data.page || 1
    };
  } catch (error) {
    console.error('Error fetching employees:', error);
    throw error;
  }
};

/**
 * Create a new employee
 * @param {object} employeeData - Employee data
 * @returns {Promise<object>} Created employee data
 */
export const createEmployee = async (employeeData) => {
  try {
    const payload = {
      user_id: employeeData.user_id || `EMP-${Date.now()}`,
      email: employeeData.email,
      full_name: employeeData.name,
      phone: employeeData.phone,
      position: employeeData.position,
      password: employeeData.password,
      date_of_joining: employeeData.date_of_joining,
      address: employeeData.address || '',
      city: employeeData.city || '',
      pincode: employeeData.pincode || '',
      salary: employeeData.salary || '',
      department: employeeData.department || '',
      role_ids: employeeData.role_ids || [],
      roles: employeeData.roles || [employeeData.position?.toLowerCase() || 'employee'],
      is_active: true,
      employee_type: 'full_time'
    };

    console.log('Creating employee with payload:', payload);

    const response = await apiRequest('/api/employees/create-with-documents', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 403) {
        throw new Error('Access Denied: Only HR and Admin users can add employees. Please contact your administrator.');
      } else if (response.status === 401) {
        throw new Error('Authentication failed. Please login again.');
      } else if (response.status === 400) {
        throw new Error(data.detail || data.message || 'Invalid data provided');
      } else {
        throw new Error(data.detail || data.message || `HTTP ${response.status}`);
      }
    }

    return data;
  } catch (error) {
    console.error('Error creating employee:', error);
    throw error;
  }
};

/**
 * Update an employee
 * @param {string} employeeId - Employee ID
 * @param {object} employeeData - Updated employee data
 * @returns {Promise<object>} Updated employee data
 */
export const updateEmployee = async (employeeId, employeeData) => {
  try {
    console.log('🚀 employeeAPI.updateEmployee called');
    console.log('📝 Employee ID:', employeeId);
    console.log('📝 Employee data:', employeeData);
    
    const payload = {
      full_name: employeeData.full_name || employeeData.name,
      email: employeeData.email,
      phone: employeeData.phone,
      position: employeeData.position,
      date_of_joining: employeeData.date_of_joining,
      address: employeeData.address || '',
      city: employeeData.city || '',
      pincode: employeeData.pincode || '',
      salary: employeeData.salary || '',
      department: employeeData.department || ''
    };

    console.log('📡 Calling API endpoint:', `/api/employees/${employeeId}`);
    console.log('📡 Payload:', payload);

    const response = await apiRequest(`/api/employees/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    console.log('📡 API response status:', response.status);
    console.log('📡 API response ok:', response.ok);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('❌ API error:', error);
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ API success response:', data);
    
    // Return normalized response with success flag
    return {
      success: true,
      data: data,
      message: 'Employee updated successfully'
    };
  } catch (error) {
    console.error('❌ Error updating employee:', error);
    return {
      success: false,
      message: error.message || 'Failed to update employee'
    };
  }
};

/**
 * Delete an employee (soft delete)
 * @param {string} employeeId - Employee ID
 * @returns {Promise<object>} Deletion result
 */
export const deleteEmployee = async (employeeId) => {
  try {
    const response = await apiRequest(`/api/staff/employees/${employeeId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error deleting employee:', error);
    throw error;
  }
};

/**
 * Upload employee document
 * @param {string} employeeId - Employee ID
 * @param {File} file - Document file
 * @param {string} documentType - Type of document
 * @param {string} documentName - Name of document
 * @returns {Promise<object>} Upload result
 */
export const uploadEmployeeDocument = async (employeeId, file, documentType, documentName) => {
  try {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('employee_id', employeeId);
    formData.append('document_type', documentType);
    formData.append('document_name', documentName || documentType.replace('_', ' ').toUpperCase());

    const response = await fetch(`${API_BASE_URL}/api/employees/documents/upload-file`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
        // Don't set Content-Type for FormData - browser will set it with boundary
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error uploading document:', error);
    throw error;
  }
};

/**
 * Get employee statistics
 * @returns {Promise<object>} Employee statistics
 */
export const getEmployeeStats = async () => {
  try {
    const response = await apiRequest('/api/employees/stats');
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching employee stats:', error);
    // Return default stats if API fails
    return {
      total_employees: 0,
      active_employees: 0,
      inactive_employees: 0,
      departments: []
    };
  }
};

/**
 * Validate employee data
 * @param {object} data - Employee data to validate
 * @returns {object} Validation result
 */
export const validateEmployeeData = (data) => {
  const errors = [];

  if (!data.name || !data.name.trim()) {
    errors.push('Employee name is required');
  }

  // Email is now optional, only validate if provided
  if (data.email && data.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Please enter a valid email address');
  }

  if (!data.phone || !data.phone.trim()) {
    errors.push('Phone number is required');
  } else if (!/^[\d\s\-\+\(\)]+$/.test(data.phone)) {
    errors.push('Please enter a valid phone number');
  }

  if (!data.position || !data.position.trim()) {
    errors.push('Position is required');
  }

  if (data.password && data.password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (data.pincode && !/^\d{6}$/.test(data.pincode)) {
    errors.push('Please enter a valid 6-digit pincode');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export default {
  fetchEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  uploadEmployeeDocument,
  getEmployeeStats,
  validateEmployeeData
};