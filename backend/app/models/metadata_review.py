from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from ..database import Base


class MetadataReview(Base):
    __tablename__ = "metadata_reviews"

    id = Column(Integer, primary_key=True)
    book_id = Column(
        Integer,
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # pending | approved | rejected
    status = Column(String(20), nullable=False, default="pending")
    # list of MetadataCandidate dicts, each with a "confidence" key
    candidates = Column(JSON, nullable=False)
    # the merged fields dict that would be applied on approve
    suggested_fields = Column(JSON, nullable=False)
    suggested_confidence = Column(Integer, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    book = relationship("Book", backref="metadata_reviews")
