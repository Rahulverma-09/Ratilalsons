import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  User2, Star, TrendingUp, Gift, ChevronUp, Mail,
  Phone, MapPin, Calendar, Search, Upload, ShoppingCart, Plus, Edit, Trash2
} from "lucide-react";
import CreatableSelect from 'react-select/creatable';
import { API_URL } from '../../config';

// --- Modal for Add New Customer ---
 export const AddCustomerModal = ({ open, onClose, onAdd, loading, customers, editMode = false, existingCustomer = null }) => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "",
    profile_picture: null,
    profilePicturePreview: null,
    company: "",
    job_title: "",
    customer_type: "regular",
    role: ""
  });
  const [error, setError] = useState("");
  const [roles, setRoles] = useState([]);
  const [customers_list, setCustomersList] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerUsers, setCustomerUsers] = useState([]); // Users with customer roles

  useEffect(() => {
    if (open) {
      if (editMode && existingCustomer) {
        // Pre-fill form with existing customer data for editing
        setForm({
          name: existingCustomer.name || "",
          email: existingCustomer.email || "",
          password: "", // Don't pre-fill password for security
          phone: existingCustomer.phone || "",
          address: existingCustomer.address || "",
          city: existingCustomer.city || "",
          state: existingCustomer.state || "",
          country: existingCustomer.country || "",
          profile_picture: null,
          profilePicturePreview: existingCustomer.avatar_url || null,
          company: existingCustomer.company || "",
          job_title: existingCustomer.job_title || "",
          customer_type: existingCustomer.customer_type || "regular",
          role: existingCustomer.role || ""
        });
        setSelectedCustomer({
          label: existingCustomer.name,
          value: existingCustomer.id,
          ...existingCustomer
        });
      } else {
        // Reset form for add mode
        setForm({
          name: "",
          email: "",
          password: "",
          phone: "",
          address: "",
          city: "",
          state: "",
          country: "",
          profile_picture: null,
          profilePicturePreview: null,
          company: "",
          job_title: "",
          customer_type: "regular",
          role: ""
        });
        setSelectedCustomer(null);
      }
      setError("");
      
      // Fetch customers and automatically populate roles
      if (!editMode) {
        fetchCustomersForSelection();
      }
    }
  }, [open, editMode, existingCustomer]);

  const fetchCustomersForSelection = async () => {
    try {
      const token = localStorage.getItem('access_token');
      // Fetch existing customers
      const customersRes = await fetch(`${API_URL}/api/customers/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (customersRes.ok) {
        const customersData = await customersRes.json();
        setCustomersList(customersData || []);
      }

      // Fetch all roles and filter for customer roles
      const rolesRes = await fetch(`${API_URL}/api/roles/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      let customerRoles = [];
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        customerRoles = rolesData.filter(role => 
          role.name && role.name.toLowerCase().includes('customer')
        ).map(role => role.name);
      }

      // Fetch users with customer role from users API (no auth required)
      const usersRes = await fetch(`${API_URL}/api/auth/users/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        
        console.log('Fetched users data:', usersData); // Debug log
        
        // Filter users who have customer role - more flexible filtering
        const customerRoleUsers = usersData.filter(user => {
          // Check if user has roles array or role_name
          if (!user.roles && !user.role_name && !user.role_ids) {
            console.log('User without roles:', user);
            return false;
          }
          
          // Handle different role structures from /api/users/ endpoint
          let userRoles = [];
          
          if (user.roles) {
            userRoles = Array.isArray(user.roles) ? user.roles : [user.roles];
          } else if (user.role_name) {
            userRoles = [user.role_name];
          }
          
          // Check if any role contains 'customer'
          const hasCustomerRole = userRoles.some(role => {
            if (typeof role === 'string') {
              return role.toLowerCase().includes('customer');
            } else if (typeof role === 'object' && role.name) {
              return role.name.toLowerCase().includes('customer');
            }
            return false;
          });
          
          console.log(`User ${user.full_name || user.username} has customer role:`, hasCustomerRole, 'Roles:', userRoles);
          return hasCustomerRole;
        });
        
        console.log('Filtered customer role users:', customerRoleUsers); // Debug log
        
        setCustomerUsers(customerRoleUsers);
        
        // Extract customer roles from users as backup
        const userCustomerRoles = usersData
          .filter(user => {
            if (!user.roles && !user.role_name) return false;
            
            let userRoles = [];
            if (user.roles) {
              userRoles = Array.isArray(user.roles) ? user.roles : [user.roles];
            } else if (user.role_name) {
              userRoles = [user.role_name];
            }
            
            return userRoles.some(role => {
              if (typeof role === 'string') {
                return role.toLowerCase().includes('customer');
              } else if (typeof role === 'object' && role.name) {
                return role.name.toLowerCase().includes('customer');
              }
              return false;
            });
          })
          .flatMap(user => {
            let userRoles = [];
            if (user.roles) {
              userRoles = Array.isArray(user.roles) ? user.roles : [user.roles];
            } else if (user.role_name) {
              userRoles = [user.role_name];
            }
            
            return userRoles
              .map(role => {
                if (typeof role === 'string') {
                  return role;
                } else if (typeof role === 'object' && role.name) {
                  return role.name;
                }
                return null;
              })
              .filter(role => role && role.toLowerCase().includes('customer'));
          });
        
        // Combine roles from roles API and users API
        const allCustomerRoles = [...new Set([...customerRoles, ...userCustomerRoles])];
        
        // If no customer roles found, fallback to basic customer types
        const fallbackRoles = allCustomerRoles.length > 0 
          ? allCustomerRoles 
          : ['customer', 'customer_support', 'customer_service'];
        
        setRoles(fallbackRoles.map(role => ({ id: role, name: role })));
      } else {
        // If employees API fails but we have roles from roles API
        if (customerRoles.length > 0) {
          setRoles(customerRoles.map(role => ({ id: role, name: role })));
        } else {
          // Fallback to default customer roles if both APIs fail
          const defaultCustomerRoles = ['customer', 'customer_support', 'customer_service'];
          setRoles(defaultCustomerRoles.map(role => ({ id: role, name: role })));
        }
        setCustomerUsers([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      // Fallback to default customer roles on error
      const defaultCustomerRoles = ['customer', 'customer_support', 'customer_service'];
      setRoles(defaultCustomerRoles.map(role => ({ id: role, name: role })));
      setCustomerUsers([]);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;

    if (type === "file" && name === "profile_picture") {
      if (files && files[0]) {
        const file = files[0];

        // Validate file type
        if (!file.type.match("image.*")) {
          setError("Please select an image file (JPEG, PNG, etc.)");
          return;
        }

        // Validate file size less than 5MB
        if (file.size > 5 * 1024 * 1024) {
          setError("File size should be less than 5MB");
          return;
        }

        // Create preview and set file to form
        const reader = new FileReader();
        reader.onloadend = () => {
          setForm((prev) => ({
            ...prev,
            profile_picture: file,
            profilePicturePreview: reader.result,
          }));
        };

        reader.readAsDataURL(file);
      } else {
        // If no file selected, clear existing
        setForm((prev) => ({
          ...prev,
          profile_picture: null,
          profilePicturePreview: null,
        }));
      }
    } else {
      // For other inputs, set form state normally
      setForm((prev) => ({ ...prev, [name]: value }));

      if (name === "role") {
        setSelectedCustomer(null);
      }
    }

    setError("");
  };

  // Customer options for React Select (all customers)
  const getCustomerOptions = () => {
    return customers_list.map(customer => ({
      value: customer.id || customer._id,
      label: `${customer.name} (${customer.email || customer.mailid || customer.email_id || 'No email'})`,
      name: customer.name,
      email: customer.email || customer.mailid || customer.email_id,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      country: customer.country,
      company: customer.company,
      job_title: customer.job_title,
      customer_type: customer.customer_type,
      role: customer.role,
      ...customer
    }));
  };

  // Customer users options for React Select (users with customer roles)
  const getCustomerUserOptions = () => {
    console.log('Current customerUsers state:', customerUsers); // Debug log
    console.log('Current form.role:', form.role); // Debug log
    
    let filteredUsers = customerUsers;
    
    // Filter users based on selected role if a role is selected
    if (form.role) {
      filteredUsers = customerUsers.filter(user => {
        if (!user.roles && !user.role_name) return false;
        
        let userRoles = [];
        if (user.roles) {
          userRoles = Array.isArray(user.roles) ? user.roles : [user.roles];
        } else if (user.role_name) {
          userRoles = [user.role_name];
        }
        
        return userRoles.some(role => {
          if (typeof role === 'string') {
            return role.toLowerCase() === form.role.toLowerCase();
          } else if (typeof role === 'object' && role.name) {
            return role.name.toLowerCase() === form.role.toLowerCase();
          }
          return false;
        });
      });
      console.log('Filtered users by role:', filteredUsers); // Debug log
    }
    
    const userOptions = filteredUsers.map(user => {
      // Handle different role structures for display from /api/users/ endpoint
      let roleNames = [];
      if (user.roles) {
        const userRoles = Array.isArray(user.roles) ? user.roles : [user.roles];
        roleNames = userRoles.map(role => {
          if (typeof role === 'string') {
            return role;
          } else if (typeof role === 'object' && role.name) {
            return role.name;
          }
          return 'Unknown Role';
        });
      } else if (user.role_name) {
        roleNames = [user.role_name];
      } else {
        roleNames = ['Unknown Role'];
      }
      
      return {
        value: user.user_id || user.id,
        label: `${user.full_name || user.username} (${user.email || 'No email'}) - ${roleNames.join(', ')}`,
        name: user.full_name || user.username,
        email: user.email,
        phone: user.phone,
        user_id: user.user_id || user.id,
        roles: roleNames, // Use processed role names
        department: user.department,
        position: user.position || roleNames[0], // Use first role as position if not available
        __isUser__: true // Flag to identify this as a user rather than existing customer
      };
    });
    
    console.log('Generated user options:', userOptions); // Debug log
    return userOptions;
  };

  // Combined and deduplicated options
  const getCombinedUniqueOptions = () => {
    const customerOptions = getCustomerOptions();
    const userOptions = getCustomerUserOptions();
    
    // Combine both arrays
    const allOptions = [...customerOptions, ...userOptions];
    
    // Create a Map to track unique emails (case-insensitive)
    const uniqueOptionsMap = new Map();
    const optionsWithoutEmail = [];
    
    allOptions.forEach(option => {
      const email = option.email;
      if (!email || email === 'No email' || email.trim() === '') {
        // Keep options without email separate to avoid conflicts
        optionsWithoutEmail.push(option);
      } else {
        const normalizedEmail = email.toLowerCase().trim();
        
        // If we haven't seen this email before, or if current option is a user (prioritize users)
        if (!uniqueOptionsMap.has(normalizedEmail) || option.__isUser__) {
          uniqueOptionsMap.set(normalizedEmail, option);
        }
      }
    });
    
    // Combine unique email options with options that have no email
    const uniqueOptions = [...uniqueOptionsMap.values(), ...optionsWithoutEmail];
    
    console.log('Combined unique options:', uniqueOptions); // Debug log
    console.log('Removed duplicates based on email matching'); // Debug log
    
    return uniqueOptions;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Required field check - password is optional in edit mode
    if (!form.name || !form.email || !form.phone || !form.address) {
      setError("Please fill all required fields.");
      return;
    }

    // In add mode, password is required
    if (!editMode && !form.password) {
      setError("Password is required when adding a new customer.");
      return;
    }

    // Client-side duplicate check (email only, case-insensitive, trimmed) - skip in edit mode
    if (!editMode) {
      const formEmail = form.email.trim().toLowerCase();
      const duplicate = customers.find(c => {
        const cEmail = (c.email || c.mailid || c.email_id || "").trim().toLowerCase();
        return cEmail === formEmail;
      });

      if (duplicate) {
        setError("A customer with this email already exists.");
        return;
      }
    }

    // Create FormData for backend, handle array/object fields safely
    const formData = new FormData();
    formData.append('name', form.name || '');
    formData.append('email', form.email || '');
    formData.append('password', form.password || '');
    formData.append('phone', form.phone || '');
    formData.append('address', form.address || '');
    formData.append('city', form.city || '');
    formData.append('state', form.state || '');
    formData.append('country', form.country || '');
    formData.append('company', form.company || '');
    formData.append('job_title', form.job_title || '');
    formData.append('customer_type', form.customer_type || 'regular');
    formData.append('status', form.status || 'active'); // optional
    formData.append('lifetime_value', form.lifetime_value || 0);

    // Preferences as JSON string
    formData.append('preferences', typeof form.preferences === "string"
      ? form.preferences
      : JSON.stringify(form.preferences || {})
    );

    // Tags as comma-separated string if array
    formData.append('tags', Array.isArray(form.tags)
      ? form.tags.join(",")
      : (form.tags || "")
    );

    // Attach profile picture if present and valid
    if (form.profile_picture instanceof File) {
      formData.append('profile_picture', form.profile_picture);
    }

    // --- Debug: log FormData keys/values to console ---
    for (const [key, value] of formData.entries()) {
      console.log(`${key}:`, value);
    }

    try {
      // Create a clean copy of form data without profilePicturePreview
      const cleanFormData = {
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        address: form.address,
        city: form.city,
        state: form.state,
        country: form.country,
        company: form.company,
        job_title: form.job_title,
        customer_type: form.customer_type,
        status: form.status || 'active',
        lifetime_value: form.lifetime_value || 0,
        preferences: form.preferences || {},
        tags: form.tags || [],
        profile_picture: form.profile_picture // This will be the File object or null
      };

      const response = await onAdd(cleanFormData);
      
      if (response && response.error) {
        setError(response.error);
        return;
      }
      
      // Success - close modal and parent will handle refresh
      onClose();
    } catch (err) {
      console.error("Network error:", err);
      setError("Something went wrong while adding/updating the customer.");
    }
  };

    
  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
      {loading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-700 font-medium">{editMode ? 'Updating customer...' : 'Adding customer...'}</p>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[100vh] overflow-hidden flex flex-col">
        {/* Header Card */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 relative">
          <button
            className="absolute top-4 right-4 text-white hover:text-red-300 text-2xl transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <i className={`fas ${editMode ? 'fa-user-edit' : 'fa-user-plus'} text-white text-xl`}></i>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{editMode ? 'Edit Customer' : 'Add New Customer'}</h2>
              <p className="text-blue-100 text-sm">{editMode ? 'Update customer profile details' : 'Create a new customer profile with all details'}</p>
            </div>
          </div>
        </div>

        {/* Form Content - Scrollable */}
        <div className="max-h-[calc(90vh-120px)] overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-8">
            {/* Role Section - Always 'customer' */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 mb-6 border border-purple-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-user-tag text-purple-600"></i>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Customer Role</h3>
              </div>
              <div className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm bg-gray-50 text-gray-700 font-semibold">
                Customer
              </div>
            </div>

            {/* Personal Information Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-user text-blue-600"></i>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Personal Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  {editMode ? (
                    <input 
                      type="text" 
                      name="name" 
                      required 
                      value={form.name} 
                      onChange={handleChange} 
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                      placeholder="Customer Name"
                    />
                  ) : (
                    <>
                      <CreatableSelect
                        value={selectedCustomer}
                        onChange={(selectedOption) => {
                          setSelectedCustomer(selectedOption);
                          if (selectedOption) {
                            if (selectedOption.__isNew__) {
                              // Handle new customer creation
                              setForm(prev => ({
                                ...prev,
                                name: selectedOption.value || "",
                                email: "",
                                password: "",
                                phone: "",
                                address: "",
                                city: "",
                                state: "",
                                country: "",
                                company: "",
                                job_title: "",
                                customer_type: "regular",
                                role: ""
                              }));
                            } else if (selectedOption.__isUser__) {
                              // Handle user with customer role selection
                              const primaryRole = selectedOption.roles.find(role => 
                                role.toLowerCase().includes('customer')
                              ) || selectedOption.roles[0] || 'customer';
                              
                              setForm(prev => ({
                                ...prev,
                                name: selectedOption.name || "",
                                email: selectedOption.email || "",
                                phone: selectedOption.phone || prev.phone,
                                address: prev.address, // Keep existing address
                                city: prev.city, // Keep existing city
                                state: prev.state, // Keep existing state
                                country: prev.country, // Keep existing country
                                company: prev.company, // Keep existing company
                                job_title: selectedOption.position || prev.job_title,
                                customer_type: "regular",
                                role: primaryRole
                              }));
                            } else {
                              // Handle existing customer selection
                              setForm(prev => ({
                                ...prev,
                                name: selectedOption.name || "",
                                email: selectedOption.email || "",
                                phone: selectedOption.phone || prev.phone,
                                address: selectedOption.address || prev.address,
                                city: selectedOption.city || prev.city,
                                state: selectedOption.state || prev.state,
                                country: selectedOption.country || prev.country,
                                company: selectedOption.company || prev.company,
                                job_title: selectedOption.job_title || prev.job_title,
                                customer_type: selectedOption.customer_type || prev.customer_type,
                                role: selectedOption.role || selectedOption.customer_type || prev.role
                              }));
                            }
                          } else {
                            setForm(prev => ({
                              ...prev,
                              name: "",
                              email: "",
                              phone: "",
                              address: "",
                              city: "",
                              state: "",
                              country: "",
                              company: "",
                              job_title: "",
                              customer_type: "regular",
                              role: ""
                            }));
                          }
                        }}
                        options={getCombinedUniqueOptions()}
                        isClearable
                        isSearchable
                        placeholder={form.role ? `Search users with '${form.role}' role or existing customers...` : "Search existing customers/users or type new name..."}
                        className="text-sm"
                        styles={{
                          control: (provided) => ({
                            ...provided,
                            minHeight: '48px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            '&:hover': {
                              border: '1px solid #9ca3af'
                            },
                            '&:focus-within': {
                              border: '2px solid #3b82f6',
                              boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.1)'
                            }
                          })
                        }}
                        formatCreateLabel={(inputValue) => `Create new customer: "${inputValue}"`}
                        noOptionsMessage={() => "No customers/users found - type to create new"}
                      />
                      {selectedCustomer && !selectedCustomer.__isNew__ && !selectedCustomer.__isUser__ && (
                        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                          <i className="fas fa-check text-green-500"></i>
                          Existing customer selected - details auto-filled
                        </p>
                      )}
                      {selectedCustomer && selectedCustomer.__isUser__ && (
                        <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                          <i className="fas fa-user text-blue-500"></i>
                          User with customer role selected - creating customer profile
                        </p>
                      )}
                      {selectedCustomer && selectedCustomer.__isNew__ && (
                        <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                          <i className="fas fa-plus text-blue-500"></i>
                          Creating new customer - fill in the details below
                        </p>
                      )}
                      {!selectedCustomer && (
                        <p className="text-xs text-gray-500 mt-2">Search for existing customers, users with customer roles, or type a new name</p>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="email" 
                    name="email" 
                    required 
                    value={form.email} 
                    onChange={handleChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    placeholder="Email Address"
                    disabled={!editMode && !!(selectedCustomer && (!selectedCustomer.__isNew__ || selectedCustomer.__isUser__))}
                  />
                  {selectedCustomer && !selectedCustomer.__isNew__ && !selectedCustomer.__isUser__ && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <i className="fas fa-check text-green-500"></i>
                      Auto-filled from selected customer
                    </p>
                  )}
                  {selectedCustomer && selectedCustomer.__isUser__ && (
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      <i className="fas fa-user text-blue-500"></i>
                      Auto-filled from selected user
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password {!editMode && <span className="text-red-500">*</span>}
                    {editMode && <span className="text-gray-500 text-xs ml-1">(leave blank to keep current)</span>}
                  </label>
                  <input 
                    type="password" 
                    name="password" 
                    required={!editMode}
                    value={form.password} 
                    onChange={handleChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    placeholder={editMode ? "Enter new password (optional)" : "Password"}
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="tel" 
                    name="phone" 
                    required 
                    value={form.phone} 
                    onChange={handleChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    placeholder="Phone Number" 
                  />
                </div>
              </div>
            </div>

            {/* Address Information Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-map-marker-alt text-green-600"></i>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Address Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    name="address" 
                    required 
                    value={form.address} 
                    onChange={handleChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    placeholder="Street Address" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input 
                    type="text" 
                    name="city" 
                    value={form.city} 
                    onChange={handleChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    placeholder="City" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input 
                    type="text" 
                    name="state" 
                    value={form.state} 
                    onChange={handleChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    placeholder="State" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <input 
                    type="text" 
                    name="country" 
                    value={form.country} 
                    onChange={handleChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    placeholder="Country" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer Type</label>
                  <select 
                    name="customer_type" 
                    value={form.customer_type} 
                    onChange={handleChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="regular">Regular</option>
                    <option value="vip">VIP</option>
                    <option value="premium">Premium</option>
                  </select>
                  {selectedCustomer && !selectedCustomer.__isNew__ && !selectedCustomer.__isUser__ && (
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      <i className="fas fa-lightbulb text-blue-500"></i>
                      Auto-filled from selected customer - you can change it
                    </p>
                  )}
                  {selectedCustomer && selectedCustomer.__isUser__ && (
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      <i className="fas fa-lightbulb text-blue-500"></i>
                      Default set to Regular - you can change it
                    </p>
                  )}
                  {!selectedCustomer && (
                    <p className="text-xs text-gray-500 mt-1">Select customer type (Regular, VIP, or Premium)</p>
                  )}
                </div>
              </div>
            </div>

            {/* Professional Information Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-briefcase text-orange-600"></i>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Professional Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                  <input 
                    type="text" 
                    name="company" 
                    value={form.company} 
                    onChange={handleChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    placeholder="Company Name" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                  <input 
                    type="text" 
                    name="job_title" 
                    value={form.job_title} 
                    onChange={handleChange} 
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                    placeholder="Job Title" 
                  />
                </div>
              </div>
            </div>

            {/* Profile Picture Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                  <i className="fas fa-camera text-indigo-600"></i>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Profile Picture</h3>
              </div>
              
              <div className="flex items-start space-x-6">
                <div className="flex-grow">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                    <label className="cursor-pointer flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                        <i className="fas fa-upload text-gray-500 text-xl"></i>
                      </div>
                      <span className="text-sm text-gray-600 font-medium">Click to upload or drag and drop</span>
                      <span className="text-xs text-gray-500 mt-1">SVG, PNG, JPG or GIF (max. 5MB)</span>
                      <input type="file" name="profile_picture" onChange={handleChange} accept="image/*" className="hidden" />
                    </label>
                  </div>
                </div>
                {form.profilePicturePreview && (
                  <div className="flex-shrink-0">
                    <div className="relative">
                      <img src={form.profilePicturePreview} alt="Profile preview" className="w-20 h-20 rounded-full object-cover border-4 border-blue-200 shadow-lg" />
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <i className="fas fa-check text-white text-xs"></i>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <i className="fas fa-exclamation-triangle text-red-600"></i>
                  </div>
                  <div>
                    <h4 className="text-red-800 font-medium">Error</h4>
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-200 flex gap-3 justify-end">
          <button 
            type="button" 
            className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors" 
            onClick={onClose} 
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="customer-form"
            className="px-6 py-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <i className="fas fa-spinner fa-spin"></i>
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <i className={`fas ${editMode ? 'fa-save' : 'fa-plus'}`}></i>
                {editMode ? 'Update Customer' : 'Add Customer'}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Order Management Modal ---
const OrderModal = ({ open, onClose, customer, onOrderSuccess }) => {
  const [orderForm, setOrderForm] = useState({
    product_id: "",
    item_name: "",
    quantity: 1,
    price: "",
    total_amount: "",
    order_date: new Date().toISOString().split('T')[0],
    status: "pending",
    notes: ""
  });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  

  // Load products list when modal opens
  useEffect(() => {
    if (open) {
      setOrderForm({
        product_id: "",
        item_name: "",
        quantity: 1,
        price: "",
        total_amount: "",
        order_date: new Date().toISOString().split('T')[0],
        status: "pending",
        notes: ""
      });
      setError("");
      
      const token = localStorage.getItem('access_token');
      fetch(`${API_URL}/api/stock/products`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => setProducts(data))
        .catch(() => setProducts([]));
    }
  }, [open]);

  // Handle changes on input/select fields
  const handleOrderChange = (e) => {
    const { name, value } = e.target;
    setOrderForm(prev => {
      let updated = { ...prev, [name]: value };

      if (name === "product_id") {
        // Find selected product in products list
        const selectedProduct = products.find(p => p.product_id === value);
        console.log("Selected product:", selectedProduct);
        if (selectedProduct) {
          updated.item_name = selectedProduct.name || "";
          updated.price = selectedProduct.price ? selectedProduct.price.toString() : "";
          const qty = parseFloat(prev.quantity) || 1;
          updated.total_amount = (qty * (selectedProduct.price || 0)).toFixed(2);
        } else {
          // Reset if no product selected
          updated.item_name = "";
          updated.price = "";
          updated.total_amount = "";
        }
      } else if (name === "quantity") {
        // Update total_amount based on new quantity and current price
        const qty = parseFloat(value) || 0;
        const price = parseFloat(prev.price) || 0;
        updated.total_amount = (qty * price).toFixed(2);
      }

      return updated;
    });
    setError("");
  };

  // Submission code unchanged
  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    const customerId = customer?.id;
    if (!customerId) {
      setError("Customer ID is missing.");
      return;
    }
    const quantity = parseFloat(orderForm.quantity);
    const price = parseFloat(orderForm.price);
    const total_amount = (quantity * price).toFixed(2);

    const orderData = {
      ...orderForm,
      quantity,
      price,
      total_amount,
      customer_id: customerId,
      customer_name: customer.name,
      customer_city: customer.city,
      customer_email: customer.email || customer.mailid || customer.email_id,
      order_id: `ORD-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    setLoading(true);
    setSuccessMessage("");
    try {
      const token = localStorage.getItem('access_token'); 
      const res = await fetch(`${API_URL}/api/customers/${customerId}/orders`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(orderData)
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        console.error("Order failed:", result);
        // Check if backend sent 'Insufficient stock' error
        if (result.detail === "Insufficient stock" || result.message === "Insufficient stock") {
          throw new Error("Stock not available for the selected product.");
        }
        throw new Error(result.message || "Failed to add order");
      }

      setSuccessMessage("Order added successfully!");
      setError("");

      if (onOrderSuccess) await onOrderSuccess();
      onClose();
    } catch (error) {
      console.error("Error adding order:", error.message);
      setError(error.message || "Failed to add order. Please check the form and try again.");
      setSuccessMessage("");
    } finally {
      setLoading(false);
    }
  };

  if (!open || !customer) return null;

  return (
    open && customer && (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg w-ful max-w-md p-6 relative">
          <button
            className="absolute top-3 right-3 text-gray-400 hover:text-red-500"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="fas fa-times"></i>
          </button>
          <h2 className="text-xl font-semibold mb-4">Add Order for {customer.name}</h2>

          {successMessage && (
            <div className="mb-3 text-green-700 bg-green-100 border border-green-300 rounded p-2">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleOrderSubmit} className="space-y-4">
            {/* Product selection dropdown */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Item Name <span className="text-red-500">*</span>
              </label>
              <select
                name="product_id"
                value={orderForm.product_id}
                onChange={handleOrderChange}
                required
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select a product</option>
                {products.map(product => (
                  <option key={product.product_id} value={product.product_id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity & Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  name="quantity"
                  min="1"
                  value={orderForm.quantity}
                  onChange={handleOrderChange}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Unit Price</label>
                <div className="w-full border rounded px-3 py-2 text-sm bg-gray-50">
                  {orderForm.price ? `₹${orderForm.price}` : "0"}
                </div>
              </div>
            </div>

            {/* Total Amount */}
            <div>
              <label className="block text-sm font-medium mb-1">Total Amount</label>
              <div className="w-full border rounded px-3 py-2 text-sm bg-gray-50">
                  {`₹ ${orderForm.total_amount}`}
              </div>
            </div>
            {/* Order Date ReadOnly */}
            <div>
              <label className="block text-sm font-medium mb-1">Order Date</label>
              <div className="w-full border rounded px-3 py-2 text-sm bg-gray-50">
                  {orderForm.order_date}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                name="status"
                value={orderForm.status}
                onChange={handleOrderChange}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                name="notes"
                value={orderForm.notes}
                onChange={handleOrderChange}
                className="w-full border rounded px-3 py-2 text-sm"
                rows="3"
                placeholder="Additional notes..."
              />
            </div>

            {/* Error display */}
            {error && <div className="text-red-600 text-sm">{error}</div>}

            {/* Buttons */}
            <div className="pt-2 flex gap-2 justify-end">
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-800 font-semibold"
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Order'}
              </button>
              <button
                type="button"
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  );
};

const CustomerDetailCard = ({ customer, onClose }) => {
  const [commLogs, setCommLogs] = useState([]);
  const [imgError, setImgError] = useState(false);
  const [commLoading, setCommLoading] = useState(false);
  const [commError, setCommError] = useState("");
  const [commForm, setCommForm] = useState({ channel: "Email", message: "", by: "User" });
  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const filteredCommLogs = commLogs.filter(
    log => !(log.content === "No communication log found. This is a default entry." && log.agent_id === "User")
  );

  useEffect(() => {
    if (customer && customer.id) {
       const token = localStorage.getItem('access_token');
      setCommLoading(true);
      fetch(`${API_URL}/api/customers/${customer.id}/communication`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => setCommLogs(Array.isArray(data) ? data : []))
        .catch(() => setCommLogs([]))
        .finally(() => setCommLoading(false));

      // Fetch feedbacks
      setFeedbackLoading(true);
      fetch(`${API_URL}/api/customers/${customer.id}/feedback`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          // Filter out feedbacks with no comment/content/rating (default/empty)
          const filtered = (Array.isArray(data) ? data : []).filter(fb => {
            const hasText = (fb.comment && fb.comment.trim() !== "") || (fb.content && fb.content.trim() !== "");
            const hasRating = typeof fb.rating === "number" && fb.rating > 0;
            return hasText || hasRating;
          });
          setFeedbacks(filtered);
        })
        .catch(() => setFeedbacks([]))
        .finally(() => setFeedbackLoading(false));
    }
  }, [customer]);

  const handleCommFormChange = e => {
    const { name, value } = e.target;
    setCommForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCommFormSubmit = async e => {
    e.preventDefault();
    setCommError("");
    if (!commForm.channel || !commForm.message) {
      setCommError("Channel and message are required.");
      return;
    }

    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${API_URL}/api/customers/${customer.id}/communication`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        'Authorization': `Bearer ${token}`,
        body: JSON.stringify({
          channel: commForm.channel,
          message: commForm.message,
          by: commForm.by,
          time: new Date().toISOString()
        })
      });
      if (!res.ok) throw new Error("Failed to add communication log");
      setCommForm({ channel: "Email", message: "", by: "User" });
      // Refresh logs with authentication header
    const logsRes = await fetch(`${API_URL}/api/customers/${customer.id}/communication`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const logs = await logsRes.json();
    setCommLogs(Array.isArray(logs) ? logs : []);
  } catch (err) {
    setCommError("Failed to add communication log");
  }
};

  if (!customer) return null;
  const API_BASE = API_URL.replace('/api', '');
  let imageUrl = "";
  if (typeof customer.profile_picture === "string" && customer.profile_picture) {
    if (customer.profile_picture.startsWith("http")) {
      imageUrl = customer.profile_picture;
    } else if (customer.profile_picture.startsWith("/")) {
      imageUrl = API_BASE + customer.profile_picture;
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-[800px] h-[600px] p-10 relative border border-blue-100 flex flex-col overflow-hidden">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-2xl"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="flex items-center gap-8 mb-8">
          {imageUrl && !imgError ? (
            <img
              src={imageUrl}
              alt={customer.name}
              className="w-20 h-20 rounded-full object-cover border-4 border-blue-200 shadow"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-3xl shadow">
              {(customer.name?.[0] || "").toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">{customer.name}</h2>
            <div className="text-xs text-gray-500 mb-1">Customer ID: <span className="font-mono">{customer.id || customer._id}</span></div>
            <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-semibold ${customer.customer_type === "vip" ? "bg-purple-100 text-purple-700" :
              customer.customer_type === "premium" ? "bg-yellow-100 text-yellow-700" :
                "bg-gray-100 text-gray-700"
              }`}>
              {(customer.customer_type || "Regular").toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center mb-4">
          <div className="w-full max-w-xl bg-white rounded-xl shadow-lg p-8 border border-gray-100 flex flex-col gap-4 text-gray-800 text-base">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Mail size={16} />
                <a
                  href={`mailto:${customer.email}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-600"
                >
                  {customer.email}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={16} /> {customer.phone}
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={16} />
                <span>
                  {customer.address}
                  {customer.city && `, ${customer.city}`}
                  {customer.state && `, ${customer.state}`}
                  {customer.country && `, ${customer.country}`}
                </span>
              </div>
              {customer.company && (
                <div className="flex items-center gap-2">
                  <i className="fas fa-building"></i> Company: {customer.company}
                  {customer.job_title && ` (${customer.job_title})`}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar size={16} /> Joined: {
                  (customer.created_at || customer.joined_on) ?
                    (new Date(customer.created_at || customer.joined_on)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) :
                    "-"
                }
              </div>
              <div className="flex items-center gap-2">
                <Gift size={16} /> Loyalty Points: {customer.loyalty_points || customer.loyaltyPoints || 0}
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp size={16} /> Revenue: ₹{(customer.revenue || customer.lifetime_value || 0).toLocaleString()}
              </div>
              <div className="flex items-center gap-2">
                <Star size={16} />
                Status: <span className={`ml-1 font-medium ${customer.status === "active" ? "text-green-600" : "text-red-600"}`}>
                  {(customer.status || "Active").toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                Orders: {customer.orders || 0}
              </div>
              <div className="flex items-center gap-2">
                Last Purchase: {customer.lastPurchase ? (new Date(customer.lastPurchase)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-"}
              </div>
              {customer.tags && customer.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {customer.tags.map((tag, index) => (
                    <span key={index} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {/* Feedback Section */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Feedback</h3>
              {feedbackLoading ? (
                <div className="text-gray-400">Loading feedback...</div>
              ) : (() => {
                // Filter out feedbacks with no comment/content/rating
                const visibleFeedbacks = feedbacks.filter(fb => {
                  const hasText = (fb.comment && fb.comment.trim() !== "") || (fb.content && fb.content.trim() !== "");
                  const hasRating = typeof fb.rating === "number" && fb.rating > 0;
                  return hasText || hasRating;
                });
                if (visibleFeedbacks.length === 0) {
                  return <div className="text-gray-400">No feedback found.</div>;
                }
                return (
                  <div className="space-y-3">
                    {visibleFeedbacks.map((fb, idx) => (
                      <div key={idx} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-blue-700">Rating:</span>
                          <span className="text-yellow-600 font-bold">{fb.rating || '-'}</span>
                          <span className="ml-4 text-xs text-gray-500">{fb.date ? new Date(fb.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ''}</span>
                        </div>
                        <div className="text-gray-800">{fb.comment || fb.content || '-'}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
        <div className="pt-2 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 shadow"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const CustomerProfile = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerTypeFilter, setCustomerTypeFilter] = useState("all");
  const [orderModal, setOrderModal] = useState(false);
  const [selectedCustomerForOrder, setSelectedCustomerForOrder] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [stockLogs, setStockLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const successMessage = (msg) => {
    alert(msg);
  };

  // Pagination state
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  // API BASE
  const API = `${API_URL}/api/customers/`;

  useEffect(() => {
    fetchCustomers();
    fetchStockLogs();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
    const res = await fetch(API, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
      if (!res.ok) throw new Error("Failed to fetch customers");
      const data = await res.json();
      const API_BASE = API_URL.replace('/api', '');
      const processedData = Array.isArray(data)
        ? data.map((customer) => {
            let avatar_url = customer.profile_picture || customer.avatar_url;
            if (avatar_url && avatar_url.startsWith("/")) {
              avatar_url = API_BASE + avatar_url;
            }
            return {
              ...customer,
              id: customer.id,
              name: customer.name,
              location: customer.location,
              avatar_url,
              loyaltyPoints: customer.loyalty_points || 0,
              revenue: customer.lifetime_value || 0,
              isVip: customer.customer_type === "vip" || customer.customer_type === "premium",
              orders: customer.orders || 0,
              status: customer.status || "active",
            };
          })
        : [];
      setCustomers(processedData);
    } catch (error) {
      console.error("Error fetching customers:", error);
      setCustomers([]);
    }
    setLoading(false);
  };

  const fetchStockLogs = async () => {
    setLogsLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/api/stock/logs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to fetch stock logs");
      const data = await res.json();
      setStockLogs(data.logs || []);
    } catch (error) {
      console.error("Error fetching stock logs:", error);
      setStockLogs([]);
    }
    setLogsLoading(false);
  };

  const handleOrderSuccess = async () => {
    await fetchCustomers();
    await fetchStockLogs();
    successMessage("Order added successfully!");
    setOrderModal(false);
  };

  const openOrderModal = (customer) => {
    setSelectedCustomerForOrder(customer);
    setOrderModal(true);
  };

  const closeOrderModal = () => {
    setOrderModal(false);
    setSelectedCustomerForOrder(null);
  };

  const handleAddCustomer = async (customer) => {
    setAdding(true);
    try {
      const token = localStorage.getItem('access_token');
      const formData = new FormData();
      Object.entries(customer).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (key === "profile_picture") return;
        if (typeof value === "object" && !(value instanceof File)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value.toString());
        }
      });
      if (customer.profile_picture instanceof File) {
        formData.append("profile_picture", customer.profile_picture);
      }
      for (const [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
      }
      const res = await fetch(`${API_URL}/api/customers/`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 409) {
          setAdding(false);
          return { error: "A customer with this name and email already exists." };
        }
        const errorData = await res.json();
        let errorMsg = "Failed to add customer";
        if (Array.isArray(errorData)) {
          errorMsg = errorData.map((e) => e.msg).join(", ");
        } else if (errorData.detail) {
          errorMsg = errorData.detail;
        }
        setAdding(false);
        return { error: errorMsg };
      }
      await fetchCustomers();
      setAddModal(false);
      setAdding(false);
      return {};
    } catch (error) {
      console.error("Error adding customer:", error);
      setAdding(false);
      return { error: "Failed to add customer" };
    }
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setEditModal(true);
  };

  const handleEditCustomer = async (customer) => {
    setAdding(true);
    try {
      const token = localStorage.getItem('access_token');
      
      // Build JSON payload for update (without profile picture for now)
      const updateData = {
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        city: customer.city || '',
        state: customer.state || '',
        country: customer.country || '',
        company: customer.company || '',
        job_title: customer.job_title || '',
        customer_type: customer.customer_type || 'regular'
      };
      
      // Only include password if it's provided (not empty)
      if (customer.password && customer.password.trim() !== '') {
        updateData.password = customer.password;
      }
      
      // Only include preferences if they exist and are not empty
      if (customer.preferences && typeof customer.preferences === 'object' && Object.keys(customer.preferences).length > 0) {
        updateData.preferences = customer.preferences;
      }
      
      // Only include tags if they exist and are not empty
      if (customer.tags && customer.tags.length > 0) {
        updateData.tags = Array.isArray(customer.tags) ? customer.tags : customer.tags.split(',');
      }
      
      const res = await fetch(`${API_URL}/api/customers/${editingCustomer.id}`, {
        method: "PUT",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData),
      });

      // If backend returns error but customer was updated, still refresh
      // This handles the case where update succeeds but response is 500
      if (!res.ok && res.status === 500) {
        console.warn("Backend returned 500 but update may have succeeded, refreshing...");
        await fetchCustomers();
        setEditModal(false);
        setEditingCustomer(null);
        setAdding(false);
        successMessage("Customer updated successfully!");
        return {};
      }
      
      if (!res.ok) {
        let errorMsg = "Failed to update customer";
        try {
          const errorData = await res.json();
          if (Array.isArray(errorData)) {
            errorMsg = errorData.map((e) => e.msg).join(", ");
          } else if (errorData.detail) {
            errorMsg = errorData.detail;
          }
        } catch (e) {
          // If can't parse error response, use default message
          console.error("Could not parse error response:", e);
        }
        setAdding(false);
        return { error: errorMsg };
      }
      
      await fetchCustomers();
      setEditModal(false);
      setEditingCustomer(null);
      setAdding(false);
      successMessage("Customer updated successfully!");
      return {};
    } catch (error) {
      console.error("Error updating customer:", error);
      // Even if there's an error, try to refresh to see if update actually worked
      await fetchCustomers();
      setEditModal(false);
      setEditingCustomer(null);
      setAdding(false);
      successMessage("Customer updated - please verify the changes");
      return {};
    }
  };

  const handleDeleteCustomer = async (customerId) => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/api/customers/${customerId}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.detail || "Failed to delete customer");
        return;
      }
      await fetchCustomers();
      setDeleteConfirm(null);
      successMessage("Customer deleted successfully!");
    } catch (error) {
      console.error("Error deleting customer:", error);
      alert("Failed to delete customer");
    }
  };

  // Filter customers based on search query and customer type
  let filteredCustomers = customers.filter(
    (customer) => {
      // Search filter
      const matchesSearch =
        (customer.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (customer.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (customer.phone || "").includes(searchQuery) ||
        (customer.customer_type || "").toLowerCase().includes(searchQuery.toLowerCase());

      // Customer type filter
      const matchesCustomerType =
        customerTypeFilter === "all" ||
        (customer.customer_type || "individual").toLowerCase() === customerTypeFilter.toLowerCase();

      return matchesSearch && matchesCustomerType;
    }
  );

  // Sort by customer id ascending (string or number)
  filteredCustomers = filteredCustomers.slice().sort((a, b) => {
    const idA = (a.id || a._id || "").toString();
    const idB = (b.id || b._id || "").toString();
    // If both are numbers, compare numerically
    if (!isNaN(Number(idA)) && !isNaN(Number(idB))) {
      return Number(idA) - Number(idB);
    }
    // Otherwise, compare as strings
    return idA.localeCompare(idB);
  });

  // Pagination logic for filtered customers
  const totalRows = filteredCustomers.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const paginatedCustomers = filteredCustomers.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const totalCustomers = customers.length;
  const vipCustomers = customers.filter((c) => c.customer_type === "vip").length;
  const premiumCustomers = customers.filter((c) => c.customer_type === "premium").length;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.revenue || 0), 0);
  const avgLoyaltyPoints = totalCustomers
    ? Math.round(
      customers.reduce((sum, c) => sum + (c.loyaltyPoints || 0), 0) / totalCustomers
    )
    : 0;

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
      if (selectedCustomer) {
        const token = localStorage.getItem('access_token');
        fetch(`${API_URL}/api/customers/${selectedCustomer.id}/orders`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
          .then(res => res.json())
          .then(data => setCustomerOrders(data))
          .catch(err => console.error('Error fetching orders', err));
      } else {
        setCustomerOrders([]);
      }
    }, [selectedCustomer]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
  }, [totalPages, page]);

  return (
    <div className="p-4 max-w-8xl mx-auto">
      {/* Add Customer Modal */}
      <AddCustomerModal
        open={addModal}
        onClose={() => setAddModal(false)}
        onAdd={handleAddCustomer}
        loading={adding}
        customers={customers}
      />

      {/* Order Modal */}
      <OrderModal
        open={orderModal}
        onClose={closeOrderModal}
        customer={selectedCustomerForOrder}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Customer Details Card Modal */}
      <CustomerDetailCard
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
      />

      {/* Page Heading with Breadcrumb */}
      <div className="mb-6">
        <div className="text-sm text-gray-500 mb-2">
          <span className="hover:text-blue-600 cursor-pointer">Dashboard</span>
          <span className="mx-2">/</span>
          <span className="text-blue-600">Customer Management</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Customer Management
          </h1>
          <div className="mt-3 sm:mt-0">
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center"
              onClick={() => setAddModal(true)}
            >
              <User2 size={16} className="mr-2" /> Add New Customer
            </button>
          </div>
        </div>
        <p className="mt-2 text-gray-500">
          Manage and nurture your valuable customer relationships
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
          <div className="flex justify-between items-center">
            <div className="bg-blue-100 p-2.5 rounded-lg">
              <User2 className="text-blue-600 w-6 h-6" />
            </div>
            <span className="text-green-500 text-sm font-medium flex items-center">
              <ChevronUp size={16} className="mr-1" /> 15%
            </span>
          </div>
          <p className="text-3xl font-bold mt-3 mb-1">{totalCustomers}</p>
          <p className="text-gray-600 text-sm">Total Customers</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
          <div className="flex justify-between items-center">
            <div className="bg-purple-100 p-2.5 rounded-lg">
              <Star className="text-purple-600 w-6 h-6" />
            </div>
            <span className="text-purple-600 text-sm font-medium bg-purple-50 py-1 px-2 rounded-full">VIP</span>
          </div>
          <p className="text-3xl font-bold mt-3 mb-1">{vipCustomers}</p>
          <p className="text-gray-600 text-sm">VIP Customers</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
          <div className="flex justify-between items-center">
            <div className="bg-yellow-100 p-2.5 rounded-lg">
              <Star className="text-yellow-600 w-6 h-6" />
            </div>
            <span className="text-yellow-600 text-sm font-medium bg-yellow-50 py-1 px-2 rounded-full">Premium</span>
          </div>
          <p className="text-3xl font-bold mt-3 mb-1">{premiumCustomers}</p>
          <p className="text-gray-600 text-sm">Premium Customers</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
          <div className="flex justify-between items-center">
            <div className="bg-green-100 p-2.5 rounded-lg">
              <TrendingUp className="text-green-600 w-6 h-6" />
            </div>
            <span className="text-green-600 text-sm font-medium">Revenue</span>
          </div>
          <p className="text-3xl font-bold mt-3 mb-1">₹{totalRevenue.toLocaleString()}</p>
          <p className="text-gray-600 text-sm">Total Revenue</p>
        </div>
      </div>

      {/* Customer List Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Customer Details</h2>
          <div className="mt-3 sm:mt-0 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search customers..."
                className="w-full sm:w-64 pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search size={18} className="text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
            <div className="w-full sm:w-48">
              <select
                value={customerTypeFilter}
                onChange={(e) => setCustomerTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="all">All Customer Types</option>
                <option value="individual">Individual</option>
                <option value="regular">Regular</option>
                <option value="vip">VIP</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>
        </div>

        {/* Customer List Table (always visible, no hide/show button) */}
        <div className="p-4 transition-all duration-300">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading customers...</div>
          ) : paginatedCustomers.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-5xl mb-4">
                <User2 className="mx-auto" />
              </div>
              <h3 className="text-xl font-medium text-gray-700">No customers found</h3>
              <p className="text-gray-500 mt-1">Try adjusting your search query</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Id</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedCustomers.map((customer, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link 
                          to={`/order-summary/${customer.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          {(customer.id || customer._id || "-").toLocaleString()}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(customer.name || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${customer.customer_type === "vip" ? "bg-purple-100 text-purple-700" :
                          customer.customer_type === "premium" ? "bg-yellow-100 text-yellow-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                          {(customer.customer_type || "Individual").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${(customer.status || "active").toLowerCase() === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                          }`}>
                          {customer.status || "Active"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{(customer.revenue || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.orders_count || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(customer.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal(customer)}
                            title={`Edit ${customer.name}`}
                            className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(customer)}
                            title={`Delete ${customer.name}`}
                            className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                          <a
                            href={`mailto:${customer.email}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Email ${customer.name}`}
                            className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                          >
                            <Mail size={16} />
                          </a>
                          <a
                            href={`tel:${customer.phone}`}
                            className="p-1.5 text-green-500 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"
                            title={`Call ${customer.name}`}
                          >
                            <Phone size={16} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="mt-5 flex justify-between items-center border-t pt-4">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{paginatedCustomers.length}</span> of <span className="font-medium">{totalRows}</span> customers (Page {page} of {totalPages || 1})
            </p>
            <div className="flex items-center">
              <button
                className="px-3 py-1 border rounded-l-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </button>
              <span className="px-3 py-1 border-t border-b bg-blue-50 text-blue-600 font-medium">{page}</span>
              <button
                className="px-3 py-1 border rounded-r-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages || totalPages === 0}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Customer Modal */}
      {editModal && editingCustomer && (
        <AddCustomerModal
          open={editModal}
          onClose={() => {
            setEditModal(false);
            setEditingCustomer(null);
          }}
          onAdd={handleEditCustomer}
          loading={adding}
          customers={customers}
          editMode={true}
          existingCustomer={editingCustomer}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="text-red-600 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Delete Customer</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-semibold">{deleteConfirm.name}</span>? 
              All associated data will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCustomer(deleteConfirm.id)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerProfile;
