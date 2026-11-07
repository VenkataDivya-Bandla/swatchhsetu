"""Data model. Key rules are enforced by the database itself (see CheckConstraint / unique)."""
from datetime import datetime
from typing import Optional

from sqlalchemy import (Boolean, CheckConstraint, DateTime, Float, ForeignKey, Integer,
                        String, Text)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, utcnow


class Zone(Base):
    __tablename__ = "zone"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(8), unique=True)
    name_en: Mapped[str] = mapped_column(String(80))
    name_te: Mapped[str] = mapped_column(String(120))


class Facility(Base):
    __tablename__ = "facility"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True)
    name_en: Mapped[str] = mapped_column(String(120))
    name_te: Mapped[str] = mapped_column(String(160))
    zone_id: Mapped[int] = mapped_column(ForeignKey("zone.id"))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    kind: Mapped[str] = mapped_column(String(16))  # permanent | temporary
    operator: Mapped[str] = mapped_column(String(40), default="RMC")
    accessible: Mapped[bool] = mapped_column(Boolean, default=False)
    has_men: Mapped[bool] = mapped_column(Boolean, default=True)
    has_women: Mapped[bool] = mapped_column(Boolean, default=True)
    free: Mapped[bool] = mapped_column(Boolean, default=True)
    verify_window_min: Mapped[int] = mapped_column(Integer, default=120)
    public_token: Mapped[str] = mapped_column(String(32), unique=True)
    staff_token: Mapped[str] = mapped_column(String(16), unique=True)
    unavailable: Mapped[bool] = mapped_column(Boolean, default=False)
    unavailable_reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    reopen_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    water_ok: Mapped[bool] = mapped_column(Boolean, default=True)
    queue_level: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)  # short | long | full
    queue_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    queue_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("app_user.id"), nullable=True)
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_verified_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("app_user.id"), nullable=True)

    zone: Mapped[Zone] = relationship()


class User(Base):
    __tablename__ = "app_user"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    role: Mapped[str] = mapped_column(String(16))  # admin | supervisor | worker
    zone_id: Mapped[Optional[int]] = mapped_column(ForeignKey("zone.id"), nullable=True)
    pin_hash: Mapped[str] = mapped_column(String(128))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Inspection(Base):
    __tablename__ = "inspection"
    id: Mapped[int] = mapped_column(primary_key=True)
    client_uuid: Mapped[str] = mapped_column(String(64), unique=True)  # offline retries never duplicate
    facility_id: Mapped[int] = mapped_column(ForeignKey("facility.id"))
    worker_id: Mapped[int] = mapped_column(ForeignKey("app_user.id"))
    answers: Mapped[str] = mapped_column(Text)  # JSON
    passed: Mapped[bool] = mapped_column(Boolean)
    water_ok: Mapped[bool] = mapped_column(Boolean)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    photo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    device_time: Mapped[datetime] = mapped_column(DateTime)
    server_time: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    offline: Mapped[bool] = mapped_column(Boolean, default=False)
    scan_method: Mapped[str] = mapped_column(String(16), default="qr")
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)


class Issue(Base):
    __tablename__ = "issue"
    id: Mapped[int] = mapped_column(primary_key=True)
    facility_id: Mapped[int] = mapped_column(ForeignKey("facility.id"))
    category: Mapped[str] = mapped_column(String(16))
    priority: Mapped[str] = mapped_column(String(4))  # P1 | P2 | P3
    state: Mapped[str] = mapped_column(String(24), default="new")
    source: Mapped[str] = mapped_column(String(16), default="public")  # public | inspection
    report_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    ack_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    assigned_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    assignee_id: Mapped[Optional[int]] = mapped_column(ForeignKey("app_user.id"), nullable=True)
    resolver_id: Mapped[Optional[int]] = mapped_column(ForeignKey("app_user.id"), nullable=True)
    verifier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("app_user.id"), nullable=True)
    resolution_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolution_photo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_offline: Mapped[bool] = mapped_column(Boolean, default=False)
    reopened_count: Mapped[int] = mapped_column(Integer, default=0)
    invalid_reason: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    facility: Mapped[Facility] = relationship()


class PublicReport(Base):
    __tablename__ = "public_report"
    id: Mapped[int] = mapped_column(primary_key=True)
    ref_no: Mapped[str] = mapped_column(String(20), unique=True)
    facility_id: Mapped[int] = mapped_column(ForeignKey("facility.id"))
    issue_id: Mapped[int] = mapped_column(ForeignKey("issue.id"))
    category: Mapped[str] = mapped_column(String(16))
    comment: Mapped[Optional[str]] = mapped_column(String(280), nullable=True)
    photo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    audio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # voice complaint, data URL
    phone_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    lang: Mapped[str] = mapped_column(String(4), default="en")
    device_key: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Verification(Base):
    __tablename__ = "verification"
    __table_args__ = (
        # The fixer can never verify their own fix: enforced by the database, not just the app.
        CheckConstraint("verifier_id <> resolver_id", name="ck_verifier_not_resolver"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("issue.id"))
    verifier_id: Mapped[int] = mapped_column(ForeignKey("app_user.id"))
    resolver_id: Mapped[int] = mapped_column(ForeignKey("app_user.id"))
    outcome: Mapped[str] = mapped_column(String(16))  # confirmed | rejected
    scan_method: Mapped[str] = mapped_column(String(16), default="qr")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class PublicFeedback(Base):
    __tablename__ = "public_feedback"
    id: Mapped[int] = mapped_column(primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("issue.id"))
    fixed: Mapped[bool] = mapped_column(Boolean)
    device_key: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class SyncRecord(Base):
    __tablename__ = "sync_record"
    client_uuid: Mapped[str] = mapped_column(String(64), primary_key=True)
    kind: Mapped[str] = mapped_column(String(16))
    user_id: Mapped[int] = mapped_column(ForeignKey("app_user.id"))
    result: Mapped[str] = mapped_column(String(16))
    detail: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    actor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("app_user.id"), nullable=True)
    actor_label: Mapped[str] = mapped_column(String(80))
    action: Mapped[str] = mapped_column(String(40))
    entity: Mapped[str] = mapped_column(String(24))
    entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    detail: Mapped[str] = mapped_column(Text, default="{}")
    prev_hash: Mapped[str] = mapped_column(String(64))
    hash: Mapped[str] = mapped_column(String(64))


class HelpRequest(Base):
    """A worker asks for something they cannot fix themselves (water tanker, plumber, supplies, crowd)."""
    __tablename__ = "help_request"
    id: Mapped[int] = mapped_column(primary_key=True)
    client_uuid: Mapped[str] = mapped_column(String(64), unique=True)
    facility_id: Mapped[int] = mapped_column(ForeignKey("facility.id"))
    requested_by_id: Mapped[int] = mapped_column(ForeignKey("app_user.id"))
    kind: Mapped[str] = mapped_column(String(16))  # tanker | plumber | supplies | crowd | other
    note: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    state: Mapped[str] = mapped_column(String(16), default="open")  # open | acknowledged | done
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    ack_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    done_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    handled_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("app_user.id"), nullable=True)

    facility: Mapped[Facility] = relationship()
