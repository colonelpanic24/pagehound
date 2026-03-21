from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Table, Text
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

book_authors = Table(
    "book_authors",
    Base.metadata,
    Column("book_id", Integer, ForeignKey("books.id", ondelete="CASCADE"), primary_key=True),
    Column("author_id", Integer, ForeignKey("authors.id", ondelete="CASCADE"), primary_key=True),
)


class BookTag(Base):
    __tablename__ = "book_tags"
    book_id: Mapped[int] = mapped_column(Integer, ForeignKey("books.id", ondelete="CASCADE"), primary_key=True)
    tag: Mapped[str] = mapped_column(String(100), primary_key=True)


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    sort_title: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    subtitle: Mapped[str | None] = mapped_column(String(512))
    description: Mapped[str | None] = mapped_column(Text)

    isbn_10: Mapped[str | None] = mapped_column(String(10), index=True)
    isbn_13: Mapped[str | None] = mapped_column(String(13), index=True)
    publisher: Mapped[str | None] = mapped_column(String(255))
    published_date: Mapped[str | None] = mapped_column(String(20))
    language: Mapped[str | None] = mapped_column(String(10))
    page_count: Mapped[int | None] = mapped_column(Integer)

    cover_image_path: Mapped[str | None] = mapped_column(String(512))
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False, unique=True)
    file_format: Mapped[str] = mapped_column(String(10), nullable=False)
    file_size: Mapped[int | None] = mapped_column(Integer)

    added_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    modified_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    metadata_source: Mapped[str | None] = mapped_column(String(50))
    metadata_confidence: Mapped[int | None] = mapped_column(Integer)

    series_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("series.id", ondelete="SET NULL"))
    series_index: Mapped[float | None] = mapped_column(Float)

    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    is_missing: Mapped[bool] = mapped_column(Boolean, default=False)
    rating: Mapped[int | None] = mapped_column(Integer)

    series: Mapped["Series | None"] = relationship("Series", back_populates="books")  # noqa: F821
    authors: Mapped[list["Author"]] = relationship(  # noqa: F821
        "Author", secondary=book_authors, back_populates="books"
    )
    tags_assoc: Mapped[list["BookTag"]] = relationship(
        "BookTag", cascade="all, delete-orphan", lazy="selectin"
    )
    tags: AssociationProxy[list[str]] = association_proxy("tags_assoc", "tag")
    reading_progress: Mapped[list["ReadingProgress"]] = relationship(  # noqa: F821
        "ReadingProgress", back_populates="book", cascade="all, delete-orphan"
    )
