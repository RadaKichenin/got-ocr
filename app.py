from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
import os
import uuid
import io
from werkzeug.utils import secure_filename
from utils.processing import process_document, ensure_dir, PROCESSED_DIR
from utils.ocr import call_got_ocr_area

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