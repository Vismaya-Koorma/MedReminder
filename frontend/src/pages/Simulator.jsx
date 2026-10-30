import React, { useState, useEffect } from 'react';
import { Tv, Radio, Send, Power, Terminal, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../services/api';

const Simulator = () => {
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('ESP32-Dispenser-01');
  const [isRegistered, setIsRegistered] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState('OFFLINE');
  const [batteryLevel, setBatteryLevel] = useState(95);
  const [wifiStatus, setWifiStatus] = useState('Connected');
  const [firmwareVersion, setFirmwareVersion] = useState('1.0.0');

  // Logs stream for Developer Console
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user already has registered device from backend
    checkExistingDevice();
  }, []);

  const addConsoleLog = (action, endpoint, payload, response, isSuccess, statusCode) => {
    const newLog = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleTimeString(),
      action,
      endpoint,
      payload,
      response,
      isSuccess,
      statusCode
    };
    setLogs(prev => [newLog, ...prev.slice(0, 49)]); // keep last 50 logs
  };

  const checkExistingDevice = async () => {
    try {
      const res = await api.get('/devices/');
      if (res.data.success && res.data.data && res.data.data.length > 0) {
        const dev = res.data.data[0];
        setDeviceId(dev.device_id);
        setDeviceName(dev.device_name);
        setDeviceStatus(dev.status);
        setBatteryLevel(dev.battery_level ?? 95);
        setWifiStatus(dev.wifi_status || 'Connected');
        setFirmwareVersion(dev.firmware_version || '1.0.0');
        setIsRegistered(true);
        addConsoleLog('FETCH_DEVICE', 'GET /api/devices/', null, res.data, true, 200);
      }
    } catch (e) {
      console.error('Failed to check existing device:', e);
    }
  };

  const handleRegisterDevice = async () => {
    const idToRegister = deviceId.trim() || `MED-ESP32-${Math.floor(1000 + Math.random() * 9000)}`;
    setLoading(true);
    const payload = {
      device_id: idToRegister,
      device_name: deviceName
    };

    try {
      const res = await api.post('/devices/register/', payload);
      if (res.data.success) {
        setDeviceId(idToRegister);
        setIsRegistered(true);
        setDeviceStatus('ONLINE');
        addConsoleLog('REGISTER_DEVICE', 'POST /api/devices/register/', payload, res.data, true, res.status);
      }
    } catch (err) {
      const errRes = err.response?.data || { message: err.message };
      const status = err.response?.status || 500;
      addConsoleLog('REGISTER_DEVICE', 'POST /api/devices/register/', payload, errRes, false, status);
    } finally {
      setLoading(false);
    }
  };

  const handleSendHeartbeat = async (forcedStatus = null) => {
    if (!deviceId) {
      alert('Please register or enter a Device ID first!');
      return;
    }

    setLoading(true);
    const payload = {
      device_id: deviceId,
      battery_level: batteryLevel,
      wifi_status: forcedStatus === 'OFFLINE' ? 'Disconnected' : wifiStatus,
      firmware_version: firmwareVersion
    };

    try {
      const res = await api.post('/devices/heartbeat/', payload);
      if (res.data.success) {
        setDeviceStatus(forcedStatus || 'ONLINE');
        addConsoleLog('HEARTBEAT', 'POST /api/devices/heartbeat/', payload, res.data, true, res.status);
      }
    } catch (err) {
      const errRes = err.response?.data || { message: err.message };
      const status = err.response?.status || 500;
      addConsoleLog('HEARTBEAT', 'POST /api/devices/heartbeat/', payload, errRes, false, status);
    } finally {
      setLoading(false);
    }
  };

  const handleMedicineEvent = async (compartmentNum, eventType) => {
    if (!deviceId) {
      alert('Please register a device before sending events!');
      return;
    }

    setLoading(true);
    const payload = {
      device_id: deviceId,
      compartment: compartmentNum,
      event: eventType // 'MEDICINE_TAKEN' or 'MEDICINE_NOT_TAKEN'
    };

    try {
      const res = await api.post('/devices/medicine-event/', payload);
      addConsoleLog(`MEDICINE_EVENT (${eventType})`, 'POST /api/devices/medicine-event/', payload, res.data, true, res.status);
    } catch (err) {
      const errRes = err.response?.data || { message: err.message };
      const status = err.response?.status || 500;
      addConsoleLog(`MEDICINE_EVENT (${eventType})`, 'POST /api/devices/medicine-event/', payload, errRes, false, status);
    } finally {
      setLoading(false);
    }
  };

  const handleCompartmentEvent = async (compartmentNum, eventType) => {
    if (!deviceId) {
      alert('Please register a device before sending events!');
      return;
    }

    setLoading(true);
    const payload = {
      device_id: deviceId,
      compartment: compartmentNum,
      event: eventType // 'COMPARTMENT_OPENED' or 'COMPARTMENT_CLOSED'
    };

    try {
      const res = await api.post('/devices/compartment-event/', payload);
      addConsoleLog(`COMPARTMENT_EVENT (${eventType})`, 'POST /api/devices/compartment-event/', payload, res.data, true, res.status);
    } catch (err) {
      const errRes = err.response?.data || { message: err.message };
      const status = err.response?.status || 500;
      addConsoleLog(`COMPARTMENT_EVENT (${eventType})`, 'POST /api/devices/compartment-event/', payload, errRes, false, status);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ padding: '0.6rem', borderRadius: '0.6rem', backgroundColor: '#38bdf8', color: '#0f172a' }}>
              <Tv size={26} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Simulated ESP32 Developer Control Panel</h2>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Simulate physical ESP32 hardware signals and verify real-time REST API integration with Django backend
              </p>
            </div>
          </div>
          <span
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 700,
              backgroundColor: isRegistered ? '#15803d' : '#475569',
              color: '#ffffff'
            }}
          >
            {isRegistered ? `REGISTERED: ${deviceId}` : 'UNREGISTERED SIMULATOR'}
          </span>
        </div>
      </div>

      {/* Device Registration & Global Status Controls */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '1rem' }}>Device Registration & Heartbeat Controls</h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label className="form-label">Device ID</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. MED-001"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Device Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="Device Name"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Battery Level (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              className="form-control"
              value={batteryLevel}
              onChange={(e) => setBatteryLevel(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={handleRegisterDevice}
            disabled={loading}
          >
            <Radio size={16} />
            <span>Register Simulated Device</span>
          </button>

          <button
            className="btn btn-outline"
            style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}
            onClick={() => handleSendHeartbeat('ONLINE')}
            disabled={loading}
          >
            <Power size={16} />
            <span>Device Online</span>
          </button>

          <button
            className="btn btn-outline"
            style={{ backgroundColor: '#fef2f2', borderColor: '#fecdd3', color: '#991b1b' }}
            onClick={() => handleSendHeartbeat('OFFLINE')}
            disabled={loading}
          >
            <Power size={16} />
            <span>Device Offline</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => handleSendHeartbeat()}
            disabled={loading}
          >
            <Send size={16} />
            <span>Send Heartbeat</span>
          </button>
        </div>
      </div>

      {/* Compartment Hardware Control Panel (Compartments 1 - 4) */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '1rem' }}>Compartment Hardware Action Controls</h3>

        <div className="compartments-grid">
          {[1, 2, 3, 4].map((num) => (
            <div key={num} className="compartment-card active" style={{ backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="compartment-badge">{num}</div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0d9488' }}>COMPARTMENT {num}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleCompartmentEvent(num, 'COMPARTMENT_OPENED')}
                    disabled={loading}
                  >
                    Open
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleCompartmentEvent(num, 'COMPARTMENT_CLOSED')}
                    disabled={loading}
                  >
                    Close
                  </button>
                </div>

                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%', backgroundColor: '#16a34a' }}
                  onClick={() => handleMedicineEvent(num, 'MEDICINE_TAKEN')}
                  disabled={loading}
                >
                  <CheckCircle2 size={14} />
                  <span>Medicine Taken</span>
                </button>

                <button
                  className="btn btn-danger btn-sm"
                  style={{ width: '100%' }}
                  onClick={() => handleMedicineEvent(num, 'MEDICINE_NOT_TAKEN')}
                  disabled={loading}
                >
                  <AlertCircle size={14} />
                  <span>Medicine Not Taken</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time Developer Console Output Stream */}
      <div className="card" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Terminal size={18} color="#38bdf8" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8' }}>ESP32 API Response Console</h3>
          </div>
          <button
            className="btn btn-outline btn-sm"
            style={{ color: '#94a3b8', borderColor: '#334155', padding: '0.2rem 0.5rem' }}
            onClick={() => setLogs([])}
          >
            Clear Log
          </button>
        </div>

        <div className="simulator-console">
          {logs.length === 0 ? (
            <p style={{ color: '#64748b' }}>Console initialized. Ready for hardware requests...</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} style={{ marginBottom: '0.75rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>[{log.timestamp}]</span>
                  <span style={{ fontWeight: 700, color: log.isSuccess ? '#4ade80' : '#f87171' }}>
                    {log.action} ({log.statusCode})
                  </span>
                  <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>{log.endpoint}</span>
                </div>

                {log.payload && (
                  <div style={{ color: '#94a3b8', fontSize: '0.775rem', marginTop: '0.2rem' }}>
                    Request Payload: {JSON.stringify(log.payload)}
                  </div>
                )}

                <div style={{ color: log.isSuccess ? '#38bdf8' : '#fda4af', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  Response: {JSON.stringify(log.response)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Simulator;
