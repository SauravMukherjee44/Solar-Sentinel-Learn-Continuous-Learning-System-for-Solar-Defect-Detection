from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import random

from app.database import get_db
from app.models import InferenceLog, ModelVersion, SystemStatus, DriftAlert
from app.websocket_manager import manager

router = APIRouter()

class InferenceRequest(BaseModel):
    image_id: Optional[str] = None

@router.get("/logs")
async def get_logs(limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(InferenceLog)
        .order_by(InferenceLog.timestamp.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    
    return [
        {
            "id": log.id,
            "image_id": log.image_id,
            "prediction": log.prediction,
            "confidence": log.confidence,
            "latency_ms": log.latency_ms,
            "model_version": log.model_version,
            "actual_label": log.actual_label,
            "is_correct": log.is_correct,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None
        }
        for log in logs
    ]

@router.post("/simulate-inference")
async def simulate_inference(
    request: InferenceRequest = None,
    db: AsyncSession = Depends(get_db)
):
    # Get active and canary models
    result = await db.execute(
        select(ModelVersion).where(
            ModelVersion.deployment_status.in_(["deployed", "canary"])
        )
    )
    models = result.scalars().all()
    
    active_model = next((m for m in models if m.deployment_status == "deployed"), None)
    canary_model = next((m for m in models if m.deployment_status == "canary"), None)
    
    if not active_model:
        raise HTTPException(status_code=400, detail="No active model deployed")
    
    # Determine which model to use (90/10 split if canary exists)
    use_canary = canary_model and random.random() < 0.1
    model = canary_model if use_canary else active_model
    
    # Generate synthetic inference
    is_defect = random.random() < 0.15
    prediction = "defect" if is_defect else "normal"
    confidence = random.uniform(0.85, 0.99) if not is_defect else random.uniform(0.75, 0.95)
    latency = random.uniform(15, 45)
    
    image_id = request.image_id if request and request.image_id else f"IMG_{random.randint(10000, 99999)}"
    
    # Create inference log
    log = InferenceLog(
        image_id=image_id,
        prediction=prediction,
        confidence=round(confidence, 4),
        latency_ms=round(latency, 2),
        model_version=model.version
    )
    db.add(log)
    
    # Update system status
    status_result = await db.execute(select(SystemStatus).where(SystemStatus.id == 1))
    status = status_result.scalar_one_or_none()
    
    if status:
        new_total = status.total_inferences + 1
        new_avg = ((status.avg_latency * status.total_inferences) + latency) / new_total
        status.total_inferences = new_total
        status.avg_latency = round(new_avg, 2)
    
    # Check for drift (high latency)
    if latency > 40:
        alert = DriftAlert(
            alert_type="latency",
            severity="warning" if latency < 50 else "critical",
            message=f"High inference latency detected: {round(latency, 2)}ms",
            current_value=round(latency, 2),
            threshold=40.0
        )
        db.add(alert)
        
        await manager.broadcast_alert_update({
            "id": alert.id,
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "message": alert.message
        })
    
    await db.commit()
    
    # Broadcast log update
    await manager.broadcast_log_update({
        "id": log.id,
        "image_id": log.image_id,
        "prediction": log.prediction,
        "confidence": log.confidence,
        "latency_ms": log.latency_ms,
        "model_version": log.model_version,
        "timestamp": log.timestamp.isoformat() if log.timestamp else None
    })
    
    return {
        "id": log.id,
        "image_id": log.image_id,
        "prediction": log.prediction,
        "confidence": log.confidence,
        "latency_ms": log.latency_ms,
        "model_version": log.model_version
    }
