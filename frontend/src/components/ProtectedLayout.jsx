import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const pageTitles = {
  '/': 'Dashboard',
  '/medicines': 'Medicine Management',
  '/schedules': 'Medicine Schedules',
  '/history': 'Medicine Log & Adherence History',
  '/device': 'IoT Device Status',
  '/simulator': 'Simulated ESP32 Developer Control Panel',
  '/notifications': 'Notifications',
  '/profile': 'User Profile',
};

const ProtectedLayout = () => {
  const { token, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b', fontWeight: 600 }}>Loading MedReminder...</p>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const title = pageTitles[location.pathname] || 'MedReminder';

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-wrapper">
        <Topbar title={title} />
        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ProtectedLayout;
