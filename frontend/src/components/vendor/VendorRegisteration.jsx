import { useState } from "react";
import { motion } from "framer-motion";

const API_REGISTER_VENDOR = "http://localhost:8000/api/vendors/register";

export default function VendorRegister() {
  const [form, setForm] = useState({
    companyName: "",
    gstNumber: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "",
    taxId: "",
    password: "",
    confirmPassword: "",
    businessLicenseFile: null,
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, files, type } = e.target;
    if (type === "file") {
      setForm((f) => ({ ...f, [name]: files[0] }));
      if (name === "gstNumber") {
        setForm((f) => ({ ...f, [name]: value.toUpperCase() }));
      } else {
        setForm((f) => ({ ...f, [name]: value }));
      }
    }
  };

  const validateGST = (gst) =>
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/i.test(gst);

  const validateEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validatePhone = (phone) =>
    /^\+?[0-9\s\-().]{7,25}$/.test(phone);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.companyName.trim()) {
      setError("Company name is required.");
      return;
    }
    if (!form.gstNumber.trim()) {
      setError("GST Number is required.");
      return;
    }
    if (!validateGST(form.gstNumber)) {
      setError("Please enter a valid 15-character GST Number.");
      return;
    }
    if (!form.contactPerson.trim()) {
      setError("Contact person is required.");
      return;
    }
    if (!validateEmail(form.email)) {
      setError("Valid email is required.");
      return;
    }
    if (!validatePhone(form.phone)) {
      setError("Valid phone number is required.");
      return;
    }
    if (!form.password || form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!form.businessLicenseFile) {
      setError("Business license file is required.");
      return;
    }

    setLoading(true);

    try {
      // Prepare form data for file upload
      const formData = new FormData();
      formData.append("companyName", form.companyName);
      formData.append("registration_number", form.gstNumber); // Maintain backend field for compatibility temporarily or update both
      formData.append("contactPerson", form.contactPerson);
      formData.append("email", form.email);
      formData.append("phone", form.phone);
      formData.append("address", form.address);
      formData.append("city", form.city);
      formData.append("state", form.state);
      formData.append("zip", form.zip);
      formData.append("country", form.country);
      formData.append("taxId", form.taxId);
      formData.append("password", form.password);
      formData.append("businessLicense", form.businessLicenseFile);

      const response = await fetch(API_REGISTER_VENDOR, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Registration failed");
      }

      setSuccess("Registration successful! Please check your email for verification.");
      setForm({
        companyName: "",
        gstNumber: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        zip: "",
        country: "",
        taxId: "",
        password: "",
        confirmPassword: "",
        businessLicenseFile: null,
      });
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  return (
    <motion.div
      className="max-w-xl mx-auto p-6 bg-white rounded-2xl shadow-lg mt-12"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 110, damping: 20 }}
    >
      <h1 className="text-3xl font-extrabold text-green-700 mb-6">Vendor Registration</h1>
      <p className="mb-6 text-green-600">Register your business to become a legal vendor.</p>

      {error && <p className="mb-4 text-red-600 font-semibold">{error}</p>}
      {success && <p className="mb-4 text-green-600 font-semibold">{success}</p>}

      <form onSubmit={handleSubmit} className="space-y-4" encType="multipart/form-data" noValidate>
        <div>
          <label className="block font-medium mb-1">Company Name <span className="text-red-500">*</span></label>
          <input
            name="companyName"
            type="text"
            value={form.companyName}
            onChange={handleChange}
            className="input-field"
            placeholder="Company Name"
            required
          />
        </div>

        <div>
          <label className="block font-medium mb-1">GST Number <span className="text-red-500">*</span></label>
          <input
            name="gstNumber"
            type="text"
            value={form.gstNumber}
            onChange={handleChange}
            className="input-field uppercase"
            placeholder="15-character GST Number"
            maxLength={15}
            required
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Contact Person <span className="text-red-500">*</span></label>
          <input
            name="contactPerson"
            type="text"
            value={form.contactPerson}
            onChange={handleChange}
            className="input-field"
            placeholder="Full Name"
            required
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Email <span className="text-red-500">*</span></label>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            className="input-field"
            placeholder="example@company.com"
            required
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Phone <span className="text-red-500">*</span></label>
          <input
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            className="input-field"
            placeholder="+1234567890"
            required
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Address</label>
          <input
            name="address"
            type="text"
            value={form.address}
            onChange={handleChange}
            className="input-field"
            placeholder="Street Address"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">City</label>
            <input
              name="city"
              type="text"
              value={form.city}
              onChange={handleChange}
              className="input-field"
              placeholder="City"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">State/Province</label>
            <input
              name="state"
              type="text"
              value={form.state}
              onChange={handleChange}
              className="input-field"
              placeholder="State/Province"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">ZIP/Postal Code</label>
            <input
              name="zip"
              type="text"
              value={form.zip}
              onChange={handleChange}
              className="input-field"
              placeholder="ZIP/Postal Code"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Country</label>
            <input
              name="country"
              type="text"
              value={form.country}
              onChange={handleChange}
              className="input-field"
              placeholder="Country"
            />
          </div>
        </div>

        <div>
          <label className="block font-medium mb-1">Tax ID (optional)</label>
          <input
            name="taxId"
            type="text"
            value={form.taxId}
            onChange={handleChange}
            className="input-field"
            placeholder="Tax Identification Number"
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Business License <span className="text-red-500">*</span></label>
          <input
            name="businessLicenseFile"
            type="file"
            accept=".pdf,.jpg,.png"
            onChange={handleChange}
            className="input-field file-input"
            required
          />
          <p className="text-xs text-gray-600 mt-1">Upload your official business license document (PDF, JPG, PNG)</p>
        </div>

        <div>
          <label className="block font-medium mb-1">Password <span className="text-red-500">*</span></label>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            className="input-field"
            placeholder="Create password"
            required
            minLength={6}
          />
        </div>

        <div>
          <label className="block font-medium mb-1">Confirm Password <span className="text-red-500">*</span></label>
          <input
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            className="input-field"
            placeholder="Confirm password"
            required
            minLength={6}
          />
        </div>

        <motion.button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-green-600 to-green-400 text-white font-semibold rounded-lg py-3 mt-4 hover:from-green-700 hover:to-green-500 shadow-lg"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {loading ? "Registering..." : "Register Vendor"}
        </motion.button>
      </form>
    </motion.div>
  );
}
