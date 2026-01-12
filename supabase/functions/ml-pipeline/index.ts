import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface BatchUpload {
  phase: number;
  totalImages: number;
  normalImages: number;
  defectImages: number;
}

interface PipelineStep {
  name: string;
  order: number;
}

const PIPELINE_STEPS: PipelineStep[] = [
  { name: 'Ingesting batch data', order: 1 },
  { name: 'Running inference on new data', order: 2 },
  { name: 'Analyzing model mistakes', order: 3 },
  { name: 'Training corrected model', order: 4 },
  { name: 'Evaluating new model', order: 5 },
  { name: 'Safe deployment with canary', order: 6 },
];

// Simulated pipeline execution (in production, this would trigger actual ML training)
// deno-lint-ignore no-explicit-any
async function runPipelineSimulation(supabase: any, batchId: string, phase: number) {
  console.log(`Starting pipeline simulation for batch ${batchId}`);

  try {
    // Get pipeline steps
    const { data: steps } = await supabase
      .from('pipeline_steps')
      .select('*')
      .eq('batch_id', batchId)
      .order('step_order', { ascending: true });

    if (!steps) return;

    // Get current model count for versioning
    const { data: models } = await supabase
      .from('model_versions')
      .select('version')
      .order('created_at', { ascending: false });

    const modelCount = models?.length || 1;

    // Simulate each step
    // deno-lint-ignore no-explicit-any
    for (const step of steps as any[]) {
      // Mark step as running
      await supabase
        .from('pipeline_steps')
        .update({ status: 'running', start_time: new Date().toISOString() })
        .eq('id', step.id);
 
      // Simulate processing time (keep fast to avoid edge runtime timeouts)
      await new Promise(resolve => setTimeout(resolve, 350 + Math.random() * 250));

      // Add details based on step
      let details = '';
      if (step.step_order === 2) {
        details = `Processed batch images for inference`;
      } else if (step.step_order === 3) {
        const fps = Math.floor(Math.random() * 15) + 5;
        const fns = Math.floor(Math.random() * 10) + 3;
        details = `Found ${fps} false positives, ${fns} false negatives`;
        
        // Update batch with analysis results
        await supabase
          .from('training_batches')
          .update({ 
            status: 'analyzed',
            analysis_results: { falsePositives: fps, falseNegatives: fns }
          })
          .eq('id', batchId);
      } else if (step.step_order === 4) {
        details = `Completed 10/10 epochs with weighted samples`;
        
        await supabase
          .from('training_batches')
          .update({ status: 'training' })
          .eq('id', batchId);
      }

      // Mark step as completed
      await supabase
        .from('pipeline_steps')
        .update({ 
          status: 'completed', 
          end_time: new Date().toISOString(),
          details,
          progress: 100,
        })
        .eq('id', step.id);
    }

    // Create new model version
    const newVersion = `v1.${modelCount}.0`;
    
    // Get previous model metrics for improvement simulation
    const { data: prevModel } = await supabase
      .from('model_versions')
      .select('metrics')
      .eq('deployment_status', 'deployed')
      .single();

    // deno-lint-ignore no-explicit-any
    const prevMetrics = (prevModel?.metrics as any) || {
      accuracy: 0.923,
      recall: 0.961,
      precision: 0.894,
      falsePositiveRate: 0.082,
    };

    // Simulate improved metrics
    const newMetrics = {
      accuracy: Math.min(0.98, prevMetrics.accuracy + 0.01 + Math.random() * 0.015),
      recall: Math.max(0.95, Math.min(0.99, prevMetrics.recall + Math.random() * 0.01)),
      precision: Math.min(0.97, prevMetrics.precision + 0.015 + Math.random() * 0.015),
      falsePositiveRate: Math.max(0.02, prevMetrics.falsePositiveRate - 0.01 - Math.random() * 0.01),
      truePositives: 490 + Math.floor(Math.random() * 15),
      trueNegatives: 910 + Math.floor(Math.random() * 25),
      falsePositives: Math.max(10, 50 - modelCount * 8 - Math.floor(Math.random() * 5)),
      falseNegatives: Math.max(5, 18 - modelCount * 2),
      f1Score: 0,
    };
    newMetrics.f1Score = 2 * (newMetrics.precision * newMetrics.recall) / 
      (newMetrics.precision + newMetrics.recall);

    // Insert new model with canary status
    await supabase
      .from('model_versions')
      .insert({
        version: newVersion,
        dataset_version: `phase-${phase}`,
        batch_version: batchId,
        hyperparameters: {
          learningRate: 0.0008,
          epochs: 10,
          batchSize: 32,
          optimizer: 'Adam',
        },
        metrics: newMetrics,
        deployment_status: 'canary',
        traffic_split: 10,
      });

    // Update deployed model traffic
    await supabase
      .from('model_versions')
      .update({ traffic_split: 90 })
      .eq('deployment_status', 'deployed');

    // Update batch status
    await supabase
      .from('training_batches')
      .update({ status: 'completed' })
      .eq('id', batchId);

    // Update system status
    await supabase
      .from('system_status')
      .update({ 
        is_training: false,
        current_phase: phase,
        canary_model: newVersion,
      })
      .eq('id', 1);

    console.log(`Pipeline completed. New model ${newVersion} deployed as canary`);

    // Auto-promote after a short delay if metrics are good (simulated canary evaluation)
    await new Promise(resolve => setTimeout(resolve, 800));

    if (newMetrics.recall >= 0.95 && newMetrics.accuracy > prevMetrics.accuracy) {
      console.log(`Auto-promoting ${newVersion} - metrics pass safety checks`);
      
      // Archive current deployed
      await supabase
        .from('model_versions')
        .update({ deployment_status: 'archived', traffic_split: 0 })
        .eq('deployment_status', 'deployed');

      // Promote canary
      await supabase
        .from('model_versions')
        .update({ deployment_status: 'deployed', traffic_split: 100 })
        .eq('version', newVersion);

      // Update system status
      await supabase
        .from('system_status')
        .update({ 
          active_model: newVersion,
          canary_model: null,
        })
        .eq('id', 1);
    }

  } catch (err) {
    const error = err as Error;
    console.error('Pipeline simulation error:', error);
    
    // Mark batch as failed
    await supabase
      .from('training_batches')
      .update({ status: 'failed', error_message: error.message })
      .eq('id', batchId);

    await supabase
      .from('system_status')
      .update({ is_training: false })
      .eq('id', 1);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    console.log(`ML Pipeline request: ${req.method} ${path}`);

    // GET endpoints
    if (req.method === 'GET') {
      if (path === 'status') {
        const { data, error } = await supabase
          .from('system_status')
          .select('*')
          .single();
        
        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path === 'models') {
        const { data, error } = await supabase
          .from('model_versions')
          .select('*')
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path === 'batches') {
        const { data, error } = await supabase
          .from('training_batches')
          .select('*, pipeline_steps(*)')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path === 'logs') {
        const { data, error } = await supabase
          .from('inference_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(100);
        
        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path === 'alerts') {
        const { data, error } = await supabase
          .from('drift_alerts')
          .select('*')
          .order('timestamp', { ascending: false });
        
        if (error) throw error;
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // POST endpoints
    if (req.method === 'POST') {
      const body = await req.json();

      if (path === 'upload-batch') {
        const { phase, totalImages, normalImages, defectImages }: BatchUpload = body;
        
        console.log(`Creating batch for phase ${phase} with ${totalImages} images`);

        // Create the batch
        const { data: batch, error: batchError } = await supabase
          .from('training_batches')
          .insert({
            phase,
            total_images: totalImages,
            normal_images: normalImages,
            defect_images: defectImages,
            status: 'pending',
          })
          .select()
          .single();

        if (batchError) throw batchError;

        // Create pipeline steps
        const steps = PIPELINE_STEPS.map(step => ({
          batch_id: batch.id,
          step_name: step.name,
          step_order: step.order,
          status: 'pending',
        }));

        const { error: stepsError } = await supabase
          .from('pipeline_steps')
          .insert(steps);

        if (stepsError) throw stepsError;

        // Update system status
        await supabase
          .from('system_status')
          .update({ is_training: true })
          .eq('id', 1);

        console.log(`Batch ${batch.id} created, starting pipeline simulation`);

        // Start pipeline processing in the background.
        // IMPORTANT: use waitUntil so the task can finish after the HTTP response returns.
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil as
          | ((promise: Promise<unknown>) => void)
          | undefined;

        const task = runPipelineSimulation(supabaseAdmin, batch.id, phase);

        if (typeof waitUntil === 'function') {
          waitUntil(task);
        } else {
          // Fallback for environments without EdgeRuntime.waitUntil
          task.catch((e) => console.error('Pipeline background task error:', e));
        }

        return new Response(JSON.stringify({ success: true, batchId: batch.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path === 'inference') {
        const { imageId, prediction, confidence, latencyMs, modelVersion } = body;
        
        const { error } = await supabase
          .from('inference_logs')
          .insert({
            image_id: imageId,
            prediction,
            confidence,
            latency_ms: latencyMs,
            model_version: modelVersion,
          });

        if (error) throw error;

        // Update total inferences
        const { data: status } = await supabase
          .from('system_status')
          .select('total_inferences, avg_latency')
          .single();

        if (status) {
          const newTotal = (status.total_inferences || 0) + 1;
          const newAvg = (status.avg_latency * 0.99) + (latencyMs * 0.01);
          
          await supabase
            .from('system_status')
            .update({ 
              total_inferences: newTotal,
              avg_latency: newAvg,
            })
            .eq('id', 1);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path === 'promote-canary') {
        const { modelId } = body;
        
        // Get canary model
        const { data: canaryModel, error: modelError } = await supabase
          .from('model_versions')
          .select('*')
          .eq('id', modelId)
          .single();

        if (modelError) throw modelError;

        // Archive current deployed model
        await supabase
          .from('model_versions')
          .update({ deployment_status: 'archived', traffic_split: 0 })
          .eq('deployment_status', 'deployed');

        // Promote canary to deployed
        await supabase
          .from('model_versions')
          .update({ deployment_status: 'deployed', traffic_split: 100 })
          .eq('id', modelId);

        // Update system status
        await supabase
          .from('system_status')
          .update({ 
            active_model: canaryModel.version,
            canary_model: null,
          })
          .eq('id', 1);

        console.log(`Promoted model ${canaryModel.version} to production`);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (path === 'acknowledge-alert') {
        const { alertId } = body;
        
        const { error } = await supabase
          .from('drift_alerts')
          .update({ acknowledged: true })
          .eq('id', alertId);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const error = err as Error;
    console.error('ML Pipeline error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
