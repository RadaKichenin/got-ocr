import React from 'react';
import { getImageUrl } from '../services/api'; // getImageUrl now needs docId, pageNum
import FileUploadArea from './FileUploadArea';
import './PageThumbnails.css'; // Make sure this file exists or remove import

const PageThumbnails = ({
  docId,
  pageCount = 0, // Use pageCount instead of pageImageUrls
  currentPage,
  onPageSelect,
  onUploadSuccess,
  onError,
  setIsLoading
}) => {

  return (
    <div className="thumbnails-panel">
      <FileUploadArea
        onUploadSuccess={onUploadSuccess}
        onError={onError}
        setIsLoading={setIsLoading}
      />

      {pageCount > 0 ? (
        <>
          <h4 className="thumbnails-header">Pages ({pageCount})</h4>
          <ul className="thumbnails-list">
            {/* Generate list based on pageCount */}
            {Array.from({ length: pageCount }, (_, index) => (
              <li
                key={`${docId || 'doc'}-${index}`}
                className={`thumbnail-item ${index === currentPage ? 'active' : ''}`}
                onClick={() => onPageSelect(index)}
                title={`View Page ${index + 1}`}
              >
                <img
                  className="thumbnail-image"
                   // Call getImageUrl with docId and page index
                  src={getImageUrl(docId, index)}
                  alt={`Thumbnail of Page ${index + 1}`}
                  loading="lazy"
                />
                <span className="thumbnail-label">Page {index + 1}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
          <p className="no-document-message">
              Upload a document to see pages.
          </p>
       )}
    </div>
  );
};

export default PageThumbnails;