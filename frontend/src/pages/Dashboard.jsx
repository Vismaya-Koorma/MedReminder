import React, { useState, useEffect } from 'react';
import { Pill, CalendarClock, CheckCircle2, AlertCircle, TrendingUp, Cpu, BellRing } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import WeeklyAdherenceChart from '../components/WeeklyAdherenceChart';

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [weeklyAdherence, setWeeklyAdherence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
    // Periodically poll dashboard data every 3 seconds so sensor hand detections
    // automatically dismiss the warning banner and update button states in real-time
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkTaken = async (log, markAllDue = false) => {
    try {
      setActionLoading(true);
      const devId = summary?.device?.device_id || 'MED-001';
      // Optimistically update todaySchedule so UI warning and buttons clear instantly
      setTodaySchedule(prev => prev.map(item => {
        if (markAllDue) {
          return (item.compartment_number === log.compartment_number && item.status === 'DUE')
            ? { ...item, status: 'TAKEN', taken_time: new Date().toISOString() }
            : item;
        } else {
          return item.id === log.id
            ? { ...item, status: 'TAKEN', taken_time: new Date().toISOString() }
            : item;
        }
      }));

      await api.post('/devices/medicine-event/', {
        device_id: devId,
        compartment: log.compartment_number,
        event: 'MEDICINE_TAKEN',
        log_id: markAllDue ? null : log.id,
        mark_all_due: markAllDue
      });
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed to mark medicine as taken:', err);
      alert('Could not record medicine taken: ' + (err.response?.data?.message || err.message));
      await fetchDashboardData();
    } finally {
      setActionLoading(false);
    }
  };

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [summaryRes, todayRes] = await Promise.all([
        api.get('/dashboard/summary/'),
        api.get('/monitoring/today/')
      ]);

      if (summaryRes.data.success) {
        setSummary(summaryRes.data.data);
        if (summaryRes.data.data.weekly_adherence) {
          setWeeklyAdherence(summaryRes.data.data.weekly_adherence);
        }
      }
      if (todayRes.data.success) {
        setTodaySchedule(todayRes.data.data);
      }
    } catch (err) {
      if (!silent) {
        console.error('Failed to load dashboard data:', err);
        setError('Could not connect to backend service. Please ensure the server is running.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
        <p style={{ fontWeight: 600 }}>Loading Dashboard Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ backgroundColor: '#fff1f2', borderColor: '#fecdd3', color: '#be123c' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Connection Error</h3>
        <p>{error}</p>
        <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={fetchDashboardData}>
          Retry Connection
        </button>
      </div>
    );
  }

  const dueDose = todaySchedule.find(log => log.status === 'DUE');

  return (
    <div>
      {/* Active Medicine Reminder Due Banner with Turn Off LED button */}
      {dueDose && (
        <div
          className="card"
          style={{
            backgroundColor: '#fef2f2',
            border: '2px solid #ef4444',
            marginBottom: '1.5rem',
            padding: '1.25rem 1.5rem',
            borderRadius: '0.75rem',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: '50%',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <BellRing size={28} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.25rem',
                      letterSpacing: '0.05em'
                    }}
                  >
                    REMINDER DUE NOW
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#991b1b', fontWeight: 600 }}>
                    Compartment {dueDose.compartment_number} • GPIO 19 LED Blinking
                  </span>
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#7f1d1d', margin: '0.35rem 0 0.15rem 0' }}>
                  Time to take: {dueDose.medicine_name || dueDose.medicine_detail?.name || 'Medicine'} ({dueDose.dosage || dueDose.medicine_detail?.dosage || 'Dose'})
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#991b1b', margin: 0 }}>
                  Take your medication from Dispenser Compartment {dueDose.compartment_number}. Click the button to confirm medicine taken and turn OFF the LED.
                </p>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{
                backgroundColor: '#10b981',
                borderColor: '#10b981',
                padding: '0.75rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderRadius: '0.5rem',
                boxShadow: '0 4px 10px rgba(16, 185, 129, 0.35)',
                cursor: 'pointer'
              }}
              onClick={() => handleMarkTaken(dueDose, true)}
              disabled={actionLoading}
            >
              <CheckCircle2 size={20} />
              <span>Medicine Taken — Turn Off LED</span>
            </button>
          </div>
        </div>
      )}

      {/* Stats Summary Grid */}
      <div className="grid-stats">
        <div className="stat-card">
          <div className="stat-icon teal">
            <Pill size={26} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{summary?.total_medicines ?? 0}</span>
            <span className="stat-label">Total Medicines</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <CalendarClock size={26} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{summary?.today_doses_count ?? 0}</span>
            <span className="stat-label">Doses Scheduled Today</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle2 size={26} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{summary?.taken_count ?? 0}</span>
            <span className="stat-label">Doses Taken Today</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <AlertCircle size={26} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{summary?.missed_count ?? 0}</span>
            <span className="stat-label">Doses Missed Today</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">
            <TrendingUp size={26} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{summary?.adherence_percentage ?? 100}%</span>
            <span className="stat-label">Adherence Rate</span>
          </div>
        </div>
      </div>

      {/* Today's Schedule Card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Today's Medicine Schedule</h2>
          <button className="btn btn-outline btn-sm" onClick={fetchDashboardData}>
            Refresh
          </button>
        </div>

        {todaySchedule.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
            <p style={{ fontWeight: 500 }}>No medicine doses scheduled for today.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Dosage</th>
                  <th>Scheduled Time</th>
                  <th>Compartment</th>
                  <th>Status</th>
                  <th>Taken Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {todaySchedule.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <strong style={{ color: '#0f172a' }}>
                        {log.medicine_name || log.medicine_detail?.name || (log.medicine ? `Medicine #${log.medicine}` : 'Unknown Medicine')}
                      </strong>
                    </td>
                    <td>{log.dosage || log.medicine_detail?.dosage || 'N/A'}</td>
                    <td>{new Date(log.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <span className="status-badge online" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                        Compartment {log.compartment_number}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={log.status} />
                    </td>
                    <td>
                      {log.taken_time
                        ? new Date(log.taken_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '-'}
                    </td>
                    <td>
                      {log.status === 'DUE' ? (
                        <button
                          className="btn btn-sm btn-primary"
                          style={{
                            backgroundColor: '#10b981',
                            borderColor: '#10b981',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.825rem',
                            fontWeight: 600
                          }}
                          onClick={() => handleMarkTaken(log)}
                          disabled={actionLoading}
                          title="Mark medicine as taken and turn off dispenser reminder LED"
                        >
                          <CheckCircle2 size={15} />
                          <span>Taken (Turn Off LED)</span>
                        </button>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Weekly Medication Adherence Section */}
      <WeeklyAdherenceChart data={weeklyAdherence || summary?.weekly_adherence} loading={loading} />

      {/* Device Quick Banner */}
      <div className="card" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Cpu size={24} color="#16a34a" />
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#166534' }}>Connected Hardware Device</h4>
              <p style={{ fontSize: '0.825rem', color: '#15803d' }}>
                {summary?.device ? `${summary.device.device_name} (${summary.device.device_id}) is ${summary.device.status}` : 'No active device connected.'}
              </p>
            </div>
          </div>
          <StatusBadge status={summary?.device?.status || 'OFFLINE'} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
