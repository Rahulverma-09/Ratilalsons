import os
from fastapi import UploadFile, HTTPException
from typing import Optional, Dict, Any
from datetime import datetime
import uuid
from PIL import Image
import io
import logging

logger = logging.getLogger(__name__)

BASE_UPLOAD_DIR = "uploads"  # Configure root for uploaded files

class FileUploadService:
    def __init__(self, base_dir: str = BASE_UPLOAD_DIR):
        self.base_dir = base_dir
        if not os.path.exists(self.base_dir):
            os.makedirs(self.base_dir, exist_ok=True)
        self.max_file_size = 25_000_000  # 25MB

    async def upload_file(
        self,
        file: UploadFile,
        user_id: str,
        ticket_number: Optional[str] = None
    ) -> Dict[str, Any]:
        """Save file locally and generate thumbnail for images."""
        try:
            contents = await file.read()
            if len(contents) > self.max_file_size:
                raise HTTPException(400, detail="File too large (25MB max)")

            # Create directory: uploads/ticket_number/user_id/
            folder_path = os.path.join(
                self.base_dir,
                ticket_number or "ticket",
                user_id
            )
            os.makedirs(folder_path, exist_ok=True)

            # Unique filename
            ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'bin'
            filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.{ext}"
            filepath = os.path.join(folder_path, filename)

            # Write file content
            with open(filepath, "wb") as f:
                f.write(contents)

            # Generate thumbnail for images
            thumbnail_path = None
            if file.content_type.startswith("image/"):
                thumbnail_path = self._generate_thumbnail(contents, folder_path, filename)

            # Return relative or absolute URLs, adjust for your static fileserver setup
            file_url = f"/{filepath.replace(os.sep, '/')}"
            thumb_url = f"/{thumbnail_path.replace(os.sep, '/')}" if thumbnail_path else None

            logger.info(f"Uploaded file saved to {filepath}")

            return {
                "filename": filename,
                "original_name": file.filename,
                "file_url": file_url,
                "thumbnail_url": thumb_url,
                "mime_type": file.content_type,
                "size_bytes": len(contents)
            }

        except Exception as e:
            logger.error(f"Local file upload failed: {str(e)}")
            raise HTTPException(500, detail="File upload failed")

    def _generate_thumbnail(self, content: bytes, folder_path: str, original_filename: str) -> Optional[str]:
        """Generate JPEG thumbnail (300x300) for images."""
        try:
            image = Image.open(io.BytesIO(content))
            image.thumbnail((300, 300), Image.LANCZOS)

            thumb_filename = original_filename.rsplit('.', 1)[0] + "_thumb.jpg"
            thumbnail_path = os.path.join(folder_path, thumb_filename)

            image.save(thumbnail_path, format="JPEG", quality=85)
            logger.info(f"Thumbnail saved to {thumbnail_path}")
            return thumbnail_path
        except Exception as e:
            logger.warning(f"Thumbnail generation failed: {str(e)}")
            return None

    def delete_file(self, file_path: str) -> bool:
        """Delete a file from local storage."""
        try:
            if os.path.exists(file_path) and os.path.isfile(file_path):
                os.remove(file_path)
                logger.info(f"Deleted file {file_path}")
                return True
            logger.warning(f"File {file_path} not found for deletion")
            return False
        except Exception as e:
            logger.error(f"Failed to delete file {file_path}: {str(e)}")
            return False
