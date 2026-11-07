"""HTTP API. Public routes need no login; staff routes need a bearer token."""
import csv
import os
import io
import json
import statistics
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import workflow as wf
from .core import (CLOSURE_CHALLENGE_MIN, HELP_KINDS, HELP_LABEL, OPEN_STATES, audit, bearing_deg, queue_state,
                   current_user, distance_m, facility_status, hash_pin, iso, issue_timers, make_token,
                   minutes_between, open_issues_by_facility, require, verify_chain)
from .db import get_db, utcnow
from .models import (AuditLog, Facility, HelpRequest, Inspection, Issue, PublicReport, SyncRecord,
                     User, Verification, Zone)

router = APIRouter(prefix="/api")
STAFF = ("admin", "supervisor", "worker")
MANAGERS = ("admin", "supervisor")


# ---------------------------------------------------------------- serialisers

def user_out(u: Optional[User]) -> Optional[dict]:
    return None if u is None else {"id": u.id, "name": u.name, "username": u.username, "role": u.role,
                                   "zone_id": u.zone_id}


def facility_out(f: Facility, issues: list[Issue], include_staff_token: bool = False) -> dict:
    out = {"id": f.id, "code": f.code, "name_en": f.name_en, "name_te": f.name_te,
           "zone": {"id": f.zone.id, "code": f.zone.code, "name_en": f.zone.name_en},
           "lat": f.lat, "lng": f.lng, "kind": f.kind, "operator": f.operator,
           "accessible": f.accessible, "has_men": f.has_men, "has_women": f.has_women, "free": f.free,
           "verify_window_min": f.verify_window_min,
           "unavailable_reason": f.unavailable_reason, "reopen_at": iso(f.reopen_at),
           "last_verified_at": iso(f.last_verified_at), "public_token": f.public_token,
           "queue": queue_state(f),
           **facility_status(f, issues)}
    if include_staff_token:
        out["staff_token"] = f.staff_token
    return out


def issue_out(i: Issue, db: Session) -> dict:
    f = i.facility
    return {"id": i.id, "category": i.category, "priority": i.priority, "state": i.state,
            "source": i.source, "report_count": i.report_count,
            "facility": {"id": f.id, "code": f.code, "name_en": f.name_en, "name_te": f.name_te,
                         "zone_code": f.zone.code},
            "created_at": iso(i.created_at), "ack_at": iso(i.ack_at), "assigned_at": iso(i.assigned_at),
            "started_at": iso(i.started_at), "resolved_at": iso(i.resolved_at), "closed_at": iso(i.closed_at),
            "assignee": user_out(db.get(User, i.assignee_id)) if i.assignee_id else None,
            "resolver": user_out(db.get(User, i.resolver_id)) if i.resolver_id else None,
            "verifier": user_out(db.get(User, i.verifier_id)) if i.verifier_id else None,
            "resolution_note": i.resolution_note, "has_resolution_photo": bool(i.resolution_photo),
            "resolved_offline": i.resolved_offline, "reopened_count": i.reopened_count,
            "invalid_reason": i.invalid_reason, **issue_timers(i)}


def facility_by_public(db: Session, token: str) -> Facility:
    f = db.scalars(select(Facility).where(Facility.public_token == token)).first()
    if not f:
        raise HTTPException(404, "This code is not active. Call the RMC helpline to report a problem.")
    return f


def get_issue(db: Session, issue_id: int) -> Issue:
    i = db.get(Issue, issue_id)
    if not i:
        raise HTTPException(404, "Issue not found.")
    return i


# ---------------------------------------------------------------- auth

class LoginIn(BaseModel):
    username: str
    pin: str


@router.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    u = db.scalars(select(User).where(User.username == body.username.strip().lower())).first()
    if not u or u.pin_hash != hash_pin(body.pin, u.username):
        raise HTTPException(401, "Username or PIN is wrong.")
    return {"token": make_token(u.id), "user": user_out(u)}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_out(user)


@router.get("/users")
def users(role: Optional[str] = None, db: Session = Depends(get_db), _: User = Depends(require(*STAFF))):
    q = select(User).where(User.active.is_(True))
    if role:
        q = q.where(User.role == role)
    out = []
    for u in db.scalars(q.order_by(User.name)):
        open_tasks = db.scalar(select(func.count(Issue.id)).where(
            Issue.assignee_id == u.id, Issue.state.in_({"assigned", "in_progress"}))) or 0
        out.append({**user_out(u), "open_tasks": open_tasks})
    return out


# ---------------------------------------------------------------- public

@router.get("/public/demo-facilities")
def demo_facilities(db: Session = Depends(get_db)):
    """Demo only: lists public QR links so evaluators can open them without scanning."""
    if os.getenv("DEMO_MODE", "1") != "1":
        raise HTTPException(404, "Not available.")
    return [{"code": f.code, "name_en": f.name_en, "public_token": f.public_token}
            for f in db.scalars(select(Facility).order_by(Facility.code))]


@router.get("/public/f/{token}")
def public_facility(token: str, db: Session = Depends(get_db)):
    f = facility_by_public(db, token)
    issues = open_issues_by_facility(db).get(f.id, [])
    since = utcnow() - timedelta(minutes=CLOSURE_CHALLENGE_MIN)
    recent = db.scalars(select(Issue).where(Issue.facility_id == f.id, Issue.state == "closed",
                                            Issue.closed_at >= since).order_by(Issue.closed_at.desc())).first()
    card = facility_out(f, issues)
    card.pop("public_token", None)
    card["recently_closed_issue"] = None if not recent else {"id": recent.id, "category": recent.category,
                                                             "closed_at": iso(recent.closed_at)}
    card["open_categories"] = sorted({i.category for i in issues})
    # Where else can I go? Nearest toilets that are verified usable and have water.
    by_fac = open_issues_by_facility(db)
    nearby = []
    for o in db.scalars(select(Facility).where(Facility.id != f.id)):
        st = facility_status(o, by_fac.get(o.id, []))
        if st["status"] != "verified" or not o.water_ok:
            continue
        nearby.append({"code": o.code, "name_en": o.name_en, "name_te": o.name_te,
                       "public_token": o.public_token, "lat": o.lat, "lng": o.lng,
                       "distance_m": round(distance_m(f.lat, f.lng, o.lat, o.lng)),
                       "bearing": round(bearing_deg(f.lat, f.lng, o.lat, o.lng)),
                       "has_men": o.has_men, "has_women": o.has_women, "accessible": o.accessible,
                       "verified_age_min": st["verified_age_min"], "queue": queue_state(o)})
    # nearest first, but toilets reported as full go to the end
    card["nearby"] = sorted(nearby, key=lambda x: ((x["queue"] or {}).get("level") == "full", x["distance_m"]))[:3]
    return card


class ReportIn(BaseModel):
    category: Literal["water", "dirty", "blocked", "door", "light", "smell", "unsafe", "other"]
    comment: Optional[str] = Field(default=None, max_length=280)
    phone: Optional[str] = Field(default=None, max_length=20)
    photo: Optional[str] = Field(default=None, max_length=400_000)
    audio: Optional[str] = Field(default=None, max_length=1_500_000)  # voice complaint (about 30 s)
    lang: Literal["en", "te", "hi"] = "en"
    device_key: Optional[str] = Field(default=None, max_length=64)


@router.post("/public/f/{token}/reports")
def public_report(token: str, body: ReportIn, db: Session = Depends(get_db)):
    f = facility_by_public(db, token)
    if body.device_key:  # simple flood control: 5 reports per device per facility per 10 minutes
        recent = db.scalar(select(func.count(PublicReport.id)).where(
            PublicReport.device_key == body.device_key, PublicReport.facility_id == f.id,
            PublicReport.created_at >= utcnow() - timedelta(minutes=10))) or 0
        if recent >= 5:
            raise HTTPException(429, "Thank you, this problem is already being handled.")
    if body.audio and not body.audio.startswith("data:audio/"):
        raise HTTPException(400, "The voice note could not be read. Please try again.")
    return wf.submit_public_report(db, f, body.category, body.comment, body.phone, body.photo, body.lang,
                                   body.device_key, body.audio)


@router.get("/public/reports/{ref_no}")
def report_status(ref_no: str, db: Session = Depends(get_db)):
    r = db.scalars(select(PublicReport).where(PublicReport.ref_no == ref_no.strip().upper())).first()
    if not r:
        raise HTTPException(404, "No report has that reference number.")
    i = db.get(Issue, r.issue_id)
    return {"ref_no": r.ref_no, "category": r.category, "state": i.state, "facility_code": i.facility.code,
            "reported_at": iso(r.created_at), "closed_at": iso(i.closed_at)}


class ReportDetailsIn(BaseModel):
    device_key: str = Field(min_length=6, max_length=64)
    comment: Optional[str] = Field(default=None, max_length=280)
    phone: Optional[str] = Field(default=None, max_length=20)
    photo: Optional[str] = Field(default=None, max_length=400_000)


@router.patch("/public/reports/{ref_no}")
def add_report_details(ref_no: str, body: ReportDetailsIn, db: Session = Depends(get_db)):
    """One-tap reporting sends first; the photo, comment or phone can be added afterwards."""
    r = db.scalars(select(PublicReport).where(PublicReport.ref_no == ref_no.strip().upper())).first()
    if not r or r.device_key != body.device_key:
        raise HTTPException(404, "No report from this phone has that reference number.")
    if body.comment:
        r.comment = body.comment
    if body.photo:
        r.photo = body.photo
    if body.phone:
        import hashlib
        r.phone_hash = hashlib.sha256(body.phone.encode()).hexdigest()
    db.commit()
    return {"ok": True}


class WithdrawIn(BaseModel):
    device_key: str = Field(min_length=6, max_length=64)


@router.post("/public/reports/{ref_no}/withdraw")
def withdraw_report(ref_no: str, body: WithdrawIn, db: Session = Depends(get_db)):
    r = db.scalars(select(PublicReport).where(PublicReport.ref_no == ref_no.strip().upper())).first()
    if not r:
        raise HTTPException(404, "No report from this phone has that reference number.")
    return wf.withdraw_public_report(db, r, body.device_key)


class FeedbackIn(BaseModel):
    fixed: bool
    device_key: str = Field(min_length=6, max_length=64)


@router.post("/public/issues/{issue_id}/feedback")
def feedback(issue_id: int, body: FeedbackIn, db: Session = Depends(get_db)):
    return wf.public_feedback(db, get_issue(db, issue_id), body.fixed, body.device_key)


# ---------------------------------------------------------------- facilities

@router.get("/facilities")
def facilities(db: Session = Depends(get_db), user: User = Depends(require(*STAFF))):
    by_fac = open_issues_by_facility(db)
    rows = db.scalars(select(Facility).order_by(Facility.code)).all()
    return [facility_out(f, by_fac.get(f.id, []), include_staff_token=user.role in MANAGERS) for f in rows]


@router.get("/facilities/{fid}/history")
def facility_history(fid: int, db: Session = Depends(get_db), _: User = Depends(require(*STAFF))):
    f = db.get(Facility, fid)
    if not f:
        raise HTTPException(404, "Facility not found.")
    ins = db.scalars(select(Inspection).where(Inspection.facility_id == fid)
                     .order_by(Inspection.device_time.desc()).limit(60)).all()
    iss = db.scalars(select(Issue).where(Issue.facility_id == fid).order_by(Issue.created_at.desc())).all()
    names = {u.id: u.name for u in db.scalars(select(User))}
    return {
        "facility": facility_out(f, [i for i in iss if i.state in OPEN_STATES]),
        "inspections": [{"id": x.id, "worker": names.get(x.worker_id), "passed": x.passed,
                         "water_ok": x.water_ok, "answers": json.loads(x.answers),
                         "device_time": iso(x.device_time), "server_time": iso(x.server_time),
                         "offline": x.offline, "flagged": x.flagged, "flag_reason": x.flag_reason,
                         "scan_method": x.scan_method} for x in ins],
        "issues": [issue_out(i, db) for i in iss],
    }


class AvailabilityIn(BaseModel):
    unavailable: bool
    reason: Optional[str] = None
    reopen_in_hours: Optional[float] = None


@router.patch("/facilities/{fid}/availability")
def set_availability(fid: int, body: AvailabilityIn, db: Session = Depends(get_db),
                     user: User = Depends(require(*MANAGERS))):
    f = db.get(Facility, fid)
    if not f:
        raise HTTPException(404, "Facility not found.")
    if body.unavailable and not (body.reason or "").strip():
        raise HTTPException(400, "Say why the facility is closed.")
    f.unavailable = body.unavailable
    f.unavailable_reason = body.reason.strip() if body.unavailable and body.reason else None
    f.reopen_at = utcnow() + timedelta(hours=body.reopen_in_hours) if body.unavailable and body.reopen_in_hours else None
    audit(db, user, "marked_unavailable" if body.unavailable else "reopened_facility", "facility", f.id,
          {"reason": f.unavailable_reason})
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- issues

@router.get("/issues")
def list_issues(scope: Literal["open", "all", "closed"] = "open", db: Session = Depends(get_db),
                _: User = Depends(require(*STAFF))):
    q = select(Issue)
    if scope == "open":
        q = q.where(Issue.state.in_(OPEN_STATES))
    elif scope == "closed":
        q = q.where(Issue.state.in_({"closed", "invalid"}))
    items = [issue_out(i, db) for i in db.scalars(q.order_by(Issue.created_at.desc()).limit(300))]
    rank = {"P1": 0, "P2": 1, "P3": 2}
    items.sort(key=lambda x: (-x["escalation_level"], rank[x["priority"]], x["created_at"]))
    return items


@router.get("/issues/{issue_id}")
def issue_detail(issue_id: int, db: Session = Depends(get_db), _: User = Depends(require(*STAFF))):
    i = get_issue(db, issue_id)
    reports = db.scalars(select(PublicReport).where(PublicReport.issue_id == i.id)
                         .order_by(PublicReport.created_at)).all()
    trail = db.scalars(select(AuditLog).where(AuditLog.entity == "issue", AuditLog.entity_id == i.id)
                       .order_by(AuditLog.id)).all()
    return {**issue_out(i, db),
            "reports": [{"ref_no": r.ref_no, "comment": r.comment, "lang": r.lang, "has_photo": bool(r.photo),
                         "has_audio": bool(r.audio),
                         "created_at": iso(r.created_at)} for r in reports],
            "timeline": [{"at": iso(a.at), "actor": a.actor_label, "action": a.action,
                          "detail": json.loads(a.detail)} for a in trail]}


@router.get("/reports/{ref_no}/audio")
def report_audio(ref_no: str, db: Session = Depends(get_db), _: User = Depends(require(*STAFF))):
    r = db.scalars(select(PublicReport).where(PublicReport.ref_no == ref_no.upper())).first()
    if not r or not r.audio:
        raise HTTPException(404, "No voice note for this report.")
    return {"audio": r.audio}


class AssignIn(BaseModel):
    worker_id: int


class ReasonIn(BaseModel):
    reason: str


class VerifyIn(BaseModel):
    staff_token: str
    confirmed: bool = True


def _commit(db: Session, issue: Issue):
    db.commit()
    return issue_out(issue, db)


@router.post("/issues/{issue_id}/acknowledge")
def ack(issue_id: int, db: Session = Depends(get_db), user: User = Depends(require(*MANAGERS))):
    i = get_issue(db, issue_id)
    wf.acknowledge(db, i, user)
    return _commit(db, i)


@router.post("/issues/{issue_id}/assign")
def assign(issue_id: int, body: AssignIn, db: Session = Depends(get_db), user: User = Depends(require(*MANAGERS))):
    i = get_issue(db, issue_id)
    w = db.get(User, body.worker_id)
    if not w:
        raise HTTPException(404, "Worker not found.")
    wf.assign(db, i, w, user)
    return _commit(db, i)


@router.post("/issues/{issue_id}/invalid")
def invalid(issue_id: int, body: ReasonIn, db: Session = Depends(get_db), user: User = Depends(require(*MANAGERS))):
    i = get_issue(db, issue_id)
    wf.mark_invalid(db, i, body.reason, user)
    return _commit(db, i)


@router.post("/issues/{issue_id}/verify")
def verify(issue_id: int, body: VerifyIn, db: Session = Depends(get_db), user: User = Depends(require(*STAFF))):
    i = get_issue(db, issue_id)
    wf.verify(db, i, user, body.staff_token.strip(), body.confirmed)
    return _commit(db, i)


# ---------------------------------------------------------------- worker

@router.get("/me/tasks")
def my_tasks(db: Session = Depends(get_db), user: User = Depends(require(*STAFF))):
    by_fac = open_issues_by_facility(db)
    facs = db.scalars(select(Facility).order_by(Facility.code)).all()
    mine = db.scalars(select(Issue).where(Issue.assignee_id == user.id,
                                          Issue.state.in_({"assigned", "in_progress"}))).all()
    to_verify = db.scalars(select(Issue).where(Issue.state == "awaiting_verification")).all()
    zone_facs = [f for f in facs if user.zone_id is None or f.zone_id == user.zone_id]
    due = sorted((facility_out(f, by_fac.get(f.id, []), True) for f in zone_facs if not f.unavailable),
                 key=lambda x: -(x["verified_age_min"] if x["verified_age_min"] is not None else 99999))
    return {"generated_at": iso(utcnow()),
            "repairs": [issue_out(i, db) for i in mine],
            "verifications": [issue_out(i, db) for i in to_verify if i.resolver_id != user.id],
            "inspections_due": due,
            # every facility this person may scan, so a staff code can be resolved while offline
            "facilities": [facility_out(f, by_fac.get(f.id, []), True) for f in facs]}


class SyncItem(BaseModel):
    client_uuid: str = Field(min_length=8, max_length=64)
    kind: Literal["inspection", "start", "resolve", "help", "queue"]
    queue_level: Optional[Literal["short", "long", "full"]] = None
    help_kind: Optional[Literal["tanker", "plumber", "supplies", "crowd", "other"]] = None
    device_time: datetime
    offline: bool = False
    staff_token: Optional[str] = None
    scan_method: Literal["qr", "manual"] = "qr"
    issue_id: Optional[int] = None
    answers: Optional[dict] = None
    note: Optional[str] = Field(default=None, max_length=500)
    photo: Optional[str] = Field(default=None, max_length=400_000)


class SyncIn(BaseModel):
    records: list[SyncItem] = Field(max_length=50)


@router.post("/sync/batch")
def sync_batch(body: SyncIn, db: Session = Depends(get_db), user: User = Depends(require(*STAFF))):
    """Apply queued field records in order. Idempotent by client_uuid; late records are kept and flagged."""
    results = []
    for rec in body.records:
        dt = rec.device_time if rec.device_time.tzinfo is None else \
            rec.device_time.astimezone(timezone.utc).replace(tzinfo=None)
        seen = db.get(SyncRecord, rec.client_uuid)
        if seen:
            results.append({"client_uuid": rec.client_uuid, "result": "duplicate", "detail": seen.detail})
            continue
        result, detail = "ok", None
        try:
            with db.begin_nested():
                if rec.kind == "inspection":
                    f = db.scalars(select(Facility).where(Facility.staff_token == (rec.staff_token or "").upper())).first()
                    if not f:
                        raise HTTPException(400, "Unknown staff code.")
                    wf.record_inspection(db, user, f, rec.client_uuid, rec.answers or {}, rec.note, rec.photo,
                                         dt, rec.offline, rec.scan_method)
                    detail = f"Inspection saved for {f.code}"
                elif rec.kind == "queue":
                    f = db.scalars(select(Facility).where(Facility.staff_token == (rec.staff_token or "").upper())).first()
                    if not f or not rec.queue_level:
                        raise HTTPException(400, "Unknown staff code or queue level.")
                    if f.queue_at is None or dt >= f.queue_at:  # an older offline reading never overwrites a newer one
                        f.queue_level, f.queue_at, f.queue_by_id = rec.queue_level, dt, user.id
                    audit(db, user, "queue_reported", "facility", f.id, {"level": rec.queue_level})
                    detail = f"Queue at {f.code}: {rec.queue_level}"
                elif rec.kind == "help":
                    f = db.scalars(select(Facility).where(Facility.staff_token == (rec.staff_token or "").upper())).first()
                    if not f:
                        raise HTTPException(400, "Unknown staff code.")
                    h = HelpRequest(client_uuid=rec.client_uuid, facility_id=f.id, requested_by_id=user.id,
                                    kind=rec.help_kind or "other", note=rec.note, created_at=dt)
                    db.add(h)
                    db.flush()
                    audit(db, user, "help_requested", "help", h.id, {"facility": f.code, "kind": h.kind})
                    detail = f"{HELP_LABEL[h.kind]} requested for {f.code}"
                else:
                    issue = get_issue(db, rec.issue_id or 0)
                    if issue.assignee_id != user.id:
                        result, detail = "late", "Issue was reassigned while you were offline; supervisor notified."
                        audit(db, user, "late_submission", "issue", issue.id,
                              {"kind": rec.kind, "device_time": dt.isoformat()})
                    elif rec.kind == "start":
                        wf.start_work(db, issue, user, dt)
                        detail = "Work started"
                    else:
                        wf.resolve(db, issue, user, dt, rec.note, rec.photo, rec.offline)
                        detail = "Fix submitted; waiting for a second person to verify"
        except HTTPException as e:
            result, detail = "rejected", str(e.detail)
        except IntegrityError:
            result, detail = "duplicate", "Already received"
        if result != "duplicate":
            db.add(SyncRecord(client_uuid=rec.client_uuid, kind=rec.kind, user_id=user.id, result=result,
                              detail=detail))
        db.commit()
        results.append({"client_uuid": rec.client_uuid, "result": result, "detail": detail})
    return {"results": results}


# ---------------------------------------------------------------- help requests

def help_out(h: HelpRequest, db: Session) -> dict:
    return {"id": h.id, "kind": h.kind, "label": HELP_LABEL[h.kind], "note": h.note, "state": h.state,
            "facility": {"id": h.facility.id, "code": h.facility.code, "name_en": h.facility.name_en},
            "requested_by": user_out(db.get(User, h.requested_by_id)),
            "handled_by": user_out(db.get(User, h.handled_by_id)) if h.handled_by_id else None,
            "created_at": iso(h.created_at), "ack_at": iso(h.ack_at), "done_at": iso(h.done_at),
            "age_min": round(minutes_between(h.created_at, utcnow()))}


@router.get("/help")
def list_help(scope: Literal["open", "all"] = "open", db: Session = Depends(get_db),
              _: User = Depends(require(*STAFF))):
    q = select(HelpRequest)
    if scope == "open":
        q = q.where(HelpRequest.state != "done")
    return [help_out(h, db) for h in db.scalars(q.order_by(HelpRequest.created_at.desc()).limit(200))]


@router.post("/help/{help_id}/{action}")
def help_action(help_id: int, action: Literal["acknowledge", "done"], db: Session = Depends(get_db),
                user: User = Depends(require(*MANAGERS))):
    h = db.get(HelpRequest, help_id)
    if not h:
        raise HTTPException(404, "Help request not found.")
    now = utcnow()
    if action == "acknowledge":
        if h.state != "open":
            raise HTTPException(409, "Already acknowledged.")
        h.state, h.ack_at, h.handled_by_id = "acknowledged", now, user.id
    else:
        if h.state == "done":
            raise HTTPException(409, "Already done.")
        h.state, h.done_at, h.handled_by_id = "done", now, user.id
        h.ack_at = h.ack_at or now
    audit(db, user, f"help_{action}", "help", h.id, {"facility": h.facility.code, "kind": h.kind})
    db.commit()
    return help_out(h, db)


# ---------------------------------------------------------------- dashboard and reports

@router.get("/dashboard/summary")
def dashboard(db: Session = Depends(get_db), _: User = Depends(require(*STAFF))):
    by_fac = open_issues_by_facility(db)
    facs = db.scalars(select(Facility)).all()
    statuses = {f.id: facility_status(f, by_fac.get(f.id, [])) for f in facs}
    open_issues = [i for lst in by_fac.values() for i in lst]
    zones = []
    for z in db.scalars(select(Zone).order_by(Zone.code)):
        zf = [f for f in facs if f.zone_id == z.id]
        zi = [i for i in open_issues if i.facility.zone_id == z.id]
        ages = [minutes_between(i.created_at, utcnow()) for i in zi]
        zones.append({"code": z.code, "name": z.name_en, "facilities": len(zf),
                      "verified": sum(statuses[f.id]["status"] == "verified" for f in zf),
                      "overdue": sum(statuses[f.id]["overdue"] and not f.unavailable for f in zf),
                      "open_p1": sum(i.priority == "P1" for i in zi),
                      "oldest_open_min": round(max(ages)) if ages else None})
    attention = []
    for i in open_issues:
        t = issue_timers(i)
        if t["escalation_level"] or i.priority == "P1":
            attention.append({"kind": "issue", "level": 2 + t["escalation_level"], "issue_id": i.id,
                              "text": f"{i.priority} · {i.facility.code} {i.facility.name_en} · {i.category}"
                                      f" · {i.report_count} report(s) · {i.state.replace('_', ' ')}",
                              "breached": bool(t["escalation_level"])})
    for f in facs:
        s = statuses[f.id]
        if s["overdue"] and not f.unavailable:
            age = s["verified_age_min"]
            attention.append({"kind": "overdue", "level": 1, "facility_id": f.id,
                              "text": f"Overdue · {f.code} {f.name_en} · "
                                      + ("never checked" if age is None else f"not checked for {age // 60} h {age % 60} min")})
    day_ago = utcnow() - timedelta(hours=24)
    repeat = db.execute(select(Issue.facility_id, Issue.category, func.count(Issue.id))
                        .where(Issue.created_at >= day_ago)
                        .group_by(Issue.facility_id, Issue.category).having(func.count(Issue.id) >= 3)).all()
    for fid, cat, n in repeat:
        f = db.get(Facility, fid)
        attention.append({"kind": "repeat", "level": 1, "facility_id": fid,
                          "text": f"Repeat · {f.code} {f.name_en} · {n} “{cat}” issues in 24 h"})
    crowded = []
    for f in facs:
        q = queue_state(f)
        if q and q["level"] in ("long", "full") and not f.unavailable:
            crowded.append(f)
            attention.append({"kind": "queue", "level": 2 if q["level"] == "full" else 1, "facility_id": f.id,
                              "text": f"Crowded · {f.code} {f.name_en} · queue {q['level']} · {q['age_min']} min ago"})
    open_help = db.scalars(select(HelpRequest).where(HelpRequest.state != "done")).all()
    for h in open_help:
        who = db.get(User, h.requested_by_id)
        attention.append({"kind": "help", "level": 3 if h.state == "open" else 1, "help_id": h.id,
                          "text": f"Help · {h.facility.code} {h.facility.name_en} · {HELP_LABEL[h.kind]}"
                                  f" · asked by {who.name} {round(minutes_between(h.created_at, utcnow()))} min ago"
                                  + (" · acknowledged" if h.state == "acknowledged" else "")})
    attention.sort(key=lambda a: -a["level"])
    workers = db.scalars(select(User).where(User.role == "worker", User.active.is_(True))).all()
    return {
        "generated_at": iso(utcnow()),
        "total_facilities": len(facs),
        "verified": sum(s["status"] == "verified" for s in statuses.values()),
        "overdue": sum(s["overdue"] and not f.unavailable for f, s in ((f, statuses[f.id]) for f in facs)),
        "water_unavailable": sum(not f.water_ok for f in facs),
        "unavailable": sum(f.unavailable for f in facs),
        "open_issues": len(open_issues),
        "open_by_priority": {p: sum(i.priority == p for i in open_issues) for p in ("P1", "P2", "P3")},
        "reports_today": db.scalar(select(func.count(PublicReport.id)).where(PublicReport.created_at >= day_ago)) or 0,
        "workers_on_shift": len(workers),
        "tasks_open": sum(i.state in {"assigned", "in_progress"} for i in open_issues),
        "tasks_overdue": sum(issue_timers(i)["resolve_breached"] for i in open_issues if i.assignee_id),
        "awaiting_verification": sum(i.state == "awaiting_verification" for i in open_issues),
        "help_open": sum(h.state == "open" for h in open_help),
        "crowded": len(crowded),
        "zones": zones,
        "attention": attention[:8],
    }


def _median(xs: list[float]) -> Optional[float]:
    return round(statistics.median(xs), 1) if xs else None


@router.get("/reports/summary")
def report_summary(hours: int = 72, db: Session = Depends(get_db), _: User = Depends(require(*STAFF))):
    since = utcnow() - timedelta(hours=hours)
    issues = db.scalars(select(Issue).where(Issue.created_at >= since)).all()
    closed = [i for i in issues if i.state == "closed" and i.closed_at]
    ack = [minutes_between(i.created_at, i.ack_at) for i in issues if i.ack_at]
    close = [minutes_between(i.created_at, i.closed_at) for i in closed]
    p1_close = [minutes_between(i.created_at, i.closed_at) for i in closed if i.priority == "P1"]
    verifs = db.scalars(select(Verification).where(Verification.created_at >= since,
                                                   Verification.outcome == "confirmed")).all()
    independent = sum(v.verifier_id != v.resolver_id for v in verifs)
    ins = db.scalars(select(Inspection).where(Inspection.device_time >= since)).all()
    by_fac = open_issues_by_facility(db)
    facs = db.scalars(select(Facility)).all()
    live = [f for f in facs if not f.unavailable]
    fresh_now = sum(not facility_status(f, by_fac.get(f.id, []))["overdue"] for f in live)
    repeat = db.execute(select(Facility.code, Issue.category, func.count(Issue.id)).join(Facility)
                        .where(Issue.created_at >= since)
                        .group_by(Facility.code, Issue.category).having(func.count(Issue.id) >= 3)).all()
    workers = []
    for w in db.scalars(select(User).where(User.role == "worker").order_by(User.name)):
        workers.append({"name": w.name,
                        "inspections": sum(x.worker_id == w.id for x in ins),
                        "offline_inspections": sum(x.worker_id == w.id and x.offline for x in ins),
                        "flagged": sum(x.worker_id == w.id and x.flagged for x in ins),
                        "fixes": sum(i.resolver_id == w.id for i in issues),
                        "verifications": sum(v.verifier_id == w.id for v in verifs)})
    return {
        "window_hours": hours,
        "inspections": len(ins),
        "inspections_offline": sum(x.offline for x in ins),
        "inspections_flagged": sum(x.flagged for x in ins),
        "freshness_now_pct": round(100 * fresh_now / len(live)) if live else None,
        "issues_created": len(issues),
        "issues_closed": len(closed),
        "median_ack_min": _median(ack),
        "median_close_min": _median(close),
        "median_p1_close_min": _median(p1_close),
        "independent_verification_pct": round(100 * independent / len(verifs)) if verifs else None,
        "reopen_pct": round(100 * sum(i.reopened_count > 0 for i in issues) / len(issues)) if issues else None,
        "repeat_issues": [{"facility": c, "category": cat, "count": n} for c, cat, n in repeat],
        "workers": workers,
    }


@router.get("/reports/issues.csv")
def issues_csv(db: Session = Depends(get_db), _: User = Depends(require(*STAFF))):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["issue_id", "facility", "category", "priority", "state", "reports", "created_at", "ack_at",
                "resolved_at", "closed_at", "minutes_to_close", "resolver", "verifier", "resolved_offline",
                "reopened"])
    names = {u.id: u.name for u in db.scalars(select(User))}
    for i in db.scalars(select(Issue).order_by(Issue.id)):
        mins = round(minutes_between(i.created_at, i.closed_at)) if i.closed_at and i.state == "closed" else ""
        w.writerow([i.id, i.facility.code, i.category, i.priority, i.state, i.report_count, iso(i.created_at),
                    iso(i.ack_at) or "", iso(i.resolved_at) or "", iso(i.closed_at) or "", mins,
                    names.get(i.resolver_id, ""), names.get(i.verifier_id, ""), i.resolved_offline,
                    i.reopened_count])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=swachhsetu-issues.csv"})


@router.get("/audit")
def audit_trail(limit: int = 100, db: Session = Depends(get_db), _: User = Depends(require(*MANAGERS))):
    rows = db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(min(limit, 500))).all()
    return [{"id": a.id, "at": iso(a.at), "actor": a.actor_label, "action": a.action, "entity": a.entity,
             "entity_id": a.entity_id, "detail": json.loads(a.detail), "hash": a.hash[:12]} for a in rows]


@router.get("/audit/verify")
def audit_verify(db: Session = Depends(get_db), _: User = Depends(require(*MANAGERS))):
    return verify_chain(db)


@router.post("/demo/reset")
def demo_reset(_: User = Depends(require(*MANAGERS))):
    from .seed import reset_and_seed
    reset_and_seed()
    return {"ok": True, "message": "Demo data restored."}


@router.get("/health")
def health(db: Session = Depends(get_db)):
    return {"ok": True, "facilities": db.scalar(select(func.count(Facility.id)))}
