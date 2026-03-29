import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io
import os
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class TextExtractor:

    @staticmethod
    async def extract_from_pdf(file_path: str) -> dict:
        """Extract text from PDF using PyMuPDF"""
        try:
            doc  = fitz.open(file_path)
            text = ""

            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text += page.get_text("text")

                # Also extract from images in PDF
                image_list = page.get_images(full=True)
                for img_index, img in enumerate(image_list):
                    try:
                        xref       = img[0]
                        base_image = doc.extract_image(xref)
                        image_data = base_image["image"]
                        image      = Image.open(io.BytesIO(image_data))
                        img_text   = pytesseract.image_to_string(
                            image, lang='eng'
                        )
                        if img_text.strip():
                            text += f"\n[Image Text]: {img_text}"
                    except Exception as e:
                        logger.warning(f"Image extraction error: {e}")

            doc.close()

            return {
                "text":    text.strip(),
                "pages":   len(doc),
                "success": True,
                "method":  "pymupdf",
            }
        except Exception as e:
            logger.error(f"PDF extraction error: {e}")
            return {
                "text":    "",
                "success": False,
                "error":   str(e),
            }

    @staticmethod
    async def extract_from_image(file_path: str) -> dict:
        """Extract text from image using Tesseract OCR"""
        try:
            image = Image.open(file_path)

            # Preprocess image for better OCR
            # Convert to grayscale
            image = image.convert('L')

            # OCR with multiple languages
            config = '--oem 3 --psm 6'
            text   = pytesseract.image_to_string(
                image,
                lang='eng+hin',  # English + Hindi
                config=config,
            )

            # Also get confidence
            data = pytesseract.image_to_data(
                image,
                output_type=pytesseract.Output.DICT,
            )
            confidences = [
                int(c) for c in data['conf']
                if str(c).isdigit() and int(c) > 0
            ]
            avg_confidence = (
                sum(confidences) / len(confidences)
                if confidences else 0
            )

            return {
                "text":       text.strip(),
                "confidence": avg_confidence,
                "success":    True,
                "method":     "tesseract",
            }
        except Exception as e:
            logger.error(f"Image OCR error: {e}")
            return {
                "text":    "",
                "success": False,
                "error":   str(e),
            }

    @staticmethod
    def clean_text(text: str) -> str:
        """Clean and normalize extracted text"""
        if not text:
            return ""

        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove special chars but keep punctuation
        text = re.sub(r'[^\w\s.,!?;:\-\(\)\[\]\'\"@#%]', '', text)
        # Remove very short lines (likely noise)
        lines = [
            line.strip() for line in text.split('\n')
            if len(line.strip()) > 3
        ]
        return '\n'.join(lines).strip()

    @classmethod
    async def extract(
        cls,
        file_type: str,
        file_path:  Optional[str],
        raw_text:   Optional[str] = "",
    ) -> dict:
        """Main extraction method"""

        if file_type == "pdf" and file_path:
            result = await cls.extract_from_pdf(file_path)
            result["text"] = cls.clean_text(result.get("text", ""))
            return result

        elif file_type == "image" and file_path:
            result = await cls.extract_from_image(file_path)
            result["text"] = cls.clean_text(result.get("text", ""))
            # Combine OCR text with any manual description
            if raw_text:
                result["text"] = (
                    result["text"] + "\n\n[Staff Description]: " + raw_text
                ).strip()
            return result

        else:
            # Voice transcription or plain text
            cleaned = cls.clean_text(raw_text or "")
            return {
                "text":    cleaned,
                "success": True,
                "method":  "direct",
            }