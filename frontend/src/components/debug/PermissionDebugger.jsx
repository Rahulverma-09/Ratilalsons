import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

const PermissionDebugger = () => {
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUserPermissions();
  }, []);

  const checkUserPermissions = async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error("No authentication token found");
        return;
      }

      console.log('Checking user permissions...');
      
      // Try to fetch user info from the backend
      const response = await fetch('http://localhost:8000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserInfo(data);
        console.log('Current user info:', data);
      } else {
        const errorText = await response.text();
        console.error('Failed to get user info:', response.status, errorText);
        toast.error(`Failed to get user info: ${response.status}`);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      toast.error('Error checking permissions');
    } finally {
      setLoading(false);
    }
  };

  const testEmployeeCreation = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const testPayload = {
        email: `test-${Date.now()}@example.com`,
        full_name: "Test Employee",
        password: "testpass123",
        phone: "1234567890",
        position: "Employee",
        department: "Testing"
      };

      console.log('Testing employee creation with payload:', testPayload);

      const response = await fetch('http://localhost:8000/api/employees-auth/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      });

      const responseData = await response.json();
      
      if (response.ok) {
        toast.success('Test employee created successfully!');
        console.log('Test employee creation successful:', responseData);
      } else {
        toast.error(`Test failed: ${responseData.detail || responseData.message}`);
        console.error('Test employee creation failed:', responseData);
      }
    } catch (error) {
      console.error('Test error:', error);
      toast.error('Test error occurred');
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">Checking permissions...</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
      <h3 className="text-lg font-semibold text-blue-900 mb-3">Permission Debugger</h3>
      
      {userInfo ? (
        <div className="space-y-2 text-sm">
          <p><strong>User ID:</strong> {userInfo.user_id || userInfo.id}</p>
          <p><strong>Username:</strong> {userInfo.username}</p>
          <p><strong>Email:</strong> {userInfo.email}</p>
          <p><strong>Roles:</strong> {JSON.stringify(userInfo.roles)}</p>
          <p><strong>Role IDs:</strong> {JSON.stringify(userInfo.role_ids)}</p>
          {userInfo.token_data && (
            <p><strong>Token Roles:</strong> {JSON.stringify(userInfo.token_data.roles)}</p>
          )}
          
          <div className="mt-4">
            <button
              onClick={testEmployeeCreation}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Test Employee Creation
            </button>
          </div>
        </div>
      ) : (
        <p className="text-red-600">Failed to load user information</p>
      )}
      
      <div className="mt-4 text-xs text-gray-600">
        <p>This debugger helps identify permission issues. Remove this component in production.</p>
      </div>
    </div>
  );
};

export default PermissionDebugger;