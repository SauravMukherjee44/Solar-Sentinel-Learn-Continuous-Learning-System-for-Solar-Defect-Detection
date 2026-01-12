import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { 
  ModelVersion, 
  ModelMetrics,
  TrainingBatch, 
  PipelineStep, 
  InferenceLog, 
  DriftAlert, 
  SystemStatus 
} from '@/types/ml-system';

// Helper to transform database metrics to frontend format
function transformMetrics(m: Record<string, unknown> | null | undefined): ModelMetrics {
  if (!m) {
    return {
      accuracy: 0, recall: 0, precision: 0, falsePositiveRate: 0,
      truePositives: 0, trueNegatives: 0, falsePositives: 0, falseNegatives: 0, f1Score: 0,
    };
  }
  
  const precision = (m.precision as number) || 0;
  const recall = (m.recall as number) || 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  
  return {
    accuracy: (m.accuracy as number) || 0,
    recall,
    precision,
    falsePositiveRate: (m.fpr as number) || 0,
    truePositives: (m.tp as number) || 0,
    trueNegatives: (m.tn as number) || 0,
    falsePositives: (m.fp as number) || 0,
    falseNegatives: (m.fn as number) || 0,
    f1Score: f1,
  };
}

export function useSupabaseBackend() {
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all data from Supabase
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [modelsRes, statusRes, logsRes, alertsRes, batchesRes, stepsRes] = await Promise.all([
        supabase.from('model_versions').select('*').order('created_at', { ascending: true }),
        supabase.from('system_status').select('*').eq('id', 1).single(),
        supabase.from('inference_logs').select('*').order('timestamp', { ascending: false }).limit(100),
        supabase.from('drift_alerts').select('*').order('timestamp', { ascending: false }),
        supabase.from('training_batches').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('pipeline_steps').select('*').order('created_at', { ascending: false }).limit(50),
      ]);

      // Transform models
      if (modelsRes.data) {
        setModels(modelsRes.data.map(m => ({
          id: m.id,
          version: m.version,
          trainingDate: new Date(m.training_date),
          datasetVersion: m.dataset_version,
          batchVersion: m.batch_version || '',
          hyperparameters: m.hyperparameters as ModelVersion['hyperparameters'] || {
            learningRate: 0.001, epochs: 50, batchSize: 32, optimizer: 'adam'
          },
          metrics: transformMetrics(m.metrics as Record<string, unknown>),
          deploymentStatus: m.deployment_status as ModelVersion['deploymentStatus'],
          trafficSplit: m.traffic_split || 0,
        })));
      }

      // Transform system status
      if (statusRes.data) {
        setSystemStatus({
          isTraining: statusRes.data.is_training,
          activeModel: statusRes.data.active_model,
          canaryModel: statusRes.data.canary_model || undefined,
          currentPhase: statusRes.data.current_phase,
          totalInferences: statusRes.data.total_inferences,
          avgLatency: statusRes.data.avg_latency,
          uptime: statusRes.data.uptime,
        });
      }

      // Transform inference logs
      if (logsRes.data) {
        setInferenceLogs(logsRes.data.map(l => ({
          id: l.id,
          imageId: l.image_id,
          modelVersion: l.model_version,
          prediction: l.prediction as 'normal' | 'defect',
          confidence: l.confidence,
          actualLabel: l.actual_label as 'normal' | 'defect' | undefined,
          latencyMs: l.latency_ms,
          timestamp: new Date(l.timestamp),
          isCorrect: l.is_correct ?? undefined,
        })));
      }

      // Transform drift alerts
      if (alertsRes.data) {
        setDriftAlerts(alertsRes.data.map(a => ({
          id: a.id,
          type: a.alert_type as DriftAlert['type'],
          severity: a.severity as 'warning' | 'critical',
          message: a.message,
          currentValue: a.current_value,
          threshold: a.threshold,
          timestamp: new Date(a.timestamp),
          acknowledged: a.acknowledged,
        })));
      }

      // Transform batches
      if (batchesRes.data) {
        setBatches(batchesRes.data.map(b => ({
          id: b.id,
          phase: b.phase,
          uploadDate: new Date(b.upload_date),
          totalImages: b.total_images,
          normalImages: b.normal_images,
          defectImages: b.defect_images,
          status: b.status as TrainingBatch['status'],
          analysisResults: b.analysis_results as TrainingBatch['analysisResults'],
        })));
      }

      // Transform pipeline steps - only show steps for the most recent batch
      if (stepsRes.data && batchesRes.data && batchesRes.data.length > 0) {
        const latestBatchId = batchesRes.data[0].id;
        const latestBatchSteps = stepsRes.data
          .filter(s => s.batch_id === latestBatchId)
          .sort((a, b) => a.step_order - b.step_order);
        
        setPipelineSteps(latestBatchSteps.map(s => ({
          id: s.id,
          name: s.step_name,
          status: s.status as PipelineStep['status'],
          startTime: s.start_time ? new Date(s.start_time) : undefined,
          endTime: s.end_time ? new Date(s.end_time) : undefined,
          details: s.details || undefined,
          progress: s.progress || 0,
        })));
      } else if (stepsRes.data) {
        setPipelineSteps([]);
      }

    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load data from database');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Setup realtime subscriptions
  useEffect(() => {
    fetchData();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('ml-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'model_versions' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_status' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_steps' }, (payload) => {
        if (payload.new) {
          const s = payload.new as Record<string, unknown>;
          setPipelineSteps(prev => {
            const existing = prev.find(p => p.id === s.id);
            if (existing) {
              return prev.map(p => p.id === s.id ? {
                ...p,
                status: s.status as PipelineStep['status'],
                progress: s.progress as number || 0,
              } : p);
            }
            return [...prev, {
              id: s.id as string,
              name: s.step_name as string,
              status: s.status as PipelineStep['status'],
              progress: s.progress as number || 0,
            }];
          });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inference_logs' }, (payload) => {
        if (payload.new) {
          const l = payload.new as Record<string, unknown>;
          const newLog: InferenceLog = {
            id: l.id as string,
            imageId: l.image_id as string,
            modelVersion: l.model_version as string,
            prediction: l.prediction as 'normal' | 'defect',
            confidence: l.confidence as number,
            latencyMs: l.latency_ms as number,
            timestamp: new Date(l.timestamp as string),
          };
          setInferenceLogs(prev => [newLog, ...prev.slice(0, 99)]);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drift_alerts' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Upload batch and trigger pipeline
  const uploadBatch = useCallback(async (
    phase: number,
    totalImages: number,
    normalImages: number,
    defectImages: number
  ) => {
    try {
      // Clear previous pipeline steps
      setPipelineSteps([]);
      
      // Call edge function to start pipeline with correct path
      const { data, error } = await supabase.functions.invoke('ml-pipeline/upload-batch', {
        body: {
          phase,
          totalImages,
          normalImages,
          defectImages,
        }
      });

      if (error) throw error;
      
      // Refetch to get the new batch and steps
      setTimeout(() => fetchData(), 500);
      
      return data;
    } catch (err) {
      console.error('Failed to upload batch:', err);
      throw err;
    }
  }, [fetchData]);

  // Promote canary to production
  const promoteCanary = useCallback(async (modelId: string) => {
    try {
      // Archive current deployed model
      await supabase
        .from('model_versions')
        .update({ deployment_status: 'archived', traffic_split: 0 })
        .eq('deployment_status', 'deployed');

      // Promote canary
      await supabase
        .from('model_versions')
        .update({ deployment_status: 'deployed', traffic_split: 100 })
        .eq('id', modelId);

      // Get the model version
      const { data: model } = await supabase
        .from('model_versions')
        .select('version')
        .eq('id', modelId)
        .single();

      // Update system status
      await supabase
        .from('system_status')
        .update({ active_model: model?.version, canary_model: null })
        .eq('id', 1);

      fetchData();
    } catch (err) {
      console.error('Failed to promote canary:', err);
      throw err;
    }
  }, [fetchData]);

  // Rollback to previous model
  const rollbackModel = useCallback(async (modelId: string) => {
    try {
      // Get target model
      const { data: targetModel } = await supabase
        .from('model_versions')
        .select('*')
        .eq('id', modelId)
        .single();

      if (!targetModel) throw new Error('Model not found');

      const metrics = targetModel.metrics as Record<string, number>;
      if (metrics.recall < 0.95) {
        throw new Error(`Rollback blocked: Recall ${(metrics.recall * 100).toFixed(1)}% below 95%`);
      }

      // Mark current deployed as rolled-back
      await supabase
        .from('model_versions')
        .update({ deployment_status: 'rolled-back', traffic_split: 0 })
        .eq('deployment_status', 'deployed');

      // Deploy target model
      await supabase
        .from('model_versions')
        .update({ deployment_status: 'deployed', traffic_split: 100 })
        .eq('id', modelId);

      // Update system status
      await supabase
        .from('system_status')
        .update({ active_model: targetModel.version, canary_model: null })
        .eq('id', 1);

      fetchData();
    } catch (err) {
      console.error('Failed to rollback:', err);
      throw err;
    }
  }, [fetchData]);

  // Acknowledge alert
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      await supabase
        .from('drift_alerts')
        .update({ acknowledged: true })
        .eq('id', alertId);

      setDriftAlerts(prev =>
        prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a)
      );
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
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
    isLoading,
    error,
    
    // Actions
    uploadBatch,
    promoteCanary,
    rollbackModel,
    acknowledgeAlert,
    refetch: fetchData,
  };
}