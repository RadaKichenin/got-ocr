# utils/ocr.py
import requests
import os
from dotenv import load_dotenv

load_dotenv()

GOT_OCR_SERVICE_URL = os.getenv("GOT_OCR_SERVICE_URL", "http://127.0.0.1:3000/process")
# Increase timeout for potentially longer analysis tasks
REQUEST_TIMEOUT = 120

def call_got_ocr_area(image_path, box_coordinates_str):
    # ... (previous function remains the same) ...
    if not os.path.exists(image_path):
        print(f"Error: Image path not found for OCR: {image_path}")
        return None
    files = {'images': (os.path.basename(image_path), open(image_path, 'rb'), 'image/png')}
    payload = {
        'task': 'Fine-grained OCR (Box)',
        'ocr_box': box_coordinates_str
    }
    print(f"Calling GOT-OCR [Box] at {GOT_OCR_SERVICE_URL} for {image_path} with box {box_coordinates_str}")
    try:
        response = requests.post(GOT_OCR_SERVICE_URL, files=files, data=payload, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        response_data = response.json()
        print(f"GOT-OCR [Box] Raw Response: {response_data}")
        # --- ADJUST PARSING based on actual response ---
        extracted_text = None
        if isinstance(response_data, dict):
             # Try common keys, prioritize more structured ones if they exist
             if 'result' in response_data and isinstance(response_data['result'], list) and len(response_data['result']) > 0 and 'text' in response_data['result'][0]:
                  extracted_text = response_data['result'][0]['text']
             elif 'text' in response_data:
                  extracted_text = response_data['text']
             elif 'extracted_text' in response_data:
                  extracted_text = response_data['extracted_text']
        if extracted_text is None:
             print(f"Warning: Could not parse 'text' from GOT-OCR [Box] response: {response_data}")
             return f"Error: Could not parse OCR result structure: {str(response_data)[:100]}..." # Return partial error
        # --------------------------------------------
        print(f"Successfully extracted text (length: {len(extracted_text)})")
        return extracted_text
    except requests.exceptions.RequestException as e:
        print(f"Error calling GOT-OCR service [Box]: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred during OCR call [Box]: {e}")
        return None
    finally:
        if 'images' in files and files['images'][1] and not files['images'][1].closed:
             files['images'][1].close()

# --- NEW FUNCTION ---
def call_got_ocr_format_text(image_path):
    """
    Calls the GOT-OCR service for formatted text extraction (Markdown/LaTeX).

    Args:
        image_path (str): Path to the image file.

    Returns:
        str: Extracted formatted text content (likely Markdown), or None if an error occurred.
    """
    if not os.path.exists(image_path):
        print(f"Error: Image path not found for Format OCR: {image_path}")
        return None

    files = {'images': (os.path.basename(image_path), open(image_path, 'rb'), 'image/png')}
    # Payload for formatted text extraction
    payload = {
        'task': 'Format Text OCR',
        'ocr_type': 'format' # Crucial: Request formatted output (Markdown/LaTeX)
    }

    print(f"Calling GOT-OCR [Format] at {GOT_OCR_SERVICE_URL} for {image_path}")

    try:
        response = requests.post(GOT_OCR_SERVICE_URL, files=files, data=payload, timeout=REQUEST_TIMEOUT)
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)

        response_data = response.json()
        print(f"GOT-OCR [Format] Raw Response: {response_data}") # Log the raw response

        # --- IMPORTANT: Adjust parsing based on ACTUAL response structure ---
        # Check potential keys where the formatted text might be located.
        # Common possibilities: 'formatted_text', 'markdown_output', 'result[0].text', 'text'
        formatted_text = None
        if isinstance(response_data, dict):
            if 'formatted_text' in response_data:
                formatted_text = response_data['formatted_text']
            elif 'markdown_output' in response_data:
                 formatted_text = response_data['markdown_output']
            elif 'result' in response_data and isinstance(response_data['result'], list) and len(response_data['result']) > 0 and 'text' in response_data['result'][0]:
                 formatted_text = response_data['result'][0]['text'] # Might just return text here too
            elif 'text' in response_data:
                 formatted_text = response_data['text'] # Fallback

        if formatted_text is None:
            print(f"Warning: Could not parse formatted text from GOT-OCR [Format] response: {response_data}")
            return f"Error: Could not parse formatted text result: {str(response_data)[:100]}..." # Return partial error
        # ------------------------------------------------------------------

        print(f"Successfully extracted formatted text (length: {len(formatted_text)})")
        return formatted_text

    except requests.exceptions.RequestException as e:
        print(f"Error calling GOT-OCR service [Format]: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred during OCR call [Format]: {e}")
        return None
    finally:
        # Ensure the file handle is closed
        if 'images' in files and files['images'][1] and not files['images'][1].closed:
             files['images'][1].close()