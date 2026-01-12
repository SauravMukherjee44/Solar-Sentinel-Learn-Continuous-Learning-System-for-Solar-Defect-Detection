import { useState, useEffect, useCallback, useRef } from 'react';
import { pythonApi, subscribeToUpdates } from '@/lib/python-api';
import type { 
  ModelVersion, 
  ModelMetrics,
  TrainingBatch, 
  PipelineStep, 
  InferenceLog, 
  DriftAlert, 
  SystemStatus 
} from '@/types/ml-system';

// Helper to transform backend metrics to frontend format
function transformMetrics(m: Record<string, unknown> | null | undefined): ModelMetrics {
  if (!m) {
    return {
      accuracy: 0,
      recall: 0,
      precision: 0,
      falsePositiveRate: 0,
      truePositives: 0,
      trueNegatives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      f1Score: 0,
    };
  }
  
  const precision = (m.precision as number) || 0;
  const recall = (m.recall as number) || 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  
  return {
    accuracy: (m.accuracy as number) || 0,
    recall: recall,
    precision: precision,
    falsePositiveRate: (m.fpr as number) || 0,
    truePositives: (m.tp as number) || 0,
    trueNegatives: (m.tn as number) || 0,
    falsePositives: (m.fp as number) || 0,
    falseNegatives: (m.fn as number) || 0,
    f1Score: f1,
  };
}

export function usePythonBackend() {
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [batches, setBatches] = useState<TrainingBatch[]>([]);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [inferenceLogs, setInferenceLogs] = useState<InferenceLog[]>([]);
  const [driftAlerts, setDriftAlerts] = useState<DriftAlert[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    isTraining: false,
    activeModel: 'v1.0.0',
    canaryModel: null,
    currentPhase: 0,
    totalInferences: 0,
    avgLatency: 0,
    uptime: 99.97,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Fetch all initial data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [statusData, modelsData, logsData, alertsData] = await Promise.all([
        pythonApi.getStatus(),
        pythonApi.getModels(),
        pythonApi.getLogs(100),
        pythonApi.getAlerts(),
      ]);

      // Transform status data
      setSystemStatus({
        isTraining: statusData.is_training,
        activeModel: statusData.active_model,
        canaryModel: statusData.canary_model,
        currentPhase: statusData.current_phase,
        totalInferences: statusData.total_inferences,
        avgLatency: statusData.avg_latency,
        uptime: statusData.uptime,
      });

      // Transform models data
      setModels(modelsData.map((m: Record<string, unknown>) => ({
        id: m.id as string,
        version: m.version as string,
        datasetVersion: m.dataset_version as string,
        batchVersion: (m.batch_version as string) || '',
        deploymentStatus: m.deployment_status as 'deployed' | 'canary' | 'archived',
        trafficSplit: (m.traffic_split as number) || 0,
        trainingDate: new Date(m.training_date as string),
        hyperparameters: (m.hyperparameters as ModelVersion['hyperparameters']) || {
          learningRate: 0.001,
          epochs: 50,
          batchSize: 32,
          optimizer: 'adam',
        },
        metrics: transformMetrics(m.metrics as Record<string, unknown>),
      })));

      // Transform logs data
      setInferenceLogs(logsData.map((l: Record<string, unknown>) => ({
        id: l.id as string,
        imageId: l.image_id as string,
        prediction: l.prediction as 'normal' | 'defect',
        confidence: l.confidence as number,
        latencyMs: l.latency_ms as number,
        modelVersion: l.model_version as string,
        timestamp: new Date(l.timestamp as string),
      })));

      // Transform alerts data
      setDriftAlerts(alertsData.map((a: Record<string, unknown>) => {
        const alertType = a.alert_type as string;
        const mappedType: DriftAlert['type'] = 
          alertType === 'latency' ? 'latency' :
          alertType === 'accuracy' ? 'accuracy' :
          alertType === 'brightness' ? 'brightness' : 'fpr';
        
        return {
          id: a.id as string,
          type: mappedType,
          severity: a.severity as 'warning' | 'critical',
          message: a.message as string,
          currentValue: a.current_value as number,
          threshold: a.threshold as number,
          acknowledged: a.acknowledged as boolean,
          timestamp: new Date(a.timestamp as string),
        };
      }));

    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to connect to backend. Make sure the Python server is running.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Setup real-time subscription
  useEffect(() => {
    fetchData();

    unsubscribeRef.current = subscribeToUpdates({
      onModelUpdate: (data) => {
        console.log('Model update:', data);
        // Refetch models on update
        pythonApi.getModels().then(modelsData => {
          setModels(modelsData.map((m: Record<string, unknown>) => ({
            id: m.id,
            version: m.version,
            datasetVersion: m.dataset_version,
            deploymentStatus: m.deployment_status as 'deployed' | 'canary' | 'archived',
            trafficSplit: m.traffic_split || 0,
            trainingDate: m.training_date,
            metrics: m.metrics as ModelVersion['metrics'],
          })));
        });
      },
      onStatusUpdate: (data) => {
        console.log('Status update:', data);
        const d = data as Record<string, unknown>;
        setSystemStatus(prev => ({
          ...prev,
          isTraining: d.is_training !== undefined ? d.is_training as boolean : prev.isTraining,
          canaryModel: d.canary_model !== undefined ? d.canary_model as string | null : prev.canaryModel,
        }));
      },
      onLogUpdate: (data) => {
        console.log('Log update:', data);
        const l = data as Record<string, unknown>;
        const newLog: InferenceLog = {
          id: l.id as string,
          imageId: l.image_id as string,
          prediction: l.prediction as 'normal' | 'defect',
          confidence: l.confidence as number,
          latencyMs: l.latency_ms as number,
          modelVersion: l.model_version as string,
          timestamp: new Date(l.timestamp as string),
        };
        setInferenceLogs(prev => [newLog, ...prev.slice(0, 99)]);
        setSystemStatus(prev => ({
          ...prev,
          totalInferences: prev.totalInferences + 1,
        }));
      },
      onAlertUpdate: (data) => {
        console.log('Alert update:', data);
        const a = data as Record<string, unknown>;
        if (a.acknowledged) {
          setDriftAlerts(prev => 
            prev.map(alert => alert.id === a.id ? { ...alert, acknowledged: true } : alert)
          );
        } else {
          const alertType = a.alert_type as string;
          const mappedType: DriftAlert['type'] = 
            alertType === 'latency' ? 'latency' :
            alertType === 'accuracy' ? 'accuracy' :
            alertType === 'brightness' ? 'brightness' : 'fpr';
          
          const newAlert: DriftAlert = {
            id: a.id as string,
            type: mappedType,
            severity: a.severity as 'warning' | 'critical',
            message: a.message as string,
            currentValue: a.current_value as number,
            threshold: a.threshold as number,
            acknowledged: false,
            timestamp: new Date(a.timestamp as string),
          };
          setDriftAlerts(prev => [newAlert, ...prev]);
        }
      },
      onPipelineUpdate: (data) => {
        console.log('Pipeline update:', data);
        const p = data as Record<string, unknown>;
        setPipelineSteps(prev => {
          const existing = prev.find(s => s.id === p.id);
          if (existing) {
            return prev.map(s => s.id === p.id ? {
              ...s,
              status: p.status as PipelineStep['status'],
              progress: p.progress as number,
            } : s);
          }
          return [...prev, {
            id: p.id as string,
            name: p.step_name as string,
            status: p.status as PipelineStep['status'],
            progress: p.progress as number,
          }];
        });
      },
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [fetchData]);

  // Upload batch
  const uploadBatch = useCallback(async (
    phase: number,
    totalImages: number,
    normalImages: number,
    defectImages: number
  ) => {
    try {
      const result = await pythonApi.uploadBatch(phase, totalImages, normalImages, defectImages);
      
      // Clear previous pipeline steps
      setPipelineSteps([]);
      
      // Update system status
      setSystemStatus(prev => ({
        ...prev,
        isTraining: true,
        currentPhase: phase,
      }));
      
      return result;
    } catch (err) {
      console.error('Failed to upload batch:', err);
      throw err;
    }
  }, []);

  // Promote canary
  const promoteCanary = useCallback(async (modelId: string) => {
    try {
      await pythonApi.promoteCanary(modelId);
      // Refetch models and status
      fetchData();
    } catch (err) {
      console.error('Failed to promote canary:', err);
      throw err;
    }
  }, [fetchData]);

  // Rollback to previous model
  const rollbackModel = useCallback(async (modelId: string) => {
    try {
      const result = await pythonApi.rollbackModel(modelId);
      // Refetch models and status
      fetchData();
      return result;
    } catch (err) {
      console.error('Failed to rollback model:', err);
      throw err;
    }
  }, [fetchData]);

  // Acknowledge alert
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      await pythonApi.acknowledgeAlert(alertId);
      setDriftAlerts(prev =>
        prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a)
      );
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
      throw err;
    }
  }, []);

  // Simulate inference
  const simulateInference = useCallback(async () => {
    try {
      return await pythonApi.simulateInference();
    } catch (err) {
      console.error('Failed to simulate inference:', err);
      throw err;
    }
  }, []);

  return {
    // State
    models,
    batches,
    pipelineSteps,
    inferenceLogs,
    driftAlerts,
    systemStatus,
    isConnected,
    isLoading,
    error,
    
    // Actions
    uploadBatch,
    promoteCanary,
    rollbackModel,
    acknowledgeAlert,
    simulateInference,
    refetch: fetchData,
  };
}
