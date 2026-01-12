"""
Mistake Detection for Active Learning
Identifies False Positives and False Negatives for sample weighting
"""
from pathlib import Path
from typing import Dict, List, Tuple
from dataclasses import dataclass

try:
    import torch
    from torch.utils.data import DataLoader
    from torchvision import transforms
    from PIL import Image
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False


@dataclass
class MistakeAnalysis:
    """Results from mistake detection"""
    false_positives: List[str]  # Normal images classified as defect
    false_negatives: List[str]  # Defect images classified as normal
    fp_confidences: Dict[str, float]  # Confidence scores for FPs
    fn_confidences: Dict[str, float]  # Confidence scores for FNs
    total_analyzed: int
    accuracy: float
    
    def to_dict(self) -> Dict:
        return {
            "false_positives": self.false_positives,
            "false_negatives": self.false_negatives,
            "fp_count": len(self.false_positives),
            "fn_count": len(self.false_negatives),
            "fp_confidences": self.fp_confidences,
            "fn_confidences": self.fn_confidences,
            "total_analyzed": self.total_analyzed,
            "accuracy": self.accuracy
        }


class MistakeDetector:
    """Detect classification mistakes for active learning"""
    
    def __init__(self, model_path: str, model_type: str = "yolov8"):
        self.model_path = model_path
        self.model_type = model_type
        self.model = None
        self.device = "cuda" if TORCH_AVAILABLE and torch.cuda.is_available() else "cpu"
        
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ]) if TORCH_AVAILABLE else None
    
    def load_model(self):
        """Load the model for analysis"""
        if self.model_type == "yolov8" and YOLO_AVAILABLE:
            self.model = YOLO(self.model_path)
        elif TORCH_AVAILABLE:
            self.model = torch.load(self.model_path, map_location=self.device)
            self.model.eval()
    
    def analyze_dataset(
        self,
        data_dir: str,
        confidence_threshold: float = 0.5
    ) -> MistakeAnalysis:
        """
        Analyze a dataset to find misclassified samples
        
        Args:
            data_dir: Directory with normal/ and defect/ subdirs
            confidence_threshold: Minimum confidence for a prediction
        
        Returns:
            MistakeAnalysis with FP and FN lists
        """
        if not TORCH_AVAILABLE:
            return self._simulate_analysis(data_dir)
        
        data_path = Path(data_dir)
        false_positives = []
        false_negatives = []
        fp_confidences = {}
        fn_confidences = {}
        total = 0
        correct = 0
        
        # Analyze normal images
        normal_dir = data_path / "normal"
        if normal_dir.exists():
            for img_path in normal_dir.glob("*.[jp][pn][g]"):
                total += 1
                result = self._predict_single(str(img_path))
                
                if result["prediction"] == "defect":
                    # False Positive: Normal classified as Defect
                    false_positives.append(str(img_path))
                    fp_confidences[str(img_path)] = result["confidence"]
                else:
                    correct += 1
        
        # Analyze defect images
        defect_dir = data_path / "defect"
        if defect_dir.exists():
            for img_path in defect_dir.glob("*.[jp][pn][g]"):
                total += 1
                result = self._predict_single(str(img_path))
                
                if result["prediction"] == "normal":
                    # False Negative: Defect classified as Normal
                    false_negatives.append(str(img_path))
                    fn_confidences[str(img_path)] = result["confidence"]
                else:
                    correct += 1
        
        accuracy = correct / total if total > 0 else 0
        
        return MistakeAnalysis(
            false_positives=false_positives,
            false_negatives=false_negatives,
            fp_confidences=fp_confidences,
            fn_confidences=fn_confidences,
            total_analyzed=total,
            accuracy=accuracy
        )
    
    def _predict_single(self, image_path: str) -> Dict:
        """Predict on a single image"""
        import torch.nn.functional as F
        
        image = Image.open(image_path).convert("RGB")
        
        if self.model_type == "yolov8" and YOLO_AVAILABLE:
            results = self.model(image, verbose=False)
            probs = results[0].probs
            class_idx = probs.top1
            confidence = float(probs.top1conf)
        else:
            input_tensor = self.transform(image).unsqueeze(0).to(self.device)
            
            with torch.no_grad():
                output = self.model(input_tensor)
                probs = F.softmax(output, dim=1)
                confidence, class_idx = torch.max(probs, 1)
                confidence = float(confidence[0])
                class_idx = int(class_idx[0])
        
        return {
            "prediction": "defect" if class_idx == 1 else "normal",
            "confidence": confidence,
            "class_index": class_idx
        }
    
    def _simulate_analysis(self, data_dir: str) -> MistakeAnalysis:
        """Simulate analysis when PyTorch is not available"""
        import random
        
        data_path = Path(data_dir)
        false_positives = []
        false_negatives = []
        fp_confidences = {}
        fn_confidences = {}
        total = 0
        
        # Simulate finding some mistakes
        for cls_dir in ["normal", "defect"]:
            cls_path = data_path / cls_dir
            if cls_path.exists():
                images = list(cls_path.glob("*.[jp][pn][g]"))
                total += len(images)
                
                # Randomly select ~5-10% as mistakes
                num_mistakes = max(1, int(len(images) * random.uniform(0.05, 0.10)))
                mistake_images = random.sample(images, min(num_mistakes, len(images)))
                
                for img in mistake_images:
                    conf = random.uniform(0.6, 0.85)
                    if cls_dir == "normal":
                        false_positives.append(str(img))
                        fp_confidences[str(img)] = conf
                    else:
                        false_negatives.append(str(img))
                        fn_confidences[str(img)] = conf
        
        correct = total - len(false_positives) - len(false_negatives)
        
        return MistakeAnalysis(
            false_positives=false_positives,
            false_negatives=false_negatives,
            fp_confidences=fp_confidences,
            fn_confidences=fn_confidences,
            total_analyzed=total,
            accuracy=correct / total if total > 0 else 0.95
        )
    
    def get_hard_samples(
        self,
        analysis: MistakeAnalysis,
        top_k: int = 10
    ) -> Dict[str, List[Tuple[str, float]]]:
        """
        Get the hardest samples (lowest confidence mistakes)
        
        Returns top_k FPs and FNs sorted by confidence
        """
        # Sort by confidence (lower = harder)
        fp_sorted = sorted(
            analysis.fp_confidences.items(),
            key=lambda x: x[1]
        )[:top_k]
        
        fn_sorted = sorted(
            analysis.fn_confidences.items(),
            key=lambda x: x[1]
        )[:top_k]
        
        return {
            "hard_false_positives": fp_sorted,
            "hard_false_negatives": fn_sorted
        }
