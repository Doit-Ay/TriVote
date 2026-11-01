"""
TriVote Database Manager
Provides a high-level API over the SQLAlchemy ORM models for voter
registration, authentication logging, vote recording, and statistics.
"""

import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker

# Ensure project root is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
from database.models import Base, Voter, AuthenticationLog, Vote

logger = logging.getLogger(__name__)


class DBManager:
    """Thin wrapper around SQLAlchemy that owns the engine and session factory."""

    def __init__(self):
        self.engine = None
        self.SessionLocal = None

    # ------------------------------------------------------------------
    # Initialisation
    # ------------------------------------------------------------------

    def init_db(self, app=None) -> None:
        """
        Create the engine, bind the session factory, and ensure all tables
        exist.  Optionally accepts a Flask *app* to read
        ``SQLALCHEMY_DATABASE_URI`` from its config.

        Args:
            app: Optional Flask application instance.
        """
        if app is not None:
            db_uri = app.config.get(
                "SQLALCHEMY_DATABASE_URI", config.SQLALCHEMY_DATABASE_URI
            )
        else:
            db_uri = config.SQLALCHEMY_DATABASE_URI

        # Ensure the directory for the SQLite file exists
        db_path = config.DATABASE_PATH
        os.makedirs(os.path.dirname(db_path), exist_ok=True)

        self.engine = create_engine(db_uri, echo=False)
        self.SessionLocal = sessionmaker(bind=self.engine)

        Base.metadata.create_all(self.engine)
        logger.info("Database initialised at %s", db_uri)

    def _session(self) -> Session:
        """Return a new session.  Caller is responsible for closing it."""
        return self.SessionLocal()

    # ------------------------------------------------------------------
    # Voter CRUD
    # ------------------------------------------------------------------

    def generate_voter_id(self) -> str:
        """
        Auto-generate the next voter ID in the format ``VTR-YYYYMMDD-NNN``.

        The sequence number resets daily.
        """
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        prefix = f"VTR-{today}-"

        with self._session() as session:
            last = (
                session.execute(
                    select(Voter)
                    .where(Voter.voter_id.like(f"{prefix}%"))
                    .order_by(Voter.voter_id.desc())
                )
                .scalars()
                .first()
            )

        if last is None:
            return f"{prefix}001"

        last_seq = int(last.voter_id.split("-")[-1])
        return f"{prefix}{last_seq + 1:03d}"

    def create_voter(self, data: dict[str, Any]) -> Voter:
        """
        Register a new voter.

        Args:
            data: Dict with keys ``full_name``, ``date_of_birth``,
                  ``address``, ``phone``, and optionally ``voter_id``.

        Returns:
            The created :class:`Voter` instance.
        """
        voter_id = data.get("voter_id") or self.generate_voter_id()

        voter = Voter(
            voter_id=voter_id,
            full_name=data["full_name"],
            date_of_birth=data["date_of_birth"],
            address=data["address"],
            phone=data["phone"],
        )

        with self._session() as session:
            session.add(voter)
            session.commit()
            session.refresh(voter)
            # Detach from session so it can be used outside
            session.expunge(voter)

        logger.info("Voter created: %s", voter)
        return voter

    def get_voter(self, voter_id: str) -> Voter | None:
        """Return a :class:`Voter` by *voter_id*, or ``None``."""
        with self._session() as session:
            voter = session.execute(
                select(Voter).where(Voter.voter_id == voter_id)
            ).scalars().first()
            if voter is not None:
                session.expunge(voter)
            return voter

    def get_all_voters(self) -> list[dict[str, Any]]:
        """
        Return a JSON-safe list of all voters (binary blobs replaced by
        boolean flags).
        """
        with self._session() as session:
            voters = session.execute(
                select(Voter).order_by(Voter.registered_at.desc())
            ).scalars().all()

            result = []
            for v in voters:
                result.append({
                    "id": v.id,
                    "voter_id": v.voter_id,
                    "full_name": v.full_name,
                    "date_of_birth": v.date_of_birth,
                    "address": v.address,
                    "phone": v.phone,
                    "has_face": v.face_encoding is not None,
                    "has_fingerprint": v.fingerprint_template is not None,
                    "has_iris": v.iris_template is not None,
                    "face_image_path": v.face_image_path,
                    "has_voted": v.has_voted,
                    "registered_at": v.registered_at.isoformat() if v.registered_at else None,
                    "voted_at": v.voted_at.isoformat() if v.voted_at else None,
                })
            return result

    def delete_voter(self, voter_id: str) -> bool:
        """
        Delete a voter and all related authentication logs and votes.

        Args:
            voter_id: The voter ID to delete.

        Returns:
            ``True`` if the voter was found and deleted, ``False`` otherwise.
        """
        with self._session() as session:
            voter = session.execute(
                select(Voter).where(Voter.voter_id == voter_id)
            ).scalars().first()

            if voter is None:
                logger.warning("delete_voter: voter %s not found", voter_id)
                return False

            # Delete related auth logs
            auth_logs = session.execute(
                select(AuthenticationLog).where(
                    AuthenticationLog.voter_id == voter_id
                )
            ).scalars().all()
            for log in auth_logs:
                session.delete(log)

            # Delete related votes
            votes = session.execute(
                select(Vote).where(Vote.voter_id == voter_id)
            ).scalars().all()
            for vote in votes:
                session.delete(vote)

            session.delete(voter)
            session.commit()

        logger.info("Voter deleted: %s", voter_id)
        return True

    def update_voter_info(self, voter_id: str, data: dict[str, Any]) -> bool:
        """
        Update a voter's demographic information (name, dob, address, phone).

        Returns:
            ``True`` on success, ``False`` if voter not found.
        """
        with self._session() as session:
            voter = session.execute(
                select(Voter).where(Voter.voter_id == voter_id)
            ).scalars().first()

            if voter is None:
                logger.warning("update_voter_info: voter %s not found", voter_id)
                return False

            if "full_name" in data and data["full_name"]:
                voter.full_name = data["full_name"]
            if "date_of_birth" in data and data["date_of_birth"]:
                voter.date_of_birth = data["date_of_birth"]
            if "address" in data and data["address"]:
                voter.address = data["address"]
            if "phone" in data and data["phone"]:
                voter.phone = data["phone"]

            session.commit()

        logger.info("Demographic info updated for %s", voter_id)
        return True

    # ------------------------------------------------------------------
    # Biometric updates
    # ------------------------------------------------------------------

    def update_voter_biometrics(
        self,
        voter_id: str,
        face_encoding: bytes | None = None,
        fingerprint_template: bytes | None = None,
        iris_template: bytes | None = None,
        face_image_path: str | None = None,
    ) -> bool:
        """
        Update one or more biometric fields for a voter.

        Returns:
            ``True`` on success, ``False`` if voter not found.
        """
        with self._session() as session:
            voter = session.execute(
                select(Voter).where(Voter.voter_id == voter_id)
            ).scalars().first()

            if voter is None:
                logger.warning("update_voter_biometrics: voter %s not found", voter_id)
                return False

            if face_encoding is not None:
                voter.face_encoding = face_encoding
            if fingerprint_template is not None:
                voter.fingerprint_template = fingerprint_template
            if iris_template is not None:
                voter.iris_template = iris_template
            if face_image_path is not None:
                voter.face_image_path = face_image_path

            session.commit()

        logger.info("Biometrics updated for %s", voter_id)
        return True

    def bind_fingerprint_template(
        self, voter_id: str, template: bytes
    ) -> tuple[bool, str | None]:
        """
        Store *template* for *voter_id* unless another voter already holds the
        exact same template bytes (same finger registered twice).

        Returns:
            ``(True, None)`` when stored, ``(False, other_voter_id)`` on a
            duplicate (nothing written), ``(False, None)`` if voter not found.
        """
        with self._session() as session:
            conflict = session.execute(
                select(Voter.voter_id).where(
                    Voter.fingerprint_template == template,
                    Voter.voter_id != voter_id,
                )
            ).scalars().first()
            if conflict is not None:
                logger.warning(
                    "bind_fingerprint_template: template for %s already bound to %s",
                    voter_id, conflict,
                )
                return False, conflict

            voter = session.execute(
                select(Voter).where(Voter.voter_id == voter_id)
            ).scalars().first()
            if voter is None:
                logger.warning("bind_fingerprint_template: voter %s not found", voter_id)
                return False, None

            voter.fingerprint_template = template
            session.commit()

        logger.info("Fingerprint template bound for %s", voter_id)
        return True, None

    # ------------------------------------------------------------------
    # Voting status
    # ------------------------------------------------------------------

    def mark_voted(self, voter_id: str) -> bool:
        """Mark a voter as having voted.  Returns ``False`` if not found."""
        with self._session() as session:
            voter = session.execute(
                select(Voter).where(Voter.voter_id == voter_id)
            ).scalars().first()

            if voter is None:
                return False

            voter.has_voted = True
            voter.voted_at = datetime.now(timezone.utc)
            session.commit()

        logger.info("Voter %s marked as voted", voter_id)
        return True

    def has_voted(self, voter_id: str) -> bool:
        """Check whether the voter has already cast a vote."""
        with self._session() as session:
            voter = session.execute(
                select(Voter).where(Voter.voter_id == voter_id)
            ).scalars().first()
            return voter is not None and voter.has_voted

    # ------------------------------------------------------------------
    # Authentication logging
    # ------------------------------------------------------------------

    def log_authentication(
        self,
        voter_id: str,
        face_score: float,
        fp_score: float,
        iris_score: float,
        fusion_score: float,
        decision: str,
        reason: str | None = None,
    ) -> AuthenticationLog:
        """Record an authentication attempt."""
        log_entry = AuthenticationLog(
            voter_id=voter_id,
            face_score=round(face_score, 4),
            fingerprint_score=round(fp_score, 4),
            iris_score=round(iris_score, 4),
            fusion_score=round(fusion_score, 4),
            decision=decision,
            rejection_reason=reason,
        )

        with self._session() as session:
            session.add(log_entry)
            session.commit()
            session.refresh(log_entry)
            session.expunge(log_entry)

        logger.info("Auth logged: %s", log_entry)
        return log_entry

    def get_auth_logs(self, limit: int = 50) -> list[dict[str, Any]]:
        """Return the most recent authentication log entries as dicts."""
        with self._session() as session:
            logs = (
                session.execute(
                    select(AuthenticationLog)
                    .order_by(AuthenticationLog.timestamp.desc())
                    .limit(limit)
                )
                .scalars()
                .all()
            )

            return [
                {
                    "id": log.id,
                    "voter_id": log.voter_id,
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                    "face_score": log.face_score,
                    "fingerprint_score": log.fingerprint_score,
                    "iris_score": log.iris_score,
                    "fusion_score": log.fusion_score,
                    "decision": log.decision,
                    "rejection_reason": log.rejection_reason,
                }
                for log in logs
            ]

    # ------------------------------------------------------------------
    # Vote recording
    # ------------------------------------------------------------------

    def record_vote(self, voter_id: str, candidate: str, party: str) -> Vote:
        """Record a vote and return the :class:`Vote` instance."""
        vote = Vote(
            voter_id=voter_id,
            candidate=candidate,
            party=party,
        )

        with self._session() as session:
            session.add(vote)
            session.commit()
            session.refresh(vote)
            session.expunge(vote)

        logger.info("Vote recorded: %s", vote)
        return vote

    def get_votes(self) -> list[dict[str, Any]]:
        """Return all votes as JSON-safe dicts."""
        with self._session() as session:
            votes = (
                session.execute(select(Vote).order_by(Vote.timestamp.desc()))
                .scalars()
                .all()
            )

            return [
                {
                    "id": v.id,
                    "voter_id": v.voter_id,
                    "candidate": v.candidate,
                    "party": v.party,
                    "timestamp": v.timestamp.isoformat() if v.timestamp else None,
                }
                for v in votes
            ]

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    def get_stats(self) -> dict[str, int]:
        """
        Return aggregate statistics.

        Returns:
            Dict with ``total_voters``, ``total_votes``,
            ``auth_success_count``, ``auth_fail_count``.
        """
        with self._session() as session:
            total_voters = session.execute(
                select(func.count(Voter.id))
            ).scalar() or 0

            total_votes = session.execute(
                select(func.count(Vote.id))
            ).scalar() or 0

            auth_success = session.execute(
                select(func.count(AuthenticationLog.id)).where(
                    AuthenticationLog.decision == "AUTHENTICATED"
                )
            ).scalar() or 0

            auth_fail = session.execute(
                select(func.count(AuthenticationLog.id)).where(
                    AuthenticationLog.decision == "REJECTED"
                )
            ).scalar() or 0

        return {
            "total_voters": total_voters,
            "total_votes": total_votes,
            "auth_success_count": auth_success,
            "auth_fail_count": auth_fail,
        }


# Module-level singleton for convenience
db_manager = DBManager()
