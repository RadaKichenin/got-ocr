// src/App.js
import React, { useState, useCallback } from 'react';
import PageThumbnails from './components/PageThumbnails';
import ImageViewer from './components/ImageViewer';
import ResultsPanel from './components/ResultsPanel';
import LoadingSpinner from './components/LoadingSpinner';
import { getImageUrl, analyzeDocument } from './services/api'; // Import analyzeDocument
import './App.css';

function App() {
  const [docInfo, setDocInfo] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Generic loading state
  const [documentAnalysisResults, setDocumentAnalysisResults] = useState(null); // State for full doc results

  // --- Callbacks ---
  const handleUploadSuccess = useCallback((data) => {
    console.log("App: Upload successful:", data);
    setDocInfo(data);
    setCurrentPage(0);
    setSelectedCoords(null);
    setErrorMessage('');
    setDocumentAnalysisResults(null); // Clear previous doc analysis on new upload
    setIsLoading(false); // Ensure loading stops
  }, []);

  const handleError = useCallback((message) => {
    console.error("App: Error received:", message);
    setErrorMessage(message);
    setIsLoading(false); // Ensure loading stops on error too
  }, []);

  const handlePageSelect = useCallback((pageIndex) => {
    console.log("App: Page selected:", pageIndex);
    setCurrentPage(pageIndex);
    setSelectedCoords(null);
  }, []);

  const handleAreaSelect = useCallback((coordsString) => {
    setSelectedCoords(coordsString);
  }, []);

  // --- NEW: Handler for Analyze Document Button ---
  const handleAnalyzeDocumentClick = useCallback(async () => {
    if (!docInfo?.doc_id) {
      setErrorMessage("Please upload a document first.");
      return;
    }
    setErrorMessage('');
    setIsLoading(true); // Use global loading state
    setDocumentAnalysisResults(null); // Clear previous results
    console.log(`App: Analyzing entire document: ${docInfo.doc_id}`);

    try {
      const result = await analyzeDocument(docInfo.doc_id);
      console.log("App: Document analysis result:", result);
      setDocumentAnalysisResults(result); // Store { page_results: {...}, errors: {...} }
      // Maybe show a success message or specific errors?
      if (result.errors && Object.keys(result.errors).length > 0) {
           setErrorMessage(`Document analysis complete with errors on pages: ${Object.keys(result.errors).join(', ')}`);
      } else {
           // Optional: Brief success notification
           // setErrorMessage("Document analysis complete.");
           // setTimeout(()=> setErrorMessage(''), 3000); // Clear after 3s
      }
    } catch (error) {
      handleError(error.message || "Failed to analyze document."); // Use central error handler
      setDocumentAnalysisResults(null);
    } finally {
      setIsLoading(false);
    }
  }, [docInfo, handleError]); // Dependencies


  const currentImageUrl = docInfo?.page_image_urls?.[currentPage]
    ? getImageUrl(docInfo.page_image_urls[currentPage])
    : null;

  return (
    <div className="App">
      {/* Update loading message based on state */}
      {isLoading && <LoadingSpinner message="Processing..." />}

      <header className="App-header">
        <h1>Document OCR & Extraction Tool</h1>
        {/* Add Analyze Document Button */}
        {docInfo && (
            <button
                onClick={handleAnalyzeDocumentClick}
                disabled={isLoading}
                className="analyze-doc-button" // Add class for styling
            >
                Analyze Entire Document
            </button>
        )}
      </header>

      <main className="main-content">
        {errorMessage && <p className="error-banner">Error: {errorMessage}</p>}
        <div className="app-layout">
          <PageThumbnails
            docId={docInfo?.doc_id}
            pageImageUrls={docInfo?.page_image_urls || []}
            currentPage={currentPage}
            onPageSelect={handlePageSelect}
            onUploadSuccess={handleUploadSuccess}
            onError={handleError}
            setIsLoading={setIsLoading}
          />
          <ImageViewer
            imageUrl={currentImageUrl}
            onAreaSelect={handleAreaSelect}
          />
          <ResultsPanel
            docId={docInfo?.doc_id}
            currentPageNum={currentPage}
            selectedAreaCoords={selectedCoords}
            // Pass full document analysis results down if needed by ResultsPanel
             fullDocumentResults={documentAnalysisResults}
          />
        </div>
      </main>
    </div>
  );
}

export default App;