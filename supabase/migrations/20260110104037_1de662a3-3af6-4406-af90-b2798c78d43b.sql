-- Model versions table for semantic versioning
CREATE TABLE public.model_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  training_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  dataset_version TEXT NOT NULL,
  batch_version TEXT,
  hyperparameters JSONB NOT NULL DEFAULT '{}',
  metrics JSONB NOT NULL DEFAULT '{}',
  deployment_status TEXT NOT NULL DEFAULT 'archived' CHECK (deployment_status IN ('deployed', 'canary', 'archived', 'rolled-back')),
  traffic_split INTEGER DEFAULT 0,
  model_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Training batches table
CREATE TABLE public.training_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phase INTEGER NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_images INTEGER NOT NULL DEFAULT 0,
  normal_images INTEGER NOT NULL DEFAULT 0,
  defect_images INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ingested', 'analyzed', 'training', 'completed', 'failed')),
  analysis_results JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Pipeline steps table for tracking training progress
CREATE TABLE public.pipeline_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES public.training_batches(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  details TEXT,
  progress INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inference logs for monitoring
CREATE TABLE public.inference_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_id TEXT NOT NULL,
  model_version TEXT NOT NULL,
  prediction TEXT NOT NULL CHECK (prediction IN ('normal', 'defect')),
  confidence REAL NOT NULL,
  actual_label TEXT CHECK (actual_label IN ('normal', 'defect')),
  latency_ms REAL NOT NULL,
  is_correct BOOLEAN,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Drift alerts for monitoring
CREATE TABLE public.drift_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('brightness', 'accuracy', 'fpr', 'latency')),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  message TEXT NOT NULL,
  current_value REAL NOT NULL,
  threshold REAL NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- System status table (single row)
CREATE TABLE public.system_status (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_training BOOLEAN NOT NULL DEFAULT false,
  current_phase INTEGER NOT NULL DEFAULT 0,
  active_model TEXT NOT NULL DEFAULT 'v1.0.0',
  canary_model TEXT,
  total_inferences BIGINT NOT NULL DEFAULT 0,
  avg_latency REAL NOT NULL DEFAULT 0,
  uptime REAL NOT NULL DEFAULT 99.97,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert initial system status
INSERT INTO public.system_status (id, is_training, current_phase, active_model, total_inferences, avg_latency, uptime)
VALUES (1, false, 0, 'v1.0.0', 0, 0, 99.97);

-- Insert baseline model
INSERT INTO public.model_versions (version, training_date, dataset_version, batch_version, hyperparameters, metrics, deployment_status, traffic_split)
VALUES (
  'v1.0.0',
  now(),
  'phase-0',
  'baseline',
  '{"learningRate": 0.001, "epochs": 10, "batchSize": 32, "optimizer": "Adam"}',
  '{"accuracy": 0.923, "recall": 0.961, "precision": 0.894, "falsePositiveRate": 0.082, "truePositives": 485, "trueNegatives": 892, "falsePositives": 58, "falseNegatives": 20, "f1Score": 0.926}',
  'deployed',
  100
);

-- Enable RLS on all tables
ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inference_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drift_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_status ENABLE ROW LEVEL SECURITY;

-- Public read policies (this is a monitoring dashboard, data is not user-specific)
CREATE POLICY "Allow public read on model_versions" ON public.model_versions FOR SELECT USING (true);
CREATE POLICY "Allow public read on training_batches" ON public.training_batches FOR SELECT USING (true);
CREATE POLICY "Allow public read on pipeline_steps" ON public.pipeline_steps FOR SELECT USING (true);
CREATE POLICY "Allow public read on inference_logs" ON public.inference_logs FOR SELECT USING (true);
CREATE POLICY "Allow public read on drift_alerts" ON public.drift_alerts FOR SELECT USING (true);
CREATE POLICY "Allow public read on system_status" ON public.system_status FOR SELECT USING (true);

-- Service role insert/update policies for edge functions
CREATE POLICY "Allow service insert on model_versions" ON public.model_versions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update on model_versions" ON public.model_versions FOR UPDATE USING (true);
CREATE POLICY "Allow service insert on training_batches" ON public.training_batches FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update on training_batches" ON public.training_batches FOR UPDATE USING (true);
CREATE POLICY "Allow service insert on pipeline_steps" ON public.pipeline_steps FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update on pipeline_steps" ON public.pipeline_steps FOR UPDATE USING (true);
CREATE POLICY "Allow service insert on inference_logs" ON public.inference_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service insert on drift_alerts" ON public.drift_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update on drift_alerts" ON public.drift_alerts FOR UPDATE USING (true);
CREATE POLICY "Allow service update on system_status" ON public.system_status FOR UPDATE USING (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.model_versions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.training_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inference_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drift_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_status;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_model_versions_updated_at BEFORE UPDATE ON public.model_versions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_training_batches_updated_at BEFORE UPDATE ON public.training_batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_system_status_updated_at BEFORE UPDATE ON public.system_status FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();