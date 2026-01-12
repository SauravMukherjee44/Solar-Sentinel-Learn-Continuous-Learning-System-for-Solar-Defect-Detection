import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = "https://knbllefougsxnyrkucnq.supabase.co";

export const mlPipelineApi = {
  // Get system status
  getStatus: async () => {
    const { data, error } = await supabase.from('system_status').select('*').single();
    if (error) throw error;
    return data;
  },

  // Get all models
  getModels: async () => {
    const { data, error } = await supabase
      .from('model_versions')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  // Get inference logs
  getLogs: async (limit = 100) => {
    const { data, error } = await supabase
      .from('inference_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  // Get drift alerts
  getAlerts: async () => {
    const { data, error } = await supabase
      .from('drift_alerts')
      .select('*')
      .order('timestamp', { ascending: false });
    if (error) throw error;
    return data;
  },

  // Upload batch - triggers training pipeline
  uploadBatch: async (phase: number, totalImages: number, normalImages: number, defectImages: number) => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ml-pipeline/upload-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase, totalImages, normalImages, defectImages }),
    });
    return response.json();
  },

  // Promote canary to production
  promoteCanary: async (modelId: string) => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ml-pipeline/promote-canary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId }),
    });
    return response.json();
  },

  // Acknowledge alert
  acknowledgeAlert: async (alertId: string) => {
    const { error } = await supabase
      .from('drift_alerts')
      .update({ acknowledged: true })
      .eq('id', alertId);
    if (error) throw error;
  },

  // Simulate inference (for testing)
  simulateInference: async () => {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/simulate-inference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  },
};

// Real-time subscriptions
export const subscribeToUpdates = (callbacks: {
  onModelUpdate?: (payload: unknown) => void;
  onStatusUpdate?: (payload: unknown) => void;
  onLogUpdate?: (payload: unknown) => void;
  onAlertUpdate?: (payload: unknown) => void;
}) => {
  const channel = supabase
    .channel('ml-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'model_versions' }, 
      payload => callbacks.onModelUpdate?.(payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'system_status' }, 
      payload => callbacks.onStatusUpdate?.(payload))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inference_logs' }, 
      payload => callbacks.onLogUpdate?.(payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'drift_alerts' }, 
      payload => callbacks.onAlertUpdate?.(payload))
    .subscribe();

  return () => supabase.removeChannel(channel);
};
