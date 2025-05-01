import fitz  # PyMuPDF
import os
import cv2 # OpenCV for image processing
import numpy as np # For numerical operations (used with OpenCV)
from werkzeug.utils import secure_filename
import time # For unique debug filenames
from deskew import determine_skew

# --- Configuration ---
PROCESSED_DIR = "processed"
PDF_DPI = 300
MAX_SKEW_ANGLE = 95     # Max angle (degrees) considered valid skew
MIN_SKEW_THRESHOLD = 0.05 # Min angle (degrees) to apply correction for
UNCONDITIONAL_CROP_MARGIN = 30 # Adjust as needed
SAVE_DEBUG_IMAGES = True
DEBUG_DIR = "debug_images"

# --- Helper Functions ---
def ensure_dir(directory):
    if not os.path.exists(directory): os.makedirs(directory)
if SAVE_DEBUG_IMAGES: ensure_dir(DEBUG_DIR)

def get_skew_angle_contours(original_gray_image: np.ndarray, debug_prefix="skew") -> float:
    print(f"  - Starting hybrid skew detection...")

    image = original_gray_image.copy()
    if len(image.shape) > 2:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    h, w = image.shape
    margin = UNCONDITIONAL_CROP_MARGIN
    image = image[margin:h-margin, margin:w-margin]

    if SAVE_DEBUG_IMAGES:
        cv2.imwrite(os.path.join(DEBUG_DIR, f"{debug_prefix}_input_for_deskew.png"), image)

    try:
        angle = determine_skew(image)
        print(f"  - deskew detected angle: {angle:.2f} degrees")
    except Exception as e:
        print(f"  - Deskew angle detection failed: {e}")
        angle = 0.0

    if abs(angle) < MIN_SKEW_THRESHOLD:
        print("  - Deskew returned near-zero angle, applying Hough fallback...")

        edges = cv2.Canny(image, 50, 150, apertureSize=3)
        lines = cv2.HoughLines(edges, 1, np.pi / 180.0, 200)
        angles = []

        if lines is not None:
            for rho, theta in lines[:, 0]:
                angle_deg = np.rad2deg(theta) - 90
                if -45 < angle_deg < 45:
                    angles.append(angle_deg)

        if angles:
            angle = np.median(angles)
            print(f"  - Hough fallback detected angle: {angle:.2f} degrees")
        else:
            print("  - No valid lines from Hough fallback.")
            angle = 0.0

    if abs(angle) > MAX_SKEW_ANGLE:
        print(f"  - Angle {angle:.2f} too large. Ignoring.")
        return 0.0
    if abs(angle) < MIN_SKEW_THRESHOLD:
        print(f"  - Angle {angle:.2f} too small. Ignoring.")
        return 0.0

    return float(-angle)  # rotate counter-clockwise
    
# --- rotate_image function (remains the same) ---
def rotate_image(image: np.ndarray, angle: float, background_color=(255,)) -> np.ndarray:
    if abs(angle) < 0.001: return image
    print(f"  - Applying rotation of {angle:.2f} degrees")
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(image, M, (w, h),
                             flags=cv2.INTER_CUBIC,
                             borderMode=cv2.BORDER_CONSTANT,
                             borderValue=background_color)
    return rotated

# --- enhance_image function (remains the same, calls new get_skew_angle_contours) ---
def enhance_image(image_path, page_index):
    debug_prefix = f"page{page_index}_{int(time.time() * 1000)}"
    try:
        img_color = cv2.imread(image_path)
        if img_color is None: raise IOError(f"Could not read image: {image_path}")
        print(f"Enhancing image: {image_path}")

        gray = cv2.cvtColor(img_color, cv2.COLOR_BGR2GRAY)
        print("  - Converted to grayscale")
        if SAVE_DEBUG_IMAGES: cv2.imwrite(os.path.join(DEBUG_DIR, f"{debug_prefix}_0_gray.png"), gray)

        deskewed_gray = gray
        original_gray_for_rotation = gray.copy()
        try:
            skew_angle = get_skew_angle_contours(gray, debug_prefix=debug_prefix)
            if skew_angle is not None and abs(skew_angle) > 0.0:
                deskewed_gray = rotate_image(original_gray_for_rotation, skew_angle, background_color=(255,))
                if SAVE_DEBUG_IMAGES: cv2.imwrite(os.path.join(DEBUG_DIR, f"{debug_prefix}_5_rotated.png"), deskewed_gray)
            else:
                 deskewed_gray = original_gray_for_rotation
        except Exception as e_skew:
            print(f"  - Warning: Skew correction process failed: {e_skew}.")
            deskewed_gray = original_gray_for_rotation

        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        contrast_img = clahe.apply(deskewed_gray)
        print("  - Applied CLAHE contrast enhancement")
        if SAVE_DEBUG_IMAGES: cv2.imwrite(os.path.join(DEBUG_DIR, f"{debug_prefix}_6_clahe.png"), contrast_img)

        denoised_img = cv2.fastNlMeansDenoising(contrast_img, None, h=10, templateWindowSize=7, searchWindowSize=21)
        print("  - Applied denoising")
        if SAVE_DEBUG_IMAGES: cv2.imwrite(os.path.join(DEBUG_DIR, f"{debug_prefix}_7_denoised.png"), denoised_img)

        success = cv2.imwrite(image_path, denoised_img)
        if not success: raise IOError(f"Failed to write enhanced image: {image_path}")

        print(f"Successfully enhanced and saved {image_path}")
        return True
    except Exception as e:
        print(f"Error during image enhancement pipeline for {image_path}: {e}")
        return False

# --- process_document function (remains the same) ---
def process_document(file_path, doc_id):
    filename = secure_filename(os.path.basename(file_path))
    doc_processed_dir = os.path.join(PROCESSED_DIR, doc_id)
    ensure_dir(doc_processed_dir)
    processed_files = []
    file_ext = os.path.splitext(filename)[1].lower()

    if file_ext == ".pdf":
        try:
            doc = fitz.open(file_path)
            print(f"Processing PDF {filename}, {len(doc)} pages...")
            for i, page in enumerate(doc):
                page_num = i
                print(f"  - Processing page {page_num + 1}/{len(doc)}")
                pix = page.get_pixmap(dpi=PDF_DPI)
                output_filename = f"page_{page_num}.png"
                output_path = os.path.join(doc_processed_dir, output_filename)
                try:
                    pix.save(output_path)
                except Exception as save_err:
                     print(f"    - Error saving initial PNG for page {page_num + 1}: {save_err}")
                     continue
                if not enhance_image(output_path, page_num):
                    print(f"    - Warning: Enhancement failed for page {page_num + 1}")
                processed_files.append(output_filename)
            doc.close()
            print(f"Finished processing PDF {filename}.")
        except Exception as e:
            print(f"Error processing PDF {filename}: {e}")
            return None
    elif file_ext in [".png", ".jpg", ".jpeg", ".tiff", ".bmp"]:
        try:
            print(f"Processing image {filename}...")
            output_filename = f"page_0.png"
            output_path = os.path.join(doc_processed_dir, output_filename)
            img_temp = cv2.imread(file_path)
            if img_temp is None: raise IOError(f"Failed to read input image {filename}")
            save_success = cv2.imwrite(output_path, img_temp)
            del img_temp
            if not save_success: raise IOError(f"Failed to save temporary PNG for image {filename}")
            if not enhance_image(output_path, 0):
                 print(f"    - Warning: Enhancement failed for image {filename}")
            processed_files.append(output_filename)
            print(f"Finished processing image {filename}.")
        except Exception as e:
            print(f"Error processing image {filename}: {e}")
            return None
    else:
        print(f"Unsupported file type: {filename}")
        return None

    return processed_files