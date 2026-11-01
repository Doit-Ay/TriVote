"""
TriVote Database Models
SQLAlchemy 2.0+ ORM models for voters, authentication logs, and votes.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Boolean, Float, DateTime, LargeBinary, Integer
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


class Voter(Base):
    """
    Stores voter registration data including biometric templates.

    voter_id format: VTR-YYYYMMDD-NNN  (e.g. VTR-20261022-001)
    Binary fields store serialized numpy arrays (via pickle) or raw bytes.
    """

    __tablename__ = "voters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    voter_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    date_of_birth: Mapped[str] = mapped_column(String(10), nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)

    # Biometric data
    face_encoding: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    face_image_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    fingerprint_template: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    iris_template: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)

    # Status
    has_voted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    registered_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    voted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    def __repr__(self) -> str:
        return f"<Voter {self.voter_id} - {self.full_name}>"


class AuthenticationLog(Base):
    """Records every authentication attempt with individual biometric scores."""

    __tablename__ = "authentication_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    voter_id: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    face_score: Mapped[float] = mapped_column(Float, nullable=False)
    fingerprint_score: Mapped[float] = mapped_column(Float, nullable=False)
    iris_score: Mapped[float] = mapped_column(Float, nullable=False)
    fusion_score: Mapped[float] = mapped_column(Float, nullable=False)
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    rejection_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    def __repr__(self) -> str:
        return f"<AuthLog {self.voter_id} - {self.decision}>"


class Vote(Base):
    """Records cast votes. Each voter may only vote once (enforced at app level)."""

    __tablename__ = "votes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    voter_id: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    candidate: Mapped[str] = mapped_column(String(200), nullable=False)
    party: Mapped[str] = mapped_column(String(200), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Vote {self.voter_id} -> {self.candidate}>"
