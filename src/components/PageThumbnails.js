import React from 'react';
import { getImageUrl } from '../services/api';

const PageThumbnails = ({ docId, pageImageUrls, currentPage, onPageSelect }) => {
  if (!pageImageUrls || pageImageUrls.length === 0) {
    return <div className="thumbnails-panel">No document loaded.</div>;
  }

  return (
    <div className="thumbnails-panel">
      <h4>Pages ({pageImageUrls.length})</h4>
      <ul>
        {pageImageUrls.map((urlPath, index) => (
          <li
            key={index}
            className={index === currentPage ? 'active' : ''}
            onClick={() => onPageSelect(index)}
          >
            <img
              src={getImageUrl(urlPath)} // Use the helper to get full URL
              alt={`Page ${index + 1}`}
              />
            <span>Page {index + 1}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PageThumbnails;