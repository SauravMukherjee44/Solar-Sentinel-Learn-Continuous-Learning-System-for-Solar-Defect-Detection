import { useState, useEffect, useCallback } from 'react';
import {
  ModelVersion,
  TrainingBatch,
  PipelineStep,
  InferenceLog,
  DriftAlert,
  SystemStatus,
} from '@/types/ml-system';

// Simulated initial data
const initialModels: ModelVersion[] = [
  {
    id: 'model-0',
    version: 'v1.0.0',
    trainingDate: new Date('2024-01-15'),
    datasetVersion: 'phase-0',
    batchVersion: 'baseline',
    hyperparameters: {
      learningRate: 0.001,
      epochs: 10,
      batchSize: 32,
      optimizer: 'Adam',
    },
    metrics: {
      accuracy: 0.923,
      recall: 0.961,
      precision: 0.894,
      falsePositiveRate: 0.082,
      truePositives: 485,
      trueNegatives: 892,
      falsePositives: 58,
      falseNegatives: 20,
      f1Score: 0.926,
    },
    deploymentStatus: 'deployed',
    trafficSplit: 100,
  },
];

const generateInferenceLogs = (count: number, modelVersion: string): InferenceLog[] => {
  const logs: InferenceLog[] = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const isDefect = Math.random() > 0.4;
    const prediction = isDefect ? 'defect' : 'normal';
    const actualLabel = Math.random() > 0.08 ? prediction : (isDefect ? 'normal' : 'defect');
    
    logs.push({
      id: `log-${i}`,
      imageId: `img-${Math.random().toString(36).substr(2, 9)}`,
      modelVersion,
      prediction,
      confidence: 0.7 + Math.random() * 0.28,
      actualLabel,
      latencyMs: 15 + Math.random() * 40,
      timestamp: new Date(now - Math.random() * 3600000),
      isCorrect: prediction === actualLabel,
    });
  }
  
  return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

export function useMLSystem() {
  const [models, setModels] = useState<ModelVersion[]>(initialModels);
  const [batches, setBatches] = useState<TrainingBatch[]>([]);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [inferenceLogs, setInferenceLogs] = useState<InferenceLog[]>(() => 
    generateInferenceLogs(50, 'v1.0.0')
  );
  const [driftAlerts, setDriftAlerts] = useState<DriftAlert[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    isTraining: false,
    currentPhase: 0,
    activeModel: 'v1.0.0',
    totalInferences: 15847,
    avgLatency: 32.4,
    uptime: 99.97,
  });

  // Simulate real-time inference logs
  useEffect(() => {
    const interval = setInterval(() => {
      if (!systemStatus.isTraining) {
        const newLog: InferenceLog = {
          id: `log-${Date.now()}`,
          imageId: `img-${Math.random().toString(36).substr(2, 9)}`,
          modelVersion: systemStatus.activeModel,
          prediction: Math.random() > 0.4 ? 'defect' : 'normal',
          confidence: 0.75 + Math.random() * 0.23,
          latencyMs: 18 + Math.random() * 35,
          timestamp: new Date(),
        };
        
        setInferenceLogs(prev => [newLog, ...prev.slice(0, 99)]);
        setSystemStatus(prev => ({
          ...prev,
          totalInferences: prev.totalInferences + 1,
          avgLatency: (prev.avgLatency * 0.99) + (newLog.latencyMs * 0.01),
        }));
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [systemStatus.isTraining, systemStatus.activeModel]);

  const startTrainingPipeline = useCallback(async (batch: TrainingBatch) => {
    const steps: PipelineStep[] = [
      { id: 'ingest', name: 'Ingesting batch data', status: 'pending' },
      { id: 'inference', name: 'Running inference on new data', status: 'pending' },
      { id: 'analysis', name: 'Analyzing model mistakes', status: 'pending' },
      { id: 'training', name: 'Training corrected model', status: 'pending' },
      { id: 'evaluation', name: 'Evaluating new model', status: 'pending' },
      { id: 'deployment', name: 'Safe deployment with canary', status: 'pending' },
    ];

    setPipelineSteps(steps);
    setSystemStatus(prev => ({ ...prev, isTraining: true }));

    // Simulate pipeline execution
    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
      
      setPipelineSteps(prev => prev.map((step, idx) => {
        if (idx < i) return { ...step, status: 'completed' };
        if (idx === i) {
          let details = '';
          if (step.id === 'inference') {
            details = `Processing ${batch.totalImages} images...`;
          } else if (step.id === 'analysis') {
            const fps = Math.floor(batch.totalImages * 0.08);
            const fns = Math.floor(batch.totalImages * 0.04);
            details = `Found ${fps} false positives, ${fns} false negatives`;
          } else if (step.id === 'training') {
            details = `Epoch ${Math.floor(Math.random() * 10) + 1}/10`;
          }
          return { ...step, status: 'running', startTime: new Date(), details };
        }
        return step;
      }));

      // Update batch status
      setBatches(prev => prev.map(b => 
        b.id === batch.id 
          ? { ...b, status: i === 0 ? 'ingested' : i === 2 ? 'analyzed' : i === 3 ? 'training' : b.status }
          : b
      ));
    }

    // Complete pipeline
    setPipelineSteps(prev => prev.map(step => ({ ...step, status: 'completed', endTime: new Date() })));

    // Create new model version
    const newVersion = `v1.${models.length}.0`;
    const newModel: ModelVersion = {
      id: `model-${models.length}`,
      version: newVersion,
      trainingDate: new Date(),
      datasetVersion: `phase-${batch.phase}`,
      batchVersion: batch.id,
      hyperparameters: {
        learningRate: 0.0008,
        epochs: 10,
        batchSize: 32,
        optimizer: 'Adam',
      },
      metrics: {
        accuracy: Math.min(0.98, models[models.length - 1].metrics.accuracy + 0.015 + Math.random() * 0.02),
        recall: Math.max(0.95, 0.96 + Math.random() * 0.03),
        precision: Math.min(0.97, models[models.length - 1].metrics.precision + 0.02 + Math.random() * 0.02),
        falsePositiveRate: Math.max(0.02, models[models.length - 1].metrics.falsePositiveRate - 0.015 - Math.random() * 0.01),
        truePositives: 495 + Math.floor(Math.random() * 10),
        trueNegatives: 920 + Math.floor(Math.random() * 20),
        falsePositives: Math.max(10, 58 - models.length * 10 - Math.floor(Math.random() * 5)),
        falseNegatives: Math.max(8, 20 - models.length * 3),
        f1Score: 0,
      },
      deploymentStatus: 'canary',
      trafficSplit: 10,
    };
    newModel.metrics.f1Score = 2 * (newModel.metrics.precision * newModel.metrics.recall) / 
      (newModel.metrics.precision + newModel.metrics.recall);

    // Update previous model to 90% traffic
    setModels(prev => [
      ...prev.map(m => m.deploymentStatus === 'deployed' ? { ...m, trafficSplit: 90 } : m),
      newModel,
    ]);

    setBatches(prev => prev.map(b => 
      b.id === batch.id ? { ...b, status: 'completed' } : b
    ));

    setSystemStatus(prev => ({
      ...prev,
      isTraining: false,
      currentPhase: batch.phase,
      canaryModel: newVersion,
    }));

    // Check for deployment promotion after delay
    setTimeout(() => {
      if (newModel.metrics.recall >= 0.95 && newModel.metrics.accuracy > models[models.length - 1].metrics.accuracy) {
        promoteCanary(newModel.id);
      }
    }, 5000);

  }, [models]);

  const promoteCanary = useCallback((modelId: string) => {
    setModels(prev => prev.map(m => {
      if (m.id === modelId) {
        return { ...m, deploymentStatus: 'deployed', trafficSplit: 100 };
      }
      if (m.deploymentStatus === 'deployed') {
        return { ...m, deploymentStatus: 'archived', trafficSplit: 0 };
      }
      return m;
    }));

    const model = models.find(m => m.id === modelId);
    if (model) {
      setSystemStatus(prev => ({
        ...prev,
        activeModel: model.version,
        canaryModel: undefined,
      }));
    }
  }, [models]);

  const rollbackModel = useCallback((modelId: string) => {
    const targetModel = models.find(m => m.id === modelId);
    if (!targetModel) return;

    // Safety check: recall must be >= 95%
    if (targetModel.metrics.recall < 0.95) {
      console.warn('Rollback blocked: Recall below 95%');
      return;
    }

    setModels(prev => prev.map(m => {
      if (m.id === modelId) {
        return { ...m, deploymentStatus: 'deployed', trafficSplit: 100 };
      }
      if (m.deploymentStatus === 'deployed') {
        return { ...m, deploymentStatus: 'rolled-back' as const, trafficSplit: 0 };
      }
      return m;
    }));

    setSystemStatus(prev => ({
      ...prev,
      activeModel: targetModel.version,
      canaryModel: undefined,
    }));
  }, [models]);

  const uploadBatch = useCallback((phase: number, totalImages: number, normalImages: number, defectImages: number) => {
    const newBatch: TrainingBatch = {
      id: `batch-${Date.now()}`,
      phase,
      uploadDate: new Date(),
      totalImages,
      normalImages,
      defectImages,
      status: 'pending',
    };

    setBatches(prev => [...prev, newBatch]);
    
    // Auto-start pipeline
    setTimeout(() => startTrainingPipeline(newBatch), 1000);

    return newBatch;
  }, [startTrainingPipeline]);

  const addDriftAlert = useCallback((alert: Omit<DriftAlert, 'id' | 'timestamp' | 'acknowledged'>) => {
    const newAlert: DriftAlert = {
      ...alert,
      id: `alert-${Date.now()}`,
      timestamp: new Date(),
      acknowledged: false,
    };
    setDriftAlerts(prev => [newAlert, ...prev]);
  }, []);

  const acknowledgeAlert = useCallback((alertId: string) => {
    setDriftAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, acknowledged: true } : a
    ));
  }, []);

  return {
    models,
    batches,
    pipelineSteps,
    inferenceLogs,
    driftAlerts,
    systemStatus,
    uploadBatch,
    startTrainingPipeline,
    promoteCanary,
    rollbackModel,
    addDriftAlert,
    acknowledgeAlert,
  };
}
