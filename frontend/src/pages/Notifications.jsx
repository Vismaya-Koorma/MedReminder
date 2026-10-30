import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Check, AlertCircle, Info, Calendar } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/notifications/');
      if (response.data.success) {
        setNotifications(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to retrieve notifications list.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      // Backend uses PATCH /api/notifications/<id>/read/
      const response = await api.patch(`/notifications/${id}/read/`);
      if (response.data.success) {
        setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
        setSuccessMsg('Notification marked as read.');
      }
    } catch (err) {
      console.error('Mark read error:', err);
      setError('Failed to mark notification as read.');
    }
  };

  const handleMarkAllRead = async () => {
    const unreadList = notifications.filter(n => !n.is_read);
    if (unreadList.length === 0) return;

    try {
      await Promise.all(
        unreadList.map(n => api.patch(`/notifications/${n.id}/read/`))
      );
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setSuccessMsg('All notifications marked as read.');
    } catch (err) {
      console.error('Mark all read error:', err);
      setError('Failed to mark all notifications as read.');
    }
  };

  return (
    <div>
      {error && (
        <div className="card" style={{ backgroundColor: '#ffe4e6', color: '#be123c', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {successMsg && (
        <div className="card" style={{ backgroundColor: '#dcfce7', color: '#15803d', marginBottom: '1rem' }}>
          {successMsg}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={22} color="#0d9488" />
            <h2 className="card-title">System & Reminder Notifications</h2>
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleMarkAllRead}>
            <CheckCheck size={16} />
            <span>Mark All as Read</span>
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
            <Bell size={40} style={{ marginBottom: '0.5rem', color: '#cbd5e1' }} />
            <p style={{ fontWeight: 600 }}>No notifications yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {notifications.map((notif) => (
              <div
                key={notif.id}
                style={{
                  padding: '1rem 1.25rem',
                  borderRadius: '0.65rem',
                  border: '1px solid #e2e8f0',
                  backgroundColor: notif.is_read ? '#ffffff' : '#f0fdf4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                  <div
                    style={{
                      padding: '0.5rem',
                      borderRadius: '50%',
                      backgroundColor: notif.is_read ? '#f1f5f9' : '#ccfbf1',
                      color: notif.is_read ? '#94a3b8' : '#0d9488',
                      marginTop: '0.1rem'
                    }}
                  >
                    <Info size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{notif.title}</h4>
                      <StatusBadge status={notif.type || 'SYSTEM'} />
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#475569', marginTop: '0.2rem' }}>{notif.message}</p>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem', display: 'inline-block' }}>
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {!notif.is_read && (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleMarkAsRead(notif.id)}
                    title="Mark as Read"
                  >
                    <Check size={14} />
                    <span>Read</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
