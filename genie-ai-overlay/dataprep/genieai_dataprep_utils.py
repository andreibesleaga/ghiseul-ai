
# Copyright (C) 2025 International Telecommunication Union (ITU)
# SPDX-License-Identifier: Apache-2.0


import easyocr
import pymupdf
import fitz 
import cv2
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed 

# Note:- imorted the os package
import os
import asyncio


from docling.document_converter import (
    DocumentConverter,
    PdfFormatOption,
    WordFormatOption,
    )
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import (
    PdfPipelineOptions, 
    EasyOcrOptions, 
    )

# Might need to check the path
from comps.dataprep.src.utils import document_loader as origin_document_loader

from comps import CustomLogger

logger = CustomLogger("genie-ai_prepare_doc_util")
logflag = os.getenv("LOGFLAG", False)

reader = easyocr.Reader(['en']) # Can add more languages later

try:
    # configuring Docling to use easyocr (more lightweight than OPEA default library)
    ocr_options = EasyOcrOptions(lang=['en']) 
    
    # Pipeline for PDFs and Images (for layout analysis and OCR)
    pdf_and_image_pipeline_config = PdfPipelineOptions(
        do_ocr=True,  
        ocr_options=ocr_options
    )

    # Map PDF file type to relevant pipeline
    format_options = {
        InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_and_image_pipeline_config),
        # Later can add pipelines for other file formats
        }

    # 5. Initialize the converter once, passing the format_options dict
    docling_converter = DocumentConverter(format_options=format_options)

except ImportError:
    print("Please install docling and its dependencies: pip install docling easyocr")
    raise
    

### Docling document loader ############################################################
# Serves as a more heavy and robust tool for extracting content from more complex PDF files
async def load_with_docling(doc_path: str) -> str:
    """
    Asynchronously processes any Docling-supported file (PDF, DOCX, PPTX,
    HTML, images, etc.) and returns its content as RAG-ready Markdown.
    """
    def process_doc():
        # .convert() handles parsing, layout analysis, table extraction, and OCR
        result = docling_converter.convert(doc_path)
        # Exporting to Markdown for enhanced readability.
        return result.document.export_to_markdown()

    loop = asyncio.get_running_loop()
    content = await loop.run_in_executor(None, process_doc)
    return content

async def docling_document_loader(doc_path):
    # other file formats to be added later (docx, csv, html, ...)
    if (
        doc_path.endswith(".pdf")
        or doc_path.endswith(".xlsx") # Docling handles XLSX
        ):

        return await load_with_docling(doc_path)

    else:
        print(f'File type {doc_path} not supported by Docling')


def genieai_process_page(doc, idx):
    page = doc.load_page(idx)
    pagetext = page.get_text().strip()
    result = pagetext if pagetext.endswith(("!", "?", ".")) else pagetext + "."

    page_images = doc.get_page_images(idx)
    if page_images:
        for img_index, img in enumerate(page_images):
            xref = img[0]
            img_data = doc.extract_image(xref)
            img_bytes = img_data["image"]

            # process images
            img_array = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
            # img_result = pytesseract.image_to_string(img_array, lang="eng", config="--psm 6")
            img_result = ''.join(reader.readtext(img_array, detail = 0)) 

            # add results
            pageimg = img_result.strip()
            pageimg += "" if pageimg.endswith(("!", "?", ".")) else "."
            result += pageimg

    return result


def genieai_load_pdf(pdf_path):
    # doc = fitz.open(pdf_path)
    doc = pymupdf.open(pdf_path)
    results = {}

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(genieai_process_page, doc, i): i for i in range(doc.page_count)}
        for future in as_completed(futures):
            page_idx = futures[future]
            results[page_idx] = future.result()

    combined_result = "".join(results[i] for i in sorted(results))
    return combined_result


async def document_loader(doc_path):
    if doc_path.endswith(".pdf"):
        # return await load_pdf_async(doc_path) # to be tested later
        return genieai_load_pdf(doc_path)
    elif doc_path.endswith(".txt") or doc_path.endswith(".md"):
        try:
             with open(doc_path, "r", encoding="utf-8") as f:
                 return f.read()
        except UnicodeDecodeError:
             # Fallback to latin-1
             try:
                 with open(doc_path, "r", encoding="latin-1") as f:
                     return f.read()
             except Exception as e:
                 print(f"Error reading text file {doc_path} with latin-1: {e}")
                 # Final fallback: ignore errors
                 try:
                     with open(doc_path, "r", encoding="utf-8", errors="ignore") as f:
                         return f.read()
                 except Exception as e2:
                    print(f"Error reading text file {doc_path} with ignore: {e2}")
                    return ""
        except Exception as e:
             print(f"Error reading text file {doc_path}: {e}")
             return ""
    else:
        return origin_document_loader(doc_path)


def is_valid_content(chunk):
    """Check if the chunk content is suitable for llm to process, rather than web archive content or base64 encoded content."""
    if not chunk:
        return False

    # Check if content is predominantly base64/web archive
    lines = chunk.split('\n')
    
    # Count problematic lines
    problematic_lines = 0
    for line in lines:
        line = line.strip()
        if (line.startswith('//') or 
            'base64' in line.lower() or
            'MIME-Version' in line or
            'Content-Type:' in line or
            'Content-Transfer-Encoding' in line or
            line.startswith('------=_NextPart_') or
            # Base64 pattern: long strings of alphanumeric chars with + and /
            (len(line) > 50 and line.replace('+', '').replace('/', '').replace('=', '').isalnum())):
            problematic_lines += 1
    
    # If more than 50% of lines are problematic, consider it invalid
    if len(lines) > 0 and problematic_lines / len(lines) > 0.5:
        return False
    
    # Also check for readable text content
    readable_chars = sum(1 for char in chunk if char.isalnum() or char.isspace())
    if len(chunk) > 0 and readable_chars / len(chunk) < 0.7:
        return False
    
    return True
    