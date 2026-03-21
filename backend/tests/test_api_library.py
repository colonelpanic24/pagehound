"""Tests for /api/library endpoints."""

import pytest


@pytest.mark.asyncio
async def test_scan_creates_job_and_returns_job_id(client, mocker):
    mocker.patch("app.tasks.library_scan.run_library_scan.delay")
    r = await client.post("/api/library/scan")
    assert r.status_code == 200
    data = r.json()
    assert "job_id" in data
    assert isinstance(data["job_id"], str)


@pytest.mark.asyncio
async def test_scan_persists_job_record(client, db_session, mocker):
    from sqlalchemy import select

    from app.models.job import Job

    mocker.patch("app.tasks.library_scan.run_library_scan.delay")
    r = await client.post("/api/library/scan")
    job_id = r.json()["job_id"]

    result = await db_session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    assert job is not None
    assert job.type == "library_scan"
    assert job.status == "pending"
    assert job.triggered_by == "user"
