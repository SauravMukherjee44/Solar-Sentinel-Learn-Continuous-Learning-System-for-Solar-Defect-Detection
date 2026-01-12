import { formatDistanceToNow } from 'date-fns';
import { GitBranch, CheckCircle, AlertTriangle, Archive, RotateCcw, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ModelVersion } from '@/types/ml-system';

interface ModelRegistryProps {
  models: ModelVersion[];
  onPromoteCanary: (modelId: string) => void;
  onRollback?: (modelId: string) => void;
}

export function ModelRegistry({ models, onPromoteCanary, onRollback }: ModelRegistryProps) {
  const deployedModel = models.find(m => m.deploymentStatus === 'deployed');
  const getStatusBadge = (status: ModelVersion['deploymentStatus']) => {
    const variants: Record<string, { variant: 'deployed' | 'canary' | 'archived' | 'rolledBack'; icon: React.ReactNode }> = {
      deployed: { variant: 'deployed', icon: <CheckCircle className="w-3 h-3" /> },
      canary: { variant: 'canary', icon: <AlertTriangle className="w-3 h-3" /> },
      archived: { variant: 'archived', icon: <Archive className="w-3 h-3" /> },
      'rolled-back': { variant: 'rolledBack', icon: <RotateCcw className="w-3 h-3" /> },
    };

    const { variant, icon } = variants[status] || variants.archived;
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {icon}
        {status}
      </Badge>
    );
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-primary" />
          Model Registry
        </h2>
        <span className="text-xs text-muted-foreground">
          {models.length} versions
        </span>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin pr-2">
        {[...models].reverse().map((model) => (
          <div
            key={model.id}
            className={`
              p-4 rounded-lg border transition-all
              ${model.deploymentStatus === 'deployed' 
                ? 'border-success/30 bg-success/5' 
                : model.deploymentStatus === 'canary'
                  ? 'border-warning/30 bg-warning/5'
                  : 'border-border/50 bg-muted/20'
              }
            `}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-lg">{model.version}</span>
                {getStatusBadge(model.deploymentStatus)}
              </div>
              {model.trafficSplit !== undefined && model.trafficSplit > 0 && (
                <span className="text-xs font-mono text-muted-foreground">
                  {model.trafficSplit}% traffic
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-3 text-center mb-3">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Accuracy</p>
                <p className="text-sm font-mono font-medium">
                  {(model.metrics.accuracy * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Recall</p>
                <p className={`text-sm font-mono font-medium ${
                  model.metrics.recall >= 0.95 ? 'text-success' : 'text-destructive'
                }`}>
                  {(model.metrics.recall * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Precision</p>
                <p className="text-sm font-mono font-medium">
                  {(model.metrics.precision * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider">FPR</p>
                <p className="text-sm font-mono font-medium text-warning">
                  {(model.metrics.falsePositiveRate * 100).toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Trained {formatDistanceToNow(model.trainingDate, { addSuffix: true })}
              </span>
              <span className="font-mono">{model.datasetVersion}</span>
            </div>

            {/* Canary Actions */}
            {model.deploymentStatus === 'canary' && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Canary evaluation in progress...
                  </p>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => onPromoteCanary(model.id)}
                  >
                    Promote to Production
                  </Button>
                </div>
              </div>
            )}

            {/* Rollback Action for Archived Models */}
            {model.deploymentStatus === 'archived' && onRollback && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {deployedModel && model.metrics.recall >= 0.95 && 
                     model.metrics.accuracy <= deployedModel.metrics.accuracy ? (
                      <span className="text-warning">⚠️ Recall OK, but accuracy lower than current</span>
                    ) : model.metrics.recall < 0.95 ? (
                      <span className="text-destructive">⚠️ Recall below 95% threshold</span>
                    ) : (
                      <span>Meets deployment criteria</span>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => onRollback(model.id)}
                  >
                    <Undo2 className="w-3 h-3 mr-1" />
                    Rollback to This
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
