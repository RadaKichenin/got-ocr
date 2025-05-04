# app.py (Corrected and Complete)

from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
import os
import uuid
import io
import subprocess # To run ocrmypdf command
import img2pdf # To convert images to PDF
import fitz # PyMuPDF - For getting page count and extracting text/images later
import cv2 # For image cropping
import numpy as np
from werkzeug.utils import secure_filename
# Import GOT-OCR callers
from utils.ocr import call_got_ocr_area, call_got_ocr_format_text

# --- Flask App Setup ---
app = Flask(__name__)
CORS(app)

# --- Configuration ---
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024 # 100MB limit
UPLOAD_FOLDER = 'uploads' # Temporary storage for uploads before processing
PROCESSED_PDF_DIR = 'processed_pdfs' # Storage for final OCR'd PDFs
TEMP_IMG_DIR = 'temp_images' # Temporary storage for images passed to GOT-OCR
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'tiff', 'bmp', 'gif'}
# DPI for extracting images for display/analysis
EXTRACT_DPI = 200 # 150-200 for display, maybe 300 for GOT-OCR analysis
# Path to ocrmypdf executable if not in system PATH
OCRMYPDF_PATH = os.getenv("OCRMYPDF_EXEC", "ocrmypdf") # Use env var or default

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(PROCESSED_PDF_DIR, exist_ok=True)
os.makedirs(TEMP_IMG_DIR, exist_ok=True)

# --- Helper Functions ---
def allowed_file(filename):
    """Checks if the file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_processed_pdf_path(doc_id):
     """Constructs the path to the processed PDF."""
     safe_doc_id = secure_filename(doc_id)
     # Use a consistent naming convention
     return os.path.join(PROCESSED_PDF_DIR, f"{safe_doc_id}_ocr.pdf")

def cleanup_file(filepath):
    """Safely remove a file if it exists."""
    if filepath and os.path.exists(filepath):
        try:
            os.remove(filepath)
            # print(f"Cleaned up temp file: {filepath}") # Optional log
        except OSError as e:
            print(f"Error cleaning up file {filepath}: {e}")

def ensure_dir(directory):
    """Creates a directory if it doesn't exist."""
    if not os.path.exists(directory):
        os.makedirs(directory, exist_ok=True)

# --- API Endpoints ---

@app.route('/upload', methods=['POST'])
def upload_and_process_ocrmypdf():
    """
    Handles uploads (PDF/Image), converts image to PDF if needed,
    runs ocrmypdf for cleaning, deskewing, OCR,
    and returns doc_id and page count.
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    if not file or not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 400

    original_filename = secure_filename(file.filename)
    file_ext = os.path.splitext(original_filename)[1].lower()
    doc_id = str(uuid.uuid4())
    temp_input_path = os.path.join(UPLOAD_FOLDER, f"{doc_id}_input{file_ext}")
    processed_pdf_path = get_processed_pdf_path(doc_id) # Final output path
    temp_pdf_for_ocrmypdf = None # Path to the PDF that ocrmypdf will process

    try:
        file.save(temp_input_path)
        print(f"File uploaded to temporary path: {temp_input_path}")

        # --- Convert Image to PDF if necessary ---
        if file_ext != ".pdf":
            temp_pdf_for_ocrmypdf = os.path.join(UPLOAD_FOLDER, f"{doc_id}_temp.pdf")
            print(f"Converting image {original_filename} to PDF...")
            try:
                with open(temp_pdf_for_ocrmypdf, "wb") as f_pdf:
                    f_pdf.write(img2pdf.convert(temp_input_path))
                print(f"Image converted to PDF: {temp_pdf_for_ocrmypdf}")
                input_to_ocr = temp_pdf_for_ocrmypdf
            except Exception as img_conv_err:
                 print(f"Error converting image to PDF: {img_conv_err}")
                 raise # Re-raise to be caught by the main try-except
        else:
            input_to_ocr = temp_input_path # Use original PDF directly

        # --- Run ocrmypdf ---
        ocrmypdf_command = [
            OCRMYPDF_PATH,
            "--output-type", "pdf",
            "--deskew",
            "--clean",
            "--rotate-pages",
            "--jobs", "4", # Adjust
            # "-l", "eng", # Add language if needed
            input_to_ocr,
            processed_pdf_path
        ]
        print(f"Running ocrmypdf: {' '.join(ocrmypdf_command)}")
        result = subprocess.run(ocrmypdf_command, capture_output=True, text=True, check=False)

        print("ocrmypdf stdout:\n", result.stdout)
        if result.returncode != 0:
             print("ocrmypdf stderr:\n", result.stderr)
             raise Exception(f"ocrmypdf failed with return code {result.returncode}.")
        else:
             print("ocrmypdf completed successfully.")

        # --- Get Page Count from Processed PDF ---
        page_count = 0
        if os.path.exists(processed_pdf_path):
            pdf_doc = None # Define before try
            try:
                pdf_doc = fitz.open(processed_pdf_path)
                page_count = len(pdf_doc)
                print(f"Processed PDF has {page_count} pages.")
            except Exception as count_err:
                 print(f"Error getting page count from processed PDF: {count_err}")
            finally:
                 if pdf_doc: pdf_doc.close() # Ensure close even on error

        # --- Return Success ---
        return jsonify({
            "message": "File processed successfully by ocrmypdf",
            "doc_id": doc_id,
            "page_count": page_count,
        }), 200

    except Exception as e:
        print(f"Error during upload/ocrmypdf processing: {e}")
        cleanup_file(processed_pdf_path) # Clean up potentially failed output
        return jsonify({"error": f"Processing failed: {e}"}), 500
    finally:
        # --- Cleanup Temporary Input Files ---
        cleanup_file(temp_input_path)
        if temp_pdf_for_ocrmypdf:
             cleanup_file(temp_pdf_for_ocrmypdf)


@app.route('/processed_image/<doc_id>/page/<int:page_num>', methods=['GET'])
def get_processed_pdf_page_image(doc_id, page_num):
    """Opens the OCR'd PDF and returns the requested page as a PNG image."""
    pdf_path = get_processed_pdf_path(doc_id)
    if not os.path.exists(pdf_path):
        return jsonify({"error": "Processed PDF not found"}), 404

    doc = None
    try:
        doc = fitz.open(pdf_path)
        if page_num < 0 or page_num >= len(doc):
            return jsonify({"error": "Page number out of range"}), 404

        page = doc.load_page(page_num)
        pix = page.get_pixmap(dpi=EXTRACT_DPI)
        img_buffer = io.BytesIO(pix.tobytes("png"))
        img_buffer.seek(0)

        return send_file(img_buffer, mimetype='image/png', as_attachment=False)
    except Exception as e:
        print(f"Error extracting page image {page_num} for doc {doc_id}: {e}")
        return jsonify({"error": "Failed to extract page image"}), 500
    finally:
        if doc: doc.close()


@app.route('/text/<doc_id>/page/<int:page_num>', methods=['GET'])
def get_ocr_text(doc_id, page_num):
    """Extracts the text layer embedded by ocrmypdf."""
    pdf_path = get_processed_pdf_path(doc_id)
    if not os.path.exists(pdf_path):
        return jsonify({"error": "Processed PDF not found"}), 404

    doc = None
    try:
        doc = fitz.open(pdf_path)
        if page_num < 0 or page_num >= len(doc):
            return jsonify({"error": "Page number out of range"}), 404

        page = doc.load_page(page_num)
        text = page.get_text("text")
        return jsonify({"page_text": text}), 200
    except Exception as e:
        print(f"Error extracting text for page {page_num} doc {doc_id}: {e}")
        return jsonify({"error": "Failed to extract text layer"}), 500
    finally:
         if doc: doc.close()


@app.route('/analyze_page', methods=['POST'])
def analyze_page_layout_got_ocr():
    """Extracts page image from OCR'd PDF and sends to GOT-OCR Format task."""
    data = request.get_json()
    if not data or 'doc_id' not in data or 'page_num' not in data: return jsonify({"error": "Missing params"}), 400

    doc_id = secure_filename(data['doc_id'])
    page_num = data['page_num']
    pdf_path = get_processed_pdf_path(doc_id)
    temp_img_dir = os.path.join(TEMP_IMG_DIR, doc_id) # Subdir for temp images
    ensure_dir(temp_img_dir)
    temp_img_path = os.path.join(temp_img_dir, f"page{page_num}_analyze_{uuid.uuid4()}.png")
    doc = None

    try:
        page_num_int = int(page_num)
    except ValueError:
        return jsonify({"error": "page_num must be an integer"}), 400

    if not os.path.exists(pdf_path): return jsonify({"error": "Processed PDF not found"}), 404

    try:
        # Extract page image
        doc = fitz.open(pdf_path)
        if page_num_int < 0 or page_num_int >= len(doc): raise ValueError("Page number out of range")
        page = doc.load_page(page_num_int)
        pix = page.get_pixmap(dpi=300) # Higher DPI for analysis
        pix.save(temp_img_path)
        doc.close(); doc = None # Close PDF now

        # Call GOT-OCR
        formatted_text = call_got_ocr_format_text(temp_img_path)

        if formatted_text is None or "Error:" in formatted_text:
            return jsonify({"error": formatted_text or "GOT-OCR Format call failed"}), 500
        return jsonify({"formatted_text": formatted_text}), 200

    except ValueError as ve:
         print(f"Value Error in /analyze_page: {ve}")
         return jsonify({"error": f"{ve}"}), 400
    except Exception as e:
        print(f"Error in /analyze_page for doc {doc_id}, page {page_num}: {e}")
        return jsonify({"error": f"Internal error during page analysis: {e}"}), 500
    finally:
        if doc: doc.close() # Ensure close if error happened before explicit close
        cleanup_file(temp_img_path)


@app.route('/ocr_area', methods=['POST'])
def ocr_selected_area_got_ocr():
    """Extracts page, crops based on coords, sends crop to GOT-OCR Box task."""
    data = request.get_json()
    if not data or 'doc_id' not in data or 'page_num' not in data or 'box_coordinates' not in data:
        return jsonify({"error": "Missing required parameters"}), 400

    doc_id = secure_filename(data['doc_id'])
    page_num = data['page_num']
    box_coords_str = data['box_coordinates']
    pdf_path = get_processed_pdf_path(doc_id)

    uuid_str = str(uuid.uuid4())
    temp_img_dir = os.path.join(TEMP_IMG_DIR, doc_id) # Subdir for temp images
    ensure_dir(temp_img_dir)
    temp_full_img_path = os.path.join(temp_img_dir, f"page{page_num}_full_{uuid_str}.png")
    temp_crop_img_path = os.path.join(temp_img_dir, f"page{page_num}_crop_{uuid_str}.png")

    doc = None
    try:
        page_num_int = int(page_num)
    except ValueError:
        return jsonify({"error": "page_num must be an integer"}), 400

    if not os.path.exists(pdf_path): return jsonify({"error": "Processed PDF not found"}), 404

    try:
        # 1. Extract full page image using EXTRACT_DPI
        doc = fitz.open(pdf_path)
        if page_num_int < 0 or page_num_int >= len(doc): raise ValueError("Page number out of range")
        page = doc.load_page(page_num_int)
        pix = page.get_pixmap(dpi=EXTRACT_DPI) # Match DPI used for coord calculation
        doc.close(); doc = None # Close PDF now
        pix.save(temp_full_img_path)

        # 2. Parse coordinates
        try:
            import json
            coords = json.loads(box_coords_str)
            if not isinstance(coords, list) or len(coords) != 4: raise ValueError("Coords must be list of 4")
            x1, y1, x2, y2 = map(int, coords)
        except Exception as e_parse:
             raise ValueError(f"Invalid box_coordinates format: {box_coords_str}. Error: {e_parse}")

        # 3. Load with OpenCV and Crop
        img_full = cv2.imread(temp_full_img_path)
        if img_full is None: raise IOError("Could not read temporary page image")
        h_img, w_img = img_full.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w_img, x2), min(h_img, y2)
        if x2 <= x1 or y2 <= y1: raise ValueError("Invalid crop dimensions after clamping")
        cropped_img = img_full[y1:y2, x1:x2]

        # 4. Save cropped image temporarily
        save_success = cv2.imwrite(temp_crop_img_path, cropped_img)
        if not save_success: raise IOError("Could not save temporary cropped image")

        # 5. Call GOT-OCR Area task
        extracted_text = call_got_ocr_area(temp_crop_img_path, box_coords_str)

        if extracted_text is None or "Error:" in extracted_text:
            # Pass specific error message back if available
            return jsonify({"error": extracted_text or "GOT-OCR Area call failed"}), 500

        return jsonify({"extracted_text": extracted_text}), 200

    except ValueError as ve:
         print(f"Value Error in /ocr_area for doc {doc_id}, page {page_num}: {ve}")
         return jsonify({"error": f"{ve}"}), 400
    except IOError as ioe:
         print(f"IO Error in /ocr_area for doc {doc_id}, page {page_num}: {ioe}")
         return jsonify({"error": f"Image handling error: {ioe}"}), 500
    except Exception as e:
        print(f"Error in /ocr_area for doc {doc_id}, page {page_num}: {e}")
        return jsonify({"error": f"Internal error during area OCR: {e}"}), 500
    finally:
        if doc: doc.close() # Ensure close if error occurred before explicit close
        cleanup_file(temp_full_img_path)
        cleanup_file(temp_crop_img_path)


@app.route('/analyze_document', methods=['POST'])
def analyze_full_document():
    """
    Iterates through pages, extracts image, calls GOT-OCR Format Text for layout analysis.
    """
    data = request.get_json()
    if not data or 'doc_id' not in data: return jsonify({"error": "Missing doc_id"}), 400
    doc_id = secure_filename(data['doc_id'])
    pdf_path = get_processed_pdf_path(doc_id)
    if not os.path.exists(pdf_path): return jsonify({"error": "Processed PDF not found"}), 404

    results = {}
    errors = {}
    page_count = 0
    temp_img_dir = os.path.join(TEMP_IMG_DIR, doc_id, "analyze_doc") # Temp dir for this run
    ensure_dir(temp_img_dir)
    doc = None # Define outside loop for finally

    try:
        doc = fitz.open(pdf_path)
        page_count = len(doc)
        print(f"Analyzing document {doc_id} with {page_count} pages...")

        for page_num in range(page_count):
            page_num_str = str(page_num)
            temp_img_path = None # Reset for each page
            print(f"  - Analyzing page {page_num + 1}/{page_count}...")
            try:
                page = doc.load_page(page_num)
                pix = page.get_pixmap(dpi=300) # Use 300 DPI for analysis
                temp_img_path = os.path.join(temp_img_dir, f"page_{page_num}.png")
                pix.save(temp_img_path)

                formatted_text = call_got_ocr_format_text(temp_img_path)

                if formatted_text is None or "Error:" in formatted_text:
                     errors[page_num_str] = formatted_text or "Unknown OCR error"
                     results[page_num_str] = "" # Store empty string for failed pages
                     print(f"    - Error analyzing page {page_num}: {errors[page_num_str]}")
                else:
                     results[page_num_str] = formatted_text
                     print(f"    - Success analyzing page {page_num} (Length: {len(formatted_text)})")

            except Exception as page_err:
                errors[page_num_str] = f"Unexpected error processing page: {page_err}"
                results[page_num_str] = ""
                print(f"    - Unexpected error for page {page_num}: {page_err}")
            finally:
                 cleanup_file(temp_img_path) # Clean up this page's temp image

        print(f"Finished analyzing document {doc_id}. Success pages: {len(results) - len(errors)}, Errors: {len(errors)}")
        return jsonify({"page_results": results, "errors": errors}), 200

    except Exception as e:
        print(f"Error during full document analysis for doc {doc_id}: {e}")
        return jsonify({"error": "Failed to analyze document"}), 500
    finally:
         if doc: doc.close()
         # Clean up temp directory after loop (optional, might remove files needed by other requests if not careful)
         # import shutil
         # shutil.rmtree(temp_img_dir, ignore_errors=True)


@app.route('/export_text', methods=['POST'])
def export_text_file():
    """Receives text content and returns it as a downloadable text file."""
    data = request.get_json()
    if not data or 'text_content' not in data:
        return jsonify({"error": "Missing 'text_content'"}), 400

    text_content = data['text_content']
    filename = secure_filename(data.get('filename', 'exported_text.txt'))
    mem_file = io.BytesIO()
    mem_file.write(text_content.encode('utf-8'))
    mem_file.seek(0)
    return Response(
        mem_file,
        mimetype='text/plain',
        headers={'Content-Disposition': f'attachment;filename={filename}'}
    )

# --- Run the App ---
if __name__ == '__main__':
    # Consider using a production WSGI server like Gunicorn or Waitress instead of debug mode
    app.run(host='0.0.0.0', port=5001, debug=True) # Set debug=False for production