from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class ReadingProgress(Base):
    __tablename__ = "reading_progress"

    id: Mapped[int] = mapped_column(primary_key=True)
    book_id: Mapped[int] = mapped_column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    kobo_device_id: Mapped[str | None] = mapped_column(String(255))
    percent_complete: Mapped[float | None] = mapped_column(Float)
    last_read_position: Mapped[str | None] = mapped_column(String(512))  # CFI for EPUB, page for PDF
    last_synced: Mapped[datetime | None] = mapped_column(DateTime)

    book: Mapped["Book"] = relationship("Book", back_populates="reading_progress")  # noqa: F821
