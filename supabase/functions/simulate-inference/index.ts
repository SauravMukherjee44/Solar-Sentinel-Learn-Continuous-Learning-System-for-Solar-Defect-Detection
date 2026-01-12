import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get active model
    const { data: status } = await supabase
      .from('system_status')
      .select('active_model, canary_model, total_inferences, avg_latency')
      .single();

    if (!status) {
      throw new Error('System status not found');
    }

    // Determine which model to use (90/10 split if canary exists)
    const useCanary = status.canary_model && Math.random() < 0.1;
    const modelVersion = useCanary ? status.canary_model : status.active_model;

    // Simulate inference
    const isDefect = Math.random() > 0.4;
    const prediction = isDefect ? 'defect' : 'normal';
    const confidence = 0.75 + Math.random() * 0.23;
    const latencyMs = 18 + Math.random() * 35;
    const imageId = `img-${Math.random().toString(36).substr(2, 9)}`;

    // Simulate occasional mistakes (8% error rate)
    const hasError = Math.random() < 0.08;
    const actualLabel = hasError 
      ? (prediction === 'defect' ? 'normal' : 'defect')
      : prediction;

    // Insert inference log
    const { error: logError } = await supabase
      .from('inference_logs')
      .insert({
        image_id: imageId,
        model_version: modelVersion,
        prediction,
        confidence,
        actual_label: actualLabel,
        latency_ms: latencyMs,
        is_correct: prediction === actualLabel,
      });

    if (logError) {
      console.error('Error logging inference:', logError);
    }

    // Update system status counters
    const newTotal = (status.total_inferences || 0) + 1;
    const newAvg = status.avg_latency
      ? (status.avg_latency * 0.99) + (latencyMs * 0.01)
      : latencyMs;

    await supabase
      .from('system_status')
      .update({ 
        total_inferences: newTotal,
        avg_latency: newAvg,
      })
      .eq('id', 1);

    // Check for drift conditions and create alerts
    if (latencyMs > 80) {
      const { data: existingAlert } = await supabase
        .from('drift_alerts')
        .select('id')
        .eq('alert_type', 'latency')
        .eq('acknowledged', false)
        .single();

      if (!existingAlert) {
        await supabase
          .from('drift_alerts')
          .insert({
            alert_type: 'latency',
            severity: latencyMs > 100 ? 'critical' : 'warning',
            message: `Inference latency spike detected: ${latencyMs.toFixed(1)}ms`,
            current_value: latencyMs,
            threshold: 80,
          });
        console.log('Created latency alert');
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      inference: {
        imageId,
        modelVersion,
        prediction,
        confidence,
        latencyMs,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const error = err as Error;
    console.error('Simulate inference error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
