import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { ModelVersion, InferenceLog } from '@/types/ml-system';

interface PerformanceChartsProps {
  models: ModelVersion[];
  inferenceLogs: InferenceLog[];
}

export function PerformanceCharts({ models, inferenceLogs }: PerformanceChartsProps) {
  const metricsData = useMemo(() => {
    return models.map(m => ({
      version: m.version,
      accuracy: m.metrics.accuracy * 100,
      recall: m.metrics.recall * 100,
      precision: m.metrics.precision * 100,
      fpr: m.metrics.falsePositiveRate * 100,
    }));
  }, [models]);

  const confusionData = useMemo(() => {
    const latestModel = models[models.length - 1];
    
    // Use mock data if no real data available
    const tp = latestModel?.metrics.truePositives || 245;
    const tn = latestModel?.metrics.trueNegatives || 238;
    const fp = latestModel?.metrics.falsePositives || 12;
    const fn = latestModel?.metrics.falseNegatives || 5;
    
    return [
      { name: 'True Positives', value: tp, fill: 'hsl(var(--success))' },
      { name: 'True Negatives', value: tn, fill: 'hsl(var(--primary))' },
      { name: 'False Positives', value: fp, fill: 'hsl(var(--warning))' },
      { name: 'False Negatives', value: fn, fill: 'hsl(var(--destructive))' },
    ];
  }, [models]);

  const latencyData = useMemo(() => {
    // If we have real logs, use them
    if (inferenceLogs.length > 0) {
      const buckets: Record<string, { total: number; count: number }> = {};
      inferenceLogs.slice(0, 50).forEach(log => {
        const bucket = Math.floor(log.timestamp.getMinutes() / 5) * 5;
        const key = `${log.timestamp.getHours()}:${bucket.toString().padStart(2, '0')}`;
        if (!buckets[key]) buckets[key] = { total: 0, count: 0 };
        buckets[key].total += log.latencyMs;
        buckets[key].count += 1;
      });

      return Object.entries(buckets).slice(-12).map(([time, { total, count }]) => ({
        time,
        latency: total / count,
      }));
    }

    // Generate mock latency data for the past 12 time buckets
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const time = new Date(now.getTime() - (11 - i) * 5 * 60 * 1000);
      return {
        time: `${time.getHours()}:${(Math.floor(time.getMinutes() / 5) * 5).toString().padStart(2, '0')}`,
        latency: 25 + Math.random() * 35, // Random latency between 25-60ms
      };
    });
  }, [inferenceLogs]);

  return (
    <div className="space-y-6">
      {/* Metrics Over Versions */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-4">Model Performance Evolution</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metricsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="version" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                domain={[80, 100]}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="accuracy" 
                stroke="hsl(var(--chart-accuracy))" 
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Accuracy"
              />
              <Line 
                type="monotone" 
                dataKey="recall" 
                stroke="hsl(var(--chart-recall))" 
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Recall"
              />
              <Line 
                type="monotone" 
                dataKey="precision" 
                stroke="hsl(var(--chart-precision))" 
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Precision"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Confusion Matrix Summary */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4">Prediction Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confusionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  type="number" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={100}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {confusionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Latency Over Time */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4">Inference Latency</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={latencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="time" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(v) => `${v}ms`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}ms`, 'Avg Latency']}
                />
                <Area
                  type="monotone"
                  dataKey="latency"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.2)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
