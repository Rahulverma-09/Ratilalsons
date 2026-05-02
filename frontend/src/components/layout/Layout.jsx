import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';

const Layout = ({ logout }) => { // <-- Accept logout as a prop
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [currentUser, setCurrentUser] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userId, setUserId] = useState("");

  // Detect screen width and manage sidebar
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        const storedState = localStorage.getItem('sidebarOpen');
        setSidebarOpen(storedState === 'true' || storedState === null);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user.username || user.name || "");
        setUserRole(user.role || user.roles?.[0] || "");
        setUserId(user.user_id || user.id || "");
      } catch (e) {
        console.error("Invalid user object in localStorage");
      }
    }
  }, []);

  // Save sidebar state only (don't touch user here)
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem('sidebarOpen', sidebarOpen);
    }
  }, [sidebarOpen, isMobile]);

  const toggleSidebar = (value) => {
    setSidebarOpen(typeof value === 'boolean' ? value : !sidebarOpen);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 text-gray-900">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} isMobile={isMobile} />

      {/* Main content area - adjusts width based on sidebar state */}
      <div 
        className={`flex flex-col h-screen overflow-hidden transition-all duration-300 ease-in-out ${
          isMobile 
            ? 'flex-1' // On mobile, always full width
            : sidebarOpen 
              ? 'flex-1' // On desktop with sidebar open, use remaining space
              : 'flex-1' // On desktop with sidebar closed, use remaining space
        }`}
      >
        <TopHeader
          toggleSidebar={toggleSidebar}
          currentDateTime={new Date().toLocaleString()}
          currentUser={currentUser}
          logout={logout}
        />

        <main 
          className={`flex-1 overflow-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 transition-all duration-300 ease-in-out ${
            isMobile ? 'w-full' : 'w-full max-w-none'
          }`}
        >
          <div className={`${isMobile ? 'max-w-full' : 'max-w-screen-xl'} mx-auto w-full`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;