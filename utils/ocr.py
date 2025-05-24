# utils/ocr.py
import requests
import os
from dotenv import load_dotenv
import time # For potential delays/retries if needed, though not used currently

load_dotenv() # Load environment variables from .env file if present

# --- Configuration ---
GOT_OCR_SERVICE_URL = os.getenv("GOT_OCR_SERVICE_URL", "http://127.0.0.1:3000/process") # Default if not in .env
REQUEST_TIMEOUT = 120 # Increased timeout in seconds for potentially long OCR operations

# --- Function Definitions ---

def call_got_ocr_area(image_path, box_coordinates_str=None):
    """
    Calls the GOT-OCR service for a specific image path.
    If box_coordinates_str is provided, uses 'Fine-grained OCR (Box)' task.
    If box_coordinates_str is None, uses 'Plain Text OCR' task, assuming the
    input image itself is already cropped to the desired area.

    Args:
        image_path (str): Path to the image file (can be full page or pre-cropped).
        box_coordinates_str (str, optional): Bounding box string e.g., "[x1,y1,x2,y2]".
                                             If None, assumes pre-cropped image. Defaults to None.

    Returns:
        str: Extracted text content, or an error string if failed, or None for critical errors.
    """
    if not os.path.exists(image_path):
        print(f"Error [call_got_ocr_area]: Image path not found: {image_path}")
        return "Error: Input image file not found." # Return specific error

    files = None
    file_handle = None # Define outside try for finally block
    task_desc = "[Unknown Task]" # For logging clarity

    try:
        # Prepare file for upload
        image_filename = os.path.basename(image_path)
        file_handle = open(image_path, 'rb')
        files = {'images': (image_filename, file_handle, 'image/png')} # Assume PNG content type

        # Determine payload based on presence of box coordinates
        if box_coordinates_str:
            # Use Fine-grained Box task when coordinates are provided
            payload = {
                'task': 'Fine-grained OCR (Box)',
                'ocr_box': box_coordinates_str
            }
            task_desc = "[Box]"
            print(f"Calling GOT-OCR {task_desc} with box {box_coordinates_str} for {image_filename}")
        else:
            # Image is pre-cropped, use Plain Text OCR on the whole (cropped) image
            payload = {'task': 'Plain Text OCR'}
            task_desc = "[Plain - Cropped Img]"
            print(f"Calling GOT-OCR {task_desc} (no box needed) for {image_filename}")

        # Make the API call
        response = requests.post(GOT_OCR_SERVICE_URL, files=files, data=payload, timeout=REQUEST_TIMEOUT)
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)

        response_data = response.json()
        print(f"GOT-OCR {task_desc} Raw Response: {response_data}")

        # --- Parse the response ---
        extracted_text = None
        # Check various common keys where the result might be nested
        if isinstance(response_data, dict):
             if 'result' in response_data and isinstance(response_data['result'], list) and len(response_data['result']) > 0 and 'text' in response_data['result'][0]:
                 extracted_text = response_data['result'][0]['text']
             elif 'text' in response_data:
                 extracted_text = response_data['text']
             elif 'extracted_text' in response_data:
                 extracted_text = response_data['extracted_text']
             # Add more potential keys here if needed based on GOT-OCR behavior
        # --- End Parsing ---

        if extracted_text is None:
             # If parsing failed, return a specific error message including part of the raw response
             print(f"Warning: Could not parse 'text' from GOT-OCR {task_desc} response: {response_data}")
             return f"Error: Could not parse OCR result structure: {str(response_data)[:150]}..."
        else:
            # Successfully extracted text
            print(f"Successfully extracted text {task_desc} (length: {len(extracted_text)})")
            return extracted_text

    except requests.exceptions.Timeout:
        print(f"Error calling GOT-OCR service {task_desc}: Request timed out after {REQUEST_TIMEOUT} seconds.")
        return "Error: OCR service request timed out."
    except requests.exceptions.RequestException as e:
        print(f"Error calling GOT-OCR service {task_desc}: {e}")
        # Try to provide more specific feedback for common network errors
        if "Connection refused" in str(e):
             return "Error: Could not connect to OCR service. Is it running?"
        return f"Error: Network error communicating with OCR service: {e}"
    except Exception as e:
        print(f"An unexpected error occurred during OCR call {task_desc}: {e}")
        import traceback
        traceback.print_exc() # Print full traceback for unexpected errors
        return f"Error: An unexpected error occurred during OCR: {e}"
    finally:
        # Ensure file handle is always closed if it was opened
        if file_handle and not file_handle.closed:
            try:
                file_handle.close()
                # print(f"Closed file handle for {image_filename}") # Optional log
            except Exception as close_err:
                print(f"Error closing file handle for {image_filename}: {close_err}")


def call_got_ocr_format_text(image_path):
    """
    Calls the GOT-OCR service using the 'Format Text OCR' task, expecting
    structured output like Markdown, suitable for layout analysis.

    Args:
        image_path (str): Path to the image file.

    Returns:
        str: Extracted formatted text content, or an error string if failed, or None for critical errors.
    """
    if not os.path.exists(image_path):
        print(f"Error [call_got_ocr_format_text]: Image path not found: {image_path}")
        return "Error: Input image file not found."

    files = None
    file_handle = None
    task_desc = "[Format]" # For logging

    try:
        image_filename = os.path.basename(image_path)
        file_handle = open(image_path, 'rb')
        files = {'images': (image_filename, file_handle, 'image/png')}
        payload = {
            'task': 'Format Text OCR',
            'ocr_type': 'format' # Request formatted output
        }
        print(f"Calling GOT-OCR {task_desc} at {GOT_OCR_SERVICE_URL} for {image_filename}")

        response = requests.post(GOT_OCR_SERVICE_URL, files=files, data=payload, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()

        response_data = response.json()
        print(f"GOT-OCR {task_desc} Raw Response: {response_data}")

        # --- Parse the response for formatted text ---
        formatted_text = None
        if isinstance(response_data, dict):
            # Check common keys in a preferred order
            if 'formatted_text' in response_data: formatted_text = response_data['formatted_text']
            elif 'markdown_output' in response_data: formatted_text = response_data['markdown_output']
            elif 'result' in response_data and isinstance(response_data['result'], list) and len(response_data['result']) > 0 and 'text' in response_data['result'][0]: formatted_text = response_data['result'][0]['text']
            elif 'text' in response_data: formatted_text = response_data['text'] # Fallback
        # --- End Parsing ---

        if formatted_text is None:
            print(f"Warning: Could not parse formatted text from GOT-OCR {task_desc} response: {response_data}")
            return f"Error: Could not parse formatted result: {str(response_data)[:150]}..."
        else:
            print(f"Successfully extracted formatted text {task_desc} (length: {len(formatted_text)})")
            return formatted_text

    except requests.exceptions.Timeout:
        print(f"Error calling GOT-OCR service {task_desc}: Request timed out after {REQUEST_TIMEOUT} seconds.")
        return "Error: OCR service request timed out."
    except requests.exceptions.RequestException as e:
        print(f"Error calling GOT-OCR service {task_desc}: {e}")
        if "Connection refused" in str(e):
             return "Error: Could not connect to OCR service. Is it running?"
        return f"Error: Network error communicating with OCR service: {e}"
    except Exception as e:
        print(f"An unexpected error occurred during OCR call {task_desc}: {e}")
        import traceback
        traceback.print_exc()
        return f"Error: An unexpected error occurred during {task_desc} OCR: {e}"
    finally:
        if file_handle and not file_handle.closed:
            try:
                file_handle.close()
                # print(f"Closed file handle for {image_filename}")
            except Exception as close_err:
                print(f"Error closing file handle for {image_filename}: {close_err}")