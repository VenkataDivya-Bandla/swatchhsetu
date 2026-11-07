"""Runs the end-to-end demo scenario against a running server and writes captures/demo-report.md.

Usage:  python scripts/demo_report.py [BASE_URL]      (default http://localhost:8000)
Exit code is 0 only if every check passes.
"""
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.demo_scenario import Recorder, run  # noqa: E402

base = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")
with httpx.Client(base_url=base, timeout=30) as client:
    rec = run(client, Recorder())
out = ROOT / "captures" / "demo-report.md"
out.parent.mkdir(exist_ok=True)
out.write_text(rec.markdown(base), encoding="utf-8")
print(f"\n{sum(r[3] for r in rec.rows)}/{len(rec.rows)} checks passed. Report written to {out}")
sys.exit(0 if rec.passed else 1)
