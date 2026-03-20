"""Tests for /api/jobs endpoints."""

import uuid
from datetime import datetime

import pytest

from app.models.job import Job


async def _seed_job(db, **kwargs):
    defaults = dict(
        id=str(uuid.uuid4()),
        type="library_scan",
        status="completed",
        label="Library scan",
        started_at=datetime.utcnow(),
    )
    defaults.update(kwargs)
    j = Job(**defaults)
    db.add(j)
    await db.commit()
    await db.refresh(j)
    return j


@pytest.mark.asyncio
async def test_list_jobs_empty(client):
    r = await client.get("/api/jobs/")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_list_jobs_returns_job(client, db_session):
    await _seed_job(db_session, label="My scan")
    r = await client.get("/api/jobs/")
    assert r.status_code == 200
    jobs = r.json()
    assert len(jobs) == 1
    assert jobs[0]["label"] == "My scan"


@pytest.mark.asyncio
async def test_get_job_not_found(client):
    r = await client.get("/api/jobs/nonexistent-id")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_get_job_found(client, db_session):
    job = await _seed_job(db_session, status="running", label="Active scan")
    r = await client.get(f"/api/jobs/{job.id}")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "running"
    assert data["label"] == "Active scan"
