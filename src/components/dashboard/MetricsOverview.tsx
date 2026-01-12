import { TrendingUp, TrendingDown, Target, ShieldCheck, AlertTriangle, Timer } from 'lucide-react';
import { ModelVersion, SystemStatus } from '@/types/ml-system';

interface MetricsOverviewProps {
  models: ModelVersion[];
  systemStatus: SystemStatus;
}

export function MetricsOverview({ models, systemStatus }: MetricsOverviewProps) {
  const activeModel = models.find(m => m.deploymentStatus === 'deployed');
  const previousModel = models.length > 1 ? models[models.length - 2] : null;

  const metrics = [
    {
      label: 'Accuracy',
      value: activeModel?.metrics.accuracy ?? 0,
      format: (v: number) => `${(v * 100).toFixed(1)}%`,
      change: previousModel 
        ? ((activeModel?.metrics.accuracy ?? 0) - previousModel.metrics.accuracy) * 100
        : 0,
      icon: Target,
      color: 'primary',
    },
    {
      label: 'Recall',
      value: activeModel?.metrics.recall ?? 0,
      format: (v: number) => `${(v * 100).toFixed(1)}%`,
      change: previousModel 
        ? ((activeModel?.metrics.recall ?? 0) - previousModel.metrics.recall) * 100
        : 0,
      icon: ShieldCheck,
      color: 'success',
      threshold: 0.95,
    },
    {
      label: 'Precision',
      value: activeModel?.metrics.precision ?? 0,
      format: (v: number) => `${(v * 100).toFixed(1)}%`,
      change: previousModel 
        ? ((activeModel?.metrics.precision ?? 0) - previousModel.metrics.precision) * 100
        : 0,
      icon: Target,
      color: 'warning',
    },
    {
      label: 'False Positive Rate',
      value: activeModel?.metrics.falsePositiveRate ?? 0,
      format: (v: number) => `${(v * 100).toFixed(2)}%`,
      change: previousModel 
        ? (previousModel.metrics.falsePositiveRate - (activeModel?.metrics.falsePositiveRate ?? 0)) * 100
        : 0,
      icon: AlertTriangle,
      color: 'destructive',
      invertChange: true,
    },
    {
      label: 'Total Inferences',
      value: systemStatus.totalInferences,
      format: (v: number) => v.toLocaleString(),
      icon: Timer,
      color: 'muted',
    },
    {
      label: 'Avg Latency',
      value: systemStatus.avgLatency,
      format: (v: number) => `${v.toFixed(1)}ms`,
      icon: Timer,
      color: systemStatus.avgLatency > 100 ? 'destructive' : 'muted',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        const isAboveThreshold = metric.threshold && metric.value >= metric.threshold;
        const hasPositiveChange = metric.invertChange ? metric.change > 0 : metric.change > 0;

        return (
          <div key={metric.label} className="metric-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                {metric.label}
              </span>
              <Icon className={`w-4 h-4 text-${metric.color}`} />
            </div>
            <div className="flex items-end gap-2">
              <span className={`text-2xl font-bold font-mono ${
                metric.threshold 
                  ? isAboveThreshold 
                    ? 'text-success' 
                    : 'text-destructive'
                  : ''
              }`}>
                {metric.format(metric.value)}
              </span>
              {metric.change !== undefined && metric.change !== 0 && (
                <div className={`flex items-center text-xs ${
                  hasPositiveChange ? 'text-success' : 'text-destructive'
                }`}>
                  {hasPositiveChange ? (
                    <TrendingUp className="w-3 h-3 mr-0.5" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-0.5" />
                  )}
                  <span>{Math.abs(metric.change).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
