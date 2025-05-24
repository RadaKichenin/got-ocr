import React, { useState } from 'react';
import { uploadFile } from '../services/api';
import LoadingSpinner from './LoadingSpinner'; // Import spinner

const UploadForm = ({ onUploadSuccess, onError }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      onError("Please select a file first.");
      return;
    }

    setIsLoading(true);
    setLoadingMessage("Uploading and processing file..."); // Set message

    try {
      const result = await uploadFile(selectedFile);
      onUploadSuccess(result); // Pass { doc_id, page_count, page_image_urls } up
    } catch (error) {
      onError(error.message || "An unknown error occurred during upload.");
    } finally {
      setIsLoading(false);
      setLoadingMessage(''); // Clear message
      setSelectedFile(null); // Clear selection after attempt
      event.target.reset(); // Reset the form input visually
    }
  };

  return (
    <>
      {isLoading && <LoadingSpinner message={loadingMessage} />}
      <form onSubmit={handleSubmit} className="upload-form">
        <h3>Upload Document (PDF/Image)</h3>
        <input type="file" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp" />
        <button type="submit" disabled={!selectedFile || isLoading}>Upload and Process</button>
      </form>
    </>
  );
};

export default UploadForm;