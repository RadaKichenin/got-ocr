import React, { useState, useRef, useCallback } from 'react';
import { uploadFile } from '../services/api';
import './FileUploadArea.css'; // We'll create this CSS file

// Props expected:
// - onUploadSuccess: Callback function when upload & processing is successful (receives { doc_id, ... })
// - onError: Callback function for reporting errors (receives error message string)
// - setIsLoading: Function to update the global loading state in App.js
const FileUploadArea = ({ onUploadSuccess, onError, setIsLoading }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [localLoadingMessage, setLocalLoadingMessage] = useState('');
  const fileInputRef = useRef(null);

  // --- Core File Processing Logic ---
  const handleFileProcessing = useCallback(async (file) => {
    if (!file) {
      onError("No valid file provided.");
      return;
    }

    // Basic file type check (can be enhanced)
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
        onError(`Unsupported file type: ${file.type}. Please upload PDF or common image formats.`);
        return;
    }

    setIsLoading(true); // Set global loading state
    setLocalLoadingMessage(`Processing ${file.name}...`); // Show message in the box

    try {
      const result = await uploadFile(file);
      onUploadSuccess(result); // Pass result up to App
    } catch (error) {
      onError(error.message || "An unknown error occurred during upload.");
    } finally {
      setIsLoading(false); // Clear global loading state
      setLocalLoadingMessage(''); // Clear local message
      // Reset file input value to allow uploading the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onUploadSuccess, onError, setIsLoading]); // useCallback dependencies

  // --- Event Handlers ---
  const handleClick = () => {
    // Trigger click on the hidden file input
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    // Handle file selection from the input
    const file = event.target.files?.[0];
    if (file) {
      handleFileProcessing(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault(); // Necessary to allow dropping
    event.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);

    const file = event.dataTransfer.files?.[0]; // Get the first dropped file
    if (file) {
      handleFileProcessing(file);
    } else {
      onError("Could not read dropped file.");
    }
  };

  // --- Render ---
  const dropZoneClass = `file-upload-area ${isDraggingOver ? 'drag-over' : ''}`;

  return (
    <div
      className={dropZoneClass}
      onClick={handleClick} // Allow clicking anywhere in the div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp"
        style={{ display: 'none' }} // Keep it hidden
        multiple={false} // Only allow one file
      />

      {/* Conditional Content: Loading or Prompt */}
      {localLoadingMessage ? (
        <div className="upload-loading">
          <div className="mini-spinner"></div>
          <span>{localLoadingMessage}</span>
        </div>
      ) : (
        <p>Click or Drag & Drop<br />(PDF/Image)</p>
      )}
    </div>
  );
};

export default FileUploadArea;