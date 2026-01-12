import { useState, useCallback, useRef } from 'react';
import { Upload, FileArchive, Check, AlertCircle, Loader2, FolderOpen, X, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface UploadPanelProps {
  onUpload: (phase: number, totalImages: number, normalImages: number, defectImages: number) => void;
  currentPhase: number;
  isTraining: boolean;
}

interface UploadedImage {
  file: File;
  label: 'normal' | 'defect';
  preview?: string;
}

export function UploadPanel({ onUpload, currentPhase, isTraining }: UploadPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [selectedImages, setSelectedImages] = useState<UploadedImage[]>([]);
  const [uploadMode, setUploadMode] = useState<'select' | 'review' | 'uploading' | 'complete'>('select');
  const [error, setError] = useState<string | null>(null);
  
  const normalInputRef = useRef<HTMLInputElement>(null);
  const defectInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFilesSelected = useCallback((files: FileList | null, label: 'normal' | 'defect') => {
    if (!files) return;
    
    const imageFiles = Array.from(files).filter(f => 
      f.type.startsWith('image/') || f.name.match(/\.(png|jpg|jpeg|webp)$/i)
    );
    
    const newImages: UploadedImage[] = imageFiles.map(file => ({
      file,
      label,
      preview: URL.createObjectURL(file)
    }));
    
    setSelectedImages(prev => [...prev, ...newImages]);
    setUploadMode('review');
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    // Default to asking user to classify
    handleFilesSelected(files, 'normal');
  }, [handleFilesSelected]);

  const removeImage = useCallback((index: number) => {
    setSelectedImages(prev => {
      const updated = [...prev];
      if (updated[index].preview) {
        URL.revokeObjectURL(updated[index].preview!);
      }
      updated.splice(index, 1);
      if (updated.length === 0) {
        setUploadMode('select');
      }
      return updated;
    });
  }, []);

  const toggleLabel = useCallback((index: number) => {
    setSelectedImages(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        label: updated[index].label === 'normal' ? 'defect' : 'normal'
      };
      return updated;
    });
  }, []);

  const uploadImages = useCallback(async () => {
    if (selectedImages.length === 0) return;
    
    setIsUploading(true);
    setUploadMode('uploading');
    setUploadProgress(0);
    setError(null);

    const batchId = crypto.randomUUID();
    const normalCount = selectedImages.filter(i => i.label === 'normal').length;
    const defectCount = selectedImages.filter(i => i.label === 'defect').length;

    try {
      // Upload each image to storage
      for (let i = 0; i < selectedImages.length; i++) {
        const img = selectedImages[i];
        const fileName = `${batchId}/${img.label}/${Date.now()}_${img.file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('training-images')
          .upload(fileName, img.file);
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(`Failed to upload ${img.file.name}`);
        }
        
        // Track the image in database
        await supabase.from('uploaded_images').insert({
          batch_id: null, // Will be linked when batch is created
          filename: img.file.name,
          storage_path: fileName,
          label: img.label,
          file_size: img.file.size
        });
        
        setUploadProgress(Math.round(((i + 1) / selectedImages.length) * 100));
      }
      
      // Trigger the training pipeline
      onUpload(currentPhase + 1, selectedImages.length, normalCount, defectCount);
      
      // Cleanup previews
      selectedImages.forEach(img => {
        if (img.preview) URL.revokeObjectURL(img.preview);
      });
      
      setUploadComplete(true);
      setUploadMode('complete');
      setSelectedImages([]);
      
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploadMode('review');
    } finally {
      setIsUploading(false);
    }
  }, [selectedImages, currentPhase, onUpload]);

  const reset = useCallback(() => {
    selectedImages.forEach(img => {
      if (img.preview) URL.revokeObjectURL(img.preview);
    });
    setSelectedImages([]);
    setUploadMode('select');
    setUploadProgress(0);
    setUploadComplete(false);
    setError(null);
  }, [selectedImages]);

  const normalCount = selectedImages.filter(i => i.label === 'normal').length;
  const defectCount = selectedImages.filter(i => i.label === 'defect').length;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          Data Upload
        </h2>
        <span className="text-xs text-muted-foreground font-mono">
          Phase {currentPhase + 1} Ready
        </span>
      </div>

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={normalInputRef}
        className="hidden"
        multiple
        accept="image/*"
        onChange={(e) => handleFilesSelected(e.target.files, 'normal')}
      />
      <input
        type="file"
        ref={defectInputRef}
        className="hidden"
        multiple
        accept="image/*"
        onChange={(e) => handleFilesSelected(e.target.files, 'defect')}
      />

      {/* Selection Mode */}
      {uploadMode === 'select' && (
        <div
          className={`
            border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200
            ${isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-border/50 hover:border-primary/50'
            }
            ${isTraining ? 'opacity-50 pointer-events-none' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-3">
            Upload EL-PV Dataset Images
          </p>
          
          <div className="flex gap-2 justify-center mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => normalInputRef.current?.click()}
              disabled={isTraining}
              className="border-success/50 hover:bg-success/10"
            >
              <Check className="w-3 h-3 mr-1 text-success" />
              Normal Images
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => defectInputRef.current?.click()}
              disabled={isTraining}
              className="border-destructive/50 hover:bg-destructive/10"
            >
              <X className="w-3 h-3 mr-1 text-destructive" />
              Defect Images
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Or drag & drop images here
          </p>
        </div>
      )}

      {/* Review Mode */}
      {uploadMode === 'review' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-success/50">
                <Check className="w-3 h-3 mr-1 text-success" />
                {normalCount} Normal
              </Badge>
              <Badge variant="outline" className="border-destructive/50">
                <X className="w-3 h-3 mr-1 text-destructive" />
                {defectCount} Defect
              </Badge>
            </div>
            <span className="text-sm font-mono">{selectedImages.length} total</span>
          </div>

          {/* Image Grid */}
          <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto p-1">
            {selectedImages.map((img, idx) => (
              <div
                key={idx}
                className={`
                  relative group rounded-lg overflow-hidden border-2
                  ${img.label === 'defect' ? 'border-destructive/50' : 'border-success/50'}
                `}
              >
                <img
                  src={img.preview}
                  alt={img.file.name}
                  className="w-full h-16 object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => toggleLabel(idx)}
                  >
                    <Image className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={() => removeImage(idx)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <Badge
                  className="absolute bottom-1 left-1 text-[10px] px-1 py-0"
                  variant={img.label === 'defect' ? 'destructive' : 'default'}
                >
                  {img.label}
                </Badge>
              </div>
            ))}
          </div>

          {/* Add more buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => normalInputRef.current?.click()}
            >
              + Normal
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => defectInputRef.current?.click()}
            >
              + Defect
            </Button>
          </div>

          {error && (
            <div className="p-2 bg-destructive/10 border border-destructive/30 rounded text-destructive text-xs">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={uploadImages}
              disabled={selectedImages.length === 0 || isTraining}
              className="flex-1"
            >
              <Upload className="w-4 h-4 mr-2" />
              Start Training Pipeline
            </Button>
            <Button variant="outline" onClick={reset}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Uploading Mode */}
      {uploadMode === 'uploading' && (
        <div className="space-y-4 text-center py-6">
          <Loader2 className="w-10 h-10 mx-auto text-primary animate-spin" />
          <div className="space-y-2">
            <p className="text-sm font-medium">Uploading {selectedImages.length} images...</p>
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {uploadProgress}% complete
            </p>
          </div>
        </div>
      )}

      {/* Complete Mode */}
      {uploadMode === 'complete' && (
        <div className="space-y-4 text-center py-6">
          <div className="w-10 h-10 mx-auto rounded-full bg-success/20 flex items-center justify-center">
            <Check className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-sm font-medium text-success">Upload Complete</p>
            <p className="text-xs text-muted-foreground mt-1">
              Training pipeline started automatically
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            Upload More
          </Button>
        </div>
      )}

      {/* Format Guide */}
      <div className="mt-4 p-3 bg-muted/30 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-warning mb-1">EL-PV Dataset Format</p>
            <ul className="space-y-0.5">
              <li>• Upload electroluminescence images (PNG/JPG)</li>
              <li>• Classify each image as "normal" or "defect"</li>
              <li>• Recommended: 100+ images per category</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}