import React, { useState } from 'react';
import { ocrArea, exportText } from '../services/api';
import LoadingSpinner from './LoadingSpinner'; // Import spinner

const ResultsPanel = ({ docId, currentPageNum, selectedAreaCoords }) => {
  const [ocrResult, setOcrResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExtractClick = async () => {
    if (!docId || currentPageNum === null || !selectedAreaCoords) {
      setError("Please upload a document, select a page, and select an area first.");
      return;
    }
    setError('');
    setIsLoading(true);
    setOcrResult('');

    try {
      const result = await ocrArea(docId, currentPageNum, selectedAreaCoords);
      setOcrResult(result.extracted_text);
    } catch (err) {
      setError(err.message || "Failed to extract text.");
      setOcrResult('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportClick = async () => {
      if (!ocrResult) {
          setError("No text to export.");
          return;
      }
      setError('');
      setIsLoading(true); // Show loading during file prep/download trigger
      try {
          const filename = `doc_${docId}_page_${currentPageNum}_export.txt`;
          await exportText(ocrResult, filename);
      } catch (err) {
          setError(err.message || "Failed to export text.");
      } finally {
          setIsLoading(false);
      }
  };


  return (
    <div className="results-panel">
       {isLoading && <LoadingSpinner message="Extracting text..." />}
      <h4>Results / Actions</h4>

      {/* --- Manual Area Extraction Section --- */}
      <div className="action-section">
        <h5>Manual Area Extraction</h5>
        {selectedAreaCoords ? (
          <p>Area Selected: <code style={{fontSize:'0.9em', wordBreak:'break-all'}}>{selectedAreaCoords}</code></p>
        ) : (
          <p><i>Select an area on the page image by clicking two points.</i></p>
        )}
        <button
          onClick={handleExtractClick}
          disabled={!selectedAreaCoords || isLoading}
          >
          Extract Text from Selected Area
        </button>
      </div>

      {error && <p className="error-message">Error: {error}</p>}

      {ocrResult && (
        <div className="ocr-results">
          <h5>Extracted Text:</h5>
          <textarea readOnly value={ocrResult} rows={10}></textarea>
          <button onClick={handleExportClick} disabled={isLoading}>
              Export Text to File
          </button>
        </div>
      )}

       {/* --- Placeholder for Automatic Results --- */}
       {/* <div className="action-section">
            <h5>Automatic Page/Document Analysis (Future)</h5>
             <button disabled>Analyze Page Tables</button>
             <button disabled>Analyze Document Tables</button>
             Display detected tables here
             Add export buttons for Excel (single table / all validated)
       </div> */}

    </div>
  );
};

export default ResultsPanel;