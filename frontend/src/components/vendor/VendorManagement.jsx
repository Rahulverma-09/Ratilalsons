import React, { useState, useEffect } from "react";
import { User2, Star, TrendingUp, ChevronUp, Mail, Phone, MapPin, Calendar, Search, Edit, Trash2, Plus, ShoppingCart, FileText, X, Eye, Printer, Download } from "lucide-react";
import CreatableSelect from 'react-select/creatable';
import { API_URL } from '../../config';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Comprehensive Vendor Registration Modal for Admin
const AddVendorModal = ({ open, onClose, onAdd, loading, vendors, editMode = false, existingVendor = null }) => {
  const [form, setForm] = useState({
    // Basic Information
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "",
    zip: "",

    // Company Information
    company: "",
    gstNumber: "",
    taxId: "",
    contact_person: "",
    contact_designation: "",

    // Files
    profile_picture: null,
    profilePicturePreview: null,
    businessLicenseFile: null,

    // Vendor Settings
    vendor_type: "regular", // regular, preferred, strategic
    status: "active",
    tags: [],
    preferences: {},
    role: ""
  });

  const [error, setError] = useState("");
  const [roles, setRoles] = useState([]);
  const [vendors_list, setVendorsList] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorUsers, setVendorUsers] = useState([]); // Users with vendor roles

  useEffect(() => {
    if (open) {
      fetchVendorsForSelection();
      if (editMode && existingVendor) {
        setForm({
          name: existingVendor.name || "",
          email: existingVendor.email || "",
          phone: existingVendor.phone || "",
          address: existingVendor.address || "",
          city: existingVendor.city || "",
          state: existingVendor.state || "",
          country: existingVendor.country || "",
          zip: existingVendor.zip || "",
          company: existingVendor.company || "",
          gstNumber: existingVendor.registration_number || existingVendor.gstNumber || "",
          taxId: existingVendor.taxId || "",
          contact_person: existingVendor.contact_person || "",
          contact_designation: existingVendor.contact_designation || "",
          profile_picture: null,
          profilePicturePreview: existingVendor.avatar_url || null,
          businessLicenseFile: null,
          vendor_type: existingVendor.vendor_type || "regular",
          status: existingVendor.status || "active",
          tags: existingVendor.tags || [],
          preferences: existingVendor.preferences || {},
          role: ""
        });
        setSelectedVendor(null);
      } else {
        setForm({
          name: "",
          email: "",
          phone: "",
          address: "",
          city: "",
          state: "",
          country: "",
          zip: "",
          company: "",
          gstNumber: "",
          taxId: "",
          contact_person: "",
          contact_designation: "",
          profile_picture: null,
          profilePicturePreview: null,
          businessLicenseFile: null,
          vendor_type: "regular",
          status: "active",
          tags: [],
          preferences: {},
          role: ""
        });
        setSelectedVendor(null);
      }
      setError("");
    }
  }, [open, editMode, existingVendor]);

  const fetchVendorsForSelection = async () => {
    try {
      const token = localStorage.getItem('access_token');
      console.log('Token from localStorage:', token ? 'Token exists' : 'No token found');

      if (!token) {
        console.error('No authentication token found');
        return;
      }

      console.log('Using token for requests: Token available');

      // Fetch roles (same endpoint as customer management)
      const rolesResponse = await fetch(`${API_URL}/roles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Roles response status:', rolesResponse.status);

      if (rolesResponse.ok) {
        const rolesData = await rolesResponse.json();
        console.log('Roles fetched:', rolesData);
        setRoles(rolesData);

        // Find vendor roles - check for both lowercase and proper case
        const vendorRoles = rolesData.filter(role =>
          role.name && (
            role.name.toLowerCase().includes('vendor') ||
            role.name.toLowerCase() === 'vendor'
          )
        );
        console.log('Vendor roles found:', vendorRoles);

        // Fetch all users (same endpoint as customer management)
        const usersResponse = await fetch(`${API_URL}/users/`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('Users response status:', usersResponse.status);

        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          console.log('All users fetched:', usersData);

          // Filter users with vendor roles - check multiple possible role structures
          let usersWithVendorRoles = [];

          if (vendorRoles.length > 0) {
            const vendorRoleIds = vendorRoles.map(role => role.id);
            const vendorRoleNames = vendorRoles.map(role => role.name.toLowerCase());

            usersWithVendorRoles = usersData.filter(user => {
              // Check role_ids array
              if (user.role_ids && user.role_ids.some(roleId => vendorRoleIds.includes(roleId))) {
                return true;
              }

              // Check role name directly (for direct role assignment)
              if (user.role && vendorRoleNames.includes(user.role.toLowerCase())) {
                return true;
              }

              // Check roles array if it exists
              if (user.roles && Array.isArray(user.roles)) {
                return user.roles.some(role =>
                  vendorRoleNames.includes((typeof role === 'string' ? role : role.name || '').toLowerCase())
                );
              }

              return false;
            });
          } else {
            // Fallback: look for users with 'vendor' in their role field directly
            usersWithVendorRoles = usersData.filter(user =>
              (user.role && user.role.toLowerCase().includes('vendor')) ||
              (user.roles && Array.isArray(user.roles) &&
                user.roles.some(role =>
                  (typeof role === 'string' ? role : role.name || '').toLowerCase().includes('vendor')
                ))
            );
          }

          console.log('Users with vendor roles:', usersWithVendorRoles);
          setVendorUsers(usersWithVendorRoles);
        }
      }

      // Fetch existing vendors for selection (using the same endpoint as main vendor list)
      const vendorsResponse = await fetch(`${API_URL}/vendors/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Vendors response status:', vendorsResponse.status);

      if (vendorsResponse.ok) {
        const vendorsData = await vendorsResponse.json();
        console.log('Existing vendors fetched:', vendorsData);
        setVendorsList(vendorsData);
      }

    } catch (error) {
      console.error('Error fetching data for vendor selection:', error);
    }
  };

  // Vendor options for React Select (all vendors)
  const getVendorOptions = () => {
    return vendors_list.map(vendor => ({
      value: vendor.id || vendor.vendor_id,
      label: `${vendor.name} (${vendor.email || 'No email'})`,
      vendor: vendor,
      __isNew__: false,
      __isUser__: false
    }));
  };

  // Vendor users options for React Select (users with vendor roles)
  const getVendorUserOptions = () => {
    return vendorUsers.map(user => {
      // Find the vendor role name - handle different role structures
      let vendorRoleName = 'vendor';

      // Check role_ids array first
      if (user.role_ids && user.role_ids.length > 0) {
        const userVendorRole = roles.find(role =>
          user.role_ids.includes(role.id) &&
          role.name &&
          (role.name.toLowerCase().includes('vendor') || role.name.toLowerCase() === 'vendor')
        );
        if (userVendorRole) {
          vendorRoleName = userVendorRole.name;
        }
      }

      // Check direct role field
      if (user.role && user.role.toLowerCase().includes('vendor')) {
        vendorRoleName = user.role;
      }

      // Check roles array
      if (user.roles && Array.isArray(user.roles)) {
        const vendorRole = user.roles.find(role =>
          (typeof role === 'string' ? role : role.name || '').toLowerCase().includes('vendor')
        );
        if (vendorRole) {
          vendorRoleName = typeof vendorRole === 'string' ? vendorRole : vendorRole.name;
        }
      }

      return {
        value: user.id || user.user_id,
        label: `${user.name || user.username} (${user.email}) - ${vendorRoleName}`,
        user: user,
        __isNew__: false,
        __isUser__: true,
        role: vendorRoleName
      };
    });
  };

  // Combined and deduplicated options
  const getCombinedUniqueOptions = () => {
    const vendorOptions = getVendorOptions();
    const userOptions = getVendorUserOptions();

    // Combine and remove duplicates based on email
    const allOptions = [...vendorOptions, ...userOptions];
    const uniqueOptions = [];
    const seenEmails = new Set();

    allOptions.forEach(option => {
      const email = option.vendor?.email || option.user?.email;
      if (email && !seenEmails.has(email)) {
        seenEmails.add(email);
        uniqueOptions.push(option);
      } else if (!email) {
        // Add options without email (shouldn't happen but just in case)
        uniqueOptions.push(option);
      }
    });

    return uniqueOptions;
  };

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;

    if (type === "file") {
      if (name === "profile_picture") {
        if (files && files[0]) {
          const file = files[0];

          if (!file.type.match("image.*")) {
            setError("Please select an image file (JPEG, PNG, etc.)");
            return;
          }

          if (file.size > 5 * 1024 * 1024) {
            setError("File size should be less than 5MB");
            return;
          }

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
          setForm((prev) => ({
            ...prev,
            profile_picture: null,
            profilePicturePreview: null,
          }));
        }
      } else if (name === "businessLicenseFile") {
        if (files && files[0]) {
          const file = files[0];
          const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

          if (!allowedTypes.includes(file.type)) {
            setError("Please select a valid file (PDF, JPG, PNG)");
            return;
          }

          if (file.size > 10 * 1024 * 1024) {
            setError("Business license file size should be less than 10MB");
            return;
          }

          setForm((prev) => ({
            ...prev,
            businessLicenseFile: file,
          }));
        } else {
          setForm((prev) => ({
            ...prev,
            businessLicenseFile: null,
          }));
        }
      }
    } else {
      if (name === "gstNumber") {
        setForm((prev) => ({ ...prev, [name]: value.toUpperCase() }));
      } else {
        setForm((prev) => ({ ...prev, [name]: value }));
      }
    }

    setError("");
  };

  const validateCurrentGST = (gst) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/i.test(gst);
  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePhone = (phone) => /^\+?[0-9\s\-().]{7,25}$/.test(phone);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Basic validation
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.address.trim()) {
      setError("Please fill all required fields (Name, Email, Phone, Address).");
      return;
    }

    if (!form.company.trim()) {
      setError("Company name is required.");
      return;
    }

    if (!editMode && !form.gstNumber.trim()) {
      setError("GST Number is required for new vendors.");
      return;
    }

    if (form.gstNumber.trim() && !validateCurrentGST(form.gstNumber)) {
      setError("Please enter a valid 15-character GST Number.");
      return;
    }

    if (!form.contact_person.trim()) {
      setError("Contact person is required.");
      return;
    }

    // Email validation
    if (!validateEmail(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    // Phone validation
    if (!validatePhone(form.phone)) {
      setError("Please enter a valid phone number.");
      return;
    }

    // Business license is optional for new vendors

    // Check for duplicate email
    if (!editMode) {
      const formEmail = form.email.trim().toLowerCase();
      const duplicate = vendors.find((v) => (v.email || "").trim().toLowerCase() === formEmail);
      if (duplicate) {
        setError("A vendor with this email already exists.");
        return;
      }
    }

    // Create clean vendor data object similar to customer pattern
    const cleanVendorData = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      address: form.address,
      city: form.city || '',
      state: form.state || '',
      country: form.country || '',
      zip: form.zip || '',
      company: form.company,
      registration_number: form.gstNumber, // Sending as registration_number for backend compatibility
      tax_id: form.taxId || '',
      contact_person: form.contact_person,
      contact_designation: form.contact_designation || '',
      vendor_type: form.vendor_type,
      status: form.status,
      tags: Array.isArray(form.tags) ? form.tags.join(",") : form.tags,
      preferences: typeof form.preferences === "string" ? form.preferences : JSON.stringify(form.preferences || {}),
      profile_picture: form.profile_picture, // This will be the File object or null
      businessLicenseFile: form.businessLicenseFile // This will be the File object or null
    };

    try {
      const response = await onAdd(cleanVendorData);

      if (response && response.error) {
        setError(response.error);
        return;
      }

      // Success - close modal and parent will handle refresh
      onClose();
    } catch (err) {
      console.error("Network error:", err);
      setError("Something went wrong while adding/updating the vendor.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
      {loading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-700 font-medium">{editMode ? "Updating vendor..." : "Adding vendor..."}</p>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[100vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-green-600 via-green-700 to-emerald-600 px-8 py-6 relative">
          <button
            className="absolute top-4 right-4 text-white hover:text-red-300 text-2xl transition-colors w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <User2 className="text-white text-2xl" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">{editMode ? "Edit Vendor" : "Vendor Registration"}</h2>
              <p className="text-green-100 text-lg">{editMode ? "Update vendor profile details" : "Complete vendor registration with business details and documentation"}</p>
            </div>
          </div>
        </div>

        <div className="max-h-[calc(90vh-120px)] overflow-y-auto p-8">
          <form onSubmit={handleSubmit}>
            {/* Personal Information */}
            <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl border border-blue-200 shadow-lg p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <User2 className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Personal Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  {editMode ? (
                    <input
                      type="text"
                      name="company"
                      required
                      value={form.company}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Company Name"
                    />
                  ) : (
                    <>
                      <CreatableSelect
                        value={selectedVendor}
                        onChange={(selectedOption) => {
                          console.log('Selected vendor option:', selectedOption);
                          setSelectedVendor(selectedOption);

                          if (selectedOption) {
                            if (selectedOption.__isNew__) {
                              // New vendor - just set the company name
                              setForm(prev => ({
                                ...prev,
                                company: selectedOption.label,
                                name: '',
                                email: '',
                                phone: '',
                                address: '',
                                city: '',
                                state: '',
                                country: '',
                                zip: '',
                                contact_person: '',
                                contact_designation: '',
                                vendor_type: 'regular'
                              }));
                            } else if (selectedOption.__isUser__) {
                              // User with vendor role - auto-fill from user data
                              const user = selectedOption.user;
                              setForm(prev => ({
                                ...prev,
                                company: user.company || selectedOption.label.split(' (')[0],
                                name: user.name || user.username,
                                email: user.email,
                                phone: user.phone || '',
                                address: user.address || '',
                                city: user.city || '',
                                state: user.state || '',
                                country: user.country || '',
                                zip: user.zip || '',
                                contact_person: user.name || user.username,
                                contact_designation: user.job_title || '',
                                vendor_type: 'regular',
                                role: selectedOption.role
                              }));
                            } else {
                              // Existing vendor - auto-fill vendor data
                              const vendor = selectedOption.vendor;
                              setForm(prev => ({
                                ...prev,
                                company: vendor.company || vendor.name,
                                name: vendor.name,
                                email: vendor.email,
                                phone: vendor.phone || '',
                                address: vendor.address || '',
                                city: vendor.city || '',
                                state: vendor.state || '',
                                country: vendor.country || '',
                                zip: vendor.zip || '',
                                contact_person: vendor.contact_person || vendor.name,
                                contact_designation: vendor.contact_designation || '',
                                vendor_type: vendor.vendor_type || 'regular'
                              }));
                            }
                          } else {
                            // Clear selection - reset form
                            setForm(prev => ({
                              ...prev,
                              company: '',
                              name: '',
                              email: '',
                              phone: '',
                              address: '',
                              city: '',
                              state: '',
                              country: '',
                              zip: '',
                              contact_person: '',
                              contact_designation: '',
                              vendor_type: 'regular',
                              role: ''
                            }));
                          }
                        }}
                        options={getCombinedUniqueOptions()}
                        isClearable
                        isSearchable
                        placeholder={form.role ? `Search vendors with '${form.role}' role or existing vendors...` : "Search existing vendors/users or type new company name..."}
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
                              border: '2px solid #10b981',
                              boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.1)'
                            }
                          })
                        }}
                        formatCreateLabel={(inputValue) => `Create new vendor: "${inputValue}"`}
                        noOptionsMessage={() => "No vendors/users found - type to create new"}
                      />
                      {selectedVendor && !selectedVendor.__isNew__ && !selectedVendor.__isUser__ && (
                        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                          <span className="w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </span>
                          Existing vendor selected - details auto-filled
                        </p>
                      )}
                      {selectedVendor && selectedVendor.__isUser__ && (
                        <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                          <User2 className="w-3 h-3 text-blue-500" />
                          User with vendor role selected - creating vendor profile
                        </p>
                      )}
                      {selectedVendor && selectedVendor.__isNew__ && (
                        <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                          <Plus className="w-3 h-3 text-blue-500" />
                          Creating new vendor - fill in the details below
                        </p>
                      )}
                      {!selectedVendor && (
                        <p className="text-xs text-gray-500 mt-2">Search for existing vendors, users with vendor roles, or type a new company name</p>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Person Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={form.name}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Full Name of Contact Person"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Person Role <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="contact_person"
                    required
                    value={form.contact_person}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Primary Contact Person"
                  />
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="example@company.com"
                    disabled={!editMode && !!(selectedVendor && (!selectedVendor.__isNew__ || selectedVendor.__isUser__))}
                  />
                  {selectedVendor && !selectedVendor.__isNew__ && !selectedVendor.__isUser__ && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <span className="w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </span>
                      Auto-filled from selected vendor
                    </p>
                  )}
                  {selectedVendor && selectedVendor.__isUser__ && (
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      <User2 className="w-3 h-3 text-blue-500" />
                      Auto-filled from selected user
                    </p>
                  )}
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="+1234567890"
                  />
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="bg-gradient-to-br from-white to-green-50 rounded-2xl border border-green-200 shadow-lg p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Address Information</h3>
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="State"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ZIP/Postal Code</label>
                  <input
                    type="text"
                    name="zip"
                    value={form.zip}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="ZIP/Postal Code"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <input
                    type="text"
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Country"
                  />
                </div>
              </div>
            </div>

            {/* Professional Info */}
            <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl border border-purple-200 shadow-lg p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Star className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Professional Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GST Number {!editMode && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    name="gstNumber"
                    required={!editMode}
                    value={form.gstNumber}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                    placeholder="Enter GST Number"
                    maxLength={15}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tax ID (Optional)</label>
                  <input
                    type="text"
                    name="taxId"
                    value={form.taxId}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Tax Identification Number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Designation</label>
                  <input
                    type="text"
                    name="contact_designation"
                    value={form.contact_designation}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="CEO, Manager, Director, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Type</label>
                  <select
                    name="vendor_type"
                    value={form.vendor_type}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="regular">Regular</option>
                    <option value="preferred">Preferred</option>
                    <option value="strategic">Strategic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Business License Upload */}
            {!editMode && (
              <div className="bg-gradient-to-br from-white to-red-50 rounded-2xl border border-red-200 shadow-lg p-6 mb-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">Business License (Optional)</h3>
                </div>
                <div className="border-2 border-dashed border-red-300 rounded-lg p-6 text-center hover:border-red-400 transition-colors cursor-pointer">
                  <label className="cursor-pointer flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                      <Plus className="text-red-500 text-xl" />
                    </div>
                    <span className="text-sm text-gray-600 font-medium">Upload Business License Document</span>
                    <span className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (max. 10MB)</span>
                    {form.businessLicenseFile && (
                      <span className="text-sm text-green-600 mt-2 font-medium">
                        ✓ {form.businessLicenseFile.name}
                      </span>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.png,.jpeg"
                      name="businessLicenseFile"
                      onChange={handleChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-600 mt-2">Upload your official business license document for verification</p>
              </div>
            )}

            {/* Profile Picture Upload */}
            <div className="bg-gradient-to-br from-white to-orange-50 rounded-2xl border border-orange-200 shadow-lg p-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                  <User2 className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Profile Picture (Optional)</h3>
              </div>
              <div className="flex items-start space-x-6">
                <div className="flex-grow">
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-400 transition-colors cursor-pointer"
                  >
                    <label className="cursor-pointer flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                        <Plus className="text-gray-500 text-xl" />
                      </div>
                      <span className="text-sm text-gray-600 font-medium">Click to upload profile picture</span>
                      <span className="text-xs text-gray-500 mt-1">SVG, PNG, JPG or GIF (max. 5MB)</span>
                      <input
                        type="file"
                        accept="image/svg+xml,image/png,image/jpeg,image/gif"
                        name="profile_picture"
                        onChange={handleChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
                <div className="w-32 h-32 rounded-xl border border-green-300 shadow-sm overflow-hidden flex items-center justify-center">
                  {form.profilePicturePreview ? (
                    <img src={form.profilePicturePreview} alt="Profile Preview" className="object-cover w-full h-full" />
                  ) : (
                    <div className="text-green-300 text-center select-none">No image</div>
                  )}
                </div>
              </div>
            </div>

            {error && <p className="text-red-600 text-center mb-3">{error}</p>}

            <div className="flex justify-end gap-4 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-8 py-3 rounded-xl border-2 border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg transform hover:scale-105"
              >
                {loading ? (editMode ? "Updating..." : "Registering...") : (editMode ? "Update Vendor" : "Register Vendor")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};


// ─── Purchase Order Modal (Multi-select from Catalog) ───────────────────────────────────────────────
const PurchaseOrderModal = ({ open, onClose, vendors, onOrderPlaced }) => {
  const [vendorId, setVendorId] = useState("");
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [manualItems, setManualItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState([
    "1. GST CHARGES AS APPLICABLE 18%",
    "2. DELIVERY At Aburoad Rajsthan Site",
    "3. Transportation As par Actual",
    "4. PAYMENT- 30 DAY CREDIT"
  ]);
  const [loading, setLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (open) {
      setVendorId("");
      setSelectedProducts([]);
      setManualItems([]);
      setNotes("");
      setTerms([
        "1. GST CHARGES AS APPLICABLE 18%",
        "2. DELIVERY At Aburoad Rajsthan Site",
        "3. Transportation As par Actual",
        "4. PAYMENT- 30 DAY CREDIT"
      ]);
      setError("");
      setShowManualEntry(false);
      setSearchTerm("");
      fetchProducts();
    }
  }, [open]);

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/api/stock/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
    setProductsLoading(false);
  };

  const toggleProductSelection = (product) => {
    const exists = selectedProducts.find(p => p.product_id === product.product_id);
    if (exists) {
      setSelectedProducts(prev => prev.filter(p => p.product_id !== product.product_id));
    } else {
      setSelectedProducts(prev => [...prev, { ...product, qty: 1, unit: 'nos', unit_price: product.price || 0 }]);
    }
  };

  const updateSelectedProduct = (productId, field, value) => {
    setSelectedProducts(prev => prev.map(p => 
      p.product_id === productId ? { ...p, [field]: value } : p
    ));
  };

  const addManualItem = () => {
    setManualItems(prev => [...prev, { name: "", qty: 1, unit: 'nos' }]);
  };

  const updateManualItem = (idx, field, value) => {
    setManualItems(prev => prev.map((item, i) => 
      i === idx ? { ...item, [field]: value } : item
    ));
  };

  const removeManualItem = (idx) => {
    setManualItems(prev => prev.filter((_, i) => i !== idx));
  };

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allItems = [
    ...selectedProducts.map(p => ({
      name: p.name,
      qty: parseFloat(p.qty) || 0,
      unit: p.unit || 'nos'
    })),
    ...manualItems.filter(m => m.name.trim()).map(m => ({
      name: m.name.trim(),
      qty: parseFloat(m.qty) || 0,
      unit: m.unit || 'nos'
    }))
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendorId) { setError("Please select a vendor."); return; }
    if (allItems.length === 0) {
      setError("Please select at least one product or add a manual item.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/api/vendors/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vendor_id: vendorId,
          items: allItems,
          notes: notes.trim() || null,
          terms: terms
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create purchase order");
      }
      const invoice = await res.json();
      onOrderPlaced(invoice);
    } catch (err) {
      setError(err.message || "Failed to create purchase order");
    }
    setLoading(false);
  };

  if (!open) return null;
  const selectedVendor = vendors.find(v => v.id === vendorId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Create Purchase Request</h2>
              <p className="text-purple-100 text-sm">Select products from catalog or add manually</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-red-300 w-9 h-9 rounded-full bg-white bg-opacity-20 flex items-center justify-center transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
          <div className="overflow-y-auto p-8 flex-1">
            {/* Vendor Selector */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Vendor <span className="text-red-500">*</span>
              </label>
              <select
                value={vendorId}
                onChange={e => setVendorId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              >
                <option value="">-- Choose a Vendor --</option>
                {vendors.filter(v => v.status === "active").map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.company || v.id})</option>
                ))}
              </select>
              {selectedVendor && (
                <p className="text-xs text-gray-500 mt-1">
                  {selectedVendor.email}&nbsp;&nbsp;|&nbsp;&nbsp;Type: <span className="capitalize">{selectedVendor.vendor_type}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Product Catalog Selection */}
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">Product Catalog</h3>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                    {selectedProducts.length} selected
                  </span>
                </div>
                
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400"
                  />
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2">
                  {productsLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading products...</div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No products found</div>
                  ) : (
                    filteredProducts.map(product => {
                      const isSelected = selectedProducts.find(p => p.product_id === product.product_id);
                      return (
                        <div
                          key={product.product_id}
                          onClick={() => toggleProductSelection(product)}
                          className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-purple-500 bg-purple-50' 
                              : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-sm text-gray-800">{product.name}</div>
                              <div className="text-xs text-gray-500">
                                SKU: {product.sku} | Stock: {product.warehouse_qty || 0}
                              </div>
                            </div>
                            <div className="text-right ml-3">
                              {isSelected && (
                                <div className="w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                                  <span className="text-white text-xs">✓</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Selected Items & Manual Entry */}
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">Selected Items</h3>
                  <button
                    type="button"
                    onClick={() => setShowManualEntry(!showManualEntry)}
                    className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-lg hover:bg-green-200 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Manual Item
                  </button>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-3">
                  {/* Selected Products from Catalog */}
                  {selectedProducts.map(product => (
                    <div key={product.product_id} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-800">{product.name}</div>
                          <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleProductSelection(product)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-600">Unit</label>
                          <select
                            value={product.unit || 'nos'}
                            onChange={e => updateSelectedProduct(product.product_id, 'unit', e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          >
                            <option value="nos">nos</option>
                            <option value="kgs">kgs</option>
                            <option value="case">case</option>
                            <option value="pack">pack</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={product.qty}
                            onChange={e => updateSelectedProduct(product.product_id, 'qty', e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Manual Items */}
                  {showManualEntry && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Manual Entry</span>
                        <button
                          type="button"
                          onClick={addManualItem}
                          className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                        >
                          + Add Row
                        </button>
                      </div>
                      {manualItems.map((item, idx) => (
                        <div key={idx} className="bg-white border border-gray-200 rounded p-2 mb-2">
                          <div className="flex items-center justify-between mb-2">
                            <input
                              type="text"
                              placeholder="Item name"
                              value={item.name}
                              onChange={e => updateManualItem(idx, 'name', e.target.value)}
                              className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm mr-2"
                            />
                            <button
                              type="button"
                              onClick={() => removeManualItem(idx)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-gray-600">Unit</label>
                              <select
                                value={item.unit || 'nos'}
                                onChange={e => updateManualItem(idx, 'unit', e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              >
                                <option value="nos">nos</option>
                                <option value="kgs">kgs</option>
                                <option value="case">case</option>
                                <option value="pack">pack</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Quantity</label>
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={e => updateManualItem(idx, 'qty', e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedProducts.length === 0 && manualItems.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No items selected</p>
                      <p className="text-xs">Select from catalog or add manually</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Additional notes for this purchase request..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">Terms & Conditions</label>
                  <button
                    type="button"
                    onClick={() => setTerms([...terms, `${terms.length + 1}. `])}
                    className="text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200"
                  >
                    + Add Term
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {terms.map((term, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={term}
                        onChange={e => {
                          const newTerms = [...terms];
                          newTerms[idx] = e.target.value;
                          setTerms(newTerms);
                        }}
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setTerms(terms.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <p className="text-red-600 text-sm mt-4 bg-red-50 px-4 py-3 rounded-xl border border-red-200">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-8 py-5 flex justify-end gap-4 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 hover:bg-gray-100 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || allItems.length === 0}
              className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all flex items-center gap-2"
            >
              {loading ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Creating Order...</>
              ) : (
                <><FileText className="w-4 h-4" /> Create Purchase Request</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Place Purchase Order Modal (Simple Entry) ───────────────────────────────────────────────
const PlaceOrderModal = ({ open, onClose, vendors, onOrderPlaced }) => {
  const [vendorId, setVendorId] = useState("");
  const [items, setItems] = useState([{ name: "", qty: "1", unit: "nos", unit_price: "" }]);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState([
    "1. GST CHARGES AS APPLICABLE 18%",
    "2. DELIVERY At Aburoad Rajsthan Site",
    "3. Transportation As par Actual",
    "4. PAYMENT- 30 DAY CREDIT"
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setVendorId("");
      setItems([{ name: "", qty: "1", unit: "nos", unit_price: "" }]);
      setNotes("");
      setTerms([
        "1. GST CHARGES AS APPLICABLE 18%",
        "2. DELIVERY At Aburoad Rajsthan Site",
        "3. Transportation As par Actual",
        "4. PAYMENT- 30 DAY CREDIT"
      ]);
      setError("");
    }
  }, [open]);

  const addItem = () =>
    setItems(prev => [...prev, { name: "", qty: "1", unit: "nos", unit_price: "" }]);

  const removeItem = idx =>
    setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const updateItem = (idx, field, value) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

  const subtotal = items.reduce((sum, item) =>
    sum + (parseFloat(item.qty) || 0) * (parseFloat(item.unit_price) || 0), 0);
  const gstAmount = subtotal * 0.18;
  const grandTotal = subtotal + gstAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendorId) { setError("Please select a vendor."); return; }
    const validItems = items.filter(
      it => it.name.trim() && parseFloat(it.qty) > 0 && parseFloat(it.unit_price) > 0
    );
    if (validItems.length === 0) {
      setError("Please add at least one item with name, quantity, and price.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/api/vendors/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vendor_id: vendorId,
          items: validItems.map(it => ({
            name: it.name.trim(),
            qty: parseFloat(it.qty),
            unit: it.unit || 'nos',
            unit_price: parseFloat(it.unit_price),
          })),
          notes: notes.trim() || null,
          terms: terms,
          gst_percent: 18,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to place order");
      }
      const invoice = await res.json();
      onOrderPlaced(invoice);
    } catch (err) {
      setError(err.message || "Failed to place order");
    }
    setLoading(false);
  };

  if (!open) return null;
  const selectedVendor = vendors.find(v => v.id === vendorId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Place Purchase Request</h2>
              <p className="text-blue-100 text-sm">Select vendor, add items and generate request</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-red-300 w-9 h-9 rounded-full bg-white bg-opacity-20 flex items-center justify-center transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
          <div className="overflow-y-auto p-8 flex-1">
            {/* Vendor Selector */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Vendor <span className="text-red-500">*</span>
              </label>
              <select
                value={vendorId}
                onChange={e => setVendorId(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">-- Choose a Vendor --</option>
                {vendors.filter(v => v.status === "active").map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.company || v.id})</option>
                ))}
              </select>
              {selectedVendor && (
                <p className="text-xs text-gray-500 mt-1">
                  {selectedVendor.email}&nbsp;&nbsp;|&nbsp;&nbsp;Type: <span className="capitalize">{selectedVendor.vendor_type}</span>
                </p>
              )}
            </div>

            {/* Items Table */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-gray-700">Items <span className="text-red-500">*</span></label>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Item Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Unit</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Unit Price (₹)</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total (₹)</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item, idx) => {
                      const lineTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unit_price) || 0);
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={e => updateItem(idx, "name", e.target.value)}
                              placeholder="e.g. Chair"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={item.unit || "nos"}
                              onChange={e => updateItem(idx, "unit", e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            >
                              <option value="nos">nos</option>
                              <option value="kgs">kgs</option>
                              <option value="case">case</option>
                              <option value="pack">pack</option>
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number" min="0.01" step="any"
                              value={item.qty}
                              onChange={e => updateItem(idx, "qty", e.target.value)}
                              className="w-16 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number" min="0" step="any"
                              value={item.unit_price}
                              onChange={e => updateItem(idx, "unit_price", e.target.value)}
                              placeholder="0.00"
                              className="w-24 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-gray-800">₹{lineTotal.toFixed(2)}</td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              disabled={items.length === 1}
                              className="text-red-400 hover:text-red-600 disabled:opacity-30 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes & Terms */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Additional notes for this request..."
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">Terms & Conditions</label>
                  <button
                    type="button"
                    onClick={() => setTerms([...terms, `${terms.length + 1}. `])}
                    className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                  >
                    + Add Term
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {terms.map((term, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={term}
                        onChange={e => {
                          const newTerms = [...terms];
                          newTerms[idx] = e.target.value;
                          setTerms(newTerms);
                        }}
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setTerms(terms.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
              <div className="flex justify-end">
                <div className="w-72 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST (18%):</span>
                    <span className="font-medium">₹{gstAmount.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-blue-200 pt-2 flex justify-between">
                    <span className="font-bold text-gray-800 text-base">Grand Total:</span>
                    <span className="font-bold text-blue-700 text-lg">₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">Terms & Conditions</label>
                  <button
                    type="button"
                    onClick={() => setTerms([...terms, `${terms.length + 1}. `])}
                    className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                  >
                    + Add Term
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {terms.map((term, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={term}
                        onChange={e => {
                          const newTerms = [...terms];
                          newTerms[idx] = e.target.value;
                          setTerms(newTerms);
                        }}
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setTerms(terms.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            {error && (
              <p className="text-red-600 text-sm mt-4 bg-red-50 px-4 py-3 rounded-xl border border-red-200">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-8 py-5 flex justify-end gap-4 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 hover:bg-gray-100 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || grandTotal === 0}
              className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all flex items-center gap-2"
            >
              {loading ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Placing Request...</>
              ) : (
                <><FileText className="w-4 h-4" /> Place Request &amp; Generate Invoice</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// ─── Invoice View Modal ───────────────────────────────────────────────────────
const InvoiceModal = ({ invoice, onClose }) => {
  if (!invoice) return null;

  const fmtCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount || 0);

  const dateStr = invoice.invoice_date
    ? new Date(invoice.invoice_date).toLocaleDateString('en-IN')
    : new Date().toLocaleDateString('en-IN');

  const printStyles = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
    .container { width: 100%; border: 1px solid #000; padding: 15px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 5px; }
    .header-title { text-align: center; font-weight: bold; font-size: 16px; padding: 10px; border-bottom: 1px solid #000; }
    .bold { font-weight: bold; }
    .items-table th { background: #f2f2f2; font-weight: bold; }
    .total-section td { font-weight: bold; }
  `;

  const buildPrintContent = () => {
    const netAmount = (invoice.items || []).reduce((sum, item) => sum + (parseFloat(item.total) || (parseFloat(item.qty) * parseFloat(item.rate)) || 0), 0);
    const gstAmount = netAmount * 0.18;
    const totalAmount = netAmount + gstAmount;

    const numberToWords = (num) => {
      const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
      const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      const inWords = (n) => {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
        if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? 'and ' + inWords(n % 100) : '');
        if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? inWords(n % 1000) : '');
        if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? inWords(n % 100000) : '');
        return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? inWords(n % 10000000) : '');
      };
      return inWords(Math.floor(num)) + ' Rupees Only';
    };

    const itemsHtml = (invoice.items || []).map((item, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${item.name || item.description || ''}</td>
        <td style="text-align: center;">${item.make || ''}</td>
        <td style="text-align: center;">${item.hsn_code || ''}</td>
        <td style="text-align: center;">${String(item.unit || 'NOS').toUpperCase()}</td>
        <td style="text-align: center;">${item.qty || 0}</td>
      </tr>
    `).join('');

    return `
      <div class="container">
        <div style="display: flex; align-items: center; padding: 20px; border-bottom: 1px solid #000;">
          <img src="/Ratilal & Sons Logo.png" style="height: 80px; margin-right: 30px;" />
          <div style="flex: 1;">
            <div style="font-weight: bold; font-size: 28px; color: #70aedb; letter-spacing: 1px;">RATILAL &amp; SONS</div>
            <div style="font-size: 11px; margin-top: 5px; color: #555;">
              " Ratilal &amp; Sons House "<br/>
              Corporate Office : Plot No. 49, Opp. Hanuman Temple, GIDC Anjar - Kachchh (Gujarat). 370110<br/>
              Regd. Office : Ground Floor, Shop No - 1, Shree Hari Business Park, Bhuj-Bhachu by Pass Road, Anjar - Kachchh, Gujarat - 370110<br/>
              Email ID : rsinfraprojects2014@gmail.com
            </div>
          </div>
        </div>
        
        <div style="padding: 10px; border-bottom: 1px solid #000;">
          <div style="text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 15px;">PURCHASE REQUEST</div>
          <div style="display: flex; justify-content: space-between;">
            <div style="width: 60%;">
              <div class="bold" style="font-size: 13px;">${invoice.vendor_company || invoice.vendor_name}</div>
              <div style="white-space: pre-line;">${invoice.vendor_address || 'Vendor Address'}</div>
              <div>Phone: ${invoice.vendor_phone}</div>
              <div>Email: ${invoice.vendor_email || ''}</div>
              <div>GST NO: ${invoice.vendor_gstin}</div>
              <div>Contact Person: ${invoice.vendor_contact_person}</div>
            </div>
            <div style="width: 35%; text-align: right;">
              <div class="bold">Date:- ${dateStr}</div>
              <div class="bold" style="margin-top: 10px;">${invoice.order_number || invoice.invoice_number}</div>
            </div>
          </div>
        </div>
        
        <table class="items-table">
          <thead>
              <tr>
                <th style="width: 5%;">NO</th>
                <th style="width: 55%;">DESCRIPATION</th>
                <th style="width: 10%;">Make</th>
                <th style="width: 15%;">HSN CODE</th>
                <th style="width: 8%;">UNIT</th>
                <th style="width: 7%;">QTY</th>
              </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            ${Array(Math.max(0, 5 - (invoice.items || []).length)).fill(0).map(() => `
              <tr style="height: 20px;"><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            `).join('')}
          </tbody>
        </table>
        <div style="border-top: 1px solid #000; padding: 10px;">
          <div class="bold" style="text-decoration: underline; margin-bottom: 5px;">TERMS & CONDITIONS</div>
          <div style="margin-left: 15px;">
            ${(Array.isArray(invoice.terms) ? invoice.terms : [
              "1. GST CHARGES AS APPLICABLE 18%",
              "2. DELIVERY At Aburoad Rajsthan Site",
              "3. Transportation As par Actual",
              "4. PAYMENT- 30 DAY CREDIT"
            ]).map(t => `${t}<br>`).join('')}
          </div>
        </div>
        <div style="border-top: 1px solid #000; padding: 10px;">
          <div class="bold" style="text-decoration: underline; margin-bottom: 5px;">DELIVERY ADDRESS</div>
          <div class="bold">RATILAL & SONS ,</div>
          <div>RMC PLANT, PKG T8, NWR RAILWAY PROJOECTS,</div>
          <div>SUVRVEY NO. 655,656, 657,658,658, .</div>
          <div>ABU AMBAJI ROAD, OPP. SIYAWA PETROL PUMP, BEHIND HAPPY RESTURANT</div>
          <div>SITE CONTECT PARSON- ANDAND PARMAR-(M) 9825917636</div>
          <div class="bold">GST NUMBER - 24BFIPS0859D1ZF</div>
        </div>
        <div style="margin-top: 30px; display: flex; flex-direction: column; align-items: flex-end; padding-right: 20px; border-top: 1px solid #000; padding-top: 20px;">
          <div class="bold" style="margin-bottom: 50px;">RATILAL & SONS</div>
          <div class="bold" style="border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; text-transform: uppercase;">AUTHORISED SIGNATORY</div>
        </div>
      </div>
    `;
  };

  const handleDownload = async () => {
    try {
      // Create a temporary container for the PDF content
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.width = '210mm'; // A4 width
      tempContainer.style.padding = '20mm';
      tempContainer.style.backgroundColor = '#ffffff';
      tempContainer.style.fontFamily = 'Arial, sans-serif';
      
      // Build the HTML content
      tempContainer.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto;">
          ${buildPrintContent()}
        </div>
      `;
      
      // Add styles
      const styleElement = document.createElement('style');
      styleElement.textContent = printStyles;
      tempContainer.appendChild(styleElement);
      
      document.body.appendChild(tempContainer);
      
      // Generate canvas from HTML
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      // Remove temporary container
      document.body.removeChild(tempContainer);
      
      // Calculate PDF dimensions
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      
      // Add image to PDF
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      // Download the PDF
      pdf.save(`Purchase_Request_${invoice.invoice_number}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Purchase Request</h2>
              <p className="text-purple-100 text-sm">{invoice.invoice_number} &mdash; {invoice.vendor_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-red-300 w-9 h-9 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Body (preview) */}
        <div className="overflow-y-auto flex-1 p-8 bg-gray-50">
          <div className="bg-white shadow-sm border border-black p-10 max-w-[210mm] mx-auto min-h-[297mm]">
            {/* Header */}
            <div className="flex items-center p-6 border border-black mb-0">
              <img src="/Ratilal & Sons Logo.png" alt="Logo" className="h-20 mr-8" />
              <div className="flex-1">
                <div className="font-bold text-3xl text-[#70aedb] tracking-wider">RATILAL & SONS</div>
                <div className="text-xs text-gray-600 mt-1">
                  " Ratilal & Sons House "<br/>
                  Corporate Office : Plot No. 49, Opp. Hanuman Temple, GIDC Anjar - Kachchh (Gujarat). 370110<br/>
                  Regd. Office : Ground Floor, Shop No - 1, Shree Hari Business Park, Bhuj-Bhachu by Pass Road, Anjar - Kachchh, Gujarat - 370110<br/>
                  Email ID : rsinfraprojects2014@gmail.com
                </div>
              </div>
            </div>

            <div className="p-4 border border-black border-t-0 mb-0">
              <div className="text-center font-bold text-lg mb-4 uppercase">Purchase Request</div>
              <div className="flex justify-between">
                <div className="w-3/5">
                  <div className="font-bold text-base mb-1">{invoice.vendor_company || invoice.vendor_name}</div>
                  <div className="text-sm text-gray-700 whitespace-pre-line space-y-1">
                    <p>{invoice.vendor_address || 'Vendor Address'}</p>
                    <p>Phone: {invoice.vendor_phone}</p>
                    <p>Email: {invoice.vendor_email}</p>
                    <p className="font-bold">GST NO: {invoice.vendor_gstin}</p>
                    <p>Contact Person: {invoice.vendor_contact_person}</p>
                  </div>
                </div>
                <div className="w-1/3 text-right">
                  <div className="font-bold">Date:- {dateStr}</div>
                  <div className="font-bold text-xl mt-4">
                    {invoice.order_number || invoice.invoice_number}
                  </div>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="mb-0 overflow-hidden border border-black border-t-0">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-black text-xs font-bold uppercase">
                    <th className="p-2 border-r border-black w-[5%]">NO</th>
                    <th className="p-2 border-r border-black w-[55%] text-left">DESCRIPTION</th>
                    <th className="p-2 border-r border-black w-[10%]">Make</th>
                    <th className="p-2 border-r border-black w-[15%]">HSN CODE</th>
                    <th className="p-2 border-r border-black w-[8%]">UNIT</th>
                    <th className="p-2 w-[7%]">QTY</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {(invoice.items || []).map((item, idx) => (
                    <tr key={idx} className="border-b border-black">
                      <td className="p-2 border-r border-black text-center">{idx + 1}</td>
                      <td className="p-2 border-r border-black font-medium">{item.name || item.description}</td>
                      <td className="p-2 border-r border-black text-center">{item.make || '-'}</td>
                      <td className="p-2 border-r border-black text-center">{item.hsn_code || '-'}</td>
                      <td className="p-2 border-r border-black text-center">{String(item.unit || 'NOS').toUpperCase()}</td>
                      <td className="p-2 text-center">{item.qty || item.quantity}</td>
                    </tr>
                  ))}
                  {Array(Math.max(0, 5 - (invoice.items || []).length)).fill(0).map((_, i) => (
                    <tr key={`empty-${i}`} className="border-b border-black h-8">
                      <td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td className="border-r border-black"></td><td></td>
                    </tr>
                  ))}
                  {/* Totals Rows Removed as requested */}
                </tbody>
              </table>
            </div>

            {/* Terms & Conditions and Delivery Address */}
            <div className="border border-black border-t-0 p-4 mb-6 text-sm">
              <div className="space-y-1 text-xs mb-4">
                <p className="font-bold underline uppercase mb-2">Terms & Conditions</p>
                {(Array.isArray(invoice.terms) ? invoice.terms : [
                  "1. GST CHARGES AS APPLICABLE 18%",
                  "2. DELIVERY At Aburoad Rajsthan Site",
                  "3. Transportation As par Actual",
                  "4. PAYMENT- 30 DAY CREDIT"
                ]).map((t, idx) => (
                  <p key={idx}>{t}</p>
                ))}
              </div>
              
              <div className="border-t border-black pt-4">
                <div className="font-bold underline mb-2 uppercase">DELIVERY ADDRESS</div>
                <div className="text-[10px] space-y-0.5 leading-tight">
                  <p className="font-bold">RATILAL & SONS ,</p>
                  <p>RMC PLANT, PKG T8, NWR RAILWAY PROJOECTS,</p>
                  <p>SUVRVEY NO. 655,656, 657,658,658, .</p>
                  <p>ABU AMBAJI ROAD, OPP. SIYAWA PETROL PUMP, BEHIND HAPPY RESTURANT</p>
                  <p>SITE CONTECT PARSON- ANDAND PARMAR-(M) 9825917636</p>
                  <p className="font-bold">GST NUMBER - 24BFIPS0859D1ZF</p>
                </div>
              </div>

              <div className="mt-12 pt-4 border-t border-black flex flex-col items-end">
                <div className="font-bold text-sm mb-12 mr-4">RATILAL & SONS</div>
                <div className="font-bold text-sm border-t border-black pt-2 w-48 text-center uppercase">Authorised Signatory</div>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
              <p className="text-xs font-bold text-yellow-700 uppercase mb-1">Notes</p>
              <p className="text-sm text-gray-700">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-200 px-8 py-5 flex justify-between items-center flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 hover:bg-gray-100 font-medium transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold shadow-lg transition-all transform hover:scale-105 flex items-center gap-2"
          >
            <Download className="w-5 h-5" /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
};


// Vendor Detail Card
const VendorDetailCard = ({ vendor, onClose }) => {
  if (!vendor) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden relative">
        {/* Header with Gradient */}
        <div className="bg-gradient-to-r from-green-600 via-green-700 to-emerald-600 px-8 py-6 relative">
          <button
            className="absolute top-4 right-4 text-white hover:text-red-300 text-2xl transition-colors z-10 w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
          <div className="flex items-center gap-6">
            <div className="relative">
              <img
                src={vendor.avatar_url || "/default-avatar.png"}
                alt={vendor.name}
                className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white ring-opacity-30"
              />
              <div className={`absolute -bottom-2 -right-2 w-6 h-6 rounded-full border-4 border-white ${vendor.status === 'active' ? 'bg-green-400' :
                vendor.status === 'inactive' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></div>
            </div>
            <div className="text-white">
              <h2 className="text-3xl font-bold mb-2">{vendor.name}</h2>
              <div className="flex items-center gap-4 text-green-100">
                <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm">ID: {vendor.id}</span>
                <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm capitalize">{vendor.vendor_type}</span>
                <span className={`px-3 py-1 rounded-full text-sm capitalize ${vendor.status === 'active' ? 'bg-green-400 text-green-900' :
                  vendor.status === 'inactive' ? 'bg-yellow-400 text-yellow-900' :
                    'bg-red-400 text-red-900'
                  }`}>{vendor.status}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-200px)] overflow-y-auto p-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
              <div className="text-3xl font-bold text-blue-600 mb-1">₹{vendor.total_spend?.toFixed(2) || "0.00"}</div>
              <div className="text-blue-600 font-medium">Total Spend</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border border-purple-200">
              <div className="text-3xl font-bold text-purple-600 mb-1">{vendor.orders_count || 0}</div>
              <div className="text-purple-600 font-medium">Orders Count</div>
            </div>
          </div>

          {/* Information Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Contact Information */}
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Contact Information</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-gray-400 mt-1" />
                  <div>
                    <div className="text-sm text-gray-500">Email</div>
                    <div className="font-medium text-gray-900">{vendor.email || "N/A"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-gray-400 mt-1" />
                  <div>
                    <div className="text-sm text-gray-500">Phone</div>
                    <div className="font-medium text-gray-900">{vendor.phone || "N/A"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                  <div>
                    <div className="text-sm text-gray-500">Address</div>
                    <div className="font-medium text-gray-900">{vendor.address || "N/A"}</div>
                    {(vendor.city || vendor.state || vendor.country) && (
                      <div className="text-sm text-gray-600">
                        {[vendor.city, vendor.state, vendor.country].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Information */}
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <User2 className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Professional Details</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-gray-500">Company</div>
                  <div className="font-medium text-gray-900">{vendor.company || "N/A"}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Contact Person</div>
                  <div className="font-medium text-gray-900">{vendor.contact_person || "N/A"}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Designation</div>
                  <div className="font-medium text-gray-900">{vendor.contact_designation || "N/A"}</div>
                </div>
                {vendor.tags && vendor.tags.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-500 mb-2">Tags</div>
                    <div className="flex flex-wrap gap-2">
                      {vendor.tags.map((tag, index) => (
                        <span key={index} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-8 bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Additional Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Member Since</div>
                <div className="font-medium text-gray-900">
                  {new Date(vendor.created_at || vendor.joined_at || vendor.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
              {vendor.preferences && Object.keys(vendor.preferences).length > 0 && (
                <div>
                  <div className="text-sm text-gray-500">Preferences</div>
                  <div className="font-medium text-gray-900 text-sm">
                    {JSON.stringify(vendor.preferences, null, 2)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// Main Vendor Profile Component
const VendorProfile = () => {
  const [vendors, setVendors] = useState([]);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [detailViewVendor, setDetailViewVendor] = useState(null);
  const [adding, setAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [orderModal, setOrderModal] = useState(false);
  const [purchaseOrderModal, setPurchaseOrderModal] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(null); // vendor id being loaded
  const [activeTab, setActiveTab] = useState("vendors"); // "vendors" or "purchase-orders"
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchaseOrdersLoading, setPurchaseOrdersLoading] = useState(false);

  const handleViewVendorInvoice = async (vendor) => {
    setInvoiceLoading(vendor.id);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/api/vendors/${vendor.id}/orders?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch orders");
      const orders = await res.json();
      if (!orders || orders.length === 0) {
        alert("No invoice found for this vendor.");
        return;
      }
      // Sort by created_at descending to get the latest
      const sorted = [...orders].sort((a, b) =>
        new Date(b.created_at || b.invoice_date || 0) - new Date(a.created_at || a.invoice_date || 0)
      );
      setCurrentInvoice(sorted[0]);
    } catch (e) {
      alert("Could not load invoice: " + e.message);
    } finally {
      setInvoiceLoading(null);
    }
  };

  // Fetch vendors on mount
  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchPurchaseOrders = async () => {
    setPurchaseOrdersLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/api/vendors/purchase-orders/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPurchaseOrders(data);
      }
    } catch (err) {
      console.error("Failed to fetch purchase orders:", err);
    }
    setPurchaseOrdersLoading(false);
  };

  const deletePurchaseOrder = async (orderNumber) => {
    if (!confirm(`Are you sure you want to delete purchase order ${orderNumber}?`)) {
      return;
    }

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/api/vendors/purchase-orders/${orderNumber}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        // Remove from local state
        setPurchaseOrders(prev => prev.filter(order => 
          (order.order_number || order.invoice_number) !== orderNumber
        ));
        alert('Purchase order deleted successfully');
      } else {
        const error = await res.json();
        alert(`Failed to delete purchase order: ${error.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Failed to delete purchase order:", err);
      alert('Failed to delete purchase order. Please try again.');
    }
  };

  useEffect(() => {
    if (activeTab === "purchase-orders") {
      fetchPurchaseOrders();
    }
  }, [activeTab]);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/api/vendors/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch vendors");
      const data = await res.json();

      const API_BASE = API_URL.replace("/api", "");
      const processed = Array.isArray(data)
        ? data.map((v) => {
          let avatar_url = v.profile_picture || v.avatar_url;
          if (avatar_url && avatar_url.startsWith("/")) {
            avatar_url = API_BASE + avatar_url;
          }
          return {
            ...v,
            id: v.id || v._id,
            name: v.name,
            avatar_url,
            total_spend: v.total_spend || 0,
            orders_count: v.orders_count || 0,
            status: v.status || "active",
          };
        })
        : [];
      setVendors(processed);
      setFilteredVendors(processed);
    } catch (e) {
      console.error("Error fetching vendors:", e);
      setVendors([]);
      setFilteredVendors([]);
    }
    setLoading(false);
  };

  const handleAddVendor = async (vendor) => {
    setAdding(true);
    try {
      const token = localStorage.getItem("access_token");
      const formData = new FormData();
      Object.entries(vendor).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (key === "profile_picture" || key === "businessLicenseFile") return;
        if (typeof value === "object" && !(value instanceof File)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value.toString());
        }
      });
      if (vendor.profile_picture instanceof File) {
        formData.append("profile_picture", vendor.profile_picture);
      }
      if (vendor.businessLicenseFile instanceof File) {
        formData.append("business_license", vendor.businessLicenseFile);
      }
      for (const [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
      }
      const res = await fetch(`${API_URL}/api/vendors/`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 409) {
          setAdding(false);
          return { error: "A vendor with this name and email already exists." };
        }
        const errorData = await res.json();
        let errorMsg = "Failed to add vendor";
        if (Array.isArray(errorData)) errorMsg = errorData.map(e => e.msg).join(", ");
        else if (errorData.detail) errorMsg = errorData.detail;
        setAdding(false);
        return { error: errorMsg };
      }
      await fetchVendors();
      setAddModal(false);
      setAdding(false);
      return {};
    } catch (err) {
      console.error("Error adding vendor:", err);
      setAdding(false);
      return { error: "Failed to add vendor" };
    }
  };

  const handleEditVendor = async (vendor) => {
    setAdding(true);
    try {
      const token = localStorage.getItem("access_token");

      // Build FormData payload for update similar to customer edit
      const formData = new FormData();
      Object.entries(vendor).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (key === "profile_picture" || key === "businessLicenseFile") return;
        if (typeof value === "object" && !(value instanceof File)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value.toString());
        }
      });
      if (vendor.profile_picture instanceof File) {
        formData.append("profile_picture", vendor.profile_picture);
      }
      if (vendor.businessLicenseFile instanceof File) {
        formData.append("business_license", vendor.businessLicenseFile);
      }

      const res = await fetch(`${API_URL}/api/vendors/${editingVendor.id}`, {
        method: "PUT",
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        let errorMsg = "Failed to update vendor";
        if (Array.isArray(errorData)) errorMsg = errorData.map(e => e.msg).join(", ");
        else if (errorData.detail) errorMsg = errorData.detail;
        setAdding(false);
        return { error: errorMsg };
      }
      await fetchVendors();
      setEditModal(false);
      setEditingVendor(null);
      setAdding(false);
      return {};
    } catch (err) {
      console.error("Error updating vendor:", err);
      setAdding(false);
      return { error: "Failed to update vendor" };
    }
  };

  const handleDeleteVendor = async (id) => {
    if (!window.confirm("Are you sure you want to delete this vendor?")) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/api/vendors/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete vendor");
      await fetchVendors();
    } catch (e) {
      console.error("Error deleting vendor:", e);
    }
    setLoading(false);
  };

  const openEditModal = (vendor) => {
    setEditingVendor(vendor);
    setEditModal(true);
  };

  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    if (!term) {
      setFilteredVendors(vendors);
      return;
    }
    const filtered = vendors.filter(vendor =>
      (vendor.name || "").toLowerCase().includes(term) ||
      (vendor.email || "").toLowerCase().includes(term) ||
      (vendor.company || "").toLowerCase().includes(term) ||
      (vendor.vendor_type || "").toLowerCase().includes(term)
    );
    setFilteredVendors(filtered);
  };

  const generatePurchaseOrderPDF = async (order) => {
    // Fallback: If order is missing details, try to find the vendor in the local vendors list
    const orderVendor = vendors.find(v => v.id === order.vendor_id) || {};
    
    const displayOrder = {
      ...order,
      vendor_address: order.vendor_address || orderVendor.address || '',
      vendor_phone: order.vendor_phone || orderVendor.phone || '',
      vendor_gstin: order.vendor_gstin || orderVendor.registration_number || '',
      vendor_contact_person: order.vendor_contact_person || orderVendor.contact_person || '',
      vendor_company: order.vendor_company || orderVendor.company || order.vendor_name || '',
    };

    const orderDate = new Date(order.invoice_date || order.created_at).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    const itemsHTML = (order.items || []).map((item, idx) => `
      <tr>
        <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #000; padding: 5px;">${item.name || item.description || ''}</td>
        <td style="border: 1px solid #000; padding: 5px; text-align: center;">${item.make || ''}</td>
        <td style="border: 1px solid #000; padding: 5px; text-align: center;">${item.hsn_code || ''}</td>
        <td style="border: 1px solid #000; padding: 5px; text-align: center;">${String(item.unit || 'NOS').toUpperCase()}</td>
        <td style="border: 1px solid #000; padding: 5px; text-align: center;">${item.qty || 0}</td>
      </tr>
    `).join('');

    const termsHTML = (Array.isArray(order.terms) ? order.terms : [
      "1. GST CHARGES AS APPLICABLE 18%",
      "2. DELIVERY At Aburoad Rajsthan Site",
      "3. Transportation As par Actual",
      "4. PAYMENT- 30 DAY CREDIT"
    ]).map(t => `${t}<br>`).join('');

    const htmlContent = `
      <div style="width: 210mm; padding: 15mm; background: white; font-family: Arial, sans-serif; font-size: 11px; color: #000;">
        <div style="border: 1px solid #000; padding: 15px;">
          <!-- Header -->
          <div style="display: flex; align-items: center; padding: 20px; border-bottom: 1px solid #000;">
            <img src="/Ratilal & Sons Logo.png" style="height: 80px; margin-right: 30px;" />
            <div style="flex: 1;">
              <div style="font-weight: bold; font-size: 28px; color: #70aedb; letter-spacing: 1px;">RATILAL &amp; SONS</div>
              <div style="font-size: 11px; margin-top: 5px; color: #555;">
                " Ratilal &amp; Sons House "<br/>
                Corporate Office : Plot No. 49, Opp. Hanuman Temple, GIDC Anjar - Kachchh (Gujarat). 370110<br/>
                Regd. Office : Ground Floor, Shop No - 1, Shree Hari Business Park, Bhuj-Bhachu by Pass Road, Anjar - Kachchh, Gujarat - 370110<br/>
                Email ID : rsinfraprojects2014@gmail.com
              </div>
            </div>
          </div>
          
          <div style="padding: 10px; border-bottom: 1px solid #000;">
            <div style="text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 15px;">PURCHASE REQUEST</div>
            <div style="display: flex; justify-content: space-between;">
              <div style="width: 60%;">
                <div style="font-weight: bold; font-size: 13px;">${displayOrder.vendor_company || displayOrder.vendor_name}</div>
                <div style="white-space: pre-line;">${displayOrder.vendor_address || 'Vendor Address'}</div>
                <div>Phone: ${displayOrder.vendor_phone}</div>
                <div>Email: ${displayOrder.vendor_email || ''}</div>
                <div>GST NO: ${displayOrder.vendor_gstin}</div>
                <div>Contact Person: ${displayOrder.vendor_contact_person}</div>
              </div>
              <div style="width: 35%; text-align: right;">
                <div style="font-weight: bold;">Date:- ${orderDate}</div>
                <div style="font-weight: bold; margin-top: 10px; font-size: 16px;">PO NO: ${order.order_number || order.invoice_number}</div>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="width: 5%; border: 1px solid #000; padding: 4px; background: #f2f2f2;">NO</th>
                <th style="width: 55%; border: 1px solid #000; padding: 4px; background: #f2f2f2;">DESCRIPATION</th>
                <th style="width: 10%; border: 1px solid #000; padding: 4px; background: #f2f2f2;">Make</th>
                <th style="width: 15%; border: 1px solid #000; padding: 4px; background: #f2f2f2;">HSN CODE</th>
                <th style="width: 8%; border: 1px solid #000; padding: 4px; background: #f2f2f2;">UNIT</th>
                <th style="width: 7%; border: 1px solid #000; padding: 4px; background: #f2f2f2;">QTY</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
              ${Array(Math.max(0, 5 - (order.items || []).length)).fill(0).map(() => `
                <tr style="height: 20px;">
                  <td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td><td style="border: 1px solid #000;"></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Terms & Conditions -->
          <div style="border-top: 1px solid #000; padding: 10px;">
            <div style="font-weight: bold; text-decoration: underline; margin-bottom: 5px;">TERMS & CONDITIONS</div>
            <div style="margin-left: 15px;">
              ${termsHTML}
            </div>
          </div>

          <!-- Delivery Address -->
          <div style="border-top: 1px solid #000; padding: 10px;">
            <div style="font-weight: bold; text-decoration: underline; margin-bottom: 5px;">DELIVERY ADDRESS</div>
            <div style="font-weight: bold;">RATILAL & SONS ,</div>
            <div>RMC PLANT, PKG T8, NWR RAILWAY PROJOECTS,</div>
            <div>SUVRVEY NO. 655,656, 657,658,658, .</div>
            <div>ABU AMBAJI ROAD, OPP. SIYAWA PETROL PUMP, BEHIND HAPPY RESTURANT</div>
            <div>SITE CONTECT PARSON- ANDAND PARMAR-(M) 9825917636</div>
            <div style="font-weight: bold;">GST NUMBER - 24BFIPS0859D1ZF</div>
          </div>

          <!-- Footer Signature -->
          <div style="margin-top: 30px; display: flex; flex-direction: column; align-items: flex-end; padding-right: 20px;">
            <div style="font-weight: bold; margin-bottom: 50px;">RATILAL & SONS</div>
            <div style="font-weight: bold; border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; text-transform: uppercase;">AUTHORISED SIGNATORY</div>
          </div>
        </div>
      </div>
    `;

    try {
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.innerHTML = htmlContent;
      document.body.appendChild(tempContainer);

      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      document.body.removeChild(tempContainer);

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Purchase_Request_${order.order_number || order.invoice_number}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  // Metrics
  const totalVendors = vendors.length;
  const activeVendors = vendors.filter((v) => (v.status || "active").toLowerCase() === "active").length;
  const preferredVendors = vendors.filter((v) => v.vendor_type === "preferred").length;
  const totalSpend = vendors.reduce((sum, v) => sum + (v.total_spend || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      {/* Header Section with Gradient */}
      <div className="bg-gradient-to-r from-green-600 via-green-700 to-emerald-600 rounded-3xl shadow-2xl p-8 mb-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-3 tracking-tight">Vendor Management</h1>
            <p className="text-green-100 text-lg">Manage your vendors, update their details, and review vendor metrics</p>
          </div>
          <div className="hidden lg:block">
            <div className="w-20 h-20 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <User2 className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Cards with Beautiful Gradients */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 shadow-lg transform hover:scale-105 transition-all duration-300 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <User2 className="w-6 h-6" />
            </div>
            <div className="text-right">
              <h3 className="text-3xl font-bold">{totalVendors}</h3>
              <p className="text-blue-100 font-medium">Total Vendors</p>
            </div>
          </div>
          <div className="w-full bg-white bg-opacity-20 rounded-full h-2">
            <div className="bg-white bg-opacity-60 h-2 rounded-full" style={{ width: '85%' }}></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 shadow-lg transform hover:scale-105 transition-all duration-300 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Star className="w-6 h-6" />
            </div>
            <div className="text-right">
              <h3 className="text-3xl font-bold">{activeVendors}</h3>
              <p className="text-green-100 font-medium">Active Vendors</p>
            </div>
          </div>
          <div className="w-full bg-white bg-opacity-20 rounded-full h-2">
            <div className="bg-white bg-opacity-60 h-2 rounded-full" style={{ width: `${totalVendors > 0 ? (activeVendors / totalVendors * 100) : 0}%` }}></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 shadow-lg transform hover:scale-105 transition-all duration-300 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="text-right">
              <h3 className="text-3xl font-bold">{preferredVendors}</h3>
              <p className="text-purple-100 font-medium">Preferred Vendors</p>
            </div>
          </div>
          <div className="w-full bg-white bg-opacity-20 rounded-full h-2">
            <div className="bg-white bg-opacity-60 h-2 rounded-full" style={{ width: `${totalVendors > 0 ? (preferredVendors / totalVendors * 100) : 0}%` }}></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 shadow-lg transform hover:scale-105 transition-all duration-300 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <ChevronUp className="w-6 h-6" />
            </div>
            <div className="text-right">
              <h3 className="text-3xl font-bold">₹{totalSpend.toFixed(2)}</h3>
              <p className="text-orange-100 font-medium">Total Spend</p>
            </div>
          </div>
          <div className="w-full bg-white bg-opacity-20 rounded-full h-2">
            <div className="bg-white bg-opacity-60 h-2 rounded-full" style={{ width: '92%' }}></div>
          </div>
        </div>
      </div>

      {/* Search and Actions Section */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
        {/* Tabs */}
        <div className="flex items-center gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("vendors")}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === "vendors"
                ? "text-green-600 border-b-2 border-green-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Vendors
          </button>
          <button
            onClick={() => setActiveTab("purchase-orders")}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === "purchase-orders"
                ? "text-purple-600 border-b-2 border-purple-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Purchase Requests
          </button>
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search vendors by name, email, company, or type..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setPurchaseOrderModal(true)}
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-8 py-4 rounded-xl flex items-center gap-3 font-semibold shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              <ShoppingCart className="w-5 h-5" /> Purchase Request
            </button>
            <button
              onClick={() => setOrderModal(true)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-4 rounded-xl flex items-center gap-3 font-semibold shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              <ShoppingCart className="w-5 h-5" /> Place Request
            </button>
            <button
              onClick={() => {
                setEditingVendor(null);
                setAddModal(true);
              }}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-8 py-4 rounded-xl flex items-center gap-3 font-semibold shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              <Plus className="w-5 h-5" /> Add New Vendor
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Showing {filteredVendors.length} of {totalVendors} vendors</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2 text-green-600">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                Active: {activeVendors}
              </span>
              <span className="flex items-center gap-2 text-purple-600">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                Preferred: {preferredVendors}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Vendors Table */}
      {activeTab === "vendors" && (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Vendor</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Type</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Total Spend</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Orders</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Joined</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                      <p className="text-gray-500 font-medium">Loading vendors...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <User2 className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">No vendors found</p>
                      <p className="text-gray-400 text-sm">Try adjusting your search criteria</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-green-50 transition-all duration-200">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        #{vendor.id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <img
                            src={vendor.avatar_url || "/default-avatar.png"}
                            alt={vendor.name}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-200"
                          />
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${vendor.status === 'active' ? 'bg-green-500' :
                            vendor.status === 'inactive' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}></div>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{vendor.name}</div>
                          <div className="text-sm text-gray-500">{vendor.email}</div>
                          {vendor.company && <div className="text-xs text-gray-400">{vendor.company}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium capitalize ${vendor.vendor_type === 'preferred' ? 'bg-purple-100 text-purple-800' :
                        vendor.vendor_type === 'strategic' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                        {vendor.vendor_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium capitalize ${vendor.status === 'active' ? 'bg-green-100 text-green-800' :
                        vendor.status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                        {vendor.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">₹{vendor.total_spend?.toFixed(2) || "0.00"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{vendor.orders_count || 0}</span>
                        <span className="text-xs text-gray-500">orders</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {new Date(vendor.created_at || vendor.joined_at || vendor.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setDetailViewVendor(vendor)}
                          title="View Details"
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <User2 size={16} />
                        </button>
                        <button
                          onClick={() => handleViewVendorInvoice(vendor)}
                          title="View Invoice"
                          disabled={invoiceLoading === vendor.id}
                          className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {invoiceLoading === vendor.id ? (
                            <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                        <button
                          onClick={() => openEditModal(vendor)}
                          title="Edit Vendor"
                          className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteVendor(vendor.id)}
                          title="Delete Vendor"
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Purchase Requests Table */}
      {activeTab === "purchase-orders" && (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">PO Number</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Vendor</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Items</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Date</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {purchaseOrdersLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                      <p className="text-gray-500 font-medium">Loading purchase orders...</p>
                    </div>
                  </td>
                </tr>
              ) : purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <FileText className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">No purchase orders found</p>
                      <p className="text-gray-400 text-sm">Create your first purchase order to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                purchaseOrders.map((order) => (
                  <tr key={order.order_number || order.invoice_number} className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {order.order_number || order.invoice_number}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-gray-900">{order.vendor_name}</div>
                        <div className="text-sm text-gray-500">{order.vendor_company}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{order.items?.length || 0} items</div>
                      <div className="text-xs text-gray-500">
                        {order.items?.slice(0, 2).map(item => item.name).join(', ')}
                        {order.items?.length > 2 && '...'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {new Date(order.invoice_date || order.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setCurrentInvoice(order)}
                          title="View Details"
                          className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => generatePurchaseOrderPDF(order)}
                          title="Download PDF"
                          className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => deletePurchaseOrder(order.order_number || order.invoice_number)}
                          title="Delete"
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Add Vendor Modal */}
      <AddVendorModal
        open={addModal}
        onClose={() => setAddModal(false)}
        onAdd={handleAddVendor}
        loading={adding}
        vendors={vendors}
      />

      {/* Edit Vendor Modal */}
      {editModal && editingVendor && (
        <AddVendorModal
          open={editModal}
          onClose={() => {
            setEditModal(false);
            setEditingVendor(null);
          }}
          onAdd={handleEditVendor}
          loading={adding}
          vendors={vendors}
          editMode={true}
          existingVendor={editingVendor}
        />
      )}

      {detailViewVendor && (
        <VendorDetailCard
          vendor={detailViewVendor}
          onClose={() => setDetailViewVendor(null)}
        />
      )}

      <PurchaseOrderModal
        open={purchaseOrderModal}
        onClose={() => setPurchaseOrderModal(false)}
        vendors={vendors}
        onOrderPlaced={(invoice) => {
          setPurchaseOrderModal(false);
          setCurrentInvoice(invoice);
          fetchPurchaseOrders(); // Refresh purchase orders list
          setActiveTab("purchase-orders"); // Switch to purchase orders tab
        }}
      />

      <PlaceOrderModal
        open={orderModal}
        onClose={() => setOrderModal(false)}
        vendors={vendors}
        onOrderPlaced={(invoice) => {
          setOrderModal(false);
          setCurrentInvoice(invoice);
          fetchVendors();
        }}
      />

      {currentInvoice && (
        <InvoiceModal
          invoice={currentInvoice}
          onClose={() => setCurrentInvoice(null)}
        />
      )}
    </div>
  );
};

export default VendorProfile;
