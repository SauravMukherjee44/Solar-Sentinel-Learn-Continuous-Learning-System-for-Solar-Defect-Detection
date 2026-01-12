# API Documentation

## Overview

This document describes the APIs available in the Solar Panel Defect Detection System. The system uses a hybrid API architecture:

1. **Lovable Cloud Edge Functions** - Serverless functions for inference and pipeline management
2. **Python FastAPI Backend** - ML training, model management, and advanced operations
3. **Supabase REST API** - Direct database access for CRUD operations

---

## Base URLs

| Environment | Frontend | Edge Functions | Python Backend |
|-------------|----------|----------------|----------------|
| Development | `http://localhost:5173` | `https://knbllefougsxnyrkucnq.supabase.co/functions/v1` | `http://localhost:8000` |
| Production | `https://your-domain.com` | Same as above | `https://your-backend.railway.app` |

---

## Authentication

### Headers

```http
Authorization: Bearer <SUPABASE_ANON_KEY>
Content-Type: application/json
```

For Edge Functions, the anon key provides public access. Service role key is used internally.

---

## Edge Functions API

### 1. Image Inference

Perform inference on a single image using Vision AI.

**Endpoint**: `POST /functions/v1/image-inference`

**Request**:
```json
{
  "image": "<base64_encoded_image>",
  "model_version": "v1.0.0"  // optional
}
```

**Response**:
```json
{
  "prediction": "defect",
  "confidence": 0.94,
  "latency_ms": 234,
  "model_version": "v1.0.0",
  "timestamp": "2025-01-12T10:30:00Z"
}
```

**Status Codes**:
| Code | Description |
|------|-------------|
| 200 | Successful inference |
| 400 | Invalid image format |
| 500 | Inference error |

---

### 2. ML Pipeline Trigger

Trigger the ML training pipeline for a batch.

**Endpoint**: `POST /functions/v1/ml-pipeline`

**Request**:
```json
{
  "batch_id": "uuid",
  "phase": 1,
  "action": "start_training"
}
```

**Response**:
```json
{
  "success": true,
  "pipeline_id": "uuid",
  "status": "running",
  "estimated_duration_minutes": 15
}
```

**Actions**:
| Action | Description |
|--------|-------------|
| `start_training` | Begin training on batch |
| `validate` | Run validation only |
| `promote_canary` | Promote canary to production |
| `rollback` | Rollback to previous model |

---

### 3. Simulate Inference

Generate simulated inference data for testing.

**Endpoint**: `POST /functions/v1/simulate-inference`

**Request**:
```json
{
  "count": 10,
  "model_version": "v1.0.0"
}
```

**Response**:
```json
{
  "success": true,
  "inferences_created": 10,
  "average_confidence": 0.87
}
```

---

## Python Backend API

### Base Configuration

```python
BASE_URL = os.getenv("VITE_API_URL", "http://localhost:8000")
WS_URL = os.getenv("VITE_WS_URL", "ws://localhost:8000")
```

---

### 1. System Status

Get current system status.

**Endpoint**: `GET /api/status`

**Response**:
```json
{
  "active_model": "v1.0.0",
  "canary_model": "v1.1.0",
  "is_training": false,
  "total_inferences": 1523,
  "avg_latency": 156.3,
  "uptime": 99.8,
  "current_phase": 2
}
```

---

### 2. Model Registry

#### List Models

**Endpoint**: `GET /api/models`

**Response**:
```json
{
  "models": [
    {
      "id": "uuid",
      "version": "v1.0.0",
      "deployment_status": "production",
      "metrics": {
        "accuracy": 0.95,
        "precision": 0.93,
        "recall": 0.97,
        "f1_score": 0.95
      },
      "training_date": "2025-01-10T08:00:00Z",
      "traffic_split": 90
    }
  ]
}
```

#### Promote Canary

**Endpoint**: `POST /api/models/{model_id}/promote`

**Response**:
```json
{
  "success": true,
  "message": "Model v1.1.0 promoted to production",
  "previous_model": "v1.0.0"
}
```

#### Rollback Model

**Endpoint**: `POST /api/models/{model_id}/rollback`

**Response**:
```json
{
  "success": true,
  "message": "Rolled back to v1.0.0",
  "reason": "Recall below threshold"
}
```

---

### 3. Training Batches

#### Upload Batch

**Endpoint**: `POST /api/batches`

**Request**:
```json
{
  "phase": 1,
  "total_images": 1000,
  "normal_images": 700,
  "defect_images": 300
}
```

**Response**:
```json
{
  "batch_id": "uuid",
  "status": "pending",
  "phase": 1,
  "upload_date": "2025-01-12T10:00:00Z"
}
```

#### Get Batch Status

**Endpoint**: `GET /api/batches/{batch_id}`

**Response**:
```json
{
  "id": "uuid",
  "phase": 1,
  "status": "completed",
  "total_images": 1000,
  "normal_images": 700,
  "defect_images": 300,
  "analysis_results": {
    "quality_score": 0.92,
    "duplicate_count": 3,
    "corrupt_count": 0
  }
}
```

---

### 4. Inference Logs

**Endpoint**: `GET /api/logs`

**Query Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 100 | Max results |
| `offset` | int | 0 | Pagination offset |
| `model_version` | string | - | Filter by model |
| `prediction` | string | - | Filter by class |

**Response**:
```json
{
  "logs": [
    {
      "id": "uuid",
      "image_id": "img_001",
      "prediction": "defect",
      "confidence": 0.94,
      "actual_label": "defect",
      "is_correct": true,
      "latency_ms": 156,
      "model_version": "v1.0.0",
      "timestamp": "2025-01-12T10:30:00Z"
    }
  ],
  "total": 1523,
  "page": 1
}
```

---

### 5. Drift Alerts

#### List Alerts

**Endpoint**: `GET /api/alerts`

**Response**:
```json
{
  "alerts": [
    {
      "id": "uuid",
      "alert_type": "accuracy_drop",
      "severity": "warning",
      "message": "Accuracy dropped by 5.2%",
      "threshold": 0.05,
      "current_value": 0.052,
      "acknowledged": false,
      "timestamp": "2025-01-12T09:00:00Z"
    }
  ]
}
```

#### Acknowledge Alert

**Endpoint**: `POST /api/alerts/{alert_id}/acknowledge`

**Response**:
```json
{
  "success": true,
  "alert_id": "uuid",
  "acknowledged_at": "2025-01-12T10:35:00Z"
}
```

---

### 6. Training Pipeline

#### Start Training

**Endpoint**: `POST /api/training/start`

**Request**:
```json
{
  "batch_id": "uuid",
  "hyperparameters": {
    "learning_rate": 0.001,
    "epochs": 50,
    "batch_size": 32
  }
}
```

**Response**:
```json
{
  "pipeline_id": "uuid",
  "status": "running",
  "steps": [
    { "name": "data_validation", "status": "completed" },
    { "name": "preprocessing", "status": "running" },
    { "name": "training", "status": "pending" },
    { "name": "evaluation", "status": "pending" },
    { "name": "deployment", "status": "pending" }
  ]
}
```

#### Get Pipeline Status

**Endpoint**: `GET /api/training/status/{pipeline_id}`

**Response**:
```json
{
  "pipeline_id": "uuid",
  "status": "completed",
  "progress": 100,
  "model_version": "v1.1.0",
  "duration_minutes": 23,
  "steps": [...]
}
```

---

## WebSocket API

### Real-time Updates

**Endpoint**: `WS /ws`

**Message Types**:

#### Training Progress
```json
{
  "type": "training_progress",
  "data": {
    "pipeline_id": "uuid",
    "step": "training",
    "progress": 45,
    "epoch": 23,
    "loss": 0.023
  }
}
```

#### Inference Event
```json
{
  "type": "inference",
  "data": {
    "image_id": "img_001",
    "prediction": "defect",
    "confidence": 0.94
  }
}
```

#### Alert Trigger
```json
{
  "type": "alert",
  "data": {
    "alert_type": "drift_detected",
    "severity": "critical",
    "message": "Significant drift detected"
  }
}
```

---

## Database Schema Reference

### Tables

| Table | Description |
|-------|-------------|
| `model_versions` | ML model registry with metrics |
| `training_batches` | Training data batches |
| `inference_logs` | Prediction audit trail |
| `drift_alerts` | Monitoring alerts |
| `pipeline_steps` | Training pipeline progress |
| `system_status` | Global system state |
| `uploaded_images` | Training image metadata |

### Key Relationships

```
training_batches ─┬─► pipeline_steps
                  └─► uploaded_images

model_versions ──► inference_logs
```

---

## Error Responses

All APIs return consistent error responses:

```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "message": "Invalid image format",
  "details": {
    "field": "image",
    "expected": "base64 encoded PNG/JPEG"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED` | 401 | Missing/invalid auth |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/image-inference` | 100 req | 1 minute |
| `/api/*` | 1000 req | 1 minute |
| WebSocket | 10 connections | per IP |

---

## SDK Usage Examples

### JavaScript/TypeScript

```typescript
import { supabase } from "@/integrations/supabase/client";

// Invoke edge function
const { data, error } = await supabase.functions.invoke('image-inference', {
  body: { image: base64Image }
});

// Query database
const { data: logs } = await supabase
  .from('inference_logs')
  .select('*')
  .order('timestamp', { ascending: false })
  .limit(100);

// Real-time subscription
supabase
  .channel('inference-updates')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'inference_logs' },
    (payload) => console.log('New inference:', payload)
  )
  .subscribe();
```

### Python

```python
import requests

BASE_URL = "http://localhost:8000"

# Get system status
response = requests.get(f"{BASE_URL}/api/status")
status = response.json()

# Upload batch
response = requests.post(f"{BASE_URL}/api/batches", json={
    "phase": 1,
    "total_images": 1000,
    "normal_images": 700,
    "defect_images": 300
})
```

---

*API Version: 1.0.0*  
*Last Updated: January 2025*
