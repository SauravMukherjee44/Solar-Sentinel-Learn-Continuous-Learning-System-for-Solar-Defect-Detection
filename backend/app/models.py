from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, JSON, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class ModelVersion(Base):
    __tablename__ = "model_versions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    version = Column(String, nullable=False)
    dataset_version = Column(String, nullable=False)
    batch_version = Column(String, nullable=True)
    deployment_status = Column(String, default="archived")  # deployed, canary, archived
    metrics = Column(JSON, default={})
    hyperparameters = Column(JSON, default={})
    model_path = Column(String, nullable=True)
    traffic_split = Column(Integer, default=0)
    training_date = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class TrainingBatch(Base):
    __tablename__ = "training_batches"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    phase = Column(Integer, nullable=False)
    total_images = Column(Integer, default=0)
    normal_images = Column(Integer, default=0)
    defect_images = Column(Integer, default=0)
    status = Column(String, default="pending")  # pending, processing, completed, failed
    error_message = Column(Text, nullable=True)
    analysis_results = Column(JSON, nullable=True)
    upload_date = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class PipelineStep(Base):
    __tablename__ = "pipeline_steps"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    batch_id = Column(String, ForeignKey("training_batches.id"), nullable=True)
    step_name = Column(String, nullable=False)
    step_order = Column(Integer, nullable=False)
    status = Column(String, default="pending")  # pending, running, completed, failed
    progress = Column(Integer, default=0)
    details = Column(Text, nullable=True)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class InferenceLog(Base):
    __tablename__ = "inference_logs"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    image_id = Column(String, nullable=False)
    prediction = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    latency_ms = Column(Float, nullable=False)
    model_version = Column(String, nullable=False)
    actual_label = Column(String, nullable=True)
    is_correct = Column(Boolean, nullable=True)
    timestamp = Column(DateTime, server_default=func.now())

class DriftAlert(Base):
    __tablename__ = "drift_alerts"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    alert_type = Column(String, nullable=False)
    severity = Column(String, nullable=False)  # warning, critical
    message = Column(Text, nullable=False)
    current_value = Column(Float, nullable=False)
    threshold = Column(Float, nullable=False)
    acknowledged = Column(Boolean, default=False)
    timestamp = Column(DateTime, server_default=func.now())

class SystemStatus(Base):
    __tablename__ = "system_status"
    
    id = Column(Integer, primary_key=True, default=1)
    is_training = Column(Boolean, default=False)
    active_model = Column(String, default="v1.0.0")
    canary_model = Column(String, nullable=True)
    current_phase = Column(Integer, default=0)
    total_inferences = Column(Integer, default=0)
    avg_latency = Column(Float, default=0)
    uptime = Column(Float, default=99.97)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
