import React, { useState, useEffect } from 'react';
import { History as HistoryIcon, Filter, TrendingUp } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

const History = () => {
  const [historyLogs, setHistoryLogs] = useState([]);
  const [adherence, setAdherence] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMedicine, setSelectedMedicine] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCompartment, setSelectedCompartment] = useState('');

  useEffect(() => {
    fetchHistoryAndAdherence();
  }, []);

  const fetchHistoryAndAdherence = async () => {
    setLoading(true);
    setError('');
    try {
      // Build query params
      const params = new URLSearchParams();
      if (selectedDate) params.append('date', selectedDate);
      if (selectedMedicine) params.append('medicine_id', selectedMedicine);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedCompartment) params.append('compartment', selectedCompartment);

      const [histRes, adhRes, medRes] = await Promise.all([
        api.get(`/monitoring/history/?${params.toString()}`),
        api.get('/monitoring/adherence/'),
        api.get('/medicines/')
      ]);

      if (histRes.data.success) {
        setHistoryLogs(histRes.data.data);
      }
      if (adhRes.data.success) {
        setAdherence(adhRes.data.data);
      }
      setMedicines(Array.isArray(medRes.data) ? medRes.data : medRes.data.results || []);
    } catch (err) {
      console.error('Error fetching history logs:', err);
      setError('Failed to retrieve history logs and adherence rate.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = (e) => {
    e.preventDefault();
    fetchHistoryAndAdherence();
  };

  const handleResetFilter = () => {
    setSelectedDate('');
    setSelectedMedicine('');
    setSelectedStatus('');
    setSelectedCompartment('');
    // Trigger fetch with empty params
    setTimeout(fetchHistoryAndAdherence, 100);
  };

  return (
    <div>
      {error && (
        <div className="card" style={{ backgroundColor: '#ffe4e6', color: '#be123c', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Adherence Card */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Overall Medication Adherence
            </span>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>
              {adherence?.adherence_percentage ?? 100}%
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
              Based on {adherence?.total_doses ?? 0} total scheduled doses ({adherence?.taken_count ?? 0} taken, {adherence?.missed_count ?? 0} missed)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '0.85rem 1.25rem', borderRadius: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#4ade80' }}>{adherence?.taken_count ?? 0}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Taken</div>
            </div>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '0.85rem 1.25rem', borderRadius: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f87171' }}>{adherence?.missed_count ?? 0}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Missed</div>
            </div>
            <div style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '0.85rem 1.25rem', borderRadius: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>{adherence?.pending_count ?? 0}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Pending</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Filter size={18} color="#0d9488" />
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Filter History Logs</h3>
        </div>

        <form onSubmit={handleApplyFilter} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-control"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Medicine</label>
            <select
              className="form-control"
              value={selectedMedicine}
              onChange={(e) => setSelectedMedicine(e.target.value)}
            >
              <option value="">All Medicines</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Status</label>
            <select
              className="form-control"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="TAKEN">TAKEN</option>
              <option value="MISSED">MISSED</option>
              <option value="DUE">DUE</option>
              <option value="UPCOMING">UPCOMING</option>
              <option value="SKIPPED">SKIPPED</option>
            </select>
          </div>

          <div>
            <label className="form-label">Compartment</label>
            <select
              className="form-control"
              value={selectedCompartment}
              onChange={(e) => setSelectedCompartment(e.target.value)}
            >
              <option value="">All Compartments</option>
              <option value="1">Compartment 1</option>
              <option value="2">Compartment 2</option>
              <option value="3">Compartment 3</option>
              <option value="4">Compartment 4</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              Apply
            </button>
            <button type="button" className="btn btn-outline" onClick={handleResetFilter}>
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* History Log Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Medication Execution Log</h2>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>Loading log history...</p>
        ) : historyLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
            <HistoryIcon size={40} style={{ marginBottom: '0.5rem', color: '#cbd5e1' }} />
            <p style={{ fontWeight: 600 }}>No history logs found for selected criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Medicine</th>
                  <th>Dosage</th>
                  <th>Compartment</th>
                  <th>Status</th>
                  <th>Taken Time</th>
                </tr>
              </thead>
              <tbody>
                {historyLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      {new Date(log.scheduled_time).toLocaleDateString()} {' '}
                      <span style={{ color: '#64748b' }}>
                        {new Date(log.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{log.medicine_detail?.name || log.medicine_name || `Medicine #${log.medicine}`}</strong>
                    </td>
                    <td>{log.dosage || '-'}</td>
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
                        ? `${new Date(log.taken_time).toLocaleDateString()} ${new Date(log.taken_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : '-'}
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

export default History;
