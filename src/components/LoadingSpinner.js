import React from 'react';
import './LoadingSpinner.css'; // We'll create this CSS file

const LoadingSpinner = ({ message = "Loading..." }) => {
  return (
    <div className="spinner-overlay">
      <div className="spinner"></div>
      <p>{message}</p>
    </div>
  );
};

export default LoadingSpinner;