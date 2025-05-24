import requests
import os
from dotenv import load_dotenv

load_dotenv()

GOT_OCR_SERVICE_URL = os.getenv("GOT_OCR_SERVICE_URL", "http://127.0.0.1:3000/process")
REQUEST_TIMEOUT = 120 # Increased timeout

def call_got_ocr_area(image_path, box_coordinates_str=None):
    """Calls GOT-OCR for a specific image (potentially cropped), expects box coords if provided"""
    if not os.path.exists(image_path):
        print(f"Error: Image path not found for OCR Area call: {image_path}")
        return None

    files = None
    file_handle = None # Define outside try
    try:
        # Prepare file for upload
        image_filename = os.path.basename(image_path)
        file_handle = open(image_path, 'rb')
        files = {'images': (image_filename, file_handle, 'image/png')}

        # Prepare payload - uses Fine-grained Box if coords provided
        if box_coordinates_str:
            payload = {
                'task': 'Fine-grained OCR (Box)',
                'ocr_box': box_coordinates_str
            }
            task_desc = "[Box]"
        else:
             # This function path in app.py assumes box coordinates are provided
             print("Error: box_coordinates_str not provided for call_got_ocr_area")
             # file_handle.close() # Close handle before returning
             return "Error: Box coordinates required for area OCR."

        print(f"Calling GOT-OCR {task_desc} at {GOT_OCR_SERVICE_URL} for {image_filename}")
        response = requests.post(GOT_OCR_SERVICE_URL, files=files, data=payload, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        response_data = response.json()
        print(f"GOT-OCR {task_desc} Raw Response: {response_data}")

        # --- PARSING ---
        extracted_text = None
        if isinstance(response_data, dict):
             if 'result' in response_data and isinstance(response_data['result'], list) and len(response_data['result']) > 0 and 'text' in response_data['result'][0]: extracted_text = response_data['result'][0]['text']
             elif 'text' in response_data: extracted_text = response_data['text']
             elif 'extracted_text' in response_data: extracted_text = response_data['extracted_text']
        if extracted_text is None:
             print(f"Warning: Could not parse 'text' from GOT-OCR {task_desc} response: {response_data}")
             return f"Error: Could not parse OCR result: {str(response_data)[:100]}..."
        # ----------------
        print(f"Successfully extracted text {task_desc} (length: {len(extracted_text)})")
        return extracted_text

    except requests.exceptions.RequestException as e:
        print(f"Error calling GOT-OCR service {task_desc}: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred during OCR call {task_desc}: {e}")
        return None
    finally:
        # Ensure file handle is closed if it was opened
        if file_handle and not file_handle.closed:
            file_handle.close()
            # print(f"Closed file handle for {image_filename}") # Optional log

def call_got_ocr_format_text(image_path):
    """Calls GOT-OCR 'Format Text OCR' for layout analysis."""
    if not os.path.exists(image_path):
        print(f"Error: Image path not found for Format OCR: {image_path}")
        return None

    files = None
    file_handle = None # Define outside try
    try:
        image_filename = os.path.basename(image_path)
        file_handle = open(image_path, 'rb')
        files = {'images': (image_filename, file_handle, 'image/png')}
        payload = {
            'task': 'Format Text OCR',
            'ocr_type': 'format'
        }
        print(f"Calling GOT-OCR [Format] at {GOT_OCR_SERVICE_URL} for {image_filename}")
        response = requests.post(GOT_OCR_SERVICE_URL, files=files, data=payload, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        response_data = response.json()
        print(f"GOT-OCR [Format] Raw Response: {response_data}")

        # --- PARSING ---
        formatted_text = None
        if isinstance(response_data, dict):
            if 'formatted_text' in response_data: formatted_text = response_data['formatted_text']
            elif 'markdown_output' in response_data: formatted_text = response_data['markdown_output']
            elif 'result' in response_data and isinstance(response_data['result'], list) and len(response_data['result']) > 0 and 'text' in response_data['result'][0]: formatted_text = response_data['result'][0]['text']
            elif 'text' in response_data: formatted_text = response_data['text']
        if formatted_text is None:
            print(f"Warning: Could not parse formatted text from GOT-OCR [Format] response: {response_data}")
            return f"Error: Could not parse formatted result: {str(response_data)[:100]}..."
        # ----------------
        print(f"Successfully extracted formatted text [Format] (length: {len(formatted_text)})")
        return formatted_text

    except requests.exceptions.RequestException as e:
        print(f"Error calling GOT-OCR service [Format]: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred during OCR call [Format]: {e}")
        return None
    finally:
        if file_handle and not file_handle.closed:
            file_handle.close()
            # print(f"Closed file handle for {image_filename}") # Optional log