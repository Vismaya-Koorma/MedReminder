import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Pill, Check, X, Box } from 'lucide-react';
import api from '../services/api';
import CompartmentGrid from '../components/CompartmentGrid';
import StatusBadge from '../components/StatusBadge';

const Medicines = () => {
  const [medicines, setMedicines] = useState([]);
  const [compartments, setCompartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    generic_name: '',
    medicine_type: 'TABLET',
    dosage: '',
    instructions: '',
    description: '',
    is_active: true
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMedicinesAndCompartments();
  }, []);

  const fetchMedicinesAndCompartments = async () => {
    setLoading(true);
    setError('');
    try {
      const [medRes, compRes] = await Promise.all([
        api.get('/medicines/'),
        api.get('/compartments/')
      ]);

      if (Array.isArray(medRes.data)) {
        setMedicines(medRes.data);
      } else if (medRes.data.results) {
        setMedicines(medRes.data.results);
      }

      if (Array.isArray(compRes.data)) {
        setCompartments(compRes.data);
      } else if (compRes.data.results) {
        setCompartments(compRes.data.results);
      }
    } catch (err) {
      console.error('Error fetching medicines:', err);
      setError('Failed to fetch medicines or compartment data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (med = null) => {
    if (med) {
      setEditingMed(med);
      setFormData({
        name: med.name || '',
        generic_name: med.generic_name || '',
        medicine_type: med.medicine_type || 'TABLET',
        dosage: med.dosage || '',
        instructions: med.instructions || '',
        description: med.description || '',
        is_active: med.is_active ?? true
      });
    } else {
      setEditingMed(null);
      setFormData({
        name: '',
        generic_name: '',
        medicine_type: 'TABLET',
        dosage: '',
        instructions: '',
        description: '',
        is_active: true
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingMed(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      if (editingMed) {
        await api.put(`/medicines/${editingMed.id}/`, formData);
        setSuccessMsg('Medicine updated successfully!');
      } else {
        await api.post('/medicines/', formData);
        setSuccessMsg('Medicine created successfully!');
      }
      handleCloseModal();
      fetchMedicinesAndCompartments();
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.response?.data?.message || 'Failed to save medicine');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this medicine?')) return;
    try {
      await api.delete(`/medicines/${id}/`);
      setSuccessMsg('Medicine deactivated successfully');
      fetchMedicinesAndCompartments();
    } catch (err) {
      console.error('Deactivation error:', err);
      setError('Failed to deactivate medicine');
    }
  };

  const handleAssignCompartment = async (compartmentIdOrNum, medicineId, compNum) => {
    try {
      // Find compartment instance or URL
      let targetComp = compartments.find(c => c.compartment_number === compNum || c.id === compartmentIdOrNum);
      if (targetComp) {
        await api.patch(`/compartments/${targetComp.id}/`, {
          assigned_medicine: medicineId,
          status: medicineId ? 'AVAILABLE' : 'EMPTY'
        });
      } else {
        await api.post('/compartments/', {
          compartment_number: compNum,
          assigned_medicine: medicineId,
          status: medicineId ? 'AVAILABLE' : 'EMPTY'
        });
      }
      setSuccessMsg(`Compartment ${compNum} assignment updated.`);
      fetchMedicinesAndCompartments();
    } catch (err) {
      console.error('Compartment update error:', err);
      setError('Failed to update compartment assignment');
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

      {/* Compartments Assignment Section */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Dispenser Compartment Manager</h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Assign medicines to physical compartments 1 - 4</p>
          </div>
        </div>
        <CompartmentGrid
          compartments={compartments}
          medicines={medicines}
          onAssignMedicine={handleAssignCompartment}
        />
      </div>

      {/* Medicines Management Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Medicines Directory</h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Manage your active medications</p>
          </div>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={18} />
            <span>Add Medicine</span>
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>Loading medicines...</p>
        ) : medicines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
            <Pill size={40} style={{ marginBottom: '0.5rem', color: '#cbd5e1' }} />
            <p style={{ fontWeight: 600 }}>No medicines added yet.</p>
            <p style={{ fontSize: '0.875rem' }}>Click "Add Medicine" to register your first medication.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Medicine Name</th>
                  <th>Generic Name</th>
                  <th>Type</th>
                  <th>Dosage</th>
                  <th>Instructions</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {medicines.map((med) => (
                  <tr key={med.id}>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{med.name}</strong>
                    </td>
                    <td>{med.generic_name || '-'}</td>
                    <td>
                      <span className="status-badge upcoming">{med.medicine_type}</span>
                    </td>
                    <td>{med.dosage}</td>
                    <td>{med.instructions || '-'}</td>
                    <td>
                      <StatusBadge status={med.is_active ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleOpenModal(med)}
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeactivate(med.id)}
                          title="Deactivate"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{editingMed ? 'Edit Medicine' : 'Add New Medicine'}</h3>
              <button onClick={handleCloseModal} style={{ background: 'none', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Medicine Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Paracetamol"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Generic Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Acetaminophen"
                  value={formData.generic_name}
                  onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Medicine Type</label>
                  <select
                    className="form-control"
                    value={formData.medicine_type}
                    onChange={(e) => setFormData({ ...formData, medicine_type: e.target.value })}
                  >
                    <option value="TABLET">Tablet</option>
                    <option value="CAPSULE">Capsule</option>
                    <option value="SYRUP">Syrup</option>
                    <option value="INJECTION">Injection</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Dosage *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 500mg"
                    value={formData.dosage}
                    onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Instructions</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Take after meals with water"
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Additional notes"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingMed ? 'Update Medicine' : 'Create Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Medicines;
