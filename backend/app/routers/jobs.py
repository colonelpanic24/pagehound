from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.job import Job

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/")
async def list_jobs(limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Job).order_by(desc(Job.started_at)).limit(limit)
    )
    jobs = result.scalars().all()
    return [
        {
            "id": j.id,
            "type": j.type,
            "status": j.status,
            "label": j.label,
            "triggered_by": j.triggered_by,
            "started_at": j.started_at,
            "finished_at": j.finished_at,
            "summary": j.summary,
            "error": j.error,
        }
        for j in jobs
    ]


@router.get("/{job_id}")
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": job.id,
        "type": job.type,
        "status": job.status,
        "label": job.label,
        "triggered_by": job.triggered_by,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
        "summary": job.summary,
        "error": job.error,
    }
