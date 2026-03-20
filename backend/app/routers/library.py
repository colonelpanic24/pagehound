import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.job import Job

router = APIRouter(prefix="/library", tags=["library"])


@router.post("/scan")
async def trigger_scan(db: AsyncSession = Depends(get_db)):
    """Enqueue a library scan Celery task. Creates a Job record immediately and returns the job_id."""
    from ..tasks.library_scan import run_library_scan

    job_id = str(uuid.uuid4())
    job = Job(
        id=job_id,
        type="library_scan",
        label="Library scan",
        status="pending",
        triggered_by="user",
    )
    db.add(job)
    await db.commit()

    run_library_scan.delay(job_id=job_id, triggered_by="user")

    return {"job_id": job_id}


@router.post("/refresh")
async def trigger_refresh(db: AsyncSession = Depends(get_db)):
    """Enqueue a refresh scan Celery task. Creates a Job record immediately and returns the job_id."""
    from ..tasks.refresh_scan import run_refresh_scan

    job_id = str(uuid.uuid4())
    job = Job(
        id=job_id,
        type="refresh_scan",
        label="Refresh scan",
        status="pending",
        triggered_by="user",
    )
    db.add(job)
    await db.commit()

    run_refresh_scan.delay(job_id=job_id, triggered_by="user")

    return {"job_id": job_id}
