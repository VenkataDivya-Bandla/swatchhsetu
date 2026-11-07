"""End-to-end demonstration scenario, run against the API.

Used by `make demo-report` (writes captures/demo-report.md) and by the test suite.
Works with either a FastAPI TestClient or an httpx.Client pointed at a running server.
"""
import uuid
from datetime import datetime, timedelta, timezone


class Recorder:
    def __init__(self):
        self.rows = []

    def check(self, step: str, expected: str, observed, ok: bool):
        self.rows.append((step, expected, str(observed), ok))
        print(f"[{'PASS' if ok else 'FAIL'}] {step}: {observed}")
        return ok

    @property
    def passed(self) -> bool:
        return all(r[3] for r in self.rows)

    def markdown(self, base_url: str) -> str:
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        lines = ["# SwachhSetu prototype: end-to-end demo report", "",
                 f"Run at {now} against `{base_url}`. **All data is synthetic.**", "",
                 f"Result: **{sum(r[3] for r in self.rows)}/{len(self.rows)} checks passed**", "",
                 "| # | Step | Expected | Observed | Result |", "| --- | --- | --- | --- | --- |"]
        for n, (step, exp, obs, ok) in enumerate(self.rows, 1):
            obs = obs.replace("|", "/")[:160]
            lines.append(f"| {n} | {step} | {exp} | {obs} | {'PASS' if ok else 'FAIL'} |")
        return "\n".join(lines) + "\n"


def _login(c, username):
    r = c.post("/api/auth/login", json={"username": username, "pin": "1234"})
    r.raise_for_status()
    return {"Authorization": "Bearer " + r.json()["token"]}


def _iso(minutes_ago: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat()


def run(c, rec: Recorder) -> Recorder:
    ravi = _login(c, "ravi")
    c.post("/api/demo/reset", headers=ravi).raise_for_status()
    ravi, eswar, durga, anil = (_login(c, u) for u in ("ravi", "eswar", "durga", "anil"))

    # 1. Starting picture
    d = c.get("/api/dashboard/summary", headers=ravi).json()
    texts = " | ".join(a["text"] for a in d["attention"])
    rec.check("Dashboard flags a facility with no recent inspection", "DN-T04 overdue",
              "DN-T04 overdue" if "DN-T04" in texts and "Overdue" in texts else texts, "Overdue · DN-T04" in texts)
    rec.check("Dashboard flags the water shortage", "1 facility without water", d["water_unavailable"],
              d["water_unavailable"] == 1)
    rec.check("Dashboard shows the open water-tanker request", "Help · DN-T03", "Help · DN-T03" in texts,
              "Help · DN-T03" in texts)
    rec.check("Dashboard flags repeated complaints", "DS-T01 repeat", "Repeat · DS-T01" in texts,
              "Repeat · DS-T01" in texts)

    facs = {f["code"]: f for f in c.get("/api/facilities", headers=ravi).json()}
    dc1 = facs["DC-T01"]
    card = c.get(f"/api/public/f/{dc1['public_token']}").json()
    rec.check("Public QR page opens without login", "DC-T01 verified usable", card["status"],
              card["status"] == "verified")

    # 2. Two members of the public report the same problem
    r1 = c.post(f"/api/public/f/{dc1['public_token']}/reports",
                json={"category": "blocked", "lang": "te", "device_key": "juror-one-device"}).json()
    r2 = c.post(f"/api/public/f/{dc1['public_token']}/reports",
                json={"category": "blocked", "lang": "en", "device_key": "juror-two-device"}).json()
    rec.check("First report gets a reference number", "SS-#### issued", r1["ref_no"], r1["ref_no"].startswith("SS-"))
    rec.check("Second report merges into the same issue", "merged, 2 reports, no new ticket",
              f"merged={r2['merged']}, reports={r2['report_count']}",
              r2["merged"] and r2["report_count"] == 2 and r1["issue_id"] == r2["issue_id"])
    issue_id = r1["issue_id"]
    card = c.get(f"/api/public/f/{dc1['public_token']}").json()
    rec.check("Facility status changes to reported issue", "issue", card["status"], card["status"] == "issue")
    near = card["nearby"]
    rec.check("Public page offers the nearest usable toilets", "1-3 verified alternatives with distance",
              ", ".join(f"{n['code']} {n['distance_m']} m" for n in near),
              0 < len(near) <= 3 and all(n["distance_m"] > 0 for n in near))
    det1 = c.patch(f"/api/public/reports/{r1['ref_no']}",
                   json={"device_key": "juror-one-device", "comment": "Water overflowing on the floor"})
    rec.check("Photo or comment can be added after a one-tap report", "HTTP 200", f"HTTP {det1.status_code}",
              det1.status_code == 200)

    # 3. Supervisor acknowledges and assigns
    c.post(f"/api/issues/{issue_id}/acknowledge", headers=ravi).raise_for_status()
    workers = {w["username"]: w for w in c.get("/api/users?role=worker", headers=ravi).json()}
    a = c.post(f"/api/issues/{issue_id}/assign", headers=ravi, json={"worker_id": workers["eswar"]["id"]}).json()
    rec.check("Supervisor assigns the worker", "assigned to Eswar", f"{a['state']} to {a['assignee']['name']}",
              a["state"] == "assigned" and a["assignee"]["name"] == "Eswar")

    # 4. Worker fixes it offline; records sync later, and a retry does not duplicate
    batch = {"records": [
        {"client_uuid": f"demo-{uuid.uuid4()}", "kind": "start", "issue_id": issue_id,
         "device_time": _iso(6), "offline": True},
        {"client_uuid": f"demo-{uuid.uuid4()}", "kind": "resolve", "issue_id": issue_id, "device_time": _iso(3),
         "offline": True, "note": "Cleared blockage, flushed lines"},
    ]}
    s1 = c.post("/api/sync/batch", headers=eswar, json=batch).json()["results"]
    rec.check("Offline records sync when the phone reconnects", "ok, ok", ", ".join(x["result"] for x in s1),
              [x["result"] for x in s1] == ["ok", "ok"])
    s2 = c.post("/api/sync/batch", headers=eswar, json=batch).json()["results"]
    rec.check("Re-sending the same records creates no duplicates", "duplicate, duplicate",
              ", ".join(x["result"] for x in s2), [x["result"] for x in s2] == ["duplicate", "duplicate"])
    det = c.get(f"/api/issues/{issue_id}", headers=ravi).json()
    rec.check("Fix waits for a second person", "awaiting_verification, resolved offline",
              f"{det['state']}, offline={det['resolved_offline']}",
              det["state"] == "awaiting_verification" and det["resolved_offline"])

    # 4b. Worker asks for help they cannot provide themselves
    before = c.get("/api/dashboard/summary", headers=ravi).json()["help_open"]
    hr = c.post("/api/sync/batch", headers=eswar, json={"records": [{
        "client_uuid": f"demo-{uuid.uuid4()}", "kind": "help", "help_kind": "plumber",
        "staff_token": facs["DC-T01"]["staff_token"], "device_time": _iso(1), "offline": True}]}).json()
    after_help = c.get("/api/dashboard/summary", headers=ravi).json()
    rec.check("Worker's help request reaches the supervisor dashboard", f"help requests {before} -> {before + 1}",
              f"{hr['results'][0]['result']}, help requests {before} -> {after_help['help_open']}",
              hr["results"][0]["result"] == "ok" and after_help["help_open"] == before + 1)
    hid = next(h["id"] for h in c.get("/api/help", headers=ravi).json() if h["kind"] == "plumber")
    c.post(f"/api/help/{hid}/acknowledge", headers=ravi).raise_for_status()
    done = c.post(f"/api/help/{hid}/done", headers=ravi).json()
    rec.check("Supervisor acknowledges and closes the help request", "done", done["state"], done["state"] == "done")

    # 4c. Crowd: an attendant reports the queue length; no sensors involved
    crowded_before = c.get("/api/dashboard/summary", headers=ravi).json()["crowded"]
    q = c.post("/api/sync/batch", headers=anil, json={"records": [{
        "client_uuid": f"demo-{uuid.uuid4()}", "kind": "queue", "queue_level": "full",
        "staff_token": facs["DN-T02"]["staff_token"], "device_time": _iso(0), "offline": False}]}).json()
    dn2 = {f["code"]: f for f in c.get("/api/facilities", headers=ravi).json()}["DN-T02"]
    crowded_after = c.get("/api/dashboard/summary", headers=ravi).json()["crowded"]
    rec.check("Attendant's queue report shows on the dashboard", f"DN-T02 full, crowded {crowded_before} -> {crowded_before + 1}",
              f"{q['results'][0]['result']}, DN-T02 {(dn2['queue'] or {}).get('level')}, crowded {crowded_before} -> {crowded_after}",
              (dn2["queue"] or {}).get("level") == "full" and crowded_after == crowded_before + 1)
    near_dc2 = c.get(f"/api/public/f/{facs['DC-T02']['public_token']}").json()["nearby"]
    codes = [n["code"] for n in near_dc2]
    rec.check("Full toilets go to the end of the nearby list", "DN-T02 not first", codes,
              "DN-T02" not in codes or codes.index("DN-T02") == len(codes) - 1)

    # 4e. Undo: a report sent by mistake can be withdrawn from the same phone
    oops = c.post(f"/api/public/f/{facs['DS-T03']['public_token']}/reports",
                  json={"category": "light", "lang": "te", "device_key": "elderly-device"}).json()
    other_phone = c.post(f"/api/public/reports/{oops['ref_no']}/withdraw", json={"device_key": "someone-else"})
    undo = c.post(f"/api/public/reports/{oops['ref_no']}/withdraw", json={"device_key": "elderly-device"}).json()
    rec.check("A mistaken report can be undone, only from the same phone", "other phone refused; issue withdrawn",
              f"other phone HTTP {other_phone.status_code}; issue {undo.get('issue_state')}",
              other_phone.status_code == 404 and undo.get("issue_state") == "invalid")

    # 4d. Voice complaint from someone who cannot read or write
    clip = "data:audio/webm;base64," + "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH" * 4
    v = c.post(f"/api/public/f/{facs['DC-T02']['public_token']}/reports",
               json={"category": "other", "lang": "te", "audio": clip, "device_key": "voice-device"}).json()
    heard = c.get(f"/api/reports/{v['ref_no']}/audio", headers=ravi)
    rec.check("Voice complaint is received and playable by the supervisor", "audio returned",
              f"{v['ref_no']}, HTTP {heard.status_code}", heard.status_code == 200 and heard.json()["audio"] == clip)

    # 5. The fixer cannot close their own fix
    v_self = c.post(f"/api/issues/{issue_id}/verify", headers=eswar,
                    json={"staff_token": facs["DC-T01"]["staff_token"]})
    rec.check("Worker who fixed it is blocked from verifying", "HTTP 403",
              f"HTTP {v_self.status_code}: {v_self.json().get('detail')}", v_self.status_code == 403)
    v_wrong = c.post(f"/api/issues/{issue_id}/verify", headers=durga, json={"staff_token": facs["DN-T01"]["staff_token"]})
    rec.check("Verification with another facility's staff code is refused", "HTTP 400",
              f"HTTP {v_wrong.status_code}", v_wrong.status_code == 400)
    v_ok = c.post(f"/api/issues/{issue_id}/verify", headers=durga,
                  json={"staff_token": facs["DC-T01"]["staff_token"]}).json()
    rec.check("A second worker confirms on site and the issue closes", "closed, verified by Durga",
              f"{v_ok['state']}, verified by {v_ok['verifier']['name']}",
              v_ok["state"] == "closed" and v_ok["verifier"]["name"] == "Durga")
    card = c.get(f"/api/public/f/{dc1['public_token']}").json()
    rec.check("Public page shows verified with a fresh check", "verified, 0 min ago",
              f"{card['status']}, {card['verified_age_min']} min ago",
              card["status"] == "verified" and card["verified_age_min"] == 0)

    # 6. Public closure challenge
    c.post(f"/api/public/issues/{issue_id}/feedback", json={"fixed": False, "device_key": "juror-one-device"})
    fb = c.post(f"/api/public/issues/{issue_id}/feedback", json={"fixed": False, "device_key": "juror-two-device"}).json()
    rec.check("Two public 'not fixed' answers reopen the issue", "reopened", fb, fb.get("reopened") is True)

    # 7. Offline inspection clears the overdue facility
    dn4 = facs["DN-T04"]
    ins = c.post("/api/sync/batch", headers=anil, json={"records": [{
        "client_uuid": f"demo-{uuid.uuid4()}", "kind": "inspection", "staff_token": dn4["staff_token"],
        "device_time": _iso(2), "offline": True,
        "answers": {k: True for k in ("floor", "pans", "water", "door", "lights", "handwash")}}]}).json()
    after = {f["code"]: f for f in c.get("/api/facilities", headers=ravi).json()}["DN-T04"]
    rec.check("Offline inspection syncs and clears the overdue status", "overdue -> verified",
              f"{dn4['status']} -> {after['status']}", ins["results"][0]["result"] == "ok" and after["status"] == "verified")

    # 8. Reports and audit
    rep = c.get("/api/reports/summary", headers=ravi).json()
    rec.check("Every confirmed closure was independent", "100%", f"{rep['independent_verification_pct']}%",
              rep["independent_verification_pct"] == 100)
    csv_text = c.get("/api/reports/issues.csv", headers=ravi).text
    rec.check("Issues export as CSV", "header + rows", f"{len(csv_text.splitlines())} lines",
              csv_text.startswith("issue_id") and len(csv_text.splitlines()) > 5)
    chain = c.get("/api/audit/verify", headers=ravi).json()
    rec.check("Audit hash chain is intact", "valid", chain, chain["valid"])
    return rec
