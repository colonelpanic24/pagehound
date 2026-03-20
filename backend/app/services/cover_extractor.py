import logging
import os

logger = logging.getLogger(__name__)

MAX_WIDTH = 400


def save_cover(book_id: int, cover_data: bytes, covers_dir: str) -> str | None:
    """Save cover bytes as JPEG to covers_dir/{book_id}.jpg.

    Resizes to max MAX_WIDTH px wide while keeping aspect ratio.
    Returns the relative path (e.g. '.covers/123.jpg') or None on error.
    """
    try:
        import io

        from PIL import Image

        os.makedirs(covers_dir, exist_ok=True)

        img = Image.open(io.BytesIO(cover_data))

        # Convert to RGB if necessary (e.g. RGBA or palette mode)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        # Resize if wider than MAX_WIDTH
        width, height = img.size
        if width > MAX_WIDTH:
            new_height = int(height * MAX_WIDTH / width)
            img = img.resize((MAX_WIDTH, new_height), Image.LANCZOS)

        dest_path = os.path.join(covers_dir, f"{book_id}.jpg")
        img.save(dest_path, "JPEG", quality=85, optimize=True)

        # Return a relative path suitable for serving
        rel_path = os.path.join(".covers", f"{book_id}.jpg")
        return rel_path

    except Exception as e:
        logger.warning("cover_extractor: could not save cover for book %d: %s", book_id, e)
        return None
