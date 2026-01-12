import { Server, ArrowRight, Shield, AlertTriangle } from 'lucide-react';
import { ModelVersion } from '@/types/ml-system';

interface DeploymentStatusProps {
  models: ModelVersion[];
}

export function DeploymentStatus({ models }: DeploymentStatusProps) {
  const deployedModel = models.find(m => m.deploymentStatus === 'deployed');
  const canaryModel = models.find(m => m.deploymentStatus === 'canary');

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Server className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Deployment Status</h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Production Model */}
        <div className="flex-1 p-4 rounded-lg border border-success/30 bg-success/5">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-success" />
            <span className="text-xs text-success uppercase font-medium">Production</span>
          </div>
          {deployedModel ? (
            <>
              <p className="text-xl font-mono font-bold">{deployedModel.version}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {deployedModel.trafficSplit}% traffic
              </p>
              <div className="mt-3 w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-success rounded-full transition-all duration-500"
                  style={{ width: `${deployedModel.trafficSplit}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">No model deployed</p>
          )}
        </div>

        <ArrowRight className="w-5 h-5 text-muted-foreground" />

        {/* Canary Model */}
        <div className={`flex-1 p-4 rounded-lg border ${
          canaryModel 
            ? 'border-warning/30 bg-warning/5' 
            : 'border-border/30 bg-muted/20'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`w-4 h-4 ${canaryModel ? 'text-warning' : 'text-muted-foreground'}`} />
            <span className={`text-xs uppercase font-medium ${canaryModel ? 'text-warning' : 'text-muted-foreground'}`}>
              Canary
            </span>
          </div>
          {canaryModel ? (
            <>
              <p className="text-xl font-mono font-bold">{canaryModel.version}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {canaryModel.trafficSplit}% traffic
              </p>
              <div className="mt-3 w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-warning rounded-full transition-all duration-500"
                  style={{ width: `${canaryModel.trafficSplit}%` }}
                />
              </div>
            </>
          ) : (
            <div className="text-muted-foreground">
              <p className="text-sm">No canary active</p>
              <p className="text-xs mt-1">Upload batch to start</p>
            </div>
          )}
        </div>
      </div>

      {/* Rollback Rules */}
      <div className="mt-4 p-3 bg-muted/30 rounded-lg">
        <p className="text-xs font-medium text-muted-foreground mb-2">Auto-Rollback Rules</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            <span className="text-muted-foreground">Recall &lt; 95%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            <span className="text-muted-foreground">Accuracy drops</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            <span className="text-muted-foreground">FPR increases</span>
          </div>
        </div>
      </div>
    </div>
  );
}
