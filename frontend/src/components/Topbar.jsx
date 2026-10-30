import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bell, LogOut } from 'lucide-react';
import api from '../services/api';

const Topbar = ({ title }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications/');
      if (response.data.success) {
        const unread = response.data.data.filter(n => !n.is_read).length;
        setUnreadCount(unread);
      }
    } catch (e) {
      console.error('Failed to fetch notifications count:', e);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <h1 className="page-title">{title}</h1>
      
      <div className="topbar-right">
        <button 
          className="notification-btn" 
          onClick={() => navigate('/notifications')}
          title="Notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="notification-badge">{unreadCount}</span>
          )}
        </button>

        <div className="user-profile-summary">
          <div className="avatar">
            {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="user-info">
            <span className="user-name">{user?.username || 'User'}</span>
            <span className="user-role">{user?.profile?.role || 'PATIENT'}</span>
          </div>
        </div>

        <button 
          className="btn btn-outline btn-sm" 
          onClick={handleLogout}
          title="Logout"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;
