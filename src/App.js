import React, { useState } from 'react';
import UploadForm from './components/UploadForm';
import PageThumbnails from './components/PageThumbnails';
import ImageViewer from './components/ImageViewer';
import ResultsPanel from './components/ResultsPanel';
import { getImageUrl } from './services/api'; // Import the helper
import './App.css'; // Import main styles

function App() {
  const [docInfo, setDocInfo] = useState(null); // { doc_id, page_count, page_image_urls }
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedCoords, setSelectedCoords] = useState(null); // String like "[x1,y1,x2,y2]"
  const [errorMessage, setErrorMessage] = useState('');

  const handleUploadSuccess = (data) => {
    console.log("Upload successful:", data);
    setDocInfo(data);
    setCurrentPage(0); // Reset to first page
    setSelectedCoords(null); // Clear selection
    setErrorMessage(''); // Clear errors
  };

  const handlePageSelect = (pageIndex) => {
    setCurrentPage(pageIndex);
    setSelectedCoords(null); // Clear selection when changing page
    // Optionally clear results panel here too
  };

   const handleAreaSelect = (coordsString) => {
      setSelectedCoords(coordsString);
      // Don't trigger OCR automatically, let user click button in ResultsPanel
   };

  const handleError = (message) => {
    setErrorMessage(message);
    // Maybe clear docInfo if upload fails fundamentally?
    // setDocInfo(null);
  };

  const currentImageUrl = docInfo ? getImageUrl(docInfo.page_image_urls[currentPage]) : null;

  return (
    <div className="App">
      <header className="App-header">
        <h1>Document OCR & Extraction Tool</h1>
      </header>

      <div className="main-content">
        {errorMessage && <p className="error-banner">Error: {errorMessage}</p>}

        {!docInfo && (
          <UploadForm onUploadSuccess={handleUploadSuccess} onError={handleError} />
        )}

        {docInfo && (
          <div className="app-layout">
            <PageThumbnails
              docId={docInfo.doc_id}
              pageImageUrls={docInfo.page_image_urls}
              currentPage={currentPage}
              onPageSelect={handlePageSelect}
            />
            <ImageViewer
              imageUrl={currentImageUrl}
              onAreaSelect={handleAreaSelect}
            />
            <ResultsPanel
              docId={docInfo.doc_id}
              currentPageNum={currentPage}
              selectedAreaCoords={selectedCoords}
             />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;