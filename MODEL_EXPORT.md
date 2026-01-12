# Model Export

This document describes where trained models are exported by the training pipeline and how they are referenced in the application.

Primary export locations

- YOLOv8 (classification) export path (per training batch):
  - models/batch_<BATCH_ID>/train/weights/best.pt
  - Full training artifacts: runs/classify/models/batch_<BATCH_ID>/train/

Database references

- `ModelVersion.model_path` — the exact file path saved into the `model_versions` record when a training run completes. See `backend/app/routers/training.py` where the `ModelVersion` is created.
- `TrainingBatch.analysis_results.model_path` — batch-level summary saved on the `training_batches` row pointing to the exported model file.

Relevant implementation files

- Trainer / export logic: `backend/app/ml/trainer.py`
- Training orchestration (creates DB entry and writes `model_path`): `backend/app/routers/training.py`
- Model schema and `ModelVersion` fields: `backend/app/models.py`

Notes

- New models created by training are recorded with `deployment_status="canary"` by default; the `inference` endpoint looks for models with `deployment_status == "deployed"` unless a specific version is requested.
- If you need to change where artifacts are written, update `MODELS_DIR` in `backend/app/routers/training.py` or pass a different `output_dir` to the trainer.

Example paths (replace `<BATCH_ID>` with your batch id):

- models/batch_123/train/weights/best.pt
- runs/classify/models/batch_123/train/weights/best.pt

Last updated: January 2026
