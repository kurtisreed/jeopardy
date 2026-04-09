#!/usr/bin/env python3
"""
Jeopardy PDF → ZIP converter
Converts a 53-slide Jeopardy PDF into a ZIP of JPEGs ready to upload.

Usage:
    python3 convert_pdf.py "path/to/game.pdf"

Tip: In Terminal, type  python3 convert_pdf.py  then drag your PDF file
     onto the Terminal window, then press Enter.
"""

import sys
import os
import zipfile
import tempfile

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Error: PyMuPDF is not installed.")
    print("Run this first:  pip3 install pymupdf")
    sys.exit(1)

EXPECTED_PAGES = 53
DPI = 300
JPG_QUALITY = 90


def convert(pdf_path):
    pdf_path = pdf_path.strip()

    if not os.path.exists(pdf_path):
        print(f"Error: File not found: {pdf_path}")
        sys.exit(1)

    if not pdf_path.lower().endswith('.pdf'):
        print("Error: File must be a PDF.")
        sys.exit(1)

    doc = fitz.open(pdf_path)
    num_pages = len(doc)

    if num_pages != EXPECTED_PAGES:
        print(f"Error: PDF has {num_pages} page(s), expected {EXPECTED_PAGES}.")
        print("Make sure you're using the Jeopardy Google Slides template and exported all slides.")
        doc.close()
        sys.exit(1)

    pdf_dir = os.path.dirname(os.path.abspath(pdf_path))
    pdf_stem = os.path.splitext(os.path.basename(pdf_path))[0]
    zip_path = os.path.join(pdf_dir, f"{pdf_stem}.zip")

    print(f"Converting {num_pages} pages at {DPI} DPI...")

    scale = DPI / 72
    mat = fitz.Matrix(scale, scale)

    with tempfile.TemporaryDirectory() as tmpdir:
        for i in range(num_pages):
            page = doc[i]
            pix = page.get_pixmap(matrix=mat)
            img_path = os.path.join(tmpdir, f"{i + 1:04d}.jpg")
            pix.save(img_path, jpg_quality=JPG_QUALITY)
            print(f"  {i + 1}/{num_pages}", end='\r')

        print()
        print(f"Creating ZIP...")

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for i in range(1, num_pages + 1):
                zf.write(os.path.join(tmpdir, f"{i:04d}.jpg"), f"{i:04d}.jpg")

    doc.close()
    print(f"\nDone! Upload this file:\n  {zip_path}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    convert(' '.join(sys.argv[1:]))
