// src/services/api.js
const API_BASE_URL = "http://localhost:5001"; // Your backend URL

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const response = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData });
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || `Upload failed: ${response.statusText}`); }
    return await response.json(); // Expects { doc_id, page_count }
  } catch (error) { console.error("Upload Error:", error); throw error; }
};

export const ocrArea = async (docId, pageNum, boxCoordinates) => {
  try {
    const response = await fetch(`${API_BASE_URL}/ocr_area`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_id: docId, page_num: pageNum, box_coordinates: boxCoordinates }),
    });
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || response.statusText); }
    return await response.json(); // Expects { extracted_text }
  } catch (error) { console.error("OCR Area Error:", error); throw error; }
};

// --- UPDATED: getImageUrl constructs URL dynamically ---
export const getImageUrl = (docId, pageNum) => {
    if (!docId || pageNum === null || pageNum === undefined) return '';
    // URL points to the backend endpoint that extracts the image on the fly
    return `${API_BASE_URL}/processed_image/${docId}/page/${pageNum}`;
};
// --- END UPDATED ---

export const analyzePage = async (docId, pageNum) => {
  try {
    const response = await fetch(`${API_BASE_URL}/analyze_page`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_id: docId, page_num: pageNum }),
    });
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || response.statusText); }
    return await response.json(); // Expects { formatted_text }
  } catch (error) { console.error("Analyze Page Error:", error); throw error; }
};

export const analyzeDocument = async (docId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/analyze_document`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_id: docId }),
    });
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || response.statusText); }
    return await response.json(); // Expects { page_results: {...}, errors: {...} }
  } catch (error) { console.error("Analyze Document Error:", error); throw error; }
};

export const exportText = async (textContent, filename = 'exported_text.txt') => {
  try {
    const response = await fetch(`${API_BASE_URL}/export_text`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text_content: textContent, filename: filename }),
    });
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || response.statusText); }
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = downloadUrl;
    link.setAttribute('download', filename); document.body.appendChild(link);
    link.click(); link.remove(); window.URL.revokeObjectURL(downloadUrl);
  } catch (error) { console.error("Export Text Error:", error); throw error; }
};

// --- NEW FUNCTION: Fetch OCR Layer Text ---
export const getOcrText = async (docId, pageNum) => {
    try {
        const response = await fetch(`${API_BASE_URL}/text/${docId}/page/${pageNum}`, {
            method: 'GET', // Use GET for fetching text layer
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        // Expecting { page_text: "..." }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching OCR text for page ${pageNum}:`, error);
        throw error;
    }
};
// --- END NEW FUNCTION ---