import { Header } from '@/components/dashboard/Header';
import { MetricsOverview } from '@/components/dashboard/MetricsOverview';
import { UploadPanel } from '@/components/dashboard/UploadPanel';
import { PipelineStatus } from '@/components/dashboard/PipelineStatus';
import { ModelRegistry } from '@/components/dashboard/ModelRegistry';
import { PerformanceCharts } from '@/components/dashboard/PerformanceCharts';
import { InferenceLogTable } from '@/components/dashboard/InferenceLogTable';
import { DriftAlerts } from '@/components/dashboard/DriftAlerts';
import { DeploymentStatus } from '@/components/dashboard/DeploymentStatus';
import { SingleImageInference } from '@/components/dashboard/SingleImageInference';
import { MistakeGallery } from '@/components/dashboard/MistakeGallery';
import { useSupabaseBackend } from '@/hooks/useSupabaseBackend';

const Index = () => {
  const {
    models,
    batches,
    pipelineSteps,
    inferenceLogs,
    driftAlerts,
    systemStatus,
    uploadBatch,
    promoteCanary,
    rollbackModel,
    acknowledgeAlert,
  } = useSupabaseBackend();

  return (
    <div className="min-h-screen bg-background">
      <Header systemStatus={systemStatus} />
      
      <main className="container mx-auto px-6 py-6 space-y-6">
        {/* Metrics Overview */}
        <MetricsOverview models={models} systemStatus={systemStatus} />

        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <UploadPanel 
              onUpload={uploadBatch}
              currentPhase={systemStatus.currentPhase}
              isTraining={systemStatus.isTraining}
            />
            <SingleImageInference />
            <PipelineStatus 
              steps={pipelineSteps}
              isTraining={systemStatus.isTraining}
            />
            <DriftAlerts 
              alerts={driftAlerts}
              onAcknowledge={acknowledgeAlert}
            />
          </div>

          {/* Right Column */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <DeploymentStatus models={models} />
            <ModelRegistry 
              models={models}
              onPromoteCanary={promoteCanary}
              onRollback={rollbackModel}
            />
            <MistakeGallery modelVersion={systemStatus.activeModel} />
            <PerformanceCharts 
              models={models}
              inferenceLogs={inferenceLogs}
            />
          </div>
        </div>

        {/* Full Width Log Table */}
        <InferenceLogTable logs={inferenceLogs} />
      </main>
    </div>
  );
};

export default Index;
