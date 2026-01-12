from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.database import get_db
from app.models import ModelVersion, SystemStatus
from app.websocket_manager import manager

router = APIRouter()

class PromoteCanaryRequest(BaseModel):
    model_id: str

class RollbackRequest(BaseModel):
    model_id: str

@router.get("/models")
async def get_models(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ModelVersion).order_by(ModelVersion.created_at.asc())
    )
    models = result.scalars().all()
    
    return [
        {
            "id": m.id,
            "version": m.version,
            "dataset_version": m.dataset_version,
            "batch_version": m.batch_version,
            "deployment_status": m.deployment_status,
            "metrics": m.metrics,
            "hyperparameters": m.hyperparameters,
            "model_path": m.model_path,
            "traffic_split": m.traffic_split,
            "training_date": m.training_date.isoformat() if m.training_date else None,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None
        }
        for m in models
    ]

@router.post("/promote-canary")
async def promote_canary(
    request: PromoteCanaryRequest,
    db: AsyncSession = Depends(get_db)
):
    # Get canary model
    result = await db.execute(
        select(ModelVersion).where(ModelVersion.id == request.model_id)
    )
    canary_model = result.scalar_one_or_none()
    
    if not canary_model or canary_model.deployment_status != "canary":
        raise HTTPException(status_code=400, detail="Model not found or not a canary")
    
    # Archive current production model
    await db.execute(
        update(ModelVersion)
        .where(ModelVersion.deployment_status == "deployed")
        .values(deployment_status="archived", traffic_split=0)
    )
    
    # Promote canary to production
    canary_model.deployment_status = "deployed"
    canary_model.traffic_split = 100
    
    # Update system status
    status_result = await db.execute(select(SystemStatus).where(SystemStatus.id == 1))
    status = status_result.scalar_one_or_none()
    if status:
        status.active_model = canary_model.version
        status.canary_model = None
    
    await db.commit()
    
    # Broadcast updates
    await manager.broadcast_model_update({
        "id": canary_model.id,
        "version": canary_model.version,
        "deployment_status": "deployed"
    })
    
    return {"success": True, "message": f"Model {canary_model.version} promoted to production"}


@router.post("/rollback")
async def rollback_model(
    request: RollbackRequest,
    db: AsyncSession = Depends(get_db)
):
    """Rollback to a previously deployed model with safety checks"""
    
    # Get target model
    result = await db.execute(
        select(ModelVersion).where(ModelVersion.id == request.model_id)
    )
    target_model = result.scalar_one_or_none()
    
    if not target_model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    if target_model.deployment_status == "deployed":
        raise HTTPException(status_code=400, detail="Model is already deployed")
    
    # Safety checks based on auto-rollback rules:
    # - Recall must be >= 95%
    # - Check accuracy against current deployed model
    
    metrics = target_model.metrics or {}
    recall = metrics.get("recall", 0)
    
    if recall < 0.95:
        raise HTTPException(
            status_code=400, 
            detail=f"Rollback blocked: Recall {recall*100:.1f}% is below 95% threshold"
        )
    
    # Get current deployed model for comparison
    current_result = await db.execute(
        select(ModelVersion).where(ModelVersion.deployment_status == "deployed")
    )
    current_model = current_result.scalar_one_or_none()
    
    current_accuracy = 0
    if current_model:
        current_metrics = current_model.metrics or {}
        current_accuracy = current_metrics.get("accuracy", 0)
    
    target_accuracy = metrics.get("accuracy", 0)
    
    # Archive or mark current deployed model as rolled-back
    if current_model:
        current_model.deployment_status = "rolled-back"
        current_model.traffic_split = 0
    
    # Deploy target model
    target_model.deployment_status = "deployed"
    target_model.traffic_split = 100
    
    # Update system status
    status_result = await db.execute(select(SystemStatus).where(SystemStatus.id == 1))
    status = status_result.scalar_one_or_none()
    if status:
        status.active_model = target_model.version
        status.canary_model = None
    
    await db.commit()
    
    # Broadcast updates
    await manager.broadcast_model_update({
        "id": target_model.id,
        "version": target_model.version,
        "deployment_status": "deployed",
        "rollback": True
    })
    
    warning = ""
    if target_accuracy < current_accuracy:
        warning = f" Warning: Accuracy ({target_accuracy*100:.1f}%) is lower than previous ({current_accuracy*100:.1f}%)"
    
    return {
        "success": True, 
        "message": f"Rolled back to {target_model.version}.{warning}"
    }
