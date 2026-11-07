"""SYNTHETIC DEMO DATA. Every facility, person and record here is fictional.

Scenarios built in:
- DN-T04 has had no inspection for 5 h 10 min (verification overdue)
- DS-T01 has four "dirty" issues in 24 h (repeated complaints)
- DN-T03 has a water shortage with a P1 repair under way and an open request for a water tanker
- DC-T01 is clean and is the target for the live complaint-to-resolution demo
- DS-T04 is closed for flooding
"""
import json
import random
from datetime import timedelta

from sqlalchemy import func, select

from .core import audit, base_priority, hash_pin
from .db import Base, SessionLocal, engine, utcnow
from .models import (Facility, HelpRequest, Inspection, Issue, PublicReport, User, Verification, Zone)

ZONES = [
    ("DN", "Demo Ghat Zone North", "డెమో ఘాట్ జోన్ ఉత్తరం"),
    ("DS", "Demo Ghat Zone South", "డెమో ఘాట్ జోన్ దక్షిణం"),
    ("DC", "Demo City Zone", "డెమో నగర జోన్"),
]

# code, name_en, name_te, zone, lat, lng, kind, operator, accessible, window_min, last_check_min_ago
FACILITIES = [
    ("DN-T01", "North Ghat Block A", "ఉత్తర ఘాట్ బ్లాక్ A", "DN", 17.0052, 81.7745, "permanent", "RMC", False, 120, 25),
    ("DN-T02", "North Ghat Block B", "ఉత్తర ఘాట్ బ్లాక్ B", "DN", 17.0061, 81.7754, "temporary", "Demo Contractor A", False, 120, 70),
    ("DN-T03", "North Ghat Women's Unit", "ఉత్తర ఘాట్ మహిళల యూనిట్", "DN", 17.0046, 81.7736, "temporary", "Demo Contractor A", False, 120, 95),
    ("DN-T04", "North Parking Toilets", "ఉత్తర పార్కింగ్ మరుగుదొడ్లు", "DN", 17.0077, 81.7772, "temporary", "Demo Contractor A", False, 120, 310),
    ("DS-T01", "South Ghat Block A", "దక్షిణ ఘాట్ బ్లాక్ A", "DS", 16.9946, 81.7795, "permanent", "RMC", False, 120, 35),
    ("DS-T02", "South Ghat Block B", "దక్షిణ ఘాట్ బ్లాక్ B", "DS", 16.9937, 81.7805, "temporary", "Demo Contractor B", False, 120, 60),
    ("DS-T03", "South Ghat Accessible Unit", "దక్షిణ ఘాట్ అందుబాటు యూనిట్", "DS", 16.9951, 81.7787, "permanent", "RMC", True, 120, 45),
    ("DS-T04", "South Bathing Changing Area", "దక్షిణ స్నాన ఘట్టం మార్పు గది", "DS", 16.9929, 81.7814, "temporary", "Demo Contractor B", False, 120, 150),
    ("DC-T01", "Bus Stand Public Toilet", "బస్ స్టాండ్ పబ్లిక్ టాయిలెట్", "DC", 17.0016, 81.7889, "permanent", "RMC", True, 240, 40),
    ("DC-T02", "Railway Road Toilet", "రైల్వే రోడ్ టాయిలెట్", "DC", 17.0009, 81.7931, "permanent", "RMC", False, 240, 100),
]

# username, name, role, zone
USERS = [
    ("admin", "Demo Admin", "admin", None),
    ("lakshmi", "Sup. Lakshmi", "supervisor", "DN"),
    ("ravi", "Sup. Ravi", "supervisor", None),
    ("anil", "Anil", "worker", "DN"),
    ("bhavani", "Bhavani", "worker", "DN"),
    ("chandra", "Chandra", "worker", "DN"),
    ("durga", "Durga", "worker", "DS"),
    ("eswar", "Eswar", "worker", "DC"),
]
DEMO_PIN = "1234"
STAFF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def reset_and_seed() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    seed()


def seed_if_empty() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if (db.scalar(select(func.count(Facility.id))) or 0) == 0:
            seed()


def seed() -> None:
    rnd = random.Random(2027)
    now = utcnow()
    with SessionLocal() as db:
        zones = {}
        for code, en, te in ZONES:
            z = Zone(code=code, name_en=en, name_te=te)
            db.add(z)
            zones[code] = z
        db.flush()
        users = {}
        for username, name, role, zone in USERS:
            u = User(username=username, name=name, role=role, zone_id=zones[zone].id if zone else None,
                     pin_hash=hash_pin(DEMO_PIN, username))
            db.add(u)
            users[username] = u
        db.flush()
        audit(db, None, "demo_seeded", "system", None, {"note": "SYNTHETIC DEMO DATA"}, actor_label="system",
              at=now - timedelta(hours=73))

        zone_workers = {"DN": ["anil", "bhavani", "chandra"], "DS": ["durga"], "DC": ["eswar"]}
        facs = {}
        for (code, en, te, zone, lat, lng, kind, op, acc, window, last_ago) in FACILITIES:
            staff = "".join(rnd.choice(STAFF_ALPHABET) for _ in range(6))
            f = Facility(code=code, name_en=en, name_te=te, zone_id=zones[zone].id, lat=lat, lng=lng, kind=kind,
                         operator=op, accessible=acc, verify_window_min=window,
                         public_token=f"{code.lower()}-{rnd.randrange(16**6):06x}", staff_token=staff)
            if code == "DN-T03":
                f.has_men = False  # women's unit
            if code == "DS-T04":
                f.free = False
            db.add(f)
            db.flush()
            facs[code] = f
            # 72 hours of inspection history ending at the facility's last check
            t = now - timedelta(minutes=last_ago)
            stamps = []
            while t > now - timedelta(hours=72):
                stamps.append(t)
                t -= timedelta(minutes=rnd.randint(60, 200))
            for i, ts in enumerate(reversed(stamps)):
                w = users[rnd.choice(zone_workers[zone])]
                answers = {k: True for k in ("floor", "pans", "water", "door", "lights", "handwash")}
                if code == "DS-T01" and ts > now - timedelta(hours=24) and i % 3 == 0:
                    answers["floor"] = answers["pans"] = False
                db.add(Inspection(client_uuid=f"seed-{code}-{i}", facility_id=f.id, worker_id=w.id,
                                  answers=json.dumps(answers), passed=all(answers.values()),
                                  water_ok=answers["water"], device_time=ts, server_time=ts + timedelta(seconds=20),
                                  offline=rnd.random() < 0.08, scan_method="qr"))
            f.last_verified_at = now - timedelta(minutes=last_ago)
            f.last_verified_by_id = users[zone_workers[zone][0]].id
        db.flush()

        ref = [100]

        def report(f: Facility, issue: Issue, at, comment=None, lang="en"):
            ref[0] += 1
            db.add(PublicReport(ref_no=f"SS-{ref[0]:04d}", facility_id=f.id, issue_id=issue.id,
                                category=issue.category, comment=comment, lang=lang,
                                device_key=f"seed-device-{ref[0]}", created_at=at))

        def issue(code, category, created_ago, reports=1, state="new", assignee=None, ack_after=5,
                  assign_after=8, start_after=None, resolve_after=None, close_after=None, verifier=None,
                  source="public"):
            f = facs[code]
            created = now - timedelta(minutes=created_ago)
            prio = "P1" if reports >= 3 else base_priority(category)
            i = Issue(facility_id=f.id, category=category, priority=prio, state=state, source=source,
                      report_count=reports if source == "public" else 0, created_at=created)
            db.add(i)
            db.flush()
            for n in range(reports if source == "public" else 0):
                report(f, i, created + timedelta(minutes=2 * n), lang="te" if n % 2 else "en")
            audit(db, None, "issue_created", "issue", i.id, {"facility": code, "category": category,
                                                             "priority": prio, "source": source},
                  actor_label="public" if source == "public" else "inspection", at=created)
            sup = users["lakshmi"] if code.startswith("DN") else users["ravi"]
            if state != "new":
                i.ack_at = created + timedelta(minutes=ack_after)
                audit(db, sup, "acknowledged", "issue", i.id, at=i.ack_at)
            if assignee:
                w = users[assignee]
                i.assignee_id, i.assigned_at = w.id, created + timedelta(minutes=assign_after)
                audit(db, sup, "assigned", "issue", i.id, {"worker": w.name}, at=i.assigned_at)
            if start_after is not None:
                i.started_at = created + timedelta(minutes=start_after)
                audit(db, users[assignee], "work_started", "issue", i.id, at=i.started_at)
            if resolve_after is not None:
                i.resolved_at, i.resolver_id = created + timedelta(minutes=resolve_after), users[assignee].id
                i.resolution_note = "Cleaned and restocked"
                audit(db, users[assignee], "resolved", "issue", i.id, {"note": i.resolution_note}, at=i.resolved_at)
            if close_after is not None:
                v = users[verifier]
                i.closed_at, i.verifier_id = created + timedelta(minutes=close_after), v.id
                db.add(Verification(issue_id=i.id, verifier_id=v.id, resolver_id=i.resolver_id,
                                    outcome="confirmed", created_at=i.closed_at))
                audit(db, v, "verified_closed", "issue", i.id, {"facility": code}, at=i.closed_at)
            db.flush()
            return i

        # Historical, closed issues (give the reports real numbers to work with)
        issue("DN-T01", "blocked", 30 * 60, 2, "closed", "anil", 6, 9, 15, 38, 52, "bhavani")
        issue("DC-T01", "water", 50 * 60, 3, "closed", "eswar", 4, 7, 12, 35, 41, "ravi")
        issue("DN-T02", "light", 44 * 60, 1, "closed", "chandra", 12, 18, 40, 70, 95, "lakshmi")
        issue("DS-T03", "door", 26 * 60, 1, "closed", "durga", 9, 15, 30, 64, 80, "ravi")
        # DS-T01: four "dirty" issues in 24 h, three closed and one open
        for ago in (22 * 60, 14 * 60, 6 * 60):
            issue("DS-T01", "dirty", ago, 2, "closed", "durga", 5, 9, 14, 33, 47, "ravi")
        issue("DS-T01", "dirty", 20, 2, "acknowledged")
        # DN-T03: water shortage, P1 repair in progress
        issue("DN-T03", "water", 50, 3, "in_progress", "anil", 3, 10, 20)
        facs["DN-T03"].water_ok = False
        # Crowd: attendants report queue length (no sensors)
        facs["DN-T01"].queue_level, facs["DN-T01"].queue_at = "long", now - timedelta(minutes=10)
        facs["DN-T01"].queue_by_id = users["bhavani"].id
        facs["DS-T03"].queue_level, facs["DS-T03"].queue_at = "short", now - timedelta(minutes=15)
        facs["DS-T03"].queue_by_id = users["durga"].id
        h = HelpRequest(client_uuid="seed-help-1", facility_id=facs["DN-T03"].id, requested_by_id=users["anil"].id,
                        kind="tanker", note="Overhead tank empty; supply line not working", created_at=now - timedelta(minutes=25))
        db.add(h)
        db.flush()
        audit(db, users["anil"], "help_requested", "help", h.id, {"facility": "DN-T03", "kind": "tanker"},
              at=h.created_at)
        # DS-T02: door lock repair in progress
        issue("DS-T02", "door", 90, 1, "in_progress", "durga", 6, 12, 40)
        # DC-T02: no light, acknowledged
        issue("DC-T02", "light", 30, 1, "acknowledged")
        # DS-T04: closed for flooding
        f = facs["DS-T04"]
        f.unavailable, f.unavailable_reason = True, "Flooding after rain"
        f.reopen_at = now + timedelta(hours=3)
        audit(db, users["ravi"], "marked_unavailable", "facility", f.id, {"reason": f.unavailable_reason},
              at=now - timedelta(minutes=140))
        db.commit()
