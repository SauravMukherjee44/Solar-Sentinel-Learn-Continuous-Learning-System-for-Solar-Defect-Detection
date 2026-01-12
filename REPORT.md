# Architecture Report: Solar Panel Defect Detection System

## Executive Summary

This document outlines the architectural decisions made for the **Continuous Learning ML System** for solar panel defect detection. The system is designed for production-grade deployment with emphasis on reliability, scalability, and maintainability.

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React + Vite)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Dashboard  │  │   Upload    │  │  Inference  │  │  Model Registry     │ │
│  │   Panel     │  │   Panel     │  │   Panel     │  │  & Monitoring       │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │    Lovable Cloud        │
                    │   (Supabase Backend)    │
                    ├─────────────────────────┤
                    │  • Edge Functions       │
                    │  • PostgreSQL Database  │
                    │  • Real-time Updates    │
                    │  • File Storage         │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
    ┌─────────▼─────────┐ ┌──────▼──────┐ ┌────────▼────────┐
    │  Python Backend   │ │   Vision    │ │  Storage        │
    │  (FastAPI)        │ │   AI API    │ │  Buckets        │
    │  ML Training      │ │  (Gemini)   │ │  training-images│
    └───────────────────┘ └─────────────┘ └─────────────────┘
```

---

## 2. Technology Stack Decisions

### 2.1 Frontend: React + Vite + TypeScript

**Decision**: Use React with Vite as the build tool and TypeScript for type safety.

**Rationale**:
- **Vite**: Lightning-fast HMR (Hot Module Replacement) for rapid development
- **TypeScript**: Catches errors at compile time, improves maintainability
- **React**: Component-based architecture ideal for complex dashboards
- **shadcn/ui + Tailwind CSS**: Consistent, accessible UI components with utility-first styling

**Trade-offs**:
- Slightly larger bundle size than vanilla JS
- Learning curve for TypeScript newcomers

### 2.2 Backend: Hybrid Architecture

**Decision**: Dual backend approach with Lovable Cloud (Supabase) and optional Python/FastAPI.

**Rationale**:
- **Lovable Cloud**: Provides instant database, auth, storage, and edge functions
- **Python Backend**: Required for ML training (PyTorch, YOLOv8) - cannot run in browser
- **Edge Functions**: Lightweight inference proxying to Vision AI

**Architecture Pattern**:
```
Frontend ─┬─► Edge Functions ─► Vision AI (Gemini) [Inference]
          │
          └─► Python Backend (FastAPI) [Training, Model Management]
```

### 2.3 Database: PostgreSQL (via Lovable Cloud)

**Decision**: Use PostgreSQL with Row Level Security (RLS).

**Rationale**:
- ACID compliance for data integrity
- JSON support for flexible schema (metrics, hyperparameters)
- Real-time subscriptions for live dashboard updates
- Built-in security with RLS policies

**Schema Design**:
| Table | Purpose |
|-------|---------|
| `model_versions` | Track model lifecycle, metrics, deployment status |
| `training_batches` | Manage training data batches per phase |
| `inference_logs` | Audit trail of all predictions |
| `drift_alerts` | Monitor data/model drift |
| `pipeline_steps` | Track training pipeline progress |
| `system_status` | Global system state (active model, canary) |

### 2.4 ML Inference: Vision AI (Gemini)

**Decision**: Use Lovable AI integration with Gemini for inference.

**Rationale**:
- No API key management required
- Scalable, managed infrastructure
- Supports image classification out-of-the-box
- Cost-effective for prototyping

**Alternative Considered**: Self-hosted YOLOv8
- Rejected for MVP due to infrastructure complexity
- Can be added later for custom model deployment

---

## 3. Key Architectural Patterns

### 3.1 Continuous Learning Loop

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Phase 1   │────►│   Phase 2    │────►│   Phase 3   │
│  Initial    │     │  Incremental │     │  Refinement │
│  Training   │     │  Learning    │     │  & Tuning   │
└─────────────┘     └──────────────┘     └─────────────┘
       │                   │                    │
       ▼                   ▼                    ▼
   v1.0.0              v1.1.0              v1.2.0
```

**Implementation**:
1. **Data Upload**: Images stored in `training-images` bucket
2. **Batch Processing**: Tracked in `training_batches` table
3. **Pipeline Execution**: Status in `pipeline_steps`
4. **Model Versioning**: Semantic versioning in `model_versions`

### 3.2 Canary Deployment Pattern

**Decision**: Implement simulated canary deployments with configurable traffic splits.

**Flow**:
```
1. New model trained → Status: "canary"
2. Traffic split: 90% production / 10% canary
3. Monitor metrics for X inferences
4. If recall > threshold → Promote to production
5. If recall < threshold → Auto-rollback
```

**Database Support**:
- `model_versions.deployment_status`: production | canary | archived
- `model_versions.traffic_split`: Percentage of traffic
- `system_status.canary_model`: Current canary reference

### 3.3 Real-time Monitoring

**Decision**: Use Supabase Realtime for live dashboard updates.

**Implementation**:
```typescript
supabase
  .channel('dashboard')
  .on('postgres_changes', { event: '*', schema: 'public' }, handler)
  .subscribe()
```

**Benefits**:
- No polling required
- Instant UI updates
- Reduced server load

### 3.4 Active Learning Strategy

**Decision**: Weight samples based on prediction confidence and correctness.

**Weighting Formula**:
```
weight = base_weight * (1 - confidence) * mistake_multiplier
```

| Scenario | Multiplier |
|----------|------------|
| False Positive (defect predicted, actually normal) | 2.0x |
| False Negative (normal predicted, actually defect) | 3.0x |
| Low confidence correct | 1.5x |

---

## 4. Security Decisions

### 4.1 Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:
- Public read access for dashboard visualization
- Authenticated write access for mutations
- Service role bypass for edge functions

### 4.2 Secrets Management

| Secret | Purpose | Storage |
|--------|---------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Edge function DB access | Lovable Secrets |
| `LOVABLE_API_KEY` | Vision AI access | Lovable Secrets |
| `DATABASE_URL` | Python backend connection | Environment variable |

### 4.3 CORS Configuration

```python
# backend/app/main.py
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
```

---

## 5. Scalability Considerations

### 5.1 Current Architecture Limits

| Component | Limit | Mitigation |
|-----------|-------|------------|
| Edge Function timeout | 60s | Async processing for long tasks |
| Database connections | 60 | Connection pooling |
| Storage | 1GB free | Archive old training data |

### 5.2 Future Scaling Path

1. **Horizontal Scaling**: Deploy Python backend to Railway/Render with auto-scaling
2. **Model Serving**: Migrate to dedicated inference server (TorchServe, Triton)
3. **Data Pipeline**: Add Apache Kafka for high-volume inference streaming
4. **Caching**: Redis for model predictions and feature caching

---

## 6. Trade-offs and Alternatives

### 6.1 Decisions Made

| Decision | Alternative | Why Chosen |
|----------|-------------|------------|
| Supabase over Firebase | Firebase | PostgreSQL flexibility, RLS, realtime |
| Edge Functions over Lambda | AWS Lambda | Integrated with Supabase, simpler deployment |
| Vision AI over custom model | Self-hosted YOLO | Faster MVP, no infrastructure management |
| Semantic versioning | Git-based versioning | Clearer model lineage, rollback support |

### 6.2 Technical Debt

1. **Mock Training Pipeline**: Currently simulated, needs real PyTorch integration
2. **Single Database Instance**: No read replicas for heavy analytics
3. **No Model Artifact Storage**: Models stored as paths, not binary blobs

---

## 7. Deployment Architecture

### 7.1 Vercel (Frontend)

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### 7.2 Environment Variables

| Variable | Environment | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Frontend | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | Yes |
| `VITE_API_URL` | Frontend | Optional (Python backend) |
| `DATABASE_URL` | Python Backend | Yes |
| `CORS_ORIGINS` | Python Backend | Yes |

---

## 8. Monitoring and Observability

### 8.1 Metrics Tracked

- **Model Metrics**: Accuracy, Precision, Recall, F1, AUC
- **System Metrics**: Latency, Throughput, Uptime
- **Drift Metrics**: Confidence distribution, prediction distribution

### 8.2 Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Accuracy drop | > 5% | > 10% |
| Latency P95 | > 500ms | > 1000ms |
| Confidence drift | > 0.1 std | > 0.2 std |

---

## 9. Conclusion

This architecture provides a solid foundation for a production ML system with:

- ✅ **Separation of concerns**: Frontend, inference, training clearly separated
- ✅ **Real-time monitoring**: Live dashboard with instant updates
- ✅ **Safe deployments**: Canary pattern with auto-rollback
- ✅ **Continuous learning**: Phase-based training with active learning
- ✅ **Security**: RLS policies and secrets management
- ✅ **Scalability path**: Clear upgrade path for production loads

---

*Document Version: 1.0.0*  
*Last Updated: January 2025*
