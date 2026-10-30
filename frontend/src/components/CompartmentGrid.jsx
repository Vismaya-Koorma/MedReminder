import React from 'react';
import { Box, Check, Info } from 'lucide-react';
import StatusBadge from './StatusBadge';

const CompartmentGrid = ({ compartments = [], medicines = [], onAssignMedicine }) => {
  // Ensure we display 4 compartments
  const compartmentNumbers = [1, 2, 3, 4];
  const compMap = {};
  compartments.forEach(c => {
    compMap[c.compartment_number] = c;
  });

  return (
    <div className="compartments-grid">
      {compartmentNumbers.map((num) => {
        const comp = compMap[num];
        const assignedMed = comp?.assigned_medicine_detail || 
                            medicines.find(m => m.id === comp?.assigned_medicine);

        return (
          <div key={num} className={`compartment-card ${comp?.assigned_medicine ? 'active' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="compartment-badge">{num}</div>
              <StatusBadge status={comp?.status || 'EMPTY'} />
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginTop: '0.5rem' }}>
                Compartment {num}
              </h4>
              <p style={{ fontSize: '0.85rem', color: assignedMed ? '#0d9488' : '#64748b', fontWeight: 600 }}>
                {assignedMed ? assignedMed.name : 'Unassigned'}
              </p>
              {assignedMed && (
                <p style={{ fontSize: '0.775rem', color: '#94a3b8' }}>
                  {assignedMed.dosage} • {assignedMed.medicine_type}
                </p>
              )}
            </div>

            {onAssignMedicine && (
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                <select
                  className="form-control"
                  style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                  value={comp?.assigned_medicine || ''}
                  onChange={(e) => onAssignMedicine(comp?.id || num, e.target.value ? parseInt(e.target.value) : null, num)}
                >
                  <option value="">-- Assign Medicine --</option>
                  {medicines.length === 0 && (
                    <option value="" disabled>No medicines added yet</option>
                  )}
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.dosage})
                    </option>
                  ))}
                </select>
                {medicines.length === 0 && (
                  <p style={{ fontSize: '0.725rem', color: '#94a3b8', marginTop: '0.35rem', marginBottom: 0 }}>
                    Add medicines in directory below to assign.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CompartmentGrid;
