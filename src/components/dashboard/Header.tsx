import { Activity, Cpu, Zap, Clock } from 'lucide-react';
import { SystemStatus } from '@/types/ml-system';

interface HeaderProps {
  systemStatus: SystemStatus;
}

export function Header({ systemStatus }: HeaderProps) {
  return (
    <header className="glass-card border-b border-border/50 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                <span className="gradient-text">SolarDefect</span>
                <span className="text-muted-foreground font-normal ml-2">ML Ops</span>
              </h1>
              <p className="text-xs text-muted-foreground">Continuous Learning Pipeline</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 glass-card">
            <div className={`status-indicator ${systemStatus.isTraining ? 'training' : 'online'}`} />
            <span className="text-sm font-medium">
              {systemStatus.isTraining ? 'Training' : 'Online'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Active:</span>
              <span className="font-mono font-medium">{systemStatus.activeModel}</span>
            </div>

            {systemStatus.canaryModel && (
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-warning" />
                <span className="text-muted-foreground">Canary:</span>
                <span className="font-mono font-medium text-warning">{systemStatus.canaryModel}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Uptime:</span>
              <span className="font-mono font-medium text-success">{systemStatus.uptime.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
