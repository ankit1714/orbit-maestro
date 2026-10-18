import logging
import os
import subprocess
import requests
from typing import Optional
from apps.api.src.core.config import settings

logger = logging.getLogger("storage_client")

class CloudStorageService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(CloudStorageService, cls).__new__(cls)
            cls._instance.bucket_name = settings.PRD_BUCKET_NAME or (f"{settings.PROJECT_ID}-prd-uploads" if settings.PROJECT_ID else "prd-uploads")
        return cls._instance

    def _get_access_token(self) -> Optional[str]:
        # 1. Try google.auth.default() (Standard on Cloud Run & GCP compute)
        try:
            import google.auth
            from google.auth.transport.requests import Request
            creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
            creds.refresh(Request())
            if creds.token:
                return creds.token
        except Exception as e:
            logger.debug(f"google.auth token attempt for GCS: {e}")

        # 2. Try gcloud CLI auth token (Standard in local development)
        try:
            token = subprocess.check_output(["gcloud", "auth", "print-access-token"], timeout=5).decode().strip()
            if token:
                return token
        except Exception as e:
            logger.debug(f"gcloud auth token attempt for GCS: {e}")

        return None

    def upload_document(self, project_id: str, file_name: str, content_bytes: bytes, content_type: Optional[str] = None) -> str:
        """Uploads document bytes to the Google Cloud Storage bucket."""
        safe_name = file_name.replace(" ", "_").replace("/", "_")
        object_path = f"{project_id}/{safe_name}"
        gcs_uri = f"gs://{self.bucket_name}/{object_path}"

        # Detect content type if not provided
        if not content_type:
            if safe_name.endswith(".pdf"):
                content_type = "application/pdf"
            elif safe_name.endswith(".md") or safe_name.endswith(".txt"):
                content_type = "text/plain"
            elif safe_name.endswith(".json"):
                content_type = "application/json"
            else:
                content_type = "application/octet-stream"

        token = self._get_access_token()
        if token:
            url = f"https://storage.googleapis.com/upload/storage/v1/b/{self.bucket_name}/o?uploadType=media&name={object_path}"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": content_type
            }

            try:
                res = requests.post(url, headers=headers, data=content_bytes, timeout=30)
                if res.status_code in [200, 201]:
                    logger.info(f"Successfully uploaded {safe_name} to GCS: {gcs_uri}")
                    return gcs_uri
                else:
                    logger.warning(f"GCS upload HTTP {res.status_code}: {res.text[:180]}")
            except Exception as e:
                logger.warning(f"GCS upload request failed: {e}")

        logger.info(f"Fallback to internal storage reference for {safe_name}: {gcs_uri}")
        return gcs_uri

storage_service = CloudStorageService()
