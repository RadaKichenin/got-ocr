// Define the base URL of your backend service
const API_BASE_URL = "http://localhost:5001"; // Adjust if your backend runs elsewhere

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json(); // { doc_id, page_count, page_image_urls }
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error; // Re-throw to be caught by the component
  }
};

export const ocrArea = async (docId, pageNum, boxCoordinates) => {
  try {
    const response = await fetch(`${API_BASE_URL}/ocr_area`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doc_id: docId,
        page_num: pageNum,
        box_coordinates: boxCoordinates, // Expecting string like "[x1,y1,x2,y2]"
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json(); // { extracted_text }
  } catch (error) {
    console.error("Error calling OCR area:", error);
    throw error;
  }
};

// Function to get the backend URL for serving images (used directly in img src)
export const getImageUrl = (imagePath) => {
    // imagePath is expected like '/processed_image/doc_id/page_0.png'
    if (!imagePath || !imagePath.startsWith('/')) return '';
    return `${API_BASE_URL}${imagePath}`;
};

// --- NEW API FUNCTION ---
export const analyzePage = async (docId, pageNum) => {
  try {
    const response = await fetch(`${API_BASE_URL}/analyze_page`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doc_id: docId,
        page_num: pageNum,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    // Expecting { formatted_text: "..." }
    return await response.json();
  } catch (error) {
    console.error("Error calling analyze page:", error);
    throw error;
  }
};
// --- END NEW API FUNCTION ---
// --- NEW API FUNCTION for Document Analysis ---
export const analyzeDocument = async (docId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/analyze_document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doc_id: docId,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    // Expecting { page_results: {"0": "text", ...}, errors: {"2":"msg",...} }
    return await response.json();
  } catch (error) {
    console.error("Error calling analyze document:", error);
    throw error;
  }
};
// --- END Document Analysis API FUNCTION ---


export const exportText = async (textContent, filename = 'extracted_text.txt') => {
    try {
        const response = await fetch(`${API_BASE_URL}/export_text`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text_content: textContent,
                filename: filename
            }),
        });

        if (!response.ok) {
             const errorData = await response.json();
             throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        // Trigger file download
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', filename); // Set filename
        document.body.appendChild(link);
        link.click();
        link.remove(); // Clean up
        window.URL.revokeObjectURL(downloadUrl); // Free up memory

    } catch (error) {
        console.error("Error exporting text:", error);
        throw error;
    }
};