import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { InferenceLog } from '@/types/ml-system';

interface InferenceLogTableProps {
  logs: InferenceLog[];
}

// Generate mock logs if none available
function generateMockLogs(): InferenceLog[] {
  const predictions: Array<'normal' | 'defect'> = ['normal', 'defect'];
  const modelVersions = ['v1.4.0', 'v1.3.0', 'AI-Vision'];
  
  return Array.from({ length: 15 }, (_, i) => ({
    id: `mock-${i}`,
    imageId: `img-${Math.random().toString(36).substr(2, 8)}.png`,
    prediction: predictions[Math.random() > 0.3 ? 0 : 1],
    confidence: 0.75 + Math.random() * 0.24,
    latencyMs: 20 + Math.random() * 80,
    modelVersion: modelVersions[Math.floor(Math.random() * modelVersions.length)],
    timestamp: new Date(Date.now() - i * 45000 - Math.random() * 30000),
  }));
}

export function InferenceLogTable({ logs }: InferenceLogTableProps) {
  const displayLogs = useMemo(() => {
    return logs.length > 0 ? logs : generateMockLogs();
  }, [logs]);

  const isUsingMockData = logs.length === 0;
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Live Inference Log</h2>
        <div className="flex items-center gap-2">
          {isUsingMockData && (
            <Badge variant="outline" className="text-xs text-muted-foreground">Demo</Badge>
          )}
          <div className="status-indicator online" />
          <span className="text-xs text-muted-foreground">Real-time</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Image ID
              </th>
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Prediction
              </th>
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Confidence
              </th>
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Latency
              </th>
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Model
              </th>
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {displayLogs.slice(0, 15).map((log, index) => (
              <tr 
                key={log.id}
                className={`
                  transition-colors hover:bg-muted/30
                  ${index === 0 ? 'animate-slide-in bg-primary/5' : ''}
                `}
              >
                <td className="py-2 px-3 font-mono text-xs">{log.imageId}</td>
                <td className="py-2 px-3">
                  <Badge variant={log.prediction === 'defect' ? 'destructive' : 'success'}>
                    {log.prediction}
                  </Badge>
                </td>
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          log.confidence > 0.9 ? 'bg-success' : 
                          log.confidence > 0.7 ? 'bg-warning' : 'bg-destructive'
                        }`}
                        style={{ width: `${log.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono">{(log.confidence * 100).toFixed(0)}%</span>
                  </div>
                </td>
                <td className="py-2 px-3">
                  <span className={`text-xs font-mono ${
                    log.latencyMs > 100 ? 'text-destructive' : 
                    log.latencyMs > 50 ? 'text-warning' : 'text-muted-foreground'
                  }`}>
                    {log.latencyMs.toFixed(0)}ms
                  </span>
                </td>
                <td className="py-2 px-3">
                  <span className="text-xs font-mono text-primary">{log.modelVersion}</span>
                </td>
                <td className="py-2 px-3 text-xs text-muted-foreground">
                  {formatDistanceToNow(log.timestamp, { addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
