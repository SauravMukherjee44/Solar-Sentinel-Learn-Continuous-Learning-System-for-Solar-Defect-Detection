from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from datetime import datetime
import asyncio
import random

from app.database import get_db, AsyncSessionLocal
from app.models import TrainingBatch, PipelineStep, ModelVersion, SystemStatus
from app.websocket_manager import manager

router = APIRouter()

class UploadBatchRequest(BaseModel):
    phase: int
    total_images: int
    normal_images: int
    defect_images: int

PIPELINE_STEPS = [
    ("Data Validation", "Validating image formats and labels"),
    ("Preprocessing", "Normalizing and augmenting images"),
    ("Feature Extraction", "Extracting visual features"),
    ("Model Training", "Training neural network"),
    ("Evaluation", "Computing metrics on validation set"),
    ("Canary Deployment", "Deploying as canary with 10% traffic"),
]

async def run_pipeline_simulation(batch_id: str):
    """Simulates the ML training pipeline with realistic delays"""
    async with AsyncSessionLocal() as db:
        try:
            # Update batch status to processing
            await db.execute(
                update(TrainingBatch)
                .where(TrainingBatch.id == batch_id)
                .values(status="processing")
            )
            
            # Update system status
            await db.execute(
                update(SystemStatus)
                .where(SystemStatus.id == 1)
                .values(is_training=True)
            )
            await db.commit()
            
            # Create pipeline steps
            steps = []
            for i, (name, details) in enumerate(PIPELINE_STEPS):
                step = PipelineStep(
                    batch_id=batch_id,
                    step_name=name,
                    step_order=i + 1,
                    status="pending",
                    details=details
                )
                db.add(step)
                steps.append(step)
            await db.commit()
            
            # Process each step
            for step in steps:
                step.status = "running"
                step.start_time = datetime.utcnow()
                step.progress = 0
                await db.commit()
                
                await manager.broadcast_pipeline_update({
                    "id": step.id,
                    "step_name": step.step_name,
                    "status": "running",
                    "progress": 0
                })
                
                # Simulate progress
                for progress in range(0, 101, 10):
                    step.progress = progress
                    await db.commit()
                    await manager.broadcast_pipeline_update({
                        "id": step.id,
                        "step_name": step.step_name,
                        "status": "running",
                        "progress": progress
                    })
                    await asyncio.sleep(random.uniform(0.3, 0.8))
                
                step.status = "completed"
                step.end_time = datetime.utcnow()
                step.progress = 100
                await db.commit()
                
                await manager.broadcast_pipeline_update({
                    "id": step.id,
                    "step_name": step.step_name,
                    "status": "completed",
                    "progress": 100
                })
            
            # Get batch for version info
            batch_result = await db.execute(
                select(TrainingBatch).where(TrainingBatch.id == batch_id)
            )
            batch = batch_result.scalar_one()
            
            # Get current model count for versioning
            model_count = await db.execute(select(ModelVersion))
            version_num = len(model_count.scalars().all()) + 1
            
            # Create new model version as canary
            new_model = ModelVersion(
                version=f"v1.{version_num}.0",
                dataset_version=f"batch-{batch.phase}",
                batch_version=batch_id,
                deployment_status="canary",
                traffic_split=10,
                metrics={
                    "accuracy": round(random.uniform(0.92, 0.98), 4),
                    "precision": round(random.uniform(0.90, 0.97), 4),
                    "recall": round(random.uniform(0.88, 0.96), 4),
                    "fpr": round(random.uniform(0.01, 0.05), 4),
                    "tp": random.randint(180, 200),
                    "tn": random.randint(780, 820),
                    "fp": random.randint(5, 15),
                    "fn": random.randint(8, 20)
                },
                hyperparameters={
                    "learning_rate": 0.001,
                    "batch_size": 32,
                    "epochs": 50
                }
            )
            db.add(new_model)
            
            # Update batch status
            batch.status = "completed"
            batch.analysis_results = {"model_id": new_model.id}
            
            # Update system status
            await db.execute(
                update(SystemStatus)
                .where(SystemStatus.id == 1)
                .values(
                    is_training=False,
                    canary_model=new_model.version,
                    current_phase=batch.phase
                )
            )
            
            await db.commit()
            
            # Broadcast updates
            await manager.broadcast_model_update({
                "id": new_model.id,
                "version": new_model.version,
                "deployment_status": "canary"
            })
            
            await manager.broadcast_status_update({
                "is_training": False,
                "canary_model": new_model.version
            })
            
        except Exception as e:
            # Handle failure
            await db.execute(
                update(TrainingBatch)
                .where(TrainingBatch.id == batch_id)
                .values(status="failed", error_message=str(e))
            )
            await db.execute(
                update(SystemStatus)
                .where(SystemStatus.id == 1)
                .values(is_training=False)
            )
            await db.commit()

@router.get("/batches")
async def get_batches(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TrainingBatch).order_by(TrainingBatch.created_at.desc())
    )
    batches = result.scalars().all()
    
    return [
        {
            "id": b.id,
            "phase": b.phase,
            "total_images": b.total_images,
            "normal_images": b.normal_images,
            "defect_images": b.defect_images,
            "status": b.status,
            "error_message": b.error_message,
            "analysis_results": b.analysis_results,
            "upload_date": b.upload_date.isoformat() if b.upload_date else None,
            "created_at": b.created_at.isoformat() if b.created_at else None
        }
        for b in batches
    ]

@router.get("/pipeline-steps")
async def get_pipeline_steps(batch_id: str = None, db: AsyncSession = Depends(get_db)):
    query = select(PipelineStep).order_by(PipelineStep.step_order.asc())
    if batch_id:
        query = query.where(PipelineStep.batch_id == batch_id)
    
    result = await db.execute(query)
    steps = result.scalars().all()
    
    return [
        {
            "id": s.id,
            "batch_id": s.batch_id,
            "step_name": s.step_name,
            "step_order": s.step_order,
            "status": s.status,
            "progress": s.progress,
            "details": s.details,
            "start_time": s.start_time.isoformat() if s.start_time else None,
            "end_time": s.end_time.isoformat() if s.end_time else None
        }
        for s in steps
    ]

@router.post("/upload-batch")
async def upload_batch(
    request: UploadBatchRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    # Create new batch
    batch = TrainingBatch(
        phase=request.phase,
        total_images=request.total_images,
        normal_images=request.normal_images,
        defect_images=request.defect_images,
        status="pending"
    )
    db.add(batch)
    await db.commit()
    await db.refresh(batch)
    
    # Start pipeline in background
    background_tasks.add_task(run_pipeline_simulation, batch.id)
    
    return {
        "success": True,
        "batch_id": batch.id,
        "message": "Batch uploaded, training pipeline started"
    }
