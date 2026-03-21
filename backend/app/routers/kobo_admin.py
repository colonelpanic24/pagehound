"""Kobo admin API — manage registered Kobo devices."""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..database import get_db
from ..models.kobo_device import KoboDevice

router = APIRouter(prefix="/kobo", tags=["kobo-admin"])
settings = get_settings()


def _device_to_dict(d: KoboDevice) -> dict:
    return {
        "id": d.id,
        "name": d.name,
        "auth_token": d.auth_token,
        "device_id": d.device_id,
        "last_synced": d.last_synced.isoformat() if d.last_synced else None,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "sync_url": f"{settings.base_url.rstrip('/')}/kobo/{d.auth_token}",
    }


@router.get("/devices")
async def list_devices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KoboDevice).order_by(KoboDevice.created_at.desc()))
    return [_device_to_dict(d) for d in result.scalars().all()]


class CreateDeviceBody(BaseModel):
    name: str


@router.post("/devices", status_code=201)
async def create_device(body: CreateDeviceBody, db: AsyncSession = Depends(get_db)):
    device = KoboDevice(
        auth_token=str(uuid.uuid4()),
        name=body.name,
        created_at=datetime.utcnow(),
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return _device_to_dict(device)


@router.delete("/devices/{device_id}", status_code=204)
async def delete_device(device_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(KoboDevice).where(KoboDevice.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    await db.delete(device)
    await db.commit()
