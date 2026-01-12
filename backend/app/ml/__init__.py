"""ML Training Module"""
from .trainer import (
    TrainingConfig,
    TrainingMetrics,
    SolarPanelDataset,
    YOLOv8Trainer,
    ResNet18Trainer,
    get_trainer,
    TORCH_AVAILABLE
)
from .inference import InferenceEngine, GradCAMGenerator
from .mistake_detector import MistakeDetector

__all__ = [
    "TrainingConfig",
    "TrainingMetrics",
    "SolarPanelDataset",
    "YOLOv8Trainer",
    "ResNet18Trainer",
    "get_trainer",
    "TORCH_AVAILABLE",
    "InferenceEngine",
    "GradCAMGenerator",
    "MistakeDetector"
]
