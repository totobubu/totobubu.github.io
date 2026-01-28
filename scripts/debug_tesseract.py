import sys
import os
import pytesseract
from PIL import Image

# Tesseract Setup
TESSERACT_CMD_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    r"C:\Users\User\AppData\Local\Programs\Tesseract-OCR\tesseract.exe",
]

def setup_tesseract():
    try:
        pytesseract.get_tesseract_version()
        return True
    except:
        pass
    for path in TESSERACT_CMD_PATHS:
        if os.path.exists(path):
            pytesseract.pytesseract.tesseract_cmd = path
            return True
    return False

if not setup_tesseract():
    print("Tesseract not found")
    sys.exit(1)

img_path = r"public/screenshot/graniteshares_2026-01-23.JPG"
if not os.path.exists(img_path):
    print(f"File not found: {img_path}")
    sys.exit(1)

try:
    text = pytesseract.image_to_string(Image.open(img_path))
    print("--- OCR OUTPUT ---")
    print(text)
    print("------------------")
except Exception as e:
    print(f"Error: {e}")
