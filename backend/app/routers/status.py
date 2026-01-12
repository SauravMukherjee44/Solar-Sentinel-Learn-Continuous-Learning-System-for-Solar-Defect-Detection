from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import SystemStatus
from app.websocket_manager import manager

router = APIRouter()

@router.get("/status")
async def get_status(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemStatus).where(SystemStatus.id == 1))
    status = result.scalar_one_or_none()
    
    if not status:
        # Create default status if not exists
        status = SystemStatus(
            id=1,
            is_training=False,
            active_model="v1.0.0",
            current_phase=0,
            total_inferences=0,
            avg_latency=0,
            uptime=99.97
        )
        db.add(status)
        await db.commit()
        await db.refresh(status)
    
    return {
        "id": status.id,
        "is_training": status.is_training,
        "active_model": status.active_model,
        "canary_model": status.canary_model,
        "current_phase": status.current_phase,
        "total_inferences": status.total_inferences,
        "avg_latency": status.avg_latency,
        "uptime": status.uptime,
        "updated_at": status.updated_at.isoformat() if status.updated_at else None
    }
