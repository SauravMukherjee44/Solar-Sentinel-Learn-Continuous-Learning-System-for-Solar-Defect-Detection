import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, AlertCircle, Bell, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DriftAlert } from '@/types/ml-system';

interface DriftAlertsProps {
  alerts: DriftAlert[];
  onAcknowledge: (alertId: string) => void;
}

export function DriftAlerts({ alerts, onAcknowledge }: DriftAlertsProps) {
  const activeAlerts = alerts.filter(a => !a.acknowledged);
  const recentAcknowledged = alerts.filter(a => a.acknowledged).slice(0, 3);

  const getAlertIcon = (type: DriftAlert['type'], severity: DriftAlert['severity']) => {
    if (severity === 'critical') {
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    }
    return <AlertTriangle className="w-4 h-4 text-warning" />;
  };

  if (alerts.length === 0) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Drift Detection</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <CheckCircle className="w-10 h-10 mb-3 text-success opacity-50" />
          <p className="text-sm">No drift alerts</p>
          <p className="text-xs mt-1">All systems operating normally</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Drift Detection</h2>
        </div>
        {activeAlerts.length > 0 && (
          <span className="px-2 py-0.5 bg-destructive/20 text-destructive text-xs font-medium rounded-full">
            {activeAlerts.length} active
          </span>
        )}
      </div>

      <div className="space-y-3">
        {activeAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`
              p-3 rounded-lg border
              ${alert.severity === 'critical' 
                ? 'border-destructive/30 bg-destructive/10' 
                : 'border-warning/30 bg-warning/10'
              }
            `}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                {getAlertIcon(alert.type, alert.severity)}
                <div>
                  <p className={`text-sm font-medium ${
                    alert.severity === 'critical' ? 'text-destructive' : 'text-warning'
                  }`}>
                    {alert.message}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="font-mono">
                      Current: {alert.currentValue.toFixed(2)}
                    </span>
                    <span className="font-mono">
                      Threshold: {alert.threshold.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => onAcknowledge(alert.id)}
              >
                Dismiss
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
            </p>
          </div>
        ))}

        {recentAcknowledged.length > 0 && (
          <div className="pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2">Recently acknowledged</p>
            {recentAcknowledged.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between py-1.5 text-xs text-muted-foreground"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3" />
                  {alert.message}
                </span>
                <span>{formatDistanceToNow(alert.timestamp, { addSuffix: true })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
