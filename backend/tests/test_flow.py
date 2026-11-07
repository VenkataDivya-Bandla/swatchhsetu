"""Runs the full demo scenario in-process, plus a direct check of the database rule."""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_swachhsetu.db")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.db import SessionLocal
from app.demo_scenario import Recorder, run
from app.main import app
from app.models import Verification


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_end_to_end_scenario(client):
    rec = run(client, Recorder())
    failed = [r for r in rec.rows if not r[3]]
    assert not failed, failed


def test_database_blocks_self_verification(client):
    with SessionLocal() as db:
        db.add(Verification(issue_id=1, verifier_id=4, resolver_id=4, outcome="confirmed"))
        with pytest.raises(IntegrityError):
            db.commit()
