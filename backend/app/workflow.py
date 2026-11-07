"""Issue workflow. Every state change goes through here and writes an audit row."""
import hashlib
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .core import (CHECKLIST, CHECKLIST_TO_CATEGORY, CLOSURE_CHALLENGE_MIN, OPEN_STATES, audit,
                   base_priority, bump_priority)
from .db import utcnow
from .models import (Facility, Inspection, Issue, PublicFeedback, PublicReport, User,
                     Verification)


def _fail(code: int, msg: str):
    raise HTTPException(code, msg)


def _next_ref(db: Session) -> str:
    # based on the highest id, so a withdrawn report never causes a reference number to be reused
    n = (db.scalar(select(func.max(PublicReport.id))) or 0) + 101
    return f"SS-{n:04d}"


def open_issue_for(db: Session, facility_id: int, category: str) -> Optional[Issue]:
    return db.scalars(select(Issue).where(Issue.facility_id == facility_id, Issue.category == category,
                                          Issue.state.in_(OPEN_STATES))).first()


def raise_issue(db: Session, facility: Facility, category: str, source: str,
                at: Optional[datetime] = None, actor: Optional[User] = None) -> tuple[Issue, bool]:
    """Create an issue, or merge into the open one for the same facility and problem."""
    at = at or utcnow()
    existing = open_issue_for(db, facility.id, category)
    if existing:
        existing.report_count += 1 if source == "public" else 0
        bump_priority(existing)
        audit(db, actor, "report_merged", "issue", existing.id,
              {"report_count": existing.report_count, "priority": existing.priority},
              actor_label=None if actor else "public", at=at)
        return existing, True
    issue = Issue(facility_id=facility.id, category=category, priority=base_priority(category),
                  state="new", source=source, report_count=1 if source == "public" else 0, created_at=at)
    db.add(issue)
    db.flush()
    if category == "water":
        facility.water_ok = False
    audit(db, actor, "issue_created", "issue", issue.id,
          {"facility": facility.code, "category": category, "priority": issue.priority, "source": source},
          actor_label=None if actor else "public", at=at)
    return issue, False


def submit_public_report(db: Session, facility: Facility, category: str, comment: Optional[str],
                         phone: Optional[str], photo: Optional[str], lang: str,
                         device_key: Optional[str], audio: Optional[str] = None) -> dict:
    issue, merged = raise_issue(db, facility, category, "public")
    if audio and issue.priority == "P3":
        issue.priority = "P2"  # nobody has heard a voice complaint yet: get a supervisor to listen soon
    ref = _next_ref(db)
    phone_hash = hashlib.sha256(phone.encode()).hexdigest() if phone else None
    db.add(PublicReport(ref_no=ref, facility_id=facility.id, issue_id=issue.id, category=category,
                        comment=(comment or None), photo=photo, audio=audio, phone_hash=phone_hash, lang=lang,
                        device_key=device_key))
    db.commit()
    return {"ref_no": ref, "merged": merged, "issue_id": issue.id, "report_count": issue.report_count,
            "priority": issue.priority}


# ---------------------------------------------------------------- transitions

def acknowledge(db: Session, issue: Issue, actor: User) -> None:
    if issue.state not in {"new", "reopened"}:
        _fail(409, f"Cannot acknowledge an issue that is {issue.state}.")
    issue.state, issue.ack_at = "acknowledged", utcnow()
    audit(db, actor, "acknowledged", "issue", issue.id)


def assign(db: Session, issue: Issue, worker: User, actor: User) -> None:
    if issue.state not in {"new", "acknowledged", "reopened", "assigned", "in_progress"}:
        _fail(409, f"Cannot assign an issue that is {issue.state}.")
    if worker.role != "worker":
        _fail(400, "Issues can only be assigned to workers.")
    now = utcnow()
    issue.ack_at = issue.ack_at or now
    issue.state, issue.assignee_id, issue.assigned_at = "assigned", worker.id, now
    audit(db, actor, "assigned", "issue", issue.id, {"worker": worker.name})


def mark_invalid(db: Session, issue: Issue, reason: str, actor: User) -> None:
    if issue.state not in {"new", "acknowledged", "reopened"}:
        _fail(409, "Only unassigned issues can be marked invalid.")
    if not reason.strip():
        _fail(400, "Give a reason for marking this issue invalid.")
    issue.state, issue.invalid_reason, issue.closed_at = "invalid", reason.strip(), utcnow()
    audit(db, actor, "marked_invalid", "issue", issue.id, {"reason": reason.strip()})


def start_work(db: Session, issue: Issue, actor: User, at: datetime) -> None:
    if issue.assignee_id != actor.id:
        _fail(409, "This issue is assigned to someone else.")
    if issue.state != "assigned":
        _fail(409, f"Cannot start work on an issue that is {issue.state}.")
    issue.state, issue.started_at = "in_progress", at
    audit(db, actor, "work_started", "issue", issue.id, {"device_time": at.isoformat()})


def resolve(db: Session, issue: Issue, actor: User, at: datetime, note: Optional[str],
            photo: Optional[str], offline: bool) -> None:
    if issue.assignee_id != actor.id:
        _fail(409, "This issue is assigned to someone else.")
    if issue.state not in {"assigned", "in_progress"}:
        _fail(409, f"Cannot resolve an issue that is {issue.state}.")
    issue.started_at = issue.started_at or at
    issue.state, issue.resolved_at, issue.resolver_id = "awaiting_verification", at, actor.id
    issue.resolution_note, issue.resolution_photo, issue.resolved_offline = note, photo, offline
    audit(db, actor, "resolved", "issue", issue.id,
          {"note": note or "", "offline": offline, "device_time": at.isoformat()})


def verify(db: Session, issue: Issue, actor: User, staff_token: str, confirmed: bool) -> None:
    """Close (or reject) a fix. Requires the facility's staff QR and a different person."""
    if issue.state != "awaiting_verification":
        _fail(409, f"Only fixes awaiting verification can be checked; this one is {issue.state}.")
    facility = db.get(Facility, issue.facility_id)
    scan_method = "qr"
    if staff_token.upper() != facility.staff_token:
        _fail(400, "That staff code belongs to a different facility. Scan the code inside this toilet.")
    if actor.id == issue.resolver_id:
        _fail(403, "You resolved this issue. Another person must verify it.")
    try:
        with db.begin_nested():
            db.add(Verification(issue_id=issue.id, verifier_id=actor.id, resolver_id=issue.resolver_id,
                                outcome="confirmed" if confirmed else "rejected", scan_method=scan_method))
            db.flush()
    except IntegrityError:
        _fail(403, "You resolved this issue. Another person must verify it.")
    now = utcnow()
    if confirmed:
        issue.state, issue.closed_at, issue.verifier_id = "closed", now, actor.id
        facility.last_verified_at, facility.last_verified_by_id = now, actor.id
        if issue.category == "water":
            facility.water_ok = True
        audit(db, actor, "verified_closed", "issue", issue.id, {"facility": facility.code})
    else:
        issue.state = "assigned"
        issue.resolved_at = issue.resolver_id = None
        audit(db, actor, "verification_rejected", "issue", issue.id, {"facility": facility.code})


UNDO_WINDOW_MIN = 2


def withdraw_public_report(db: Session, report: PublicReport, device_key: str) -> dict:
    """Undo a report sent by mistake, from the same phone, within two minutes. Nothing is deleted from the audit log."""
    if report.device_key != device_key:
        _fail(404, "No report from this phone has that reference number.")
    if utcnow() - report.created_at > timedelta(minutes=UNDO_WINDOW_MIN):
        _fail(409, "This report can no longer be undone.")
    issue = db.get(Issue, report.issue_id)
    issue.report_count = max(0, issue.report_count - 1)
    if issue.report_count == 0 and issue.state == "new":
        issue.state, issue.invalid_reason, issue.closed_at = "invalid", "Withdrawn by the person who reported it", utcnow()
    audit(db, None, "report_withdrawn", "issue", issue.id, {"ref_no": report.ref_no}, actor_label="public")
    db.delete(report)
    db.commit()
    return {"withdrawn": True, "issue_state": issue.state}


def public_feedback(db: Session, issue: Issue, fixed: bool, device_key: str) -> dict:
    now = utcnow()
    if issue.state != "closed" or issue.closed_at is None or \
            now - issue.closed_at > timedelta(minutes=CLOSURE_CHALLENGE_MIN):
        _fail(409, "This fix can no longer be checked here.")
    already = db.scalars(select(PublicFeedback).where(PublicFeedback.issue_id == issue.id,
                                                     PublicFeedback.device_key == device_key,
                                                     PublicFeedback.created_at >= issue.closed_at)).first()
    if not already:
        db.add(PublicFeedback(issue_id=issue.id, fixed=fixed, device_key=device_key))
        db.flush()
    not_fixed = db.scalar(select(func.count(func.distinct(PublicFeedback.device_key))).where(
        PublicFeedback.issue_id == issue.id, PublicFeedback.fixed.is_(False),
        PublicFeedback.created_at >= issue.closed_at)) or 0
    reopened = False
    if not_fixed >= 2:
        issue.state, issue.reopened_count = "reopened", issue.reopened_count + 1
        issue.ack_at = issue.assignee_id = issue.resolver_id = issue.verifier_id = None
        issue.closed_at = issue.resolved_at = None
        issue.created_at = now  # timers restart from the reopening
        audit(db, None, "reopened_by_public", "issue", issue.id, {"not_fixed_answers": not_fixed},
              actor_label="public")
        reopened = True
    db.commit()
    return {"recorded": True, "not_fixed_answers": not_fixed, "reopened": reopened}


# ---------------------------------------------------------------- inspections

def record_inspection(db: Session, worker: User, facility: Facility, client_uuid: str, answers: dict,
                      note: Optional[str], photo: Optional[str], device_time: datetime, offline: bool,
                      scan_method: str) -> Inspection:
    now = utcnow()
    flagged, reason = False, None
    if device_time > now + timedelta(minutes=10):
        flagged, reason = True, "Device clock ahead of server by more than 10 minutes"
    elif now - device_time > timedelta(hours=24):
        flagged, reason = True, "Submitted more than 24 hours after the inspection"
    if scan_method != "qr":
        flagged, reason = True, reason or "Staff code typed in instead of scanned"
    clean = {k: bool(answers.get(k, False)) for k in CHECKLIST}
    passed = all(clean.values())
    ins = Inspection(client_uuid=client_uuid, facility_id=facility.id, worker_id=worker.id,
                     answers=json.dumps(clean), passed=passed, water_ok=clean["water"], note=note,
                     photo=photo, device_time=device_time, server_time=now, offline=offline,
                     scan_method=scan_method, flagged=flagged, flag_reason=reason)
    db.add(ins)
    db.flush()
    checked_at = now if flagged and device_time > now else device_time
    if facility.last_verified_at is None or checked_at > facility.last_verified_at:
        facility.last_verified_at, facility.last_verified_by_id = checked_at, worker.id
    facility.water_ok = clean["water"]
    audit(db, worker, "inspection", "facility", facility.id,
          {"passed": passed, "offline": offline, "flagged": flagged, "inspection_id": ins.id})
    for item, ok in clean.items():
        if not ok:
            raise_issue(db, facility, CHECKLIST_TO_CATEGORY[item], "inspection", actor=worker)
    return ins
