from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
import os
import uuid
import io
from werkzeug.utils import secure_filename
from utils.processing import process_document, ensure_dir, PROCESSED_DIR
from utils.ocr import call_got_ocr_area, call_got_ocr_format_text

# --- Flask App Setup ---
app = Flask(__name__)
CORS(app) # Allow requests from your frontend domain

# --- Configuration ---
# Max file size (e.g., 50MB)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
# Directory to store temporary uploads
UPLOAD_FOLDER = 'uploads'
# Allowed file extensions
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'tiff', 'bmp'}

ensure_dir(UPLOAD_FOLDER)
ensure_dir(PROCESSED_DIR)

# --- Helper Functions ---
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- API Endpoints ---

@app.route('/upload', methods=['POST'])
def upload_file():
    """
    Handles file uploads (PDF or images).
    Generates a unique doc_id, processes the file (PDF to images, enhancement),
    and returns the doc_id and list of page image URLs.
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        doc_id = str(uuid.uuid4()) # Unique ID for this document session
        upload_path = os.path.join(UPLOAD_FOLDER, f"{doc_id}_{filename}")

        try:
            file.save(upload_path)
            print(f"File uploaded to {upload_path}")

            # Process the document (convert to images, enhance)
            processed_filenames = process_document(upload_path, doc_id)

            if processed_filenames is None:
                 # Processing failed
                 # Clean up uploaded file?
                 if os.path.exists(upload_path): os.remove(upload_path)
                 return jsonify({"error": "Failed to process document"}), 500

            # Generate URLs relative to the backend root for the frontend to fetch
            page_image_urls = [f"/processed_image/{doc_id}/{fname}" for fname in processed_filenames]

            # Clean up original uploaded file after processing
            if os.path.exists(upload_path):
                os.remove(upload_path)
                print(f"Removed original upload: {upload_path}")

            return jsonify({
                "message": "File processed successfully",
                "doc_id": doc_id,
                "page_count": len(page_image_urls),
                "page_image_urls": page_image_urls # URLs to fetch images
            }), 200

        except Exception as e:
            print(f"Error during upload/processing: {e}")
            # Clean up if upload path exists
            if os.path.exists(upload_path): os.remove(upload_path)
            # Clean up processed dir if it exists? Might be complex if partial
            return jsonify({"error": f"An internal error occurred: {e}"}), 500
    else:
        return jsonify({"error": "File type not allowed"}), 400

@app.route('/processed_image/<doc_id>/<path:filename>', methods=['GET'])
def get_processed_image(doc_id, filename):
    """Serves a specific processed page image."""
    # Basic security check on doc_id and filename
    safe_doc_id = secure_filename(doc_id)
    safe_filename = secure_filename(filename)
    directory = os.path.join(PROCESSED_DIR, safe_doc_id)

    # Check if directory and file exist before serving
    if not os.path.isdir(directory) or not os.path.exists(os.path.join(directory, safe_filename)):
         return jsonify({"error": "Image not found"}), 404

    try:
        return send_from_directory(directory, safe_filename)
    except Exception as e:
        print(f"Error serving image {safe_filename} for doc {safe_doc_id}: {e}")
        return jsonify({"error": "Could not serve image"}), 500


@app.route('/ocr_area', methods=['POST'])
def ocr_selected_area():
    """
    Receives doc_id, page number, and bounding box coordinates.
    Calls the GOT-OCR service for the specified area of the page image.
    Returns the extracted text.
    """
    data = request.get_json()
    if not data or 'doc_id' not in data or 'page_num' not in data or 'box_coordinates' not in data:
        return jsonify({"error": "Missing required parameters: doc_id, page_num, box_coordinates"}), 400

    doc_id = secure_filename(data['doc_id'])
    try:
        page_num = int(data['page_num'])
    except ValueError:
        return jsonify({"error": "page_num must be an integer"}), 400

    box_coordinates = data['box_coordinates'] # Expecting string "[x1,y1,x2,y2]"

    # Construct the path to the specific processed page image
    image_filename = f"page_{page_num}.png"
    image_path = os.path.join(PROCESSED_DIR, doc_id, image_filename)

    if not os.path.exists(image_path):
        return jsonify({"error": f"Processed image not found for page {page_num}"}), 404

    # Call the utility function to interact with GOT-OCR
    extracted_text = call_got_ocr_area(image_path, box_coordinates)

    if extracted_text is None:
        return jsonify({"error": "Failed to get OCR result from GOT-OCR service"}), 500
    elif "Error:" in extracted_text: # Check if our wrapper returned an error string
         return jsonify({"error": extracted_text}), 500

    return jsonify({"extracted_text": extracted_text}), 200

# --- NEW ENDPOINT ---
@app.route('/analyze_page', methods=['POST'])
def analyze_full_page():
    """
    Receives doc_id and page number.
    Calls the GOT-OCR service using 'Format Text OCR' task for the whole page.
    Returns the extracted formatted text (hopefully Markdown).
    """
    data = request.get_json()
    if not data or 'doc_id' not in data or 'page_num' not in data:
        return jsonify({"error": "Missing required parameters: doc_id, page_num"}), 400

    doc_id = secure_filename(data['doc_id'])
    try:
        page_num = int(data['page_num'])
    except ValueError:
        return jsonify({"error": "page_num must be an integer"}), 400

    # Construct the path to the specific processed page image
    image_filename = f"page_{page_num}.png"
    image_path = os.path.join(PROCESSED_DIR, doc_id, image_filename)

    if not os.path.exists(image_path):
        return jsonify({"error": f"Processed image not found for page {page_num}"}), 404

    # Call the utility function to interact with GOT-OCR for formatted text
    formatted_text = call_got_ocr_format_text(image_path)

    if formatted_text is None:
        return jsonify({"error": "Failed to get analysis result from GOT-OCR service [Format]"}), 500
    elif "Error:" in formatted_text: # Check for internal error string
        return jsonify({"error": formatted_text}), 500

    # Return the raw formatted text string
    return jsonify({"formatted_text": formatted_text}), 200
# --- END NEW ENDPOINT ---

# --- NEW ENDPOINT for Document Analysis ---
@app.route('/analyze_document', methods=['POST'])
def analyze_full_document():
    """
    Receives doc_id. Iterates through all processed pages for that doc_id,
    calls GOT-OCR 'Format Text OCR' for each, and returns a dictionary
    mapping page numbers (as strings) to their formatted text results.
    """
    data = request.get_json()
    if not data or 'doc_id' not in data:
        return jsonify({"error": "Missing required parameter: doc_id"}), 400

    doc_id = secure_filename(data['doc_id'])
    doc_processed_dir = os.path.join(PROCESSED_DIR, doc_id)

    if not os.path.isdir(doc_processed_dir):
        return jsonify({"error": "Processed document not found"}), 404

    results = {}
    errors = {}
    page_files = sorted([f for f in os.listdir(doc_processed_dir) if f.startswith('page_') and f.endswith('.png')],
                       key=lambda x: int(x.split('_')[1].split('.')[0])) # Sort numerically

    if not page_files:
        return jsonify({"error": "No processed pages found for this document"}), 404

    print(f"Analyzing document {doc_id} with {len(page_files)} pages...")

    for page_filename in page_files:
        try:
            page_num_str = page_filename.split('_')[1].split('.')[0]
            page_num = int(page_num_str)
            image_path = os.path.join(doc_processed_dir, page_filename)

            print(f"  - Analyzing page {page_num}...")
            formatted_text = call_got_ocr_format_text(image_path)

            if formatted_text is None or "Error:" in formatted_text:
                errors[page_num_str] = formatted_text or "Unknown OCR error"
                results[page_num_str] = "" # Put empty string for failed pages in results
                print(f"    - Error analyzing page {page_num}: {errors[page_num_str]}")
            else:
                results[page_num_str] = formatted_text
                print(f"    - Success analyzing page {page_num} (Length: {len(formatted_text)})")

        except Exception as e:
            page_num_str = page_filename.split('_')[1].split('.')[0] # Try to get page num for error reporting
            errors[page_num_str] = f"Unexpected error processing page: {e}"
            results[page_num_str] = ""
            print(f"    - Unexpected error for page {page_num_str}: {e}")

    print(f"Finished analyzing document {doc_id}. Success: {len(results) - len(errors)}, Errors: {len(errors)}")

    # Return dictionary of page results and any errors encountered
    return jsonify({
        "page_results": results, # { "0": "text page 0", "1": "text page 1", ... }
        "errors": errors        # { "2": "OCR Error message", ... }
        }), 200
# --- END Document Analysis Endpoint ---


@app.route('/export_text', methods=['POST'])
def export_text_file():
    """
    Receives text content and returns it as a downloadable text file.
    (Simplified version for now - later this could take structured data for Excel).
    """
    data = request.get_json()
    if not data or 'text_content' not in data:
        return jsonify({"error": "Missing 'text_content' in request body"}), 400

    text_content = data['text_content']
    filename = data.get('filename', 'extracted_text.txt') # Allow optional filename
    safe_filename = secure_filename(filename)

    # Create a file-like object in memory
    mem_file = io.BytesIO()
    mem_file.write(text_content.encode('utf-8'))
    mem_file.seek(0) # Rewind to the beginning of the stream

    return Response(
        mem_file,
        mimetype='text/plain',
        headers={'Content-Disposition': f'attachment;filename={safe_filename}'}
    )

# --- Run the App ---
if __name__ == '__main__':
    # Use 0.0.0.0 to make it accessible on your network
    # Debug=True automatically reloads on code changes, but disable for production
    app.run(host='0.0.0.0', port=5001, debug=True)