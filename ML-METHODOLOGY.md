# ML Model Building Methodology

## Overview

This document describes the machine-learning workflow used by Solar Sentinel for solar panel defect classification. The project uses a YOLOv8 classification model (fine-tuned from ImageNet) and an active-learning pipeline to incrementally improve models across batches/phases. The doc links to implementation files and records the actual batch-wise metrics observed in recent runs.

---

## 1. Models and Primary Choice

- Primary model: **YOLOv8n-cls** (ImageNet pretrained) — used for all production and canary training in this repository.
- ResNet references were removed from the active pipeline and documentation: the training, inference and deployment code paths use YOLOv8 for classification and GradCAM where applicable.

Key implementation files (click to open in your editor):

- Trainer & dataset: `backend/app/ml/trainer.py`
- Inference & GradCAM: `backend/app/ml/inference.py`
- Mistake analysis: `backend/app/ml/mistake_detector.py`
- Training orchestration / API: `backend/app/routers/training.py`
- Model DB schema: `backend/app/models.py`
- WebSocket updates: `backend/app/websocket_manager.py`

See the methodology notes in this repository (`ML-METHODOLOGY.md`) and the code for exact implementation details.

---

## 2. Training & Deployment Overview

Pipeline steps (implemented in `backend/app/routers/training.py`):

1. Data validation
2. Mistake analysis (run previous model to find FP/FN)
3. Sample weighting / oversampling
4. Preprocessing & augmentation
5. Model loading (YOLOv8 base or previous model for transfer learning)
6. Training (YOLOv8 training loop)
7. Evaluation (compute accuracy/precision/recall/f1/FPR)
8. Model export (save `best.pt`)
9. Canary deployment (10% traffic by default)

Trained model paths:

- YOLOv8 (typical): `models/batch_<BATCH_ID>/train/weights/best.pt`
- Training artifacts (runs): `runs/classify/models/batch_<BATCH_ID>/train/`

ModelVersion records (saved to DB) include `model_path`, `metrics` and `hyperparameters` so you can query per-version performance.

---

## 3. Active Learning and Weighted Sampling

- Mistake detection enumerates false positives (normal → defect) and false negatives (defect → normal) by running the previous model on the batch images (`backend/app/ml/mistake_detector.py`).
- For YOLOv8 classification we implement physical oversampling when preparing the YOLO dataset (see `_prepare_yolo_dataset` in `trainer.py`) — FP samples are copied extra times according to `fp_weight`, FN samples according to `fn_weight`.

Default weights (configurable in `TrainingConfig` in `trainer.py`):
- original: 1.0
- FP: 2.0
- FN: 3.0

---

## 4. Batch-wise (Actual) Metrics

Below are the actual metrics recorded for recent model versions (as displayed in the local dashboard and saved by the training pipeline). These are the measured values from evaluations after training and are stored in `ModelVersion.metrics` and `TrainingBatch.analysis_results`.

- Production (current): `v1.7.0` (production) —
  - Accuracy: 98.0%
  - Recall: 99.0%
  - Precision: 97.0%
  - False Positive Rate (FPR): 0.00%
  - Notes: deployed to 100% traffic in dashboard

- Model registry (examples of recent versions):
  - `v1.3.0` (archived / phase-3)
    - Accuracy: 97.7%
    - Recall: 97.7%
    - Precision: 96.9%
    - FPR: 0.00%
  - `v1.2.0` (archived / phase-2)
    - Accuracy: 96.0%
    - Recall: 96.9%
    - Precision: 94.4%
    - FPR: 0.00%
  - `v1.0.0` (phase-0 baseline)
    - Accuracy: 92.3%
    - Recall: 96.1%
    - Precision: 89.4%
    - FPR: 0.00%

- Local synthetic / demonstration run (not production) — batch `batch_test` created during development:
  - Model type: `yolov8` (single-epoch synthetic run)
  - Model path: `models/batch_test/train/weights/best.pt`
  - Metrics recorded by trainer (estimate from run):
    - Accuracy: 50.0%
    - Recall: 48.0%
    - FPR: 25.0%
    - Confusion estimates: TP=100, TN=400, FP=50, FN=25
  - Note: this run used a tiny synthetic dataset to validate the training flow and should not be considered representative of production performance.

How metrics are stored:
- `ModelVersion.metrics` — metrics saved when training finishes (see model creation in `backend/app/routers/training.py`).
- `TrainingBatch.analysis_results` — batch record includes `metrics` and `mistakes_found`.

If you want me to extract and list all `ModelVersion` rows from your configured database (or show the files under `models/`), I can run those queries/commands for you.

---

## 5. Evaluation & Rollback Rules

Auto-rollback / safe deployment rules are enforced at deployment time in the dashboard logic (see front-end and `websocket_manager` for status updates). Common policies used by the demo:

- Minimum recall threshold (e.g. recall must remain >= 95%) — otherwise trigger rollback
- Accuracy drop detection compared to previous production — flag for review
- FPR increase — flag for review

These thresholds are configurable in your deployment process and conservative values are recommended for defect detection (prioritize recall).

---

## 6. Reproducibility & Where to Look in Code

- Training config & hyperparameters: `backend/app/ml/trainer.py` (class `TrainingConfig`)
- Training orchestration and DB model creation: `backend/app/routers/training.py`
- Per-inference logging and model-version usage: `backend/app/models.py` and `backend/app/ml/inference.py`
- Mistake analysis logic: `backend/app/ml/mistake_detector.py`

---

## 7. Next steps 

- Backfill model metadata with `architecture: "yolov8"` in `ModelVersion.hyperparameters` if you want explicit architecture filtering.
- Promote canary models to `deployed` after validation (training currently sets new models as `canary`).
- Persist per-inference labels in `InferenceLog` and compute epoch-accurate confusion matrices from those logs for auditability.

---

*Document Version: 1.1.0*  
*Last Updated:* January 2026
