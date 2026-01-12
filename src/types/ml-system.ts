export interface ModelVersion {
  id: string;
  version: string;
  trainingDate: Date;
  datasetVersion: string;
  batchVersion: string;
  hyperparameters: {
    learningRate: number;
    epochs: number;
    batchSize: number;
    optimizer: string;
  };
  metrics: ModelMetrics;
  deploymentStatus: 'deployed' | 'canary' | 'archived' | 'rolled-back';
  trafficSplit?: number;
}

export interface ModelMetrics {
  accuracy: number;
  recall: number;
  precision: number;
  falsePositiveRate: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  f1Score: number;
}

export interface TrainingBatch {
  id: string;
  phase: number;
  uploadDate: Date;
  totalImages: number;
  normalImages: number;
  defectImages: number;
  status: 'pending' | 'ingested' | 'analyzed' | 'training' | 'completed' | 'failed';
  analysisResults?: {
    falsePositives: number;
    falseNegatives: number;
    correctPredictions: number;
  };
}

export interface PipelineStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  details?: string;
  progress?: number;
}

export interface InferenceLog {
  id: string;
  imageId: string;
  modelVersion: string;
  prediction: 'normal' | 'defect';
  confidence: number;
  actualLabel?: 'normal' | 'defect';
  latencyMs: number;
  timestamp: Date;
  isCorrect?: boolean;
}

export interface DriftAlert {
  id: string;
  type: 'brightness' | 'accuracy' | 'fpr' | 'latency';
  severity: 'warning' | 'critical';
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
}

export interface SystemStatus {
  isTraining: boolean;
  currentPhase: number;
  activeModel: string;
  canaryModel?: string;
  totalInferences: number;
  avgLatency: number;
  uptime: number;
}
