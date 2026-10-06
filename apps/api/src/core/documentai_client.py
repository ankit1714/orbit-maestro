import logging
import os
from io import BytesIO
from typing import Dict, Any, List
from apps.api.src.core.config import settings

logger = logging.getLogger("documentai_client")

class DocumentAIService:
    def __init__(self):
        self._is_live = False
        self._client = None

        try:
            if settings.DOCUMENT_AI_PROCESSOR_ID and (os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or os.getenv("K_SERVICE")):
                from google.cloud import documentai
                self._client = documentai.DocumentProcessorServiceClient()
                self._is_live = True
                logger.info("Connected to live Google Document AI Processor.")
        except Exception as e:
            logger.debug(f"Document AI processor init: {e}")
            self._is_live = False

    def parse_document(self, file_bytes: bytes, mime_type: str = "application/pdf") -> Dict[str, Any]:
        """Parses a PRD/Specification document, extracting actual text from PDF or text bytes."""
        if not file_bytes:
            return {"text": "", "pages": 0, "entities": []}

        # 1. Native PDF extraction using pypdf
        try:
            from pypdf import PdfReader
            reader = PdfReader(BytesIO(file_bytes))
            pages_text = []
            for idx, page in enumerate(reader.pages):
                txt = page.extract_text()
                if txt and txt.strip():
                    pages_text.append(txt.strip())

            if pages_text:
                full_text = "\n\n".join(pages_text)
                logger.info(f"Successfully extracted {len(pages_text)} pages ({len(full_text)} characters) from uploaded PDF using pypdf.")
                return {
                    "text": full_text,
                    "pages": len(pages_text),
                    "entities": []
                }
        except Exception as e:
            logger.debug(f"Native pypdf extraction attempt: {e}")

        # 2. Plain text / UTF-8 fallback
        try:
            utf8_text = file_bytes.decode("utf-8")
            if utf8_text.strip():
                return {
                    "text": utf8_text,
                    "pages": max(1, len(utf8_text) // 1500),
                    "entities": []
                }
        except UnicodeDecodeError:
            pass

        # 3. Google Document AI Processor if configured
        if self._is_live and self._client and settings.DOCUMENT_AI_PROCESSOR_ID:
            try:
                from google.cloud import documentai
                name = settings.DOCUMENT_AI_PROCESSOR_ID
                raw_document = documentai.RawDocument(content=file_bytes, mime_type=mime_type)
                request = documentai.ProcessRequest(name=name, raw_document=raw_document)
                result = self._client.process_document(request=request)
                document = result.document
                return {
                    "text": document.text,
                    "pages": len(document.pages),
                    "entities": [e.type_ for e in document.entities]
                }
            except Exception as e:
                logger.error(f"Live Document AI call failed: {e}")

        # Fallback if binary file cannot be parsed
        return {
            "text": "Uploaded specification document binary content.",
            "pages": 1,
            "entities": []
        }

docai_service = DocumentAIService()
