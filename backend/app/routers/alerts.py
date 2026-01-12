from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from app.database import get_db
from app.models import DriftAlert
from app.websocket_manager import manager

router = APIRouter()

class AcknowledgeAlertRequest(BaseModel):
    alert_id: str

@router.get("/alerts")
async def get_alerts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DriftAlert).order_by(DriftAlert.timestamp.desc())
    )
    alerts = result.scalars().all()
    
    return [
        {
            "id": a.id,
            "alert_type": a.alert_type,
            "severity": a.severity,
            "message": a.message,
            "current_value": a.current_value,
            "threshold": a.threshold,
            "acknowledged": a.acknowledged,
            "timestamp": a.timestamp.isoformat() if a.timestamp else None
        }
        for a in alerts
    ]

@router.post("/acknowledge-alert")
async def acknowledge_alert(
    request: AcknowledgeAlertRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DriftAlert).where(DriftAlert.id == request.alert_id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.acknowledged = True
    await db.commit()
    
    await manager.broadcast_alert_update({
        "id": alert.id,
        "acknowledged": True
    })
    
    return {"success": True, "message": "Alert acknowledged"}
