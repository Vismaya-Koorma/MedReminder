import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, CalendarClock, X, Check } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

const Schedules = () => {
  const [schedules, setSchedules] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [compartments, setCompartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [formData, setFormData] = useState({
    medicine: '',
    compartment: '',
    schedule_time: '08:00:00',
    frequency: 'DAILY',
    dosage: '',
    instructions: '',
    is_active: true
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSchedulesAndData();
  }, []);

  const fetchSchedulesAndData = async () => {
    setLoading(true);
    setError('');
    try {
      const [schedRes, medRes, compRes] = await Promise.all([
        api.get('/schedules/'),
        api.get('/medicines/'),
        api.get('/compartments/')
      ]);

      setSchedules(Array.isArray(schedRes.data) ? schedRes.data : schedRes.data.results || []);
      setMedicines(Array.isArray(medRes.data) ? medRes.data : medRes.data.results || []);
      setCompartments(Array.isArray(compRes.data) ? compRes.data : compRes.data.results || []);
    } catch (err) {
      console.error('Failed to load schedules data:', err);
      setError('Failed to fetch schedule configuration data.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (sched = null) => {
    if (sched) {
      setEditingSchedule(sched);
      setFormData({
        medicine: sched.medicine || '',
        compartment: sched.compartment || '',
        schedule_time: sched.schedule_time || '08:00:00',
        frequency: sched.frequency || 'DAILY',
        dosage: sched.dosage || '',
        instructions: sched.instructions || '',
        is_active: sched.is_active ?? true
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        medicine: medicines[0]?.id || '',
        compartment: compartments[0]?.id || '',
        schedule_time: '08:00:00',
        frequency: 'DAILY',
        dosage: medicines[0]?.dosage || '',
        instructions: medicines[0]?.instructions || '',
        is_active: true
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSchedule(null);
  };

  const handleMedicineChange = (e) => {
    const medId = parseInt(e.target.value);
    const selectedMed = medicines.find(m => m.id === medId);
    // Find assigned compartment for selected medicine if exists
    const assignedComp = compartments.find(c => c.assigned_medicine === medId);

    setFormData({
      ...formData,
      medicine: medId,
      compartment: assignedComp ? assignedComp.id : formData.compartment,
      dosage: selectedMed ? selectedMed.dosage : formData.dosage,
      instructions: selectedMed ? selectedMed.instructions : formData.instructions
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.medicine || !formData.compartment) {
      setError('Please select both a medicine and a compartment.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      let formattedTime = formData.schedule_time;
      if (formattedTime.length === 5) {
        formattedTime = `${formattedTime}:00`;
      }

      const payload = {
        ...formData,
        schedule_time: formattedTime
      };

      if (editingSchedule) {
        await api.put(`/schedules/${editingSchedule.id}/`, payload);
        setSuccessMsg('Schedule updated successfully');
      } else {
        await api.post('/schedules/', payload);
        setSuccessMsg('Schedule created successfully');
      }

      handleCloseModal();
      fetchSchedulesAndData();
    } catch (err) {
      console.error('Schedule submit error:', err);
      setError(err.response?.data?.message || JSON.stringify(err.response?.data) || 'Failed to save schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    try {
      await api.delete(`/schedules/${id}/`);
      setSuccessMsg('Schedule deleted successfully');
      fetchSchedulesAndData();
    } catch (err) {
      console.error('Schedule deletion error:', err);
      setError('Failed to delete schedule');
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
          <div>
            <h2 className="card-title">Medicine Dosage Schedules</h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Configure times and frequency for compartment dispensing</p>
          </div>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={18} />
            <span>Create Schedule</span>
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>Loading schedules...</p>
        ) : schedules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
            <CalendarClock size={40} style={{ marginBottom: '0.5rem', color: '#cbd5e1' }} />
            <p style={{ fontWeight: 600 }}>No schedules created yet.</p>
            <p style={{ fontSize: '0.875rem' }}>Create a schedule to enable automated reminders and today's dose tracking.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Compartment</th>
                  <th>Scheduled Time</th>
                  <th>Frequency</th>
                  <th>Dosage</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((sched) => {
                  const med = sched.medicine_detail || medicines.find(m => m.id === sched.medicine);
                  const comp = sched.compartment_detail || compartments.find(c => c.id === sched.compartment);

                  return (
                    <tr key={sched.id}>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{med?.name || `Medicine #${sched.medicine}`}</strong>
                      </td>
                      <td>
                        <span className="status-badge online" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                          Compartment {comp?.compartment_number || '-'}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: '#0d9488' }}>{sched.schedule_time}</strong>
                      </td>
                      <td>
                        <span className="status-badge upcoming">{sched.frequency}</span>
                      </td>
                      <td>{sched.dosage || med?.dosage || '-'}</td>
                      <td>
                        <StatusBadge status={sched.is_active ? 'ACTIVE' : 'INACTIVE'} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleOpenModal(sched)}
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(sched.id)}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}</h3>
              <button onClick={handleCloseModal} style={{ background: 'none', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Select Medicine *</label>
                  {medicines.length === 0 && (
                    <a href="/medicines" style={{ fontSize: '0.8rem', color: '#0d9488', fontWeight: 600 }}>
                      + Add Medicine first
                    </a>
                  )}
                </div>
                <select
                  className="form-control"
                  value={formData.medicine}
                  onChange={handleMedicineChange}
                  required
                >
                  <option value="">
                    {medicines.length === 0 ? '-- No medicines registered yet --' : '-- Choose Medicine --'}
                  </option>
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.dosage})
                    </option>
                  ))}
                </select>
                {medicines.length === 0 && (
                  <p style={{ fontSize: '0.775rem', color: '#b91c1c', marginTop: '0.35rem' }}>
                    No medicines found. Please add medication in the Medicines tab before creating a schedule.
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Compartment *</label>
                <select
                  className="form-control"
                  value={formData.compartment}
                  onChange={(e) => setFormData({ ...formData, compartment: parseInt(e.target.value) })}
                  required
                >
                  <option value="">-- Choose Compartment --</option>
                  {compartments.map((c) => (
                    <option key={c.id} value={c.id}>
                      Compartment {c.compartment_number} ({c.assigned_medicine_detail ? c.assigned_medicine_detail.name : 'Unassigned'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Schedule Time *</label>
                  <input
                    type="time"
                    className="form-control"
                    value={formData.schedule_time.substring(0, 5)}
                    onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Frequency *</label>
                  <select
                    className="form-control"
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  >
                    <option value="ONCE">ONCE</option>
                    <option value="DAILY">DAILY</option>
                    <option value="TWICE_DAILY">TWICE_DAILY</option>
                    <option value="THREE_TIMES_DAILY">THREE_TIMES_DAILY</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Dosage Instructions</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Take 1 tablet with water"
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedules;
