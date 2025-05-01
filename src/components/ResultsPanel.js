import React, { useState, useEffect } from 'react';
import { ocrArea, exportText, analyzePage } from '../services/api';
import LoadingSpinner from './LoadingSpinner';
import './ResultsPanel.css';

// Add fullDocumentResults to the props
const ResultsPanel = ({ docId, currentPageNum, selectedAreaCoords, fullDocumentResults }) => {
    const [manualOcrResult, setManualOcrResult] = useState('');
    const [isExtractingManual, setIsExtractingManual] = useState(false);
    const [analysisResultRaw, setAnalysisResultRaw] = useState('');
    const [isAnalyzingPage, setIsAnalyzingPage] = useState(false);
    const [error, setError] = useState('');

    // Log props on every render for debugging
    console.log("ResultsPanel Render - Props:", { docId, currentPageNum, selectedAreaCoords, fullDocumentResults });

    // Effect 1: Clear local results when page/doc changes
    useEffect(() => {
        console.log(`ResultsPanel Effect 1: Page/Doc changed (Page: ${currentPageNum}, DocId: ${docId}), clearing local results.`);
        setManualOcrResult('');
        // Don't clear analysisResultRaw here IF fullDocumentResults exists for the new page
        // It will be handled by Effect 2. Only clear if fullDocumentResults is null.
        if (!fullDocumentResults) {
             setAnalysisResultRaw('');
        }
        setError('');
        setIsExtractingManual(false);
        setIsAnalyzingPage(false);
    }, [currentPageNum, docId, fullDocumentResults]); // Add fullDocumentResults here too

    // --- Effect 2: Update displayed analysis text based on full results OR current page change ---
    useEffect(() => {
        console.log(`ResultsPanel Effect 2 Triggered: fullDocumentResults changed or currentPageNum=${currentPageNum}`);
        // Ensure fullDocumentResults and page_results exist
        if (fullDocumentResults?.page_results) {
            // *** CRITICAL FIX: Convert currentPageNum to string for key lookup ***
            const pageKey = currentPageNum.toString();
            console.log(`ResultsPanel Effect 2: Looking for key "${pageKey}" in page_results`);

            // Check if the key exists in the results object
            if (fullDocumentResults.page_results.hasOwnProperty(pageKey)) {
                const pageText = fullDocumentResults.page_results[pageKey];
                console.log(`ResultsPanel Effect 2: Found text for page ${pageKey} (length ${pageText?.length}). Updating display.`);
                setAnalysisResultRaw(pageText || ''); // Set the text, default to empty string if null/undefined

                // Display specific errors for this page if they exist
                if (fullDocumentResults.errors && fullDocumentResults.errors[pageKey]) {
                    setError(`Error during full analysis for page ${currentPageNum + 1}: ${fullDocumentResults.errors[pageKey]}`);
                } else {
                    // Consider clearing error ONLY if it was related to previous page's full analysis?
                    // setError(''); // Maybe too aggressive, might clear unrelated errors
                }
            } else {
                // Key doesn't exist (e.g., analysis didn't include this page or failed silently)
                console.log(`ResultsPanel Effect 2: No pre-analyzed result found for page key "${pageKey}". Clearing display.`);
                setAnalysisResultRaw(''); // Clear display if no result exists for this page
            }
        } else {
            // Full document analysis hasn't run or returned empty results
            console.log("ResultsPanel Effect 2: fullDocumentResults or page_results not available.");
            // Do NOT clear analysisResultRaw here, it might hold single-page analysis result
        }
        // This effect depends on the full results object and the current page number
    }, [fullDocumentResults, currentPageNum]);


    // --- Action Handlers (remain largely the same) ---

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

    const handleAnalyzePageClick = async () => {
        if (!docId || currentPageNum === null) { setError("Please upload a document and select a page first."); return; }
        setError('');
        setAnalysisResultRaw(''); // Clear previous specific result before fetching new one
        setIsAnalyzingPage(true);
        console.log(`ResultsPanel: Calling analyzePage (single) for Doc: ${docId}, Page: ${currentPageNum}`);
        try {
            const result = await analyzePage(docId, currentPageNum);
            setAnalysisResultRaw(result.formatted_text || ''); // Update display with single page result
        } catch (err) {
            setError(err.message || "Failed to analyze page.");
            setAnalysisResultRaw('');
        } finally {
            setIsAnalyzingPage(false);
        }
    };

    const handleExportAnalysisClick = async () => {
        if (!analysisResultRaw) { setError("No analysis result to export."); return; }
        setError('');
        try {
            const analysisType = fullDocumentResults ? 'full_doc' : 'single_page';
            const filename = `doc_${docId || 'unknown'}_page_${currentPageNum}_${analysisType}_analysis.txt`;
            await exportText(analysisResultRaw, filename);
        } catch (err) { setError(err.message || "Failed to export text."); }
    };

    // --- Render Logic ---
    const isLoading = isExtractingManual || isAnalyzingPage;

    return (
        <div className="results-panel">
            {isLoading && <LoadingSpinner message={isAnalyzingPage ? "Analyzing page..." : "Extracting text..."} />}
            <h4>Results / Actions</h4>
            {error && <p className="error-message">Error: {error}</p>}

            {/* Manual Extraction Section */}
            <div className="action-section manual-extraction">
                {/* ... content same as before ... */}
                 <h5>Manual Area Extraction</h5>
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

            {/* Automatic Analysis Section */}
            <div className="action-section auto-analysis">
                <h5>Automatic Page Analysis</h5>
                <button onClick={handleAnalyzePageClick} disabled={isAnalyzingPage || !docId}>
                    Analyze Page Content
                </button>

                {isAnalyzingPage && <p><i>Analyzing current page content...</i></p>}

                {/* Display Raw Analysis Result (populated by single page OR full doc effect) */}
                {/* Show text area only if there IS text OR if single page analysis just ran (even if empty) */}
                {(analysisResultRaw || isAnalyzingPage) && !isLoading && (
                    <div className="raw-analysis-output">
                        <h6>Full Page Analysis Result:</h6>
                        <textarea
                            readOnly
                            value={analysisResultRaw}
                            rows={15}
                            placeholder={isAnalyzingPage ? "Analyzing..." : "No text found for this page."} // Placeholder
                        ></textarea>
                        {/* Enable export only if there is actual text */}
                        {analysisResultRaw && (
                             <button onClick={handleExportAnalysisClick} disabled={isLoading}>
                                Export Page Analysis
                             </button>
                        )}
                    </div>
                )}
                {/* Specific message if full doc analysis ran but this page had no results */}
                {!isAnalyzingPage && !analysisResultRaw && fullDocumentResults?.page_results && !fullDocumentResults.page_results.hasOwnProperty(currentPageNum.toString()) && (
                     <p>Full document analysis ran, but no result was found for this page.</p>
                )}

            </div>
        </div>
    );
};

export default ResultsPanel;