import { useState, useCallback } from 'react';
import { Upload, Image, Loader2, CheckCircle, XCircle, Thermometer, Cpu, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import config from '@/lib/backend-config';

interface InferenceResult {
  prediction: 'normal' | 'defect';
  confidence: number;
  latency_ms: number;
  model_version: string;
  gradcam_heatmap?: string;
  defect_type?: string;
  reasoning?: string;
}

type InferenceMode = 'auto' | 'python' | 'ai';

export function SingleImageInference() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<InferenceResult | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<InferenceMode>('auto');

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
      setShowHeatmap(false);
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
      setShowHeatmap(false);
    }
  }, []);

  const runPythonInference = async (): Promise<InferenceResult | null> => {
    if (!selectedFile) return null;
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('generate_heatmap', 'true');

    try {
      const response = await fetch(`${config.apiUrl}/api/infer`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Python backend not available - start the backend server locally');
      }

      return response.json();
    } catch (err) {
      throw new Error('PyTorch backend unavailable - run backend/main.py locally to enable');
    }
  };

  const runAIInference = async (): Promise<InferenceResult | null> => {
    if (!selectedFile) return null;
    
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('generate_heatmap', 'false');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-inference`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'AI inference failed');
    }

    return response.json();
  };

  const saveInferenceLog = async (inferenceResult: InferenceResult, fileName: string) => {
    try {
      // Insert the inference log
      const { error: insertError } = await supabase.from('inference_logs').insert({
        image_id: fileName,
        prediction: inferenceResult.prediction,
        confidence: inferenceResult.confidence,
        latency_ms: inferenceResult.latency_ms,
        model_version: inferenceResult.model_version,
      });
      
      if (insertError) {
        console.error('Failed to save inference log:', insertError);
        return;
      }

      // Update system_status with new inference count and avg latency
      const { data: currentStatus } = await supabase
        .from('system_status')
        .select('total_inferences, avg_latency')
        .eq('id', 1)
        .single();

      if (currentStatus) {
        const newTotal = (currentStatus.total_inferences || 0) + 1;
        const oldAvg = currentStatus.avg_latency || 0;
        const newAvg = ((oldAvg * (newTotal - 1)) + inferenceResult.latency_ms) / newTotal;

        await supabase
          .from('system_status')
          .update({ 
            total_inferences: newTotal, 
            avg_latency: newAvg 
          })
          .eq('id', 1);
      }
    } catch (err) {
      console.error('Error saving inference log:', err);
    }
  };

  const runInference = useCallback(async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);

    try {
      let inferenceResult: InferenceResult | null = null;

      if (mode === 'python') {
        inferenceResult = await runPythonInference();
      } else if (mode === 'ai') {
        inferenceResult = await runAIInference();
      } else {
        // Auto mode: try Python first, fallback to AI
        try {
          inferenceResult = await runPythonInference();
          toast.info('Using PyTorch model');
        } catch {
          console.log('Python backend not available, falling back to AI');
          inferenceResult = await runAIInference();
          toast.info('Using Vision AI');
        }
      }

      if (inferenceResult) {
        setResult(inferenceResult);
        // Persist to inference_logs table
        await saveInferenceLog(inferenceResult, selectedFile.name);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Inference failed';
      setError(message);
      toast.error(message);
      console.error('Inference error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, mode]);

  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setShowHeatmap(false);
  }, []);

  return (
    <Card className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Image className="w-5 h-5 text-primary" />
          Single Image Inference
        </h2>
        <div className="flex items-center gap-2">
          {result?.gradcam_heatmap && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHeatmap(!showHeatmap)}
              className="text-xs"
            >
              <Thermometer className="w-4 h-4 mr-1" />
              {showHeatmap ? 'Original' : 'GradCAM'}
            </Button>
          )}
        </div>
      </div>

      {/* Mode Selector */}
      <div className="flex gap-1 mb-4 p-1 bg-muted/30 rounded-lg">
        {(['auto', 'python', 'ai'] as InferenceMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`
              flex-1 px-3 py-1.5 text-xs rounded-md transition-all
              ${mode === m 
                ? 'bg-primary text-primary-foreground' 
                : 'hover:bg-muted text-muted-foreground'
              }
            `}
          >
            {m === 'auto' && 'Auto'}
            {m === 'python' && 'PyTorch'}
            {m === 'ai' && 'AI Vision'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* Upload Area */}
        {!previewUrl ? (
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
          >
            <Upload className="w-10 h-10 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Drop an EL image here or click to upload
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports PNG, JPG, JPEG
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        ) : (
          <div className="relative">
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              <img
                src={showHeatmap && result?.gradcam_heatmap 
                  ? `data:image/png;base64,${result.gradcam_heatmap}`
                  : previewUrl
                }
                alt="Selected"
                className="w-full h-full object-contain"
              />
              {result && (
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                  <Badge
                    variant={result.prediction === 'defect' ? 'destructive' : 'default'}
                    className="text-sm px-3 py-1"
                  >
                    {result.prediction === 'defect' ? (
                      <XCircle className="w-4 h-4 mr-1" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-1" />
                    )}
                    {result.prediction.toUpperCase()}
                  </Badge>
                  {result.defect_type && (
                    <Badge variant="outline" className="text-xs">
                      {result.defect_type}
                    </Badge>
                  )}
                </div>
              )}
              {result && (
                <div className="absolute bottom-2 left-2">
                  <Badge variant="secondary" className="text-xs">
                    <Cpu className="w-3 h-3 mr-1" />
                    {result.model_version}
                  </Badge>
                </div>
              )}
            </div>

            {/* Results Panel */}
            {result && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      Confidence
                    </p>
                    <p className="text-lg font-mono font-bold mt-1 text-foreground">
                      {((result.confidence ?? 0) * 100).toFixed(1)}%
                    </p>
                    <Progress 
                      value={(result.confidence ?? 0) * 100} 
                      className="h-1 mt-2"
                    />
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      Latency
                    </p>
                    <p className="text-lg font-mono font-bold mt-1 text-foreground">
                      {(result.latency_ms ?? 0).toFixed(0)}ms
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      Model
                    </p>
                    <p className="text-sm font-mono font-bold mt-1 truncate text-foreground">
                      {(result.model_version ?? 'Unknown').includes('Vision') ? 'Vision AI' : result.model_version}
                    </p>
                  </div>
                </div>

                {result.reasoning && (
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <Info className="w-3 h-3" />
                      AI Analysis
                    </p>
                    <p className="text-sm">{result.reasoning}</p>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-4 flex gap-2">
              <Button
                onClick={runInference}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Cpu className="w-4 h-4 mr-2" />
                    {result ? 'Run Again' : 'Run Inference'}
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleClear}>
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}