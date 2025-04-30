import requests
import os
from dotenv import load_dotenv

load_dotenv() # Load variables from .env file

# --- Configuration ---
GOT_OCR_SERVICE_URL = os.getenv("GOT_OCR_SERVICE_URL", "http://127.0.0.1:3000/process") # Default if not in .env

def call_got_ocr_area(image_path, box_coordinates_str):
    """
    Calls the GOT-OCR service for fine-grained box extraction.

    Args:
        image_path (str): Path to the image file.
        box_coordinates_str (str): Bounding box string e.g., "[100,200,300,400]".

    Returns:
        str: Extracted text content, or None if an error occurred.
    """
    if not os.path.exists(image_path):
        print(f"Error: Image path not found for OCR: {image_path}")
        return None

    files = {'images': (os.path.basename(image_path), open(image_path, 'rb'), 'image/png')}
    payload = {
        'task': 'Fine-grained OCR (Box)',
        'ocr_box': box_coordinates_str
    }

    print(f"Calling GOT-OCR at {GOT_OCR_SERVICE_URL} for {image_path} with box {box_coordinates_str}")

    try:
        response = requests.post(GOT_OCR_SERVICE_URL, files=files, data=payload, timeout=60) # Increased timeout
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)

        # --- IMPORTANT: Adjust based on ACTUAL GOT-OCR response structure ---
        # Assuming the response JSON looks like: {'result': [{'text': 'extracted text here'}]}
        # Or maybe: {'text': 'extracted text here'}
        # Or maybe: {'ocr_results': [...]}
        # You MUST inspect the actual response from your service and adjust parsing accordingly.
        response_data = response.json()
        print(f"GOT-OCR Raw Response: {response_data}") # Log the raw response for debugging

        # Example Parsing Logic (adjust as needed!)
        extracted_text = None
        if isinstance(response_data, dict):
            if 'result' in response_data and isinstance(response_data['result'], list) and len(response_data['result']) > 0:
                 # Example: Taking text from the first result item
                 if 'text' in response_data['result'][0]:
                      extracted_text = response_data['result'][0]['text']
            elif 'text' in response_data: # Simpler structure?
                 extracted_text = response_data['text']
            elif 'results' in response_data and isinstance(response_data['results'], list) and len(response_data['results']) > 0:
                 # Another possible structure
                 if 'text' in response_data['results'][0]:
                      extracted_text = response_data['results'][0]['text']
            # Add more checks based on observed response formats

        if extracted_text is None:
             print("Warning: Could not parse extracted text from GOT-OCR response structure.")
             print(f"Full response was: {response_data}")
             return "Error: Could not parse OCR result structure." # Return error message

        # ------------------------------------------------------------------

        print(f"Successfully extracted text (length: {len(extracted_text)})")
        return extracted_text

    except requests.exceptions.RequestException as e:
        print(f"Error calling GOT-OCR service: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred during OCR call: {e}")
        return None
    finally:
        # Ensure the file handle is closed
        if 'images' in files:
            files['images'][1].close()