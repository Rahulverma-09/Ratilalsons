
import React, { useState } from "react";
import { AUTH_API } from "../config";

export default function LoginForm({ onLogin, onShowRegister }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [successModal, setSuccessModal] = useState(false);
  const [waitingForRedirect, setWaitingForRedirect] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append("username", form.username);
      formData.append("password", form.password);
      formData.append("grant_type", "password");
      formData.append("scope", "");
      formData.append("client_id", "");
      formData.append("client_secret", "");


      const res = await fetch(AUTH_API.LOGIN, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Invalid username or password");
      }

      const data = await res.json();

      // Save tokens
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("token_type", data.token_type);
      localStorage.setItem("user", JSON.stringify(data.user));

      window.dispatchEvent(new Event('login'));
      // ===========================

      // Show success modal, don't call onLogin yet!
      setSuccessModal(true);
      setWaitingForRedirect(true);

      // Wait 1 sec, then call onLogin (which will redirect)
      setTimeout(() => {
        setSuccessModal(false);
        setWaitingForRedirect(false);
        setIsLoading(false);
        if (onLogin) onLogin(data.user);
      }, 1000);

    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  // Just in case user closes modal early, also redirect
  const handleSuccessClose = () => {
    setSuccessModal(false);
    setWaitingForRedirect(false);
    setIsLoading(false);
    if (onLogin) onLogin(form.username);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-200">
      <div className="w-full max-w-md mx-auto bg-white shadow-2xl rounded-2xl p-8">
        <div className="flex flex-col items-center mb-6">
          <h2 className="text-2xl font-bold text-blue-800 mb-1">
            Welcome Back
          </h2>
          <p className="text-gray-500 text-sm">Sign in to your CRM account</p>
        </div>

        {error && (
          <div className="mb-4 text-red-600 text-sm text-center font-medium">
            {error}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              User Name
            </label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={form.username}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 pr-10 outline-none transition"
                placeholder="Enter your password"
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-2 top-2 text-gray-400 hover:text-blue-500"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7a9.77 9.77 0 014.5 1.125M19.07 13.34A9.993 9.993 0 0021 12c0-3-4-7-9-7a9.77 9.77 0 00-4.5 1.125M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg shadow-md transition flex items-center justify-center"
            disabled={isLoading || waitingForRedirect}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>
        {/* <div className="mt-6 text-center">
          <span className="text-gray-500 text-sm">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              className="text-blue-700 font-semibold hover:underline"
              onClick={onShowRegister}
              disabled={waitingForRedirect}
            >
              Register
            </button>
          </span>
        </div> */}
      </div>

      {/* Success Modal */}
      {successModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-xs w-[92vw] flex flex-col items-center relative animate-popIn">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl"
              onClick={handleSuccessClose}
              aria-label="Close success modal"
              style={{ lineHeight: 1 }}
            >
              &times;
            </button>
            <svg
              className="w-16 h-16 text-green-400 mb-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M9 12l2 2l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <h3 className="text-xl font-bold text-green-700 mb-2 text-center">Login Successful!</h3>
            <p className="text-gray-600 text-center mb-1">
              Welcome back. You have successfully logged in.
            </p>
          </div>
          <style>{`
            .animate-popIn {
              animation: popIn 0.45s cubic-bezier(.22,1.25,.36,1) both;
            }
            @keyframes popIn {
              0% { opacity: 0; transform: scale(0.85) translateY(60px);}
              80% { opacity: 1; transform: scale(1.08) translateY(-8px);}
              100% { opacity: 1; transform: scale(1) translateY(0);}
            }
          `}</style>
        </div>
      )}
    </div>
  );
}