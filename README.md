# SwachhSetu — working prototype

**A toilet shows green only if someone checked it recently, and a fix counts only when someone else confirms it.**

Prototype for RTIH PS-06 (Smart Sanitation and Public Toilet Monitoring), Godavari Pushkaralu 2027, for Rajamahendravaram Municipal Corporation.
**All data is synthetic.** No RMC data is used, and this is not a live municipal service.

| Part | Technology |
| --- | --- |
| Web app (public QR page, worker field app, supervisor console) | React 18 + TypeScript, Tailwind CSS, Leaflet + OpenStreetMap, installable PWA |
| Offline field work | IndexedDB outbox + service worker; idempotent sync by client UUID |
| API | FastAPI modular monolith (Python 3.12) |
| Database | PostgreSQL 16 (SQLite fallback when `DATABASE_URL` is not set) |
| Evidence capture | pytest, an API scenario runner, and Playwright screenshots/recordings |

## What the prototype demonstrates

| Requirement | Where to see it |
| --- | --- |
| 10 facilities, 2 supervisors, 5 workers, 72 h of inspection history | Seeded on first start (`backend/app/seed.py`) |
| Facility with no recent inspection | DN-T04 shows **Verification overdue** |
| Facility with repeated complaints | DS-T01: four “dirty” issues in 24 h |
| Facility with a water shortage | DN-T03: no water, P1 repair in progress |
| Public page usable without reading: big colour + symbol status, **Listen** (voice) button | `/f/<token>`, opens in **Telugu**; Hindi / English one tap away; **A+** for bigger text |
| **Voice complaint** for people who cannot read or write: **hold to talk, let go to send** (like a WhatsApp voice message) | Public page microphone button; supervisor plays it on the issue screen |
| **Crowd help without sensors**: the attendant taps the queue length (short / long / very crowded) | Field app; shown on the public page, in nearby suggestions (full toilets go last) and as **Crowded now** on the dashboard |
| **First-time picture guide** (3 cards) on the public page and the field app; **Undo** for 5 seconds after a one-tap report | Shown once per phone; undo works only from the same phone |
| **Printable sign** per facility: QR, scanning taught in pictures, “GPay/PhonePe won't open it”, no-phone instructions, nearest toilets with arrows | Console → **Printable signs** (print to A4) |
| One-tap reporting with picture tiles; sound + vibration confirmation | Tap a picture: the report is sent at once; photo, comment and phone can be added after |
| “Where else can I go?” nearest usable toilets, with distance, direction arrow and walking directions | Shown first whenever the toilet is not usable |
| “Feels unsafe” shows Police 112 and Women's helpline 181 at once | Public page, after the unsafe tile |
| Women / men / wheelchair / free shown as icons | Public page |
| Duplicate reports merge into one issue | Second report on the same problem raises the count, not a new ticket |
| Assignment, timers, escalation | Console → Issues |
| Field app is Telugu-first with pictures; in-app QR **Scan** button | `/w` (switch to EN in the header) |
| One-tap **Everything is OK** inspection (second tap confirms; hidden while a repair is open there); picture checklist only when something is wrong | Field app, after scanning a facility |
| **Next task** card telling a new worker exactly what to do first | Top of the field app |
| Supervisor console in plain words, grouped menu (Daily work / Records / Setup), **Assign…** straight from the problems list | Console |
| **I need help**: water tanker, plumber, supplies, crowd → supervisor | Field app → Console → **Help requests** (DN-T03 already has a tanker request) |
| Offline worker submission and later sync | Field app in airplane mode → Outbox → reconnect |
| Fixer cannot verify own fix (app **and** database rule) | Self-verification returns HTTP 403; `CHECK (verifier_id <> resolver_id)` |
| Independent closure on site via staff QR | Second worker scans the staff code and confirms |
| Status expires when nobody checks | Status computed from last verification vs. the facility’s window |
| Public can contest a closure for 60 min | “Is this fixed?” on the public page; two “No” answers reopen |
| Reports, CSV export, hash-chained audit log | Console → Reports and audit |

---

## Run it in GitHub Codespaces

1. Push this folder to a GitHub repository (see [Put the code on GitHub](#put-the-code-on-github)).
2. On the repository page: **Code → Codespaces → Create codespace on main**.
   The dev container installs Python, Node 20, Docker, ffmpeg and every dependency automatically (about 3–5 minutes).
3. In the Codespace terminal, start the app:

   ```bash
   make run
   ```

   Codespaces opens the app on port 8000. Sign in as `ravi` with PIN `1234`.

If the automatic setup was skipped or failed, run `make setup` first.

### Capture the results (screenshots, recordings, test report)

Keep `make run` going in the first terminal. Open a second terminal (**+** in the terminal panel) and run:

```bash
make test          # automated tests: full scenario + database rule
make evidence      # captures/demo-report.md + captures/screens/*.png + captures/video/*.webm
make video         # joins the phone recordings into captures/walkthrough.mp4
```

What you get:

| File | Contents |
| --- | --- |
| `captures/demo-report.md` | 29 end-to-end checks with expected vs. observed results, pass/fail |
| `captures/signs.pdf` | All printable signs as A4 pages |
| `captures/screens/01…34-*.png` | Dashboard, map, icon-first Telugu public page, picture tiles, report sent, Hindi safety helplines, voice complaint recording and sent, nearby usable toilets, merged reports, assignment, Telugu field app, offline fix, outbox, sync, blocked self-verification, “I need help”, second-person closure, closure check, picture checklist, one-tap “Everything is OK” and queue length, voice playback, help requests, reports, audit chain, QR sheet, printable sign |
| `captures/video/phone-*.webm` | Screen recordings of the pilgrim and two worker phones |
| `captures/walkthrough.mp4` | The three recordings joined, ready to upload |

To download them: in the Explorer, right-click the `captures` folder → **Download…**.

Each run resets the demo data first, so you can repeat it as often as you like. To reset manually: `make reset`.

### Try it from a real phone during the Codespace session

1. Open the **Ports** tab, right-click port **8000**, and choose **Port Visibility → Public**.
   From the command line: `gh codespace ports visibility 8000:public -c $CODESPACE_NAME`
2. Open the forwarded address, which looks like `https://<codespace-name>-8000.app.github.dev`.
3. Go to **Console → QR codes** and scan a public code with any phone camera. Scan a staff code from a phone signed in as a worker.

This link works only while the Codespace is running, so use a deployed link (below) in the submission.

### Use PostgreSQL instead of SQLite

```bash
make run-pg        # starts postgres:16 in Docker, then serves on port 8000 against it
```

---

## Commands

| Command | What it does |
| --- | --- |
| `make setup` | Install all dependencies, including the Playwright browser |
| `make run` | Build the web app and serve app + API on port 8000 (SQLite) |
| `make run-pg` | Same, against PostgreSQL in Docker |
| `make dev` | Hot reload: API on 8000, Vite on 5173 (open 5173) |
| `make test` | pytest: full scenario plus the database self-verification rule |
| `make demo-report` | Run the scenario against `BASE` (default `http://localhost:8000`) and write the report |
| `make capture` | Browser run: screenshots and phone recordings |
| `make evidence` | `demo-report` + `capture` |
| `make video` | Join recordings into `captures/walkthrough.mp4` |
| `make reset` | Restore demo data on a running server |

Point any of these at a deployed copy with `BASE=https://your-demo.onrender.com make evidence`.

## Demo accounts (PIN 1234 for all)

| Username | Role |
| --- | --- |
| `ravi` | Supervisor, South and City zones |
| `lakshmi` | Supervisor, North zone |
| `eswar` | Worker, City (use for the live repair) |
| `durga` | Worker, South (use for the independent verification) |
| `anil`, `bhavani`, `chandra` | Workers, North |
| `admin` | Administrator |

## Five-minute live demo

1. **Dashboard** (`ravi`): one overdue toilet, one without water (with an open water-tanker request), one with repeated complaints.
2. **Public page:** open DC-T01 from the landing page or scan its QR. Tap **Listen**, then tap the “Blocked” picture: one tap sends it. Report it again from a second phone: the reports merge, and the page now points to the nearest usable toilets.
   Then, on another phone, open DC-T02. Hold the microphone, speak, and let go; the voice complaint is sent.
3. **Problems:** assign the DC-T01 issue to Eswar using **Assign…** in the list. Open the DC-T02 issue and press **Play voice complaint**.
4. **Field app** (`eswar`, phone, Telugu): tap **Scan** and scan DC-T01's staff QR, or open its staff link. Switch to airplane mode and tap **Mark as fixed**. The record waits in the Outbox; reconnect and it syncs.
5. Still as Eswar, tap **Confirm fix**: it is refused, because another person must verify. Then tap **I need help → Plumber**, and it appears under **Help requests** in the console.
6. **Crowd:** as any worker, after scanning a toilet, tap a queue length. It appears on that toilet's public page and as **Crowded now** on the dashboard.
7. **Field app** (`durga`): open the same staff link and tap **Confirm fix**. The toilet turns green, showing “checked just now”.
8. **Public page:** answer “No, still a problem” from two phones, and the issue reopens.
9. **Printable signs:** print the A4 sign for any facility.
10. **Reports and audit:** download the CSV, then use **Check audit chain**.

---

## Put the code on GitHub

```bash
cd swachhsetu
git init && git add . && git commit -m "SwachhSetu prototype"
gh repo create swachhsetu-prototype --public --source=. --push
# or: create an empty repo on github.com, then
# git remote add origin https://github.com/<you>/swachhsetu-prototype.git && git push -u origin main
```

## Deploy a permanent demo link (for the submission)

**Render (free, about 5 minutes):**

1. Sign in at render.com with GitHub.
2. Choose **New → Blueprint** and pick your repository. Render reads `render.yaml` and builds the `Dockerfile`.
3. When it shows **Live**, open `https://<service-name>.onrender.com/api/health`. It should return `{"ok": true, "facilities": 10}`.
4. Run the evidence capture against it from your Codespace:

   ```bash
   BASE=https://<service-name>.onrender.com make evidence
   ```

Free Render services sleep after inactivity; the first request then takes about a minute. Open the link yourself shortly before the jury does. The free plan keeps data in SQLite inside the container, and demo data is re-seeded whenever the service restarts. That is deliberate for a demo.

**Any Docker host** (Railway, Fly.io, a State Data Centre VM):

```bash
docker build -t swachhsetu .
docker run -p 8000:8000 -e SECRET_KEY=<random> swachhsetu
# with PostgreSQL:
docker run -p 8000:8000 -e SECRET_KEY=<random> -e DATABASE_URL=postgresql://user:pass@host:5432/db swachhsetu
```

Or run app and database together: `docker compose --profile full up --build`.

## Project layout

```
backend/app/
  main.py            FastAPI app; serves the built web app
  api.py             HTTP routes (public, staff, sync, dashboard, reports, audit)
  workflow.py        issue state machine, report merging, inspections, verification
  core.py            status rules, priorities, timers, audit hash chain, auth
  models.py          database tables, including the verifier ≠ resolver CHECK
  seed.py            synthetic demo data and scenarios
  demo_scenario.py   the 20-check end-to-end scenario
backend/tests/       pytest suite
frontend/src/
  pages/PublicPage   public QR page (Telugu/English)
  pages/worker/      field app: tasks, staff-QR scan, repair, verify, checklist, outbox
  pages/console/     dashboard, map, issues, facilities, reports and audit, QR sheet
  offline.ts         IndexedDB outbox and sync
scripts/demo_report.py   scenario runner → captures/demo-report.md
scripts/capture/         Playwright browser capture
```

## Prototype versus production

This prototype is honest about its shortcuts. Each item below is listed as production work in the proposal.

- **Login:** demo login uses a username and PIN. Production uses SMS OTP.
- **SMS:** public SMS acknowledgements are not sent. Production uses a DLT-registered gateway.
- **Staff codes:** to allow offline use, the field app caches staff codes on the phone. Production would use rotating, signed codes, backed by the random spot checks.
- **Timers and expiry:** these are computed whenever data is read. Production adds a scheduler that sends escalation notifications.
- **Listen:** this uses the phone's built-in voices. Most Android phones have Telugu and Hindi; where a voice is missing, the page says so. Production would add recorded audio clips.
- **Missed-call reporting:** reporting by missed call (IVR) for people without smartphones is proposed, not built. It needs a telecom provider. The printable sign leaves the helpline number as “[number to be added]”.
- **Voice complaints:** these are stored as short audio clips (about 30 seconds) for a supervisor to listen to. Nothing is transcribed automatically. Production would keep clips in object storage and delete them after 90 days, like photos.
- **Queue length:** this is what staff report, not a measurement. A reading older than 45 minutes is hidden, so the public page never shows stale crowd information.
- **Sign arrows:** the arrows on printed signs assume the sign faces north. Set the direction when the sign is mounted.
- **Map tiles:** these come from public OpenStreetMap servers. Production uses a self-hosted or contracted tile server.
- **Security audit:** none has been done yet. A CERT-In empanelled audit is required before any public launch.
