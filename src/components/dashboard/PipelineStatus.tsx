import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { PipelineStep } from '@/types/ml-system';

interface PipelineStatusProps {
  steps: PipelineStep[];
  isTraining: boolean;
}

export function PipelineStatus({ steps, isTraining }: PipelineStatusProps) {
  const getStepIcon = (status: PipelineStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (steps.length === 0 && !isTraining) {
    return (
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">Training Pipeline</h2>
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <div className="text-center">
            <Circle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No active training</p>
            <p className="text-xs mt-1">Upload a batch to start</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Training Pipeline</h2>
        {isTraining && (
          <div className="flex items-center gap-2 text-xs text-primary">
            <div className="status-indicator training" />
            <span>In Progress</span>
          </div>
        )}
      </div>

      <div className="space-y-1">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`pipeline-step ${step.status}`}
          >
            <div className="absolute left-[-13px] top-0">
              {getStepIcon(step.status)}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${
                  step.status === 'running' ? 'text-primary' : 
                  step.status === 'completed' ? 'text-foreground' : 
                  'text-muted-foreground'
                }`}>
                  {step.name}
                </p>
                {step.details && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {step.details}
                  </p>
                )}
              </div>
              {step.status === 'running' && step.progress !== undefined && (
                <span className="text-xs font-mono text-primary">
                  {step.progress}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {steps.every(s => s.status === 'completed') && (
        <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-lg">
          <p className="text-sm text-success font-medium">
            ✓ Pipeline completed successfully
          </p>
          <p className="text-xs text-success/80 mt-1">
            New model ready for canary deployment
          </p>
        </div>
      )}
    </div>
  );
}
