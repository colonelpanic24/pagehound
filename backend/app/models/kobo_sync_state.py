from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class KoboSyncState(Base):
    __tablename__ = "kobo_sync_states"
    __table_args__ = (UniqueConstraint("device_id", "book_id", name="uq_device_book"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("kobo_devices.id", ondelete="CASCADE"), nullable=False
    )
    book_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)

    device: Mapped["KoboDevice"] = relationship("KoboDevice", back_populates="sync_states")  # noqa: F821
