# SolarDefect ML Ops - FastAPI Backend

A Python FastAPI backend for the SolarDefect ML Ops dashboard.

## Features

- **REST API** for ML pipeline management
- **WebSocket** support for real-time updates
- **Async SQLAlchemy** with SQLite (dev) or PostgreSQL (prod)
- **Background Tasks** for training pipeline simulation

## Local Development

1. **Create virtual environment:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Create .env file:**
   ```bash
   cp .env.example .env
   ```

4. **Run the server:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

5. **Access the API:**
   - API: http://localhost:8000
   - Docs: http://localhost:8000/docs
   - WebSocket: ws://localhost:8000/ws

## API Endpoints

### Status
- `GET /api/status` - Get system status
- `GET /api/training-status` - Get PyTorch/GPU availability

### Models
- `GET /api/models` - List all model versions
- `POST /api/promote-canary` - Promote canary to production

### Batches
- `GET /api/batches` - List training batches
- `GET /api/pipeline-steps` - Get pipeline steps
- `POST /api/upload-batch` - Upload new batch (triggers training)

### Training (Real PyTorch/YOLOv8)
- `POST /api/train` - Start real training with config:
  ```json
  {
    "batch_id": "uuid",
    "model_type": "yolov8",  // or "resnet18"
    "epochs": 50,
    "batch_size": 32,
    "learning_rate": 0.001,
    "use_previous_model": true,
    "fp_weight": 2.0,
    "fn_weight": 3.0
  }
  ```
- `POST /api/infer` - Run single image inference with optional GradCAM
- `POST /api/analyze-mistakes` - Analyze FP/FN for active learning

### Inference
- `GET /api/logs` - Get inference logs
- `POST /api/simulate-inference` - Simulate an inference

### Alerts
- `GET /api/alerts` - Get drift alerts
- `POST /api/acknowledge-alert` - Acknowledge an alert

## ML Features

### Transfer Learning
- Fine-tunes from previous model (Model-k trained from Model-k-1)
- Uses pretrained YOLOv8n-cls or ResNet18 as base

### Active Learning (Sample Weighting)
- Original data: weight 1.0
- False Positives (Normal → Defect): weight 2.0
- False Negatives (Defect → Normal): weight 3.0

### GradCAM Explainability
- Generate heatmaps for model predictions
- Visualize what the model focuses on

## Deployment

### Railway
1. Connect your GitHub repo
2. Add `DATABASE_URL` environment variable
3. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Render
1. Create new Web Service
2. Set build command: `pip install -r requirements.txt`
3. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add PostgreSQL database

### Fly.io
1. `flyctl launch`
2. Add PostgreSQL: `flyctl postgres create`
3. `flyctl deploy`

## WebSocket Events

Connect to `ws://your-backend/ws` to receive real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // data.type: 'model_update' | 'status_update' | 'log_update' | 'alert_update' | 'pipeline_update'
  // data.table: table name
  // data.data: updated record
};
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `sqlite+aiosqlite:///./ml_ops.db` |
| `CORS_ORIGINS` | Allowed CORS origins | `*` |
