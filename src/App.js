import React, { useState, useCallback } from 'react';
import PageThumbnails from './components/PageThumbnails';
import ImageViewer from './components/ImageViewer';
import ResultsPanel from './components/ResultsPanel';
import LoadingSpinner from './components/LoadingSpinner'; // Keep for global loading state
import { getImageUrl } from './services/api';
import './App.css';

function App() {
  const [docInfo, setDocInfo] = useState(null); // Stores { doc_id, page_count, page_image_urls }
  const [currentPage, setCurrentPage] = useState(0); // Index of the currently viewed page
  const [selectedCoords, setSelectedCoords] = useState(null); // Holds "[x1,y1,x2,y2]" string or null
  const [errorMessage, setErrorMessage] = useState(''); // Stores error messages for display
  const [isUploading, setIsUploading] = useState(false); // Global loading state during upload/processing

  // --- Callbacks wrapped in useCallback for performance ---

  // Called by FileUploadArea (inside PageThumbnails) on successful processing
  const handleUploadSuccess = useCallback((data) => {
    console.log("App: Upload successful:", data);
    setDocInfo(data); // Update document info (triggers re-render)
    setCurrentPage(0); // Reset view to the first page
    setSelectedCoords(null); // Clear any previous selection coordinates
    setErrorMessage(''); // Clear any previous errors
    // isUploading state is managed within FileUploadArea before this callback
  }, []); // Empty dependency array: this function reference is stable

  // Called by FileUploadArea (inside PageThumbnails) or other components on error
  const handleError = useCallback((message) => {
    console.error("App: Error received:", message);
    setErrorMessage(message); // Display the error message
    // isUploading state is managed within FileUploadArea before this callback
  }, []);

  // Called by PageThumbnails when a thumbnail is clicked
  const handlePageSelect = useCallback((pageIndex) => {
    console.log("App: Page selected:", pageIndex);
    setCurrentPage(pageIndex); // Update the current page index
    setSelectedCoords(null); // Clear selection when changing page
    // Optionally clear results in ResultsPanel here if needed
  }, []);

  // Called by ImageViewer when a crop selection is completed or cleared
  const handleAreaSelect = useCallback((coordsString) => {
    console.log("App: Area selected:", coordsString);
    setSelectedCoords(coordsString); // Update the selected coordinates state
  }, []);

  // --- Derived State ---
  // Safely get the URL for the current page image
  const currentImageUrl = docInfo?.page_image_urls?.[currentPage]
    ? getImageUrl(docInfo.page_image_urls[currentPage])
    : null;

  // --- Render ---
  return (
    <div className="App">
      {/* Global Loading Spinner: Shows only when isUploading is true */}
      {isUploading && <LoadingSpinner message="Processing Document..." />}

      <header className="App-header">
        <h1>Document OCR & Extraction Tool</h1>
      </header>

      <main className="main-content">
        {/* Display Error Banner if there's an error message */}
        {errorMessage && <p className="error-banner">Error: {errorMessage}</p>}

        {/* Main Three-Panel Layout */}
        <div className="app-layout">
          {/* Left Panel: Thumbnails + Upload Area */}
          <PageThumbnails
            // Pass necessary state and callbacks down
            docId={docInfo?.doc_id}
            pageImageUrls={docInfo?.page_image_urls} // Pass safely, defaults to [] in child
            currentPage={currentPage}
            onPageSelect={handlePageSelect}
            onUploadSuccess={handleUploadSuccess}
            onError={handleError}
            setIsLoading={setIsUploading} // Allows FileUploadArea to control global spinner
          />

          {/* Center Panel: Image Viewer & Cropping */}
          <ImageViewer
            imageUrl={currentImageUrl} // Pass the calculated URL
            onAreaSelect={handleAreaSelect} // Callback for when area selection changes
          />

          {/* Right Panel: Results & Actions */}
          <ResultsPanel
            docId={docInfo?.doc_id} // Pass docId safely
            currentPageNum={currentPage} // Pass current page number
            selectedAreaCoords={selectedCoords} // Pass the selected coordinates string
            // Pass onError here too if ResultsPanel actions can cause errors
            // onError={handleError}
          />
        </div>
      </main>

      {/* Optional Footer */}
      {/* <footer className="App-footer">Footer Content</footer> */}
    </div>
  );
}

export default App;