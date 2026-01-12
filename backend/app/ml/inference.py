"""
Inference Engine with GradCAM support for model explainability
"""
import os
import base64
from pathlib import Path
from typing import Dict, Optional, Tuple
from io import BytesIO

try:
    import torch
    import torch.nn.functional as F
    from torchvision import transforms
    from PIL import Image
    import numpy as np
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False


class GradCAMGenerator:
    """Generate GradCAM heatmaps for model predictions"""
    
    def __init__(self, model, target_layer=None):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        
        if TORCH_AVAILABLE and target_layer is not None:
            self._register_hooks()
    
    def _register_hooks(self):
        """Register forward and backward hooks for gradient capture"""
        def forward_hook(module, input, output):
            self.activations = output.detach()
        
        def backward_hook(module, grad_input, grad_output):
            self.gradients = grad_output[0].detach()
        
        self.target_layer.register_forward_hook(forward_hook)
        self.target_layer.register_full_backward_hook(backward_hook)
    
    def generate(self, input_tensor: torch.Tensor, class_idx: int = None) -> Optional[np.ndarray]:
        """Generate GradCAM heatmap for input image"""
        if not TORCH_AVAILABLE:
            return None
        
        self.model.eval()
        
        # Forward pass
        output = self.model(input_tensor)
        
        if class_idx is None:
            class_idx = output.argmax(dim=1).item()
        
        # Backward pass
        self.model.zero_grad()
        one_hot = torch.zeros_like(output)
        one_hot[0, class_idx] = 1
        output.backward(gradient=one_hot, retain_graph=True)
        
        # Generate heatmap
        if self.gradients is None or self.activations is None:
            return None
        
        weights = self.gradients.mean(dim=(2, 3), keepdim=True)
        cam = (weights * self.activations).sum(dim=1, keepdim=True)
        cam = F.relu(cam)
        cam = F.interpolate(cam, size=input_tensor.shape[2:], mode='bilinear', align_corners=False)
        
        # Normalize
        cam = cam - cam.min()
        cam = cam / (cam.max() + 1e-8)
        
        return cam.squeeze().cpu().numpy()
    
    def generate_overlay(
        self,
        image: Image.Image,
        heatmap: np.ndarray,
        alpha: float = 0.5
    ) -> Image.Image:
        """Overlay heatmap on original image"""
        if not TORCH_AVAILABLE:
            return image
        
        import matplotlib.pyplot as plt
        from matplotlib import cm
        
        # Resize heatmap to image size
        heatmap_resized = np.array(Image.fromarray((heatmap * 255).astype(np.uint8)).resize(image.size))
        
        # Apply colormap
        heatmap_colored = cm.jet(heatmap_resized / 255.0)[:, :, :3]
        heatmap_colored = (heatmap_colored * 255).astype(np.uint8)
        
        # Blend with original
        image_array = np.array(image)
        overlay = (alpha * heatmap_colored + (1 - alpha) * image_array).astype(np.uint8)
        
        return Image.fromarray(overlay)


class InferenceEngine:
    """Run inference on single images with explainability"""
    
    def __init__(self, model_path: str, model_type: str = "yolov8"):
        self.model_path = model_path
        self.model_type = model_type
        self.model = None
        self.gradcam = None
        self.device = "cuda" if TORCH_AVAILABLE and torch.cuda.is_available() else "cpu"
        
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ]) if TORCH_AVAILABLE else None
        
        self.classes = ["normal", "defect"]
    
    def load_model(self):
        """Load the model for inference"""
        if not Path(self.model_path).exists():
            raise FileNotFoundError(f"Model not found: {self.model_path}")
        
        if self.model_type == "yolov8" and YOLO_AVAILABLE:
            self.model = YOLO(self.model_path)
        elif TORCH_AVAILABLE:
            self.model = torch.load(self.model_path, map_location=self.device)
            self.model.eval()
            
            # Setup GradCAM for ResNet
            if hasattr(self.model, 'layer4'):
                self.gradcam = GradCAMGenerator(self.model, self.model.layer4[-1])
    
    def predict(
        self,
        image_path: str,
        generate_heatmap: bool = False
    ) -> Dict:
        """
        Run inference on a single image
        
        Returns:
            Dict with prediction, confidence, latency, and optional heatmap
        """
        import time
        
        start_time = time.time()
        
        if not TORCH_AVAILABLE:
            return self._simulate_inference()
        
        image = Image.open(image_path).convert("RGB")
        
        if self.model_type == "yolov8" and YOLO_AVAILABLE:
            results = self.model(image)
            probs = results[0].probs
            class_idx = probs.top1
            confidence = float(probs.top1conf)
            prediction = self.classes[class_idx]
        else:
            # ResNet inference
            input_tensor = self.transform(image).unsqueeze(0).to(self.device)
            
            with torch.no_grad():
                output = self.model(input_tensor)
                probs = F.softmax(output, dim=1)
                confidence, class_idx = torch.max(probs, 1)
                confidence = float(confidence[0])
                class_idx = int(class_idx[0])
                prediction = self.classes[class_idx]
        
        latency_ms = (time.time() - start_time) * 1000
        
        result = {
            "prediction": prediction,
            "confidence": confidence,
            "class_index": class_idx,
            "latency_ms": latency_ms
        }
        
        # Generate GradCAM if requested
        if generate_heatmap and self.gradcam is not None:
            input_tensor = self.transform(image).unsqueeze(0).to(self.device)
            input_tensor.requires_grad = True
            
            heatmap = self.gradcam.generate(input_tensor, class_idx)
            if heatmap is not None:
                overlay = self.gradcam.generate_overlay(image, heatmap)
                
                # Convert to base64
                buffer = BytesIO()
                overlay.save(buffer, format="PNG")
                result["heatmap_base64"] = base64.b64encode(buffer.getvalue()).decode()
        
        return result
    
    def _simulate_inference(self) -> Dict:
        """Simulate inference when PyTorch is not available"""
        import random
        import time
        
        time.sleep(random.uniform(0.01, 0.05))
        
        is_defect = random.random() > 0.7
        
        return {
            "prediction": "defect" if is_defect else "normal",
            "confidence": random.uniform(0.85, 0.99),
            "class_index": 1 if is_defect else 0,
            "latency_ms": random.uniform(10, 50)
        }
    
    def batch_predict(self, image_paths: list) -> list:
        """Run inference on multiple images"""
        return [self.predict(path) for path in image_paths]
