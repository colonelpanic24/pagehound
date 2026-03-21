from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class KoboDevice(Base):
    __tablename__ = "kobo_devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    auth_token: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    device_id: Mapped[str | None] = mapped_column(String(255))  # X-Kobo-DeviceId header
    last_synced: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sync_states: Mapped[list["KoboSyncState"]] = relationship(  # noqa: F821
        "KoboSyncState", back_populates="device", cascade="all, delete-orphan"
    )
