import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Phone, AlertCircle, HeartPulse } from 'lucide-react';
import api from '../services/api';

const Profile = () => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/accounts/profile/');
      if (response.data.success) {
        setProfileData(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to retrieve user profile details.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>Loading User Profile...</p>;
  }

  const user = profileData?.user || {};
  const profile = profileData?.profile || {};

  return (
    <div style={{ maxWidth: '720px' }}>
      {error && (
        <div className="card" style={{ backgroundColor: '#ffe4e6', color: '#be123c', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* User Header Profile Card */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '2rem' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: '#ccfbf1',
            color: '#0d9488',
            fontSize: '2rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '4px solid #ffffff',
            boxShadow: '0 4px 12px rgba(13, 148, 136, 0.2)'
          }}
        >
          {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
        </div>

        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{user.username}</h2>
          <span
            className="status-badge online"
            style={{ backgroundColor: '#ccfbf1', color: '#0f766e', marginTop: '0.35rem' }}
          >
            {profile.role || 'PATIENT'}
          </span>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.4rem' }}>
            Registered Account • Medicine Reminder & Monitoring System
          </p>
        </div>
      </div>

      {/* Detailed Info Card */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '1.5rem' }}>Account Information</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.6rem', borderRadius: '0.5rem', backgroundColor: '#f1f5f9', color: '#64748b' }}>
              <User size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.775rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Username</span>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>{user.username}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.6rem', borderRadius: '0.5rem', backgroundColor: '#f1f5f9', color: '#64748b' }}>
              <Mail size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.775rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Email Address</span>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>{user.email || 'Not provided'}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.6rem', borderRadius: '0.5rem', backgroundColor: '#f1f5f9', color: '#64748b' }}>
              <Shield size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.775rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Role</span>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>{profile.role || 'PATIENT'}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.6rem', borderRadius: '0.5rem', backgroundColor: '#f1f5f9', color: '#64748b' }}>
              <Phone size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.775rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Phone Number</span>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>{profile.phone || 'Not configured'}</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.6rem', borderRadius: '0.5rem', backgroundColor: '#ffe4e6', color: '#be123c' }}>
              <AlertCircle size={20} />
            </div>
            <div>
              <span style={{ fontSize: '0.775rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Emergency Contact</span>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#be123c' }}>{profile.emergency_contact || 'Not configured'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
