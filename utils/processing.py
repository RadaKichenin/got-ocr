import fitz  # PyMuPDF
from PIL import Image
import os
import cv2 # OpenCV for potential enhancements
import numpy as np
from werkzeug.utils import secure_filename

# --- Configuration ---
# Directory to store processed images, relative to app.py
PROCESSED_DIR = "processed"
# DPI for rendering PDF pages
PDF_DPI = 300

# --- Helper Functions ---

def ensure_dir(directory):
    """Creates a directory if it doesn't exist."""
    if not os.path.exists(directory):
        os.makedirs(directory)

def enhance_image(image_path):
    """
    Placeholder for image enhancement.
    Implement skew correction, contrast adjustment etc. here using OpenCV.
    For now, it just reads and writes the image.
    """
    try:
        img = cv2.imread(image_path)
        if img is None:
            print(f"Warning: Could not read image for enhancement: {image_path}")
            return False

        # TODO: Implement actual enhancement steps
        # 1. Grayscaling (often good for OCR)
        # gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # 2. Skew Correction (complex - might need libraries like deskew)
        # corrected_img = deskew_function(gray)
        # 3. Contrast Adjustment (e.g., CLAHE)
        # clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        # contrast_img = clahe.apply(corrected_img if 'corrected_img' in locals() else gray)
        # 4. Noise Reduction (optional)
        # final_img = cv2.fastNlMeansDenoising(contrast_img, None, 10, 7, 21)

        # For now, just use the original image - replace 'img' with final processed image later
        processed_img = img

        # Overwrite the original file with the processed one (or save with new name)
        cv2.imwrite(image_path, processed_img)
        print(f"Placeholder enhancement applied to {image_path}")
        return True
    except Exception as e:
        print(f"Error during image enhancement for {image_path}: {e}")
        return False

def process_document(file_path, doc_id):
    """
    Converts PDF pages to images or processes single images.
    Applies basic preprocessing/enhancement.
    Saves processed images to processed/<doc_id>/page_<n>.png
    Returns a list of processed image filenames (relative to PROCESSED_DIR/<doc_id>).
    """
    filename = secure_filename(os.path.basename(file_path))
    doc_processed_dir = os.path.join(PROCESSED_DIR, doc_id)
    ensure_dir(doc_processed_dir)
    processed_files = []
    file_ext = os.path.splitext(filename)[1].lower()

    if file_ext == ".pdf":
        try:
            doc = fitz.open(file_path)
            for i, page in enumerate(doc):
                pix = page.get_pixmap(dpi=PDF_DPI)
                output_filename = f"page_{i}.png"
                output_path = os.path.join(doc_processed_dir, output_filename)
                pix.save(output_path)

                # Apply enhancement (currently placeholder)
                enhance_image(output_path)

                processed_files.append(output_filename)
            doc.close()
            print(f"Processed PDF {filename} into {len(processed_files)} pages.")
        except Exception as e:
            print(f"Error processing PDF {filename}: {e}")
            # Consider cleanup if partial processing occurred
            return None # Indicate failure
    elif file_ext in [".png", ".jpg", ".jpeg", ".tiff", ".bmp"]:
        try:
            output_filename = f"page_0.png" # Treat single images as page 0
            output_path = os.path.join(doc_processed_dir, output_filename)
            # Read and save as PNG to standardize format and apply enhancement
            img = Image.open(file_path)
            img.save(output_path, "PNG")
            img.close()

            # Apply enhancement (currently placeholder)
            enhance_image(output_path)

            processed_files.append(output_filename)
            print(f"Processed image {filename}.")
        except Exception as e:
            print(f"Error processing image {filename}: {e}")
            return None # Indicate failure
    else:
        print(f"Unsupported file type: {filename}")
        return None # Indicate failure

    return processed_files