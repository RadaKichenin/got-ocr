// src/components/ResultsPanel.js
import React, { useState, useEffect } from 'react';
// Import Latex parser and API functions
import { ocrArea, exportText, analyzePage, getOcrText } from '../services/api';
import { parseLatexTables, tableObjectToHtml } from '../utils/parsing'; // Use Latex parser
import LoadingSpinner from './LoadingSpinner';
import './ResultsPanel.css'; // Ensure this file exists

const ResultsPanel = ({ docId, currentPageNum, selectedAreaCoords, fullDocumentResults }) => {
    // State for Manual Area Extraction (now expects potentially formatted text)
    const [manualExtractionResult, setManualExtractionResult] = useState('');
    const [isExtractingManual, setIsExtractingManual] = useState(false);

    // State for Automatic Page Analysis results (GOT-OCR Format - Raw LaTeX/Markdown)
    const [analysisResultRaw, setAnalysisResultRaw] = useState('');
    const [detectedTables, setDetectedTables] = useState([]); // Parsed tables from Full Page Analysis
    const [isAnalyzingPage, setIsAnalyzingPage] = useState(false);

    // State for OCR Layer Text (ocrmypdf)
    const [ocrLayerText, setOcrLayerText] = useState('');
    const [isLoadingOcrLayer, setIsLoadingOcrLayer] = useState(false);

    // General Error State
    const [error, setError] = useState('');

    // Effect 1: Clear local results when page/doc changes
    useEffect(() => {
        // console.log(`ResultsPanel: Page/Doc changed (Page: ${currentPageNum}, DocId: ${docId}), clearing results.`); // Optional log
        setManualExtractionResult('');
        setOcrLayerText('');
        setError('');
        setIsExtractingManual(false);
        setIsAnalyzingPage(false);
        setIsLoadingOcrLayer(false);
        // Clear analysis display if full doc results aren't available for the new context
        if (!fullDocumentResults?.page_results?.hasOwnProperty(currentPageNum?.toString())) {
             setAnalysisResultRaw('');
             setDetectedTables([]); // Clear parsed tables too
        }
    }, [currentPageNum, docId, fullDocumentResults]);

    // Effect 2: Update displayed analysis text from full results prop when it changes or page changes
    useEffect(() => {
        // console.log(`ResultsPanel Effect 2 Triggered: fullDocRes changed or page=${currentPageNum}`); // Optional log
        if (fullDocumentResults?.page_results) {
            const pageKey = currentPageNum?.toString();
            if (pageKey !== undefined && fullDocumentResults.page_results.hasOwnProperty(pageKey)) {
                // console.log(`ResultsPanel Effect 2: Loading analysis result for page ${pageKey} from full doc.`); // Optional log
                setAnalysisResultRaw(fullDocumentResults.page_results[pageKey] || '');
                // Optionally handle errors specific to this page from fullDocumentResults.errors
            } else {
                // Only clear if not currently analyzing this specific page via button click
                if (!isAnalyzingPage) {
                    // console.log(`ResultsPanel Effect 2: No pre-analyzed result for page key "${pageKey}". Clearing display.`); // Optional log
                    setAnalysisResultRaw('');
                }
            }
        }
        // We don't necessarily clear if fullDocumentResults is null, because
        // analysisResultRaw might hold a single-page analysis result. Effect 1 handles clearing on doc change.
    }, [fullDocumentResults, currentPageNum, isAnalyzingPage]);

    // --- Effect 3: Parse Tables from Raw LaTeX/Markdown ---
    useEffect(() => {
      // Run parsing whenever the raw analysis text changes
      if (analysisResultRaw) {
        console.log("ResultsPanel: Raw analysis result updated, attempting to parse LaTeX tables...");
        // *** Use the LaTeX parser ***
        const tables = parseLatexTables(analysisResultRaw);
        setDetectedTables(tables); // Update state with parsed tables (empty array if none found)
        if (tables.length === 0) {
            console.log("ResultsPanel: No tables found in parsed LaTeX output.");
        } else {
            console.log(`ResultsPanel: Successfully parsed ${tables.length} table(s) from LaTeX.`);
        }
      } else {
        // If raw result is cleared, clear the parsed tables too
        setDetectedTables([]);
      }
    }, [analysisResultRaw]); // Dependency: Run only when raw analysis text changes


    // --- Action Handlers ---

    // Handler for "Extract Formatted Text from Area" button
    const handleExtractManualClick = async () => {
        if (!docId || currentPageNum === null || !selectedAreaCoords) { setError("Please upload doc, select page, and select area."); return; }
        setError(''); setManualExtractionResult(''); setIsExtractingManual(true);
        console.log(`ResultsPanel: Calling /ocr_area (microservice format attempt) for Doc: ${docId}, Page: ${currentPageNum}, Coords: ${selectedAreaCoords}`);
        try {
            const result = await ocrArea(docId, currentPageNum, selectedAreaCoords);
            setManualExtractionResult(result.extracted_text || ''); // Store the raw formatted text
        } catch (err) {
            setError(err.message || "Failed to extract formatted text from area.");
            setManualExtractionResult('');
        } finally {
            setIsExtractingManual(false);
        }
    };

    // Handler for exporting the manual area extraction result
    const handleExportManualClick = async () => {
        if (!manualExtractionResult) { setError("No manual extraction result to export."); return; }
        // setIsExtractingManual(true); // Optional: show loading briefly
        setError('');
        try {
            // Filename indicates potential format difference
            const filename = `doc_${docId || 'unknown'}_page_${currentPageNum}_manual_extract_formatted.txt`;
            await exportText(manualExtractionResult, filename);
        } catch (err) { setError(err.message || "Failed to export manual extraction."); }
        // finally { setIsExtractingManual(false); }
    };

    // Handler for "Analyze Layout (GOT-OCR)" button (Full Page)
    const handleAnalyzePageClick = async () => {
        if (!docId || currentPageNum === null) { setError("Please upload a document and select a page first."); return; }
        setError('');
        setAnalysisResultRaw(''); // Clear previous raw result for this page
        setDetectedTables([]); // Clear previously parsed tables
        setOcrLayerText(''); // Also clear OCR layer text display
        setIsAnalyzingPage(true);
        console.log(`ResultsPanel: Calling analyzePage (microservice GOT-OCR) for Doc: ${docId}, Page: ${currentPageNum}`);
        try {
            const result = await analyzePage(docId, currentPageNum);
            setAnalysisResultRaw(result.formatted_text || ''); // Update raw text -> triggers Effect 3
        } catch (err) {
            setError(err.message || "Failed to analyze page layout.");
            setAnalysisResultRaw('');
            setDetectedTables([]);
        } finally {
            setIsAnalyzingPage(false);
        }
    };

   // Handler for Exporting the raw Layout Analysis text area content
   const handleExportAnalysisClick = async () => {
        if (!analysisResultRaw) { setError("No layout analysis result to export."); return; }
        setError('');
        try {
            const analysisType = fullDocumentResults ? 'full_doc' : 'single_page';
            // Indicate format in filename
            const filename = `doc_${docId || 'unknown'}_page_${currentPageNum}_layout_${analysisType}_raw.txt`;
            await exportText(analysisResultRaw, filename);
        } catch (err) { setError(err.message || "Failed to export layout analysis text."); }
    };

    // Handler for "Show OCR Layer Text (ocrmypdf)" button
    const handleShowOcrLayerClick = async () => {
         if (!docId || currentPageNum === null) { setError("Please upload a document and select a page first."); return; }
         setError('');
         setOcrLayerText(''); // Clear previous
         setAnalysisResultRaw(''); // Clear layout analysis when showing plain text
         setDetectedTables([]); // Clear parsed tables too
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

     // Handler for Exporting OCR Layer Text
     const handleExportOcrLayerClick = async () => {
        if (!ocrLayerText) { setError("No OCR layer text to export."); return; }
        setError('');
        try {
            const filename = `doc_${docId || 'unknown'}_page_${currentPageNum}_ocr_layer.txt`;
            await exportText(ocrLayerText, filename);
        } catch (err) { setError(err.message || "Failed to export OCR layer text."); }
    };


    // --- Render Logic ---
    // Combine loading states for disabling buttons, but use specific states for messages
    const isAnyLoading = isExtractingManual || isAnalyzingPage || isLoadingOcrLayer;

    return (
        <div className="results-panel">
            {/* Show specific loading message */}
            {isExtractingManual && <LoadingSpinner message="Extracting formatted area..." />}
            {isAnalyzingPage && <LoadingSpinner message="Analyzing page layout..." />}
            {isLoadingOcrLayer && <LoadingSpinner message="Fetching OCR layer text..." />}

            <h4>Results / Actions</h4>
            {error && <p className="error-message">Error: {error}</p>}

            {/* Manual Area Extraction Section - Displays Formatted Text */}
            <div className="action-section manual-extraction">
                <h5>Manual Area Extraction (Formatted)</h5>
                {selectedAreaCoords ? ( <p>Area Selected: <code>{selectedAreaCoords}</code></p> ) : ( <p><i>Select an area on the page image by dragging.</i></p> )}
                <button onClick={handleExtractManualClick} disabled={!selectedAreaCoords || isAnyLoading}> Extract Formatted Text from Area </button>
                {manualExtractionResult && !isExtractingManual && (
                  <div className="ocr-results manual-results">
                    <h6>Extracted Formatted Text (Manual Area):</h6>
                    <textarea readOnly value={manualExtractionResult} rows={8}></textarea>
                    <button onClick={handleExportManualClick} disabled={isAnyLoading}> Export Manual Extract </button>
                  </div>
                )}
            </div>

            {/* Automatic Analysis & OCR Layer Section */}
            <div className="action-section auto-analysis">
                <h5>Full Page Results</h5>
                <div style={{ marginBottom: '10px' }}>
                    <button onClick={handleAnalyzePageClick} disabled={isAnyLoading || !docId}> Analyze Layout (GOT-OCR) </button>
                    <button onClick={handleShowOcrLayerClick} disabled={isAnyLoading || !docId}> Show OCR Layer Text (ocrmypdf) </button>
                </div>

                {/* Display Loading States */}
                {isAnalyzingPage && <p><i>Analyzing page layout...</i></p>}
                {isLoadingOcrLayer && <p><i>Fetching OCR layer text...</i></p>}

                {/* Display OCR Layer Text Result */}
                {ocrLayerText && !isLoadingOcrLayer && (
                     <div className="ocr-layer-output">
                         <h6>OCR Layer Text (from ocrmypdf):</h6>
                         <textarea readOnly value={ocrLayerText} rows={10}></textarea>
                         <button onClick={handleExportOcrLayerClick} disabled={isAnyLoading}>Export OCR Text</button>
                     </div>
                 )}

                {/* Display Parsed Tables from Full Page Layout Analysis */}
                {!isAnalyzingPage && analysisResultRaw && detectedTables.length > 0 && (
                    <div className="detected-tables">
                        <h5>Detected Tables from Layout Analysis ({detectedTables.length}):</h5>
                        {detectedTables.map((table, index) => (
                            <div key={`table-${index}`} className="table-container">
                                <h6>Table {index + 1}</h6>
                                <div className="table-preview" dangerouslySetInnerHTML={{ __html: tableObjectToHtml(table) }}></div>
                                {/* Add Export button per table later */}
                                {/* <button disabled>Export Table {index + 1}</button> */}
                            </div>
                        ))}
                         {/* Optional: Expander to show raw LaTeX */}
                         <details style={{marginTop: '10px', fontSize: '0.9em'}}>
                             <summary style={{cursor: 'pointer'}}>Show Raw Layout Analysis Output</summary>
                             <textarea readOnly value={analysisResultRaw} rows={5} style={{width: 'calc(100% - 12px)', marginTop:'5px'}}></textarea>
                             <button onClick={handleExportAnalysisClick} disabled={isAnyLoading} style={{marginTop:'5px'}}> Export Raw Analysis </button>
                         </details>
                    </div>
                )}
                {/* Message if analysis ran but no tables were parsed */}
                 {!isAnalyzingPage && analysisResultRaw && detectedTables.length === 0 && (
                     <div>
                         <p>Layout analysis complete. No tables parsed from the output.</p>
                         <details style={{fontSize: '0.9em'}}>
                             <summary style={{cursor: 'pointer'}}>Show Raw Layout Analysis Output</summary>
                             <textarea readOnly value={analysisResultRaw} rows={5} style={{width: 'calc(100% - 12px)', marginTop:'5px'}}></textarea>
                              <button onClick={handleExportAnalysisClick} disabled={isAnyLoading} style={{marginTop:'5px'}}> Export Raw Analysis </button>
                         </details>
                     </div>
                 )}
                 {/* Message if full doc analysis ran but no result for this specific page */}
                 {!isAnalyzingPage && !analysisResultRaw && !ocrLayerText && fullDocumentResults?.page_results && !fullDocumentResults.page_results.hasOwnProperty(currentPageNum?.toString()) && (
                      <p>Full document layout analysis ran, but no result was found for this page.</p>
                 )}
                 {/* Message if no analysis has been run yet for this page */}
                  {!isAnalyzingPage && !analysisResultRaw && !ocrLayerText && !manualExtractionResult && !fullDocumentResults && (
                     <p><i>Click a button above to analyze or extract text.</i></p>
                  )}
            </div>
        </div>
    );
};

export default ResultsPanel;