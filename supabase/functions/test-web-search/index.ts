import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...cors, "Access-Control-Allow-Methods": "POST" } });
  }

  try {
    console.log("🚀 [TEST] Starting web search test");
    
    const systemPrompt = 
      "You are a market analyst. IMPORTANT: After using web_search, you MUST output results as JSON.\n" +
      "Output exactly this JSON format:\n" +
      "{\"events\": [{\"event\": \"name\", \"date\": \"YYYY-MM-DD\", \"source\": \"url\"}]}";
    
    const userPrompt = 
      "Current date: " + new Date().toISOString().split('T')[0] + "\n\n" +
      "STEP 1: Use web_search to find:\n" +
      "- Search 'site:federalreserve.gov FOMC meeting schedule 2025' for next Fed meeting\n" +
      "- Search 'site:bls.gov CPI release dates 2025' for next CPI release\n" +
      "- Calculate next triple witching (third Friday of September 2025)\n\n" +
      "STEP 2: After searching, output JSON with the exact dates found:\n" +
      "{\"events\": [\n" +
      "  {\"event\": \"FOMC Meeting\", \"date\": \"2025-XX-XX\", \"source\": \"federalreserve.gov\"},\n" +
      "  {\"event\": \"CPI Release\", \"date\": \"2025-XX-XX\", \"source\": \"bls.gov\"},\n" +
      "  {\"event\": \"Triple Witching\", \"date\": \"2025-09-19\", \"source\": \"calculated\"}\n" +
      "]}";
    
    // Log the request we're making
    console.log("📝 [TEST] System prompt:", systemPrompt);
    console.log("📝 [TEST] User prompt:", userPrompt);
    
    const requestBody = {
      model: "gpt-5",
      reasoning: { effort: "low" },
      instructions: systemPrompt,  // System instructions go here
      input: userPrompt,           // User request goes here
      tools: [{ 
        type: "web_search",
        filters: { 
          allowed_domains: [
            "federalreserve.gov",
            "bls.gov",
            "farside.co.uk",
            "blackrock.com"
          ] 
        }
      }],
      tool_choice: "auto",
      // Cannot use JSON format with web_search - will parse manually
      include: ["web_search_call.action.sources"],
      max_output_tokens: 2000,
      parallel_tool_calls: true
    };
    
    console.log("🔍 [TEST] Request body:", JSON.stringify(requestBody, null, 2));
    
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${OPENAI_API_KEY}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(requestBody)
    });
    
    const raw = await res.json();
    
    // Log everything we got back
    console.log("📡 [TEST] Response status:", res.status);
    console.log("📡 [TEST] Full response:", JSON.stringify(raw, null, 2));
    
    if (!res.ok) {
      console.error("❌ [TEST] API Error:", raw);
      return new Response(JSON.stringify({
        success: false,
        error: raw?.error?.message || `API error ${res.status}`,
        debugInfo: {
          status: res.status,
          error: raw
        }
      }), { 
        status: 400, 
        headers: { "Content-Type": "application/json", ...cors } 
      });
    }
    
    // Check what we got
    console.log("🌐 [TEST] Web search call:", raw.web_search_call);
    console.log("🌐 [TEST] Sources found:", raw.web_search_call?.action?.sources);
    console.log("📄 [TEST] Output text:", raw.output_text);
    console.log("📄 [TEST] Output array:", raw.output);
    
    // Try to parse the result
    let parsedResult = null;
    try {
      if (raw.output_text) {
        parsedResult = JSON.parse(raw.output_text);
      } else if (Array.isArray(raw.output)) {
        const text = raw.output
          .flatMap((item: any) => 
            Array.isArray(item?.content) 
              ? item.content.map((c: any) => c?.text || "").filter(Boolean)
              : []
          )
          .join("");
        if (text) {
          parsedResult = JSON.parse(text);
        }
      }
    } catch (e) {
      console.error("⚠️ [TEST] Failed to parse JSON:", e);
    }
    
    // Return everything for debugging
    return new Response(JSON.stringify({
      success: true,
      parsedResult,
      debugInfo: {
        hasWebSearchCall: !!raw.web_search_call,
        webSearchStatus: raw.web_search_call?.status,
        sources: raw.web_search_call?.action?.sources,
        hasOutputText: !!raw.output_text,
        hasOutputArray: !!raw.output,
        rawResponse: raw
      }
    }, null, 2), {
      headers: { "Content-Type": "application/json", ...cors }
    });
    
  } catch (err) {
    console.error("💥 [TEST] Exception:", err);
    return new Response(JSON.stringify({
      success: false,
      error: String(err),
      stack: err.stack
    }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...cors } 
    });
  }
});