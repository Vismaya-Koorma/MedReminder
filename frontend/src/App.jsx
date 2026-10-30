import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedLayout from './components/ProtectedLayout';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Medicines from './pages/Medicines';
import Schedules from './pages/Schedules';
import History from './pages/History';
import Device from './pages/Device';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Simulator from './pages/Simulator';

import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/medicines" element={<Medicines />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/history" element={<History />} />
            <Route path="/device" element={<Device />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/simulator" element={<Simulator />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
