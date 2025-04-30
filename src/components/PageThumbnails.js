import React from 'react';
import { getImageUrl } from '../services/api';
import FileUploadArea from './FileUploadArea'; // Import the new component
import './PageThumbnails.css'; // Assuming you might want specific styles

// Props expected:
// - docId: String | null
// - pageImageUrls: Array<string>
// - currentPage: number
// - onPageSelect: Function(index)
// - onUploadSuccess: Function(resultData) -> Called by FileUploadArea
// - onError: Function(errorMessage) -> Called by FileUploadArea
// - setIsLoading: Function(boolean) -> Called by FileUploadArea to control global spinner
const PageThumbnails = ({
  docId,
  pageImageUrls = [], // Default to empty array
  currentPage,
  onPageSelect,
  onUploadSuccess,
  onError,
  setIsLoading
}) => {

  return (
    <div className="thumbnails-panel">
      {/* --- File Upload Area --- */}
      <FileUploadArea
        onUploadSuccess={onUploadSuccess}
        onError={onError}
        setIsLoading={setIsLoading}
      />
      {/* --- End File Upload Area --- */}

      {/* --- Thumbnails Section --- */}
      {pageImageUrls && pageImageUrls.length > 0 ? (
        <>
          <h4 className="thumbnails-header">Pages ({pageImageUrls.length})</h4>
          <ul className="thumbnails-list">
            {pageImageUrls.map((urlPath, index) => (
              <li
                key={`${docId || 'doc'}-${index}`} // Add prefix if docId exists
                className={`thumbnail-item ${index === currentPage ? 'active' : ''}`}
                onClick={() => onPageSelect(index)}
                title={`View Page ${index + 1}`} // Tooltip for accessibility
              >
                <img
                  className="thumbnail-image"
                  src={getImageUrl(urlPath)} // Use helper for full URL
                  alt={`Thumbnail of Page ${index + 1}`}
                  loading="lazy" // Improve performance for many pages
                />
                <span className="thumbnail-label">Page {index + 1}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
          // Message shown when no document is loaded yet
          <p className="no-document-message">
              Upload a document to see pages.
          </p>
       )}
    </div>
  );
};

export default PageThumbnails;