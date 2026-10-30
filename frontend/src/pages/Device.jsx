import React, { useState, useEffect } from 'react';
import { Cpu, Battery, Wifi, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

const Device = () => {
  const [deviceData, setDeviceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDeviceStatus();
  }, []);

  const fetchDeviceStatus = async (selectedId = null) => {
    setLoading(true);
    setError('');
    try {
      const url = selectedId ? `/devices/status/?device_id=${selectedId}` : '/devices/status/';
      const response = await api.get(url);
      if (response.data.success) {
        setDeviceData(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch device status:', err);
      setError('Could not fetch hardware device status.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>Loading Device Status...</p>;
  }

  const device = deviceData?.device;
  const availableDevices = deviceData?.available_devices || [];
  const compartments = deviceData?.compartments || [];
  const recentEvents = deviceData?.recent_events || [];

  return (
    <div>
      {error && (
        <div className="card" style={{ backgroundColor: '#ffe4e6', color: '#be123c', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Primary Device Overview Card */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.6rem', borderRadius: '0.6rem', backgroundColor: '#ccfbf1', color: '#0d9488' }}>
              <Cpu size={24} />
            </div>
            <div>
              <h2 className="card-title">{device?.device_name || 'Medicine Dispenser'}</h2>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Device ID: <strong>{device?.device_id || 'N/A'}</strong></p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {availableDevices.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Active Device:</span>
                <select
                  className="form-control"
                  style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                  value={device?.device_id || ''}
                  onChange={(e) => fetchDeviceStatus(e.target.value)}
                >
                  {availableDevices.map((d) => (
                    <option key={d.device_id} value={d.device_id}>
                      {d.device_id} ({d.is_simulated ? 'Simulated' : 'Physical'})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <StatusBadge status={device?.status || 'OFFLINE'} />
          </div>
        </div>

        <div className="grid-stats" style={{ marginBottom: 0 }}>
          <div className="stat-card" style={{ backgroundColor: '#f8fafc' }}>
            <div className="stat-icon green">
              <Battery size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{device?.battery_level ?? 100}%</span>
              <span className="stat-label">Battery Level</span>
            </div>
          </div>

          <div className="stat-card" style={{ backgroundColor: '#f8fafc' }}>
            <div className="stat-icon blue">
              <Wifi size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{device?.wifi_status || 'Connected'}</span>
              <span className="stat-label">Wi-Fi Connection</span>
            </div>
          </div>

          <div className="stat-card" style={{ backgroundColor: '#f8fafc' }}>
            <div className="stat-icon teal">
              <Activity size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">v{device?.firmware_version || '1.0.0'}</span>
              <span className="stat-label">Firmware Version</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
          <span>Last Heartbeat: <strong>{device?.last_seen ? new Date(device.last_seen).toLocaleString() : 'Just now'}</strong></span>
          <span>Hardware Type: <strong>{device?.is_simulated ? 'Simulated ESP32 Microcontroller' : 'Physical ESP32 Microcontroller'}</strong></span>
        </div>
      </div>

      {/* Compartments Status Grid */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Device Compartments Status</h3>
        </div>

        <div className="compartments-grid">
          {compartments.map((comp) => (
            <div key={comp.compartment_number} className="compartment-card active">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="compartment-badge">{comp.compartment_number}</div>
                <StatusBadge status={comp.status} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.5rem' }}>
                  Compartment {comp.compartment_number}
                </h4>
                <p style={{ fontSize: '0.85rem', color: comp.assigned_medicine ? '#0d9488' : '#64748b' }}>
                  {comp.assigned_medicine ? comp.assigned_medicine : 'Empty'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Device Events Log */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Hardware Signal Log</h3>
          <button className="btn btn-outline btn-sm" onClick={fetchDeviceStatus}>
            Refresh
          </button>
        </div>

        {recentEvents.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem' }}>No recent hardware events recorded.</p>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event Type</th>
                  <th>Compartment</th>
                  <th>Payload Data</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td>{new Date(ev.timestamp).toLocaleString()}</td>
                    <td>
                      <StatusBadge status={ev.event_type} />
                    </td>
                    <td>Compartment {ev.compartment_number}</td>
                    <td>
                      <code style={{ fontSize: '0.8rem', backgroundColor: '#f1f5f9', padding: '0.2rem 0.4rem', borderRadius: '0.25rem' }}>
                        {JSON.stringify(ev.raw_payload || {})}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Device;
