import React from 'react';

const StatusBadge = ({ status }) => {
  const normalized = (status || '').toLowerCase();
  
  return (
    <span className={`status-badge ${normalized}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
