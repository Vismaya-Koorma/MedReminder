import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await api.get('/accounts/profile/');
      if (response.data.success) {
        setUser(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await api.post('/accounts/login/', { username, password });
      if (response.data.success) {
        const { token: authToken, user: userData } = response.data.data;
        localStorage.setItem('token', authToken);
        setToken(authToken);
        setUser(userData);
        return response.data;
      }
      throw new Error(response.data.message || 'Login failed');
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Login failed';
      throw new Error(message);
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post('/accounts/register/', userData);
      if (response.data.success) {
        const { token: authToken, user: registeredUser } = response.data.data;
        localStorage.setItem('token', authToken);
        setToken(authToken);
        setUser(registeredUser);
        return response.data;
      }
      throw new Error(response.data.message || 'Registration failed');
    } catch (error) {
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const firstKey = Object.keys(errors)[0];
        const firstVal = errors[firstKey];
        const detail = Array.isArray(firstVal) ? firstVal[0] : firstVal;
        throw new Error(detail || error.response.data.message || 'Registration failed');
      }
      const message = error.response?.data?.message || error.message || 'Registration failed';
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      await api.post('/accounts/logout/');
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, fetchUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
