import fitz  # PyMuPDF
import io
import os
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Try importing OCR libraries (optional)
try:
    import pytesseract
    from PIL import Image
    HAS_OCR = True
except ImportError:
    HAS_OCR = False
    logger.warning("pytesseract/Pillow not available — OCR disabled")


class TextExtractor:

    @staticmethod
    async def extract_from_pdf(file_path: str) -> dict:
        """Extract text from PDF using PyMuPDF"""
        try:
            doc = fitz.open(file_path)
            text = ""
            num_pages = len(doc)

            for page_num in range(num_pages):
                page = doc.load_page(page_num)
                page_text = page.get_text("text")
                text += page_text

                # Try OCR on images inside PDF
                if HAS_OCR:
                    try:
                        image_list = page.get_images(full=True)
                        for img in image_list:
                            try:
                                xref = img[0]
                                base_image = doc.extract_image(xref)
                                image_data = base_image["image"]
                                image = Image.open(io.BytesIO(image_data))
                                img_text = pytesseract.image_to_string(image, lang='eng')
                                if img_text.strip():
                                    text += f"\n[Image Text]: {img_text}"
                            except Exception as e:
                                logger.warning(f"Image extraction error: {e}")
                    except Exception as e:
                        logger.warning(f"Image list error: {e}")

            # ✅ Save page count BEFORE closing
            doc.close()

            return {
                "text":    text.strip(),
                "pages":   num_pages,
                "success": True,
                "method":  "pymupdf",
            }
        except Exception as e:
            logger.error(f"PDF extraction error: {e}")
            return {
                "text":    "",
                "pages":   0,
                "success": False,
                "error":   str(e),
            }

    @staticmethod
    async def extract_from_image(file_path: str) -> dict:
        """Extract text from image using Tesseract OCR"""
        if not HAS_OCR:
            return {
                "text":    "",
                "success": False,
                "error":   "OCR not available (pytesseract not installed)",
            }

        try:
            image = Image.open(file_path)
            image = image.convert('L')  # grayscale

            config = '--oem 3 --psm 6'
            text = pytesseract.image_to_string(image, lang='eng', config=config)

            return {
                "text":    text.strip(),
                "success": True,
                "method":  "tesseract",
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

        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'[^\w\s.,!?;:\-\(\)\[\]\'\"@#%]', '', text)
        lines = [
            line.strip() for line in text.split('\n')
            if len(line.strip()) > 3
        ]
        return '\n'.join(lines).strip()

    @classmethod
    async def extract(
        cls,
        file_type: str,
        file_path: Optional[str],
        raw_text:  Optional[str] = "",
    ) -> dict:
        """Main extraction method"""

        if file_type == "pdf" and file_path:
            result = await cls.extract_from_pdf(file_path)
            result["text"] = cls.clean_text(result.get("text", ""))
            return result

        elif file_type == "image" and file_path:
            result = await cls.extract_from_image(file_path)
            result["text"] = cls.clean_text(result.get("text", ""))
            if raw_text:
                result["text"] = (
                    result["text"] + "\n\n[Staff Description]: " + raw_text
                ).strip()
            return result

        else:
            cleaned = cls.clean_text(raw_text or "")
            return {
                "text":    cleaned,
                "success": True,
                "method":  "direct",
            }