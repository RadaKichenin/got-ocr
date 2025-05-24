import React, { useState, useCallback } from 'react';
import PageThumbnails from './components/PageThumbnails';
import ImageViewer from './components/ImageViewer';
import ResultsPanel from './components/ResultsPanel';
import LoadingSpinner from './components/LoadingSpinner';
// Import analyzeDocument and getImageUrl
import { getImageUrl, analyzeDocument } from './services/api'; // Removed unused uploadFile import here
import './App.css';

function App() {
  const [docInfo, setDocInfo] = useState(null); // Stores { doc_id, page_count }
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Global loading state
  // State to store results from full document analysis (GOT-OCR layout attempt)
  const [documentAnalysisResults, setDocumentAnalysisResults] = useState(null);

  // --- Callbacks ---
  const handleUploadSuccess = useCallback((data) => {
    console.log("App: Upload successful:", data);
    setDocInfo(data);
    setCurrentPage(0);
    setSelectedCoords(null);
    setErrorMessage('');
    setDocumentAnalysisResults(null);
    setIsLoading(false); // Ensure loading stops (triggered via setIsLoading prop)
  }, []); // Empty dependency array: this function reference is stable

  const handleError = useCallback((message) => {
    console.error("App: Error received:", message);
    setErrorMessage(`Operation failed: ${message}`);
    setIsLoading(false);
  }, []);

  const handlePageSelect = useCallback((pageIndex) => {
    console.log("App: Page selected:", pageIndex);
    setCurrentPage(pageIndex);
    setSelectedCoords(null);
  }, []);

  const handleAreaSelect = useCallback((coordsString) => {
    console.log("App: Area selected:", coordsString);
    setSelectedCoords(coordsString);
  }, []);

  // Handler for Analyze Entire Document Button
  const handleAnalyzeDocumentClick = useCallback(async () => {
    if (!docInfo?.doc_id) {
      setErrorMessage("Please upload a document first.");
      return;
    }
    setErrorMessage('');
    setIsLoading(true);
    setDocumentAnalysisResults(null);
    console.log(`App: Analyzing entire document layout: ${docInfo.doc_id}`);

    try {
      const result = await analyzeDocument(docInfo.doc_id);
      console.log("App: Document analysis result:", result);
      setDocumentAnalysisResults(result);
      if (result.errors && Object.keys(result.errors).length > 0) {
           const errorPages = Object.keys(result.errors).map(p => parseInt(p)+1).join(', ');
           setErrorMessage(`Document layout analysis complete with errors on pages: ${errorPages}.`);
      } else {
           setErrorMessage("Document layout analysis complete.");
           setTimeout(()=> setErrorMessage(''), 4000);
      }
    } catch (error) {
      handleError(error.message || "Failed to analyze document layout.");
      setDocumentAnalysisResults(null);
    } finally {
      setIsLoading(false);
    }
  }, [docInfo, handleError]);


  // Construct image URL for the current page
  const currentImageUrl = getImageUrl(docInfo?.doc_id, currentPage);

  return (
    <div className="App">
      {isLoading && <LoadingSpinner message="Processing..." />}

      <header className="App-header">
        <h1>Document OCR & Extraction Tool</h1>
        {docInfo && docInfo.page_count > 0 && (
            <button
                onClick={handleAnalyzeDocumentClick}
                disabled={isLoading}
                className="analyze-doc-button"
            >
                Analyze Entire Document Layout (GOT-OCR)
            </button>
        )}
      </header>

      <main className="main-content">
        {errorMessage && <p className="error-banner">{errorMessage}</p>}
        <div className="app-layout">
          <PageThumbnails
            docId={docInfo?.doc_id}
            // Pass page count correctly
            pageCount={docInfo?.page_count || 0}
            currentPage={currentPage}
            onPageSelect={handlePageSelect}
            // Pass callbacks needed by FileUploadArea
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
            // Pass the full document analysis results down
            fullDocumentResults={documentAnalysisResults}
          />
        </div>
      </main>
    </div>
  );
}

export default App;