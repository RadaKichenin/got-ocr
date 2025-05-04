import React, { useState, useEffect } from 'react';
// Import getPageText from api.js
import { ocrArea, exportText, analyzePage, getOcrText } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import './ResultsPanel.css'; // Make sure this file exists

const ResultsPanel = ({ docId, currentPageNum, selectedAreaCoords, fullDocumentResults }) => {
    const [manualOcrResult, setManualOcrResult] = useState('');
    const [isExtractingManual, setIsExtractingManual] = useState(false);
    const [analysisResultRaw, setAnalysisResultRaw] = useState(''); // For GOT-OCR analysis result
    const [isAnalyzingPage, setIsAnalyzingPage] = useState(false);
    // --- NEW State for OCR Layer Text ---
    const [ocrLayerText, setOcrLayerText] = useState('');
    const [isLoadingOcrLayer, setIsLoadingOcrLayer] = useState(false);
    // --- END NEW State ---
    const [error, setError] = useState('');

    // Effect 1: Clear local results when page/doc changes
    useEffect(() => {
        console.log(`ResultsPanel: Page/Doc changed (Page: ${currentPageNum}, DocId: ${docId}), clearing results.`);
        setManualOcrResult('');
        setOcrLayerText(''); // Clear OCR layer text too
        setError('');
        setIsExtractingManual(false);
        setIsAnalyzingPage(false);
        setIsLoadingOcrLayer(false); // Clear loading state
        // Clear analysis display if full doc results aren't available for the new context
        if (!fullDocumentResults?.page_results?.hasOwnProperty(currentPageNum?.toString())) {
             setAnalysisResultRaw('');
        }
    }, [currentPageNum, docId, fullDocumentResults]);

    // Effect 2: Update displayed analysis text from full results
    useEffect(() => {
        console.log(`ResultsPanel Effect 2 Triggered: fullDocRes changed or page=${currentPageNum}`);
        if (fullDocumentResults?.page_results) {
            const pageKey = currentPageNum?.toString();
            if (pageKey !== undefined && fullDocumentResults.page_results.hasOwnProperty(pageKey)) {
                console.log(`ResultsPanel Effect 2: Loading analysis result for page ${pageKey} from full doc.`);
                setAnalysisResultRaw(fullDocumentResults.page_results[pageKey] || '');
                 // Clear error ONLY if it was related to previous page's full analysis?
                 // if (!fullDocumentResults.errors || !fullDocumentResults.errors[pageKey]) setError('');
            } else {
                if (!isAnalyzingPage) { // Don't clear if single page analysis is running
                    console.log(`ResultsPanel Effect 2: No pre-analyzed result for page key "${pageKey}". Clearing display.`);
                    setAnalysisResultRaw('');
                }
            }
        }
    }, [fullDocumentResults, currentPageNum, isAnalyzingPage]); // Added isAnalyzingPage


    // --- Action Handlers ---
    const handleExtractManualClick = async () => {
        if (!docId || currentPageNum === null || !selectedAreaCoords) { setError("Please upload doc, select page, and select area."); return; }
        setError(''); setManualOcrResult(''); setIsExtractingManual(true);
        try {
            const result = await ocrArea(docId, currentPageNum, selectedAreaCoords);
            setManualOcrResult(result.extracted_text);
        } catch (err) { setError(err.message || "Failed to extract text from area."); setManualOcrResult(''); }
        finally { setIsExtractingManual(false); }
    };

    const handleExportManualClick = async () => {
        if (!manualOcrResult) { setError("No manual text to export."); return; }
        setIsExtractingManual(true); setError('');
        try {
            const filename = `doc_${docId || 'unknown'}_page_${currentPageNum}_manual_export.txt`;
            await exportText(manualOcrResult, filename);
        } catch (err) { setError(err.message || "Failed to export text."); }
        finally { setIsExtractingManual(false); }
    };

    // Handler for "Analyze Page Content" button (Single Page GOT-OCR Analysis)
    const handleAnalyzePageClick = async () => {
        if (!docId || currentPageNum === null) { setError("Please upload a document and select a page first."); return; }
        setError('');
        setAnalysisResultRaw(''); // Clear previous specific result
        setOcrLayerText(''); // Also clear OCR layer text when doing new analysis
        setIsAnalyzingPage(true);
        console.log(`ResultsPanel: Calling analyzePage (single GOT-OCR) for Doc: ${docId}, Page: ${currentPageNum}`);
        try {
            const result = await analyzePage(docId, currentPageNum);
            setAnalysisResultRaw(result.formatted_text || '');
        } catch (err) {
            setError(err.message || "Failed to analyze page layout.");
            setAnalysisResultRaw('');
        } finally {
            setIsAnalyzingPage(false);
        }
    };

    // Handler for Exporting the content of the Layout Analysis text area
    const handleExportAnalysisClick = async () => {
        if (!analysisResultRaw) { setError("No layout analysis result to export."); return; }
        setError('');
        try {
            const analysisType = fullDocumentResults ? 'full_doc' : 'single_page';
            const filename = `doc_${docId || 'unknown'}_page_${currentPageNum}_layout_${analysisType}.txt`;
            await exportText(analysisResultRaw, filename);
        } catch (err) { setError(err.message || "Failed to export layout analysis text."); }
    };

    // --- NEW Handler for Show OCR Layer Text ---
    const handleShowOcrLayerClick = async () => {
         if (!docId || currentPageNum === null) {
             setError("Please upload a document and select a page first."); return;
         }
         setError('');
         setOcrLayerText(''); // Clear previous
         setIsLoadingOcrLayer(true);
         console.log(`ResultsPanel: Calling getOcrText for Doc: ${docId}, Page: ${currentPageNum}`);
         try {
            const result = await getOcrText(docId, currentPageNum);
            setOcrLayerText(result.page_text || ''); // Update state with ocrmypdf text
         } catch (err) {
             setError(err.message || "Failed to fetch OCR layer text.");
             setOcrLayerText('');
         } finally {
             setIsLoadingOcrLayer(false);
         }
      };
     // --- END NEW Handler ---

     // --- Handler for Exporting OCR Layer Text ---
     const handleExportOcrLayerClick = async () => {
        if (!ocrLayerText) { setError("No OCR layer text to export."); return; }
        setError('');
        try {
            const filename = `doc_${docId || 'unknown'}_page_${currentPageNum}_ocr_layer.txt`;
            await exportText(ocrLayerText, filename);
        } catch (err) { setError(err.message || "Failed to export OCR layer text."); }
    };


    // --- Render Logic ---
    const isLoading = isExtractingManual || isAnalyzingPage || isLoadingOcrLayer;

    return (
        <div className="results-panel">
            {isLoading && <LoadingSpinner message={
                isAnalyzingPage ? "Analyzing layout..." :
                isLoadingOcrLayer ? "Fetching OCR text..." :
                "Extracting text..."}
            />}
            <h4>Results / Actions</h4>
            {error && <p className="error-message">Error: {error}</p>}

            {/* --- Manual Area Extraction Section --- */}
            <div className="action-section manual-extraction">
                <h5>Manual Area Extraction (GOT-OCR)</h5>
                {selectedAreaCoords ? ( <p>Area Selected: <code>{selectedAreaCoords}</code></p> ) : ( <p><i>Select an area on the page image by dragging.</i></p> )}
                <button onClick={handleExtractManualClick} disabled={!selectedAreaCoords || isLoading}> Extract Text from Area </button>
                {manualOcrResult && (
                  <div className="ocr-results manual-results">
                    <h6>Extracted Text (Manual):</h6>
                    <textarea readOnly value={manualOcrResult} rows={8}></textarea>
                    <button onClick={handleExportManualClick} disabled={isLoading}> Export Manual Text </button>
                  </div>
                )}
            </div>

            {/* --- Automatic Analysis & OCR Layer Section --- */}
            <div className="action-section auto-analysis">
                <h5>Full Page Results</h5>
                <div style={{ marginBottom: '10px' }}>
                    <button onClick={handleAnalyzePageClick} disabled={isLoading || !docId}>
                        Analyze Layout (GOT-OCR)
                    </button>
                    <button onClick={handleShowOcrLayerClick} disabled={isLoading || !docId}>
                        Show OCR Layer Text (ocrmypdf)
                    </button>
                </div>

                {/* Display Loading States */}
                {isAnalyzingPage && <p><i>Analyzing page layout...</i></p>}
                {isLoadingOcrLayer && <p><i>Fetching OCR layer text...</i></p>}

                {/* Display OCR Layer Text Result */}
                {ocrLayerText && !isLoadingOcrLayer && (
                     <div className="ocr-layer-output">
                         <h6>OCR Layer Text (from ocrmypdf):</h6>
                         <textarea readOnly value={ocrLayerText} rows={10}></textarea>
                         <button onClick={handleExportOcrLayerClick} disabled={isLoading}>Export OCR Text</button>
                     </div>
                 )}

                {/* Display GOT-OCR Analysis Result */}
                {analysisResultRaw && !isAnalyzingPage && (
                    <div className="raw-analysis-output">
                        <h6>Layout Analysis Result (GOT-OCR):</h6>
                        <textarea
                            readOnly
                            value={analysisResultRaw}
                            rows={10}
                            placeholder={isAnalyzingPage ? "Analyzing..." : "No layout analysis performed or no result."}
                        ></textarea>
                        {analysisResultRaw && (
                             <button onClick={handleExportAnalysisClick} disabled={isLoading}>
                                Export Layout Analysis
                             </button>
                        )}
                    </div>
                )}
                 {/* Message if full doc analysis ran previously but this page had no layout result */}
                 {!isAnalyzingPage && !analysisResultRaw && fullDocumentResults?.page_results && !fullDocumentResults.page_results.hasOwnProperty(currentPageNum?.toString()) && (
                      <p>Full document layout analysis ran, but no result was found for this page.</p>
                 )}
            </div>
        </div>
    );
};

export default ResultsPanel;