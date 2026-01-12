# ML Model Building Methodology

## Overview

This document details the machine learning model building methodology for the Solar Panel Defect Detection system, including the initial model setup, incremental fine-tuning across phases, active learning implementation, and performance metrics.

---

## 1. Initial Model (Model-0) - Phase 0 Baseline

### 1.1 Base Model Selection

| Model | Parameters | Pretrained On | Use Case |
|-------|------------|---------------|----------|
| **YOLOv8n-cls** (Primary) | ~3.2M | ImageNet (1000 classes) | Fast inference, mobile-friendly |
| **ResNet18** (Alternative) | ~11.7M | ImageNet (1000 classes) | Higher accuracy, more compute |

### 1.2 Why YOLOv8n-cls?

```python
# backend/app/ml/trainer.py
def load_base_model(self, previous_model_path: Optional[str] = None):
    if previous_model_path and Path(previous_model_path).exists():
        self.model = YOLO(previous_model_path)  # Fine-tune from previous
    else:
        self.model = YOLO("yolov8n-cls.pt")     # Phase 0: Pretrained ImageNet
```

**Advantages**:
- Lightweight (~6MB model file)
- Optimized for edge deployment
- Built-in classification head
- Excellent transfer learning capabilities

### 1.3 Phase 0 Training Process

```
1. Load yolov8n-cls.pt (ImageNet pretrained weights)
2. Replace classification head: 1000 classes → 2 classes (Normal/Defect)
3. Train on ~2000 baseline images from PVEL-AD dataset
4. Validate on 20% holdout set
5. Save as Model-0 → models/batch_phase0/best.pt
```

---

## 2. Transfer Learning & Fine-Tuning

### 2.1 Model Evolution Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSFER LEARNING CHAIN                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ImageNet Pretrained (yolov8n-cls.pt)                           │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │    Model-0      │  Phase 0: 2000 images (baseline)           │
│  │   v1.0.0        │  Accuracy: ~92-95%                         │
│  └────────┬────────┘                                            │
│           │ Fine-tune + Active Learning                         │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │    Model-1      │  Phase 1: +200 images (client upload #1)   │
│  │   v1.1.0        │  Accuracy: ~94-96%                         │
│  └────────┬────────┘                                            │
│           │ Fine-tune + Active Learning                         │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │    Model-2      │  Phase 2: +200 images (client upload #2)   │
│  │   v1.2.0        │  Accuracy: ~95-97%                         │
│  └────────┬────────┘                                            │
│           │ Fine-tune + Active Learning                         │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │    Model-3      │  Phase 3: +224 images (client upload #3)   │
│  │   v1.3.0        │  Accuracy: ~96-98%                         │
│  └─────────────────┘                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Fine-Tuning Implementation

```python
# backend/app/routers/training.py - Lines 114-123
# Get previous model for transfer learning
previous_model_path = None
if config.use_previous_model:
    prev_model_result = await db.execute(
        select(ModelVersion)
        .where(ModelVersion.deployment_status.in_(["active", "canary"]))
        .order_by(ModelVersion.created_at.desc())
        .limit(1)
    )
    prev_model = prev_model_result.scalar_one_or_none()
    if prev_model and prev_model.model_path:
        previous_model_path = prev_model.model_path
```

### 2.3 Backbone Freezing Strategy

```python
# backend/app/ml/trainer.py - TrainingConfig
freeze_backbone: bool = True        # Freeze early layers initially
unfreeze_after_epochs: int = 10     # Unfreeze for full fine-tuning

# ResNet18 implementation
if self.config.freeze_backbone:
    for name, param in self.model.named_parameters():
        if "fc" not in name:  # Keep classification layer trainable
            param.requires_grad = False

# Unfreeze after N epochs
if epoch == self.config.unfreeze_after_epochs:
    for param in self.model.parameters():
        param.requires_grad = True
```

---

## 3. Active Learning Implementation

### 3.1 Sample Weight Strategy

| Sample Type | Weight | Rationale |
|-------------|--------|-----------|
| Original (correctly classified) | 1.0x | Baseline weight |
| False Positive (Normal → Defect) | 2.0x | Reduce false alarms |
| False Negative (Defect → Normal) | 3.0x | **Critical**: Missing defects is dangerous |

### 3.2 Mistake Detection

```python
# backend/app/ml/mistake_detector.py
class MistakeDetector:
    def analyze_dataset(self, data_dir: str) -> MistakeAnalysis:
        """
        Run previous model on training data to find mistakes
        """
        false_positives = []  # Normal images classified as defect
        false_negatives = []  # Defect images classified as normal
        
        # Analyze normal images
        for img_path in normal_dir.glob("*.jpg"):
            result = self._predict_single(str(img_path))
            if result["prediction"] == "defect":
                false_positives.append(str(img_path))
        
        # Analyze defect images
        for img_path in defect_dir.glob("*.jpg"):
            result = self._predict_single(str(img_path))
            if result["prediction"] == "normal":
                false_negatives.append(str(img_path))
        
        return MistakeAnalysis(
            false_positives=false_positives,
            false_negatives=false_negatives,
            ...
        )
```

### 3.3 Weighted Sampling During Training

```python
# backend/app/ml/trainer.py - SolarPanelDataset
def _load_samples(self):
    fp_set = set(self.mistake_samples.get("fp", []))
    fn_set = set(self.mistake_samples.get("fn", []))
    
    # Load normal images (label 0)
    for img_path in normal_dir.glob("*.jpg"):
        self.samples.append(str(img_path))
        self.labels.append(0)
        
        if str(img_path) in fn_set:
            self.weights.append(3.0)  # FN weight
        else:
            self.weights.append(1.0)  # Original weight
    
    # Load defect images (label 1)
    for img_path in defect_dir.glob("*.jpg"):
        self.samples.append(str(img_path))
        self.labels.append(1)
        
        if str(img_path) in fp_set:
            self.weights.append(2.0)  # FP weight
        else:
            self.weights.append(1.0)  # Original weight

def get_weighted_sampler(self):
    return WeightedRandomSampler(
        weights=self.weights,
        num_samples=len(self.weights),
        replacement=True  # Higher weight = more likely to be sampled
    )
```

### 3.4 YOLO Oversampling Approach

For YOLOv8 (which doesn't support weighted samplers), we use physical oversampling:

```python
# backend/app/ml/trainer.py - _prepare_yolo_dataset
def _prepare_yolo_dataset(self, source_dir, target_dir, mistake_samples):
    for img in train_images:
        # Copy original
        shutil.copy(img, target / "train" / cls / img.name)
        
        # Oversample FPs: weight 2 = 1 extra copy
        if img_str in fp_set:
            for i in range(1):  # 2.0 - 1 = 1 extra copy
                shutil.copy(img, f"fp_{i}_{img.name}")
        
        # Oversample FNs: weight 3 = 2 extra copies
        elif img_str in fn_set:
            for i in range(2):  # 3.0 - 1 = 2 extra copies
                shutil.copy(img, f"fn_{i}_{img.name}")
```

---

## 4. Training Pipeline

### 4.1 Pipeline Steps

| Step | Duration | Description |
|------|----------|-------------|
| 1. Data Validation | ~1s | Verify image formats, directory structure |
| 2. Mistake Analysis | ~30s-2min | Run previous model, identify FP/FN |
| 3. Sample Weighting | ~1s | Apply weights: Original=1, FP=2, FN=3 |
| 4. Preprocessing | ~5-10s | Resize 224x224, normalize, augment |
| 5. Model Loading | ~2-5s | Load previous model or pretrained base |
| 6. Model Training | ~5-30min | PyTorch training (50 epochs default) |
| 7. Evaluation | ~30s-1min | Compute accuracy, precision, recall, F1 |
| 8. Model Export | ~1s | Save best.pt weights |
| 9. Canary Deployment | ~1s | Deploy with 10% traffic split |

**Total Pipeline Time**: ~6-35 minutes (hardware dependent)

### 4.2 Data Augmentation

```python
# backend/app/ml/trainer.py
self.transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(15),
    transforms.ColorJitter(brightness=0.2, contrast=0.2),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],  # ImageNet mean
        std=[0.229, 0.224, 0.225]    # ImageNet std
    )
])
```

### 4.3 Training Loop (ResNet18)

```python
# backend/app/ml/trainer.py - ResNet18Trainer.train()
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(
    filter(lambda p: p.requires_grad, self.model.parameters()),
    lr=self.config.learning_rate  # Default: 0.001
)

for epoch in range(self.config.epochs):  # Default: 50
    self.model.train()
    
    # Unfreeze backbone after initial epochs
    if epoch == self.config.unfreeze_after_epochs:
        for param in self.model.parameters():
            param.requires_grad = True
    
    for images, labels in dataloader:
        images = images.to(self.device)
        labels = labels.to(self.device)
        
        optimizer.zero_grad()
        outputs = self.model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
```

---

## 5. Inference Pipeline

### 5.1 Inference Flow

```
Input Image (any size)
       │
       ▼
┌─────────────────────────────────────┐
│  Preprocessing                       │
│  - Resize to 224x224                │
│  - Convert to tensor                │
│  - Normalize (ImageNet stats)       │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Model Forward Pass                  │
│  - YOLOv8: model(image)             │
│  - ResNet: model(tensor)            │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Postprocessing                      │
│  - Softmax probabilities            │
│  - Class prediction (Normal/Defect) │
│  - Confidence score                 │
└─────────────────────────────────────┘
       │
       ▼
Output: {prediction, confidence, latency_ms}
```

### 5.2 Inference Implementation

```python
# backend/app/ml/inference.py
class InferenceEngine:
    def predict(self, image_path: str, generate_heatmap: bool = False) -> Dict:
        start_time = time.time()
        
        image = Image.open(image_path).convert("RGB")
        
        if self.model_type == "yolov8":
            results = self.model(image)
            probs = results[0].probs
            class_idx = probs.top1
            confidence = float(probs.top1conf)
        else:  # ResNet18
            input_tensor = self.transform(image).unsqueeze(0).to(self.device)
            with torch.no_grad():
                output = self.model(input_tensor)
                probs = F.softmax(output, dim=1)
                confidence, class_idx = torch.max(probs, 1)
        
        prediction = self.classes[class_idx]  # "normal" or "defect"
        latency_ms = (time.time() - start_time) * 1000
        
        return {
            "prediction": prediction,
            "confidence": confidence,
            "latency_ms": latency_ms
        }
```

### 5.3 Latency Breakdown

| Stage | CPU (ms) | GPU (ms) |
|-------|----------|----------|
| Image loading | 5-10 | 5-10 |
| Preprocessing | 3-5 | 1-2 |
| Model inference | 30-80 | 5-15 |
| Postprocessing | 1-2 | 1-2 |
| **Total** | **40-100ms** | **12-30ms** |

### 5.4 GradCAM Explainability

```python
# backend/app/ml/inference.py - GradCAMGenerator
class GradCAMGenerator:
    def generate(self, input_tensor, class_idx=None) -> np.ndarray:
        # Forward pass
        output = self.model(input_tensor)
        
        # Backward pass for gradients
        self.model.zero_grad()
        one_hot = torch.zeros_like(output)
        one_hot[0, class_idx] = 1
        output.backward(gradient=one_hot)
        
        # Compute CAM
        weights = self.gradients.mean(dim=(2, 3), keepdim=True)
        cam = (weights * self.activations).sum(dim=1, keepdim=True)
        cam = F.relu(cam)  # Only positive contributions
        
        return cam.squeeze().cpu().numpy()
```

**GradCAM Overhead**: +30-50ms additional latency

---

## 6. Model Metrics

### 6.1 Metrics Tracked

```python
# backend/app/ml/trainer.py
@dataclass
class TrainingMetrics:
    accuracy: float       # (TP + TN) / Total
    precision: float      # TP / (TP + FP)
    recall: float         # TP / (TP + FN) - Critical for defect detection!
    f1_score: float       # 2 * (P * R) / (P + R)
    fpr: float           # FP / (FP + TN) - False alarm rate
    tp: int              # True Positives
    tn: int              # True Negatives
    fp: int              # False Positives
    fn: int              # False Negatives
    train_losses: List[float]  # Per-epoch loss curve
```

### 6.2 Expected Performance by Phase

| Phase | Training Images | Expected Accuracy | Expected Recall |
|-------|-----------------|-------------------|-----------------|
| 0 (Baseline) | 2000 | 92-95% | 88-92% |
| 1 | +200 (2200 total) | 94-96% | 91-94% |
| 2 | +200 (2400 total) | 95-97% | 93-96% |
| 3 | +224 (2624 total) | 96-98% | 95-98% |

---

## 7. Hyperparameters

### 7.1 Default Configuration

```python
# backend/app/ml/trainer.py
@dataclass
class TrainingConfig:
    # Model selection
    model_type: str = "yolov8"      # "yolov8" or "resnet18"
    
    # Training parameters
    epochs: int = 50                # Training iterations
    batch_size: int = 32            # Images per batch
    learning_rate: float = 0.001    # Adam optimizer LR
    img_size: int = 224             # Input image size
    
    # Active learning weights
    original_weight: float = 1.0    # Normal samples
    fp_weight: float = 2.0          # False Positive penalty
    fn_weight: float = 3.0          # False Negative penalty
    
    # Transfer learning
    freeze_backbone: bool = True    # Freeze early layers initially
    unfreeze_after_epochs: int = 10 # When to unfreeze
    
    # Paths
    data_dir: str = "data/images"
    models_dir: str = "models"
```

### 7.2 Hyperparameter Tuning Guidelines

| Parameter | Low Value | High Value | Effect |
|-----------|-----------|------------|--------|
| learning_rate | 0.0001 | 0.01 | Lower = stable, Higher = faster convergence |
| epochs | 20 | 100 | More = better fit, risk of overfitting |
| batch_size | 8 | 64 | Larger = smoother gradients, more memory |
| fn_weight | 2.0 | 5.0 | Higher = prioritize catching defects |

---

## 8. Model Architecture Details

### 8.1 YOLOv8n-cls Architecture

```
Input (224 × 224 × 3)
        │
        ▼
┌───────────────────────────────────────┐
│  Backbone: CSPDarknet                  │
│  ├─ Conv 3×3, stride 2                │
│  ├─ C2f Block (efficient bottleneck)  │
│  ├─ 5 stages of downsampling          │
│  └─ Output: 512 feature channels      │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  Classification Head                   │
│  ├─ Global Average Pooling            │
│  ├─ Linear(512 → 2)                   │
│  └─ Softmax                           │
└───────────────────────────────────────┘
        │
        ▼
Output: [P(Normal), P(Defect)]
```

### 8.2 ResNet18 Architecture (Modified)

```
Input (224 × 224 × 3)
        │
        ▼
┌───────────────────────────────────────┐
│  Conv1: 7×7, stride 2, 64 filters     │
│  BatchNorm + ReLU                      │
│  MaxPool 3×3, stride 2                │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  Layer 1: 2 Residual Blocks, 64 ch    │
│  Layer 2: 2 Residual Blocks, 128 ch   │
│  Layer 3: 2 Residual Blocks, 256 ch   │
│  Layer 4: 2 Residual Blocks, 512 ch   │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  AdaptiveAvgPool → Flatten            │
│  FC: 512 → 2 (Modified for binary)    │
│  Softmax                              │
└───────────────────────────────────────┘
        │
        ▼
Output: [P(Normal), P(Defect)]
```

---

## 9. Summary

### Key Improvement Mechanisms

1. **Transfer Learning**: Each Model-k inherits learned features from Model-(k-1)
2. **Active Learning**: Hard samples (FP/FN) receive 2-3x sampling weight
3. **Incremental Data**: New phases add domain-specific edge cases
4. **Weighted Oversampling**: Physical copies of mistake samples in training set

### Performance Timeline

```
Phase 0: ImageNet → Train 2000 images → Model-0 (Baseline)
                                            │
Phase 1: Model-0 + Mistake Analysis ───────►│ Weight FP/FN → Model-1
                                            │
Phase 2: Model-1 + Mistake Analysis ───────►│ Weight FP/FN → Model-2
                                            │
Phase 3: Model-2 + Mistake Analysis ───────►│ Weight FP/FN → Model-3 (Final)
```

---

*Document Version: 1.0.0*  
*Last Updated: January 2025*
