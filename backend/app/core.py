"""Core rules of SwachhSetu: status, priority, timers, audit chain and auth."""
import hashlib
import math
import hmac
import json
import os
import time
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db, utcnow
from .models import AuditLog, Facility, Issue, User

SECRET = os.getenv("SECRET_KEY", "swachhsetu-demo-secret-change-me").encode()

CATEGORIES = ["water", "dirty", "blocked", "door", "light", "smell", "unsafe", "other"]
P1_CATEGORIES = {"water", "blocked", "unsafe"}
P3_CATEGORIES = {"other"}
ACK_MIN = {"P1": 10, "P2": 20, "P3": 60}
RESOLVE_MIN = {"P1": 45, "P2": 120, "P3": 480}
OPEN_STATES = {"new", "acknowledged", "assigned", "in_progress", "awaiting_verification", "reopened"}
WORK_STATES = {"assigned", "in_progress", "awaiting_verification"}
CLOSURE_CHALLENGE_MIN = 60
CHECKLIST = ["floor", "pans", "water", "door", "lights", "handwash"]
CHECKLIST_TO_CATEGORY = {"floor": "dirty", "pans": "dirty", "water": "water",
                         "door": "door", "lights": "light", "handwash": "other"}


def base_priority(category: str) -> str:
    if category in P1_CATEGORIES:
        return "P1"
    if category in P3_CATEGORIES:
        return "P3"
    return "P2"


def bump_priority(issue: Issue) -> None:
    """Crowd signal: three or more merged reports make any issue urgent."""
    if issue.report_count >= 3 and issue.priority != "P1":
        issue.priority = "P1"


def minutes_between(a: datetime, b: datetime) -> float:
    return (b - a).total_seconds() / 60.0


def issue_timers(issue: Issue, now: Optional[datetime] = None) -> dict:
    now = now or utcnow()
    ack_due = issue.created_at + timedelta(minutes=ACK_MIN[issue.priority])
    resolve_due = issue.created_at + timedelta(minutes=RESOLVE_MIN[issue.priority])
    ack_breached = issue.ack_at is None and issue.state in {"new", "reopened"} and now > ack_due
    resolve_breached = issue.state in OPEN_STATES and issue.state != "awaiting_verification" and now > resolve_due
    level = int(ack_breached) + int(resolve_breached)
    return {
        "ack_due_at": ack_due.isoformat() + "Z",
        "resolve_due_at": resolve_due.isoformat() + "Z",
        "minutes_to_resolve_due": round(minutes_between(now, resolve_due)),
        "ack_breached": ack_breached,
        "resolve_breached": resolve_breached,
        "escalation_level": level,
    }


def facility_status(f: Facility, open_issues: list[Issue], now: Optional[datetime] = None) -> dict:
    """Highest condition wins: unavailable > maintenance > issue > overdue > verified."""
    now = now or utcnow()
    age = None if f.last_verified_at is None else round(minutes_between(f.last_verified_at, now))
    overdue = age is None or age > f.verify_window_min
    if f.unavailable:
        status = "unavailable"
    elif any(i.state in WORK_STATES for i in open_issues):
        status = "maintenance"
    elif open_issues:
        status = "issue"
    elif overdue:
        status = "overdue"
    else:
        status = "verified"
    return {"status": status, "verified_age_min": age, "overdue": overdue,
            "water_ok": f.water_ok, "open_issue_count": len(open_issues)}


def open_issues_by_facility(db: Session) -> dict[int, list[Issue]]:
    out: dict[int, list[Issue]] = {}
    for i in db.scalars(select(Issue).where(Issue.state.in_(OPEN_STATES))):
        out.setdefault(i.facility_id, []).append(i)
    return out


QUEUE_LEVELS = ["short", "long", "full"]
QUEUE_TTL_MIN = 45  # a queue reading older than this is shown as unknown


def queue_state(f, now: Optional[datetime] = None) -> Optional[dict]:
    """Queue length as last reported by staff, or None if never reported or out of date."""
    now = now or utcnow()
    if not f.queue_level or not f.queue_at:
        return None
    age = minutes_between(f.queue_at, now)
    if age > QUEUE_TTL_MIN:
        return None
    return {"level": f.queue_level, "age_min": round(age)}


HELP_KINDS = ["tanker", "plumber", "supplies", "crowd", "other"]
HELP_LABEL = {"tanker": "Water tanker", "plumber": "Plumber", "supplies": "Cleaning supplies",
              "crowd": "Crowd too heavy", "other": "Other help"}


def distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def bearing_deg(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lng2 - lng1)
    x = math.sin(dl) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def iso(dt: Optional[datetime]) -> Optional[str]:
    return None if dt is None else dt.isoformat() + "Z"


# ---------------------------------------------------------------- audit chain

def _hash(prev: str, payload: dict) -> str:
    raw = prev + json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def audit(db: Session, actor: Optional[User], action: str, entity: str,
          entity_id: Optional[int], detail: Optional[dict] = None, actor_label: Optional[str] = None,
          at: Optional[datetime] = None) -> None:
    """Append one row to the hash-chained audit log, in the caller's transaction."""
    last = db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(1)).first()
    prev = last.hash if last else "0" * 64
    at = at or utcnow()
    label = actor_label or (f"{actor.name} ({actor.role})" if actor else "system")
    detail_json = json.dumps(detail or {}, sort_keys=True)
    payload = {"at": at.isoformat(), "actor": label, "action": action, "entity": entity,
               "entity_id": entity_id, "detail": detail_json}
    db.add(AuditLog(at=at, actor_id=actor.id if actor else None, actor_label=label, action=action,
                    entity=entity, entity_id=entity_id, detail=detail_json, prev_hash=prev,
                    hash=_hash(prev, payload)))
    db.flush()


def verify_chain(db: Session) -> dict:
    prev = "0" * 64
    count = 0
    for row in db.scalars(select(AuditLog).order_by(AuditLog.id)):
        payload = {"at": row.at.isoformat(), "actor": row.actor_label, "action": row.action,
                   "entity": row.entity, "entity_id": row.entity_id, "detail": row.detail}
        if row.prev_hash != prev or row.hash != _hash(prev, payload):
            return {"valid": False, "rows_checked": count, "broken_at_id": row.id}
        prev = row.hash
        count += 1
    return {"valid": True, "rows_checked": count, "chain_head": prev}


# ---------------------------------------------------------------- auth

def hash_pin(pin: str, username: str) -> str:
    return hashlib.sha256(f"{username}:{pin}".encode() + SECRET).hexdigest()


def make_token(user_id: int, hours: int = 12) -> str:
    exp = int(time.time()) + hours * 3600
    body = f"{user_id}.{exp}"
    sig = hmac.new(SECRET, body.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{body}.{sig}"


def read_token(token: str) -> Optional[int]:
    try:
        uid, exp, sig = token.split(".")
        good = hmac.new(SECRET, f"{uid}.{exp}".encode(), hashlib.sha256).hexdigest()[:32]
        if not hmac.compare_digest(good, sig) or int(exp) < time.time():
            return None
        return int(uid)
    except ValueError:
        return None


def current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> User:
    token = authorization.removeprefix("Bearer ").strip()
    uid = read_token(token) if token else None
    user = db.get(User, uid) if uid else None
    if not user or not user.active:
        raise HTTPException(401, "Sign in to continue.")
    return user


def require(*roles: str):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "Your role cannot do this.")
        return user
    return dep
