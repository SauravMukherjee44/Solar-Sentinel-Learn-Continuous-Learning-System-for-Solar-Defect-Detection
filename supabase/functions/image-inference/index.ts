import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;
    const generateHeatmap = formData.get('generate_heatmap') === 'true';

    if (!imageFile) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();

    // Convert image to base64 (chunked to avoid stack overflow)
    const arrayBuffer = await imageFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const chunkSize = 8192;
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Image = btoa(binaryString);
    const mimeType = imageFile.type || 'image/png';
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Use Vision AI for defect detection
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert solar cell defect detection system analyzing electroluminescence (EL) images of photovoltaic cells.

Your task is to classify images as either "normal" (no defects) or "defect" (contains cracks, micro-cracks, dead cells, or other issues).

Analyze the image carefully and respond with ONLY a JSON object in this exact format:
{
  "prediction": "normal" or "defect",
  "confidence": 0.0 to 1.0,
  "defect_type": null or "crack" or "micro-crack" or "dead_cell" or "finger_interruption",
  "reasoning": "brief explanation of what you observed"
}

For EL images:
- Normal cells appear uniformly bright
- Defects appear as dark lines, spots, or regions
- Cracks appear as thin dark lines
- Dead cells appear as completely dark areas
- Micro-cracks are very fine dark lines`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this electroluminescence image of a solar cell for defects. Respond with JSON only.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageDataUrl
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1 // Low temperature for consistent classification
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';

    const latencyMs = Date.now() - startTime;

    // Parse JSON from response
    let prediction = 'normal';
    let confidence = 0.5;
    let reasoning = '';
    let defectType = null;

    try {
      // Extract JSON from response (handle potential markdown code blocks)
      let jsonStr = content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      } else {
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonStr = objectMatch[0];
        }
      }

      const parsed = JSON.parse(jsonStr);
      prediction = parsed.prediction || 'normal';
      confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;
      reasoning = parsed.reasoning || '';
      defectType = parsed.defect_type || null;
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      // Fallback: check if content contains defect-related words
      if (content.toLowerCase().includes('defect') || content.toLowerCase().includes('crack')) {
        prediction = 'defect';
        confidence = 0.7;
      }
    }

    // Ensure confidence is between 0 and 1
    confidence = Math.max(0, Math.min(1, confidence));

    const result = {
      prediction,
      confidence,
      latency_ms: latencyMs,
      model_version: 'Vision AI',
      defect_type: defectType,
      reasoning,
      gradcam_heatmap: null // AI doesn't generate GradCAM
    };

    console.log(`Inference result: ${prediction} (${(confidence * 100).toFixed(1)}%) in ${latencyMs}ms`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Inference error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});