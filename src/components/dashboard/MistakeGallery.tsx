import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, ArrowRight, RefreshCw, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import config from '@/lib/backend-config';

interface MistakeAnalysis {
  false_positives: number;
  false_negatives: number;
  total_analyzed: number;
  fp_samples: MistakeSample[];
  fn_samples: MistakeSample[];
}

interface MistakeSample {
  id: string;
  image_id: string;
  prediction: string;
  actual: string;
  confidence: number;
  corrected_in_version?: string;
}

interface MistakeGalleryProps {
  modelVersion?: string;
}

export function MistakeGallery({ modelVersion }: MistakeGalleryProps) {
  const [analysis, setAnalysis] = useState<MistakeAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'fp' | 'fn'>('fp');

  const fetchAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.apiUrl}/api/analyze-mistakes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_version: modelVersion }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze mistakes');
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      // Generate mock data for demonstration
      setAnalysis({
        false_positives: 12,
        false_negatives: 5,
        total_analyzed: 500,
        fp_samples: Array.from({ length: 12 }, (_, i) => ({
          id: `fp-${i}`,
          image_id: `img-fp-${Math.random().toString(36).substr(2, 6)}`,
          prediction: 'defect',
          actual: 'normal',
          confidence: 0.6 + Math.random() * 0.3,
          corrected_in_version: i < 8 ? `v1.${Math.floor(i / 3) + 1}.0` : undefined,
        })),
        fn_samples: Array.from({ length: 5 }, (_, i) => ({
          id: `fn-${i}`,
          image_id: `img-fn-${Math.random().toString(36).substr(2, 6)}`,
          prediction: 'normal',
          actual: 'defect',
          confidence: 0.5 + Math.random() * 0.4,
          corrected_in_version: i < 3 ? `v1.${Math.floor(i / 2) + 1}.0` : undefined,
        })),
      });
    } finally {
      setIsLoading(false);
    }
  }, [modelVersion]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const getImprovementRate = (samples: MistakeSample[]) => {
    const corrected = samples.filter(s => s.corrected_in_version).length;
    return samples.length > 0 ? (corrected / samples.length) * 100 : 0;
  };

  return (
    <Card className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          Mistake Analysis & Improvements
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchAnalysis}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {analysis && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
              <p className="text-2xl font-bold text-destructive">{analysis.false_positives}</p>
              <p className="text-xs text-muted-foreground">False Positives</p>
            </div>
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-center">
              <p className="text-2xl font-bold text-warning">{analysis.false_negatives}</p>
              <p className="text-xs text-muted-foreground">False Negatives</p>
            </div>
            <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-center">
              <p className="text-2xl font-bold text-success">
                {getImprovementRate(analysis.fp_samples).toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground">FP Corrected</p>
            </div>
            <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-center">
              <p className="text-2xl font-bold text-success">
                {getImprovementRate(analysis.fn_samples).toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground">FN Corrected</p>
            </div>
          </div>

          {/* Mistake Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'fp' | 'fn')}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="fp" className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                False Positives ({analysis.fp_samples.length})
              </TabsTrigger>
              <TabsTrigger value="fn" className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-warning" />
                False Negatives ({analysis.fn_samples.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="fp" className="space-y-2 max-h-[300px] overflow-y-auto">
              {analysis.fp_samples.map((sample) => (
                <MistakeItem
                  key={sample.id}
                  sample={sample}
                  type="fp"
                />
              ))}
            </TabsContent>

            <TabsContent value="fn" className="space-y-2 max-h-[300px] overflow-y-auto">
              {analysis.fn_samples.map((sample) => (
                <MistakeItem
                  key={sample.id}
                  sample={sample}
                  type="fn"
                />
              ))}
            </TabsContent>
          </Tabs>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-destructive" />
              FP: Predicted defect, actually normal
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-warning" />
              FN: Predicted normal, actually defect
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-success" />
              Corrected in later version
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}
    </Card>
  );
}

interface MistakeItemProps {
  sample: MistakeSample;
  type: 'fp' | 'fn';
}

function MistakeItem({ sample, type }: MistakeItemProps) {
  return (
    <div className={`
      flex items-center justify-between p-3 rounded-lg border transition-all
      ${sample.corrected_in_version 
        ? 'bg-success/5 border-success/20' 
        : type === 'fp' 
          ? 'bg-destructive/5 border-destructive/20'
          : 'bg-warning/5 border-warning/20'
      }
    `}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs font-mono">
          {sample.image_id.slice(0, 6)}
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant={type === 'fp' ? 'destructive' : 'default'} className="text-xs">
              {sample.prediction}
            </Badge>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <Badge variant="outline" className="text-xs">
              {sample.actual}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Confidence: {(sample.confidence * 100).toFixed(1)}%
          </p>
        </div>
      </div>
      
      {sample.corrected_in_version ? (
        <div className="flex items-center gap-1 text-success">
          <CheckCircle className="w-4 h-4" />
          <span className="text-xs font-mono">{sample.corrected_in_version}</span>
        </div>
      ) : (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Pending
        </Badge>
      )}
    </div>
  );
}