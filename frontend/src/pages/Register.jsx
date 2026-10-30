import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HeartPulse, Lock, User, Mail, Phone, Shield } from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'PATIENT',
    phone: '',
    emergency_contact: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(formData);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '2rem 1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '1rem', backgroundColor: '#ccfbf1', color: '#0d9488', marginBottom: '0.75rem' }}>
            <HeartPulse size={32} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>Create Account</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>Register for Medicine Reminder & Monitoring System</p>
        </div>

        {error && (
          <div style={{ backgroundColor: '#ffe4e6', color: '#be123c', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', marginBottom: '1.25rem', fontWeight: 500 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              name="username"
              className="form-control"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              name="email"
              className="form-control"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              name="password"
              className="form-control"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Account Role</label>
            <select
              name="role"
              className="form-control"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="PATIENT">Patient</option>
              <option value="CAREGIVER">Caregiver</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              type="text"
              name="phone"
              className="form-control"
              placeholder="Phone number"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Emergency Contact Phone</label>
            <input
              type="text"
              name="emergency_contact"
              className="form-control"
              placeholder="Emergency contact"
              value={formData.emergency_contact}
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
            disabled={submitting}
          >
            {submitting ? 'Creating Account...' : 'Register Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: '#64748b' }}>
          Already registered?{' '}
          <Link to="/login" style={{ color: '#0d9488', fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
