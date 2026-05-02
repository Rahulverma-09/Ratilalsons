import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = "https://ratilalsons-backend-api.onrender.com/api/vendors";

const DOCUMENT_TYPES = [
  { key: "business_license", label: "Business License", required: true },
  { key: "tax_certificate", label: "Tax Certificate", required: true },
  { key: "id_proof", label: "Identity Proof", required: false },
  { key: "other", label: "Other Document", required: false },
];

export default function VendorDocuments() {
  const [documents, setDocuments] = useState({});
  const [uploadingDocKey, setUploadingDocKey] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch existing documents metadata on mount
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    fetch(`${API_BASE}/documents`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => setDocuments(data.documents || {}))
      .catch(() => setDocuments({}));
  }, []);

  const handleFileChange = async (e, docKey) => {
    setError("");
    setSuccessMessage("");
    const file = e.target.files[0];
    if (!file) return;

    // Validate file types if needed (example: allow pdf, jpg, png)
    const validTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!validTypes.includes(file.type)) {
      setError("File must be PDF, JPG, or PNG format.");
      return;
    }
    // Validate max size (e.g., 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File size should be less than 5 MB.");
      return;
    }

    setUploadingDocKey(docKey);
    setLoading(true);

    try {
      const token = localStorage.getItem("access_token");
      const formData = new FormData();
      formData.append("document_key", docKey);
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      // Update documents state with new file metadata (name, url, etc)
      const uploadedDoc = await res.json();
      setDocuments((docs) => ({ ...docs, [docKey]: uploadedDoc.document }));
      setSuccessMessage(`${DOCUMENT_TYPES.find(d => d.key === docKey).label} uploaded successfully.`);
    } catch (err) {
      setError(err.message);
    }

    setUploadingDocKey(null);
    setLoading(false);
  };

  const handleRemoveDocument = async (docKey) => {
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/documents/${docKey}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Delete failed");
      }
      setDocuments((docs) => {
        const newDocs = { ...docs };
        delete newDocs[docKey];
        return newDocs;
      });
      setSuccessMessage(`${DOCUMENT_TYPES.find(d => d.key === docKey).label} removed successfully.`);
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  return (
    <motion.div className="max-w-3xl mx-auto p-6 bg-white rounded-2xl shadow-lg mt-10">
      <h1 className="text-3xl font-extrabold text-green-700 mb-6">Vendor Documents</h1>
      <p className="mb-4 text-green-600">
        Upload the documents required for your vendor verification.
      </p>

      {error && <p className="text-red-600 mb-4 font-semibold">{error}</p>}
      {successMessage && <p className="text-green-600 mb-4 font-semibold">{successMessage}</p>}

      <div className="space-y-6">
        {DOCUMENT_TYPES.map(({ key, label, required }) => {
          const doc = documents[key];
          return (
            <div key={key} className="border p-4 rounded-lg shadow-sm flex items-center justify-between">
              <div>
                <p className="font-semibold text-green-800">
                  {label} {required && <span className="text-red-500">*</span>}
                </p>
                {doc ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-700 underline truncate max-w-xs block mt-1"
                    title={doc.name}
                  >
                    {doc.name}
                  </a>
                ) : (
                  <p className="text-green-500 italic mt-1">No document uploaded</p>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <label
                  htmlFor={`file-upload-${key}`}
                  className="cursor-pointer rounded bg-gradient-to-r from-green-600 to-green-400 hover:from-green-700 hover:to-green-500 text-white px-4 py-2 text-sm font-semibold shadow"
                >
                  {doc ? "Replace" : "Upload"}
                  <input
                    type="file"
                    id={`file-upload-${key}`}
                    className="hidden"
                    onChange={(e) => handleFileChange(e, key)}
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={loading && uploadingDocKey === key}
                  />
                </label>
                {doc && (
                  <button
                    onClick={() => handleRemoveDocument(key)}
                    disabled={loading}
                    className="text-red-600 font-semibold hover:text-red-800"
                    title="Remove document"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
