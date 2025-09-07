import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: "Test deploy works!",
      timestamp: new Date().toISOString()
    }),
    { 
      headers: { ...cors, "Content-Type": "application/json" },
      status: 200 
    }
  );
});