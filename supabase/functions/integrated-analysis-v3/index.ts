/**
 * Integrated Analysis V3 Edge Function
 *
 * Main orchestrator for the portfolio recommendations system.
 * Receives portfolio data and returns A-F grading with upgrade recommendations.
 */

import { generateRecommendations } from './coach/recommendations.ts';
import type { RecommendationsResult } from './types/recommendations.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body = await req.json();

    // Validate required fields (shareBasis is optional, defaults to currentPrice)
    const requiredFields = ['ticker', 'currentPrice', 'shareCount', 'portfolioValue', 'positions', 'strategies'];
    const missingFields = requiredFields.filter((field) => body[field] === undefined);

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields',
          missing: missingFields,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate positions array
    if (!Array.isArray(body.positions)) {
      return new Response(
        JSON.stringify({ success: false, error: 'positions must be an array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate strategies array
    if (!Array.isArray(body.strategies)) {
      return new Response(
        JSON.stringify({ success: false, error: 'strategies must be an array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[integrated-analysis-v3] Processing ${body.ticker}...`);
    console.log(`  - ${body.positions.length} positions`);
    console.log(`  - ${body.strategies.length} strategies`);
    console.log(`  - Portfolio value: $${body.portfolioValue.toFixed(2)}`);

    // Generate recommendations
    const result: RecommendationsResult = await generateRecommendations(body);

    console.log(`[integrated-analysis-v3] Complete. Overall grade: ${result.overallGrade} (${result.overallScore}/100)`);
    console.log(`  - Coverage: ${result.grades.coverage.grade}`);
    console.log(`  - Income: ${result.grades.income.grade}`);
    console.log(`  - Risk: ${result.grades.risk.grade}`);
    console.log(`  - Upside: ${result.grades.upside.grade}`);
    console.log(`  - Sophistication: ${result.grades.sophistication.grade}`);

    // Wrap result in standard Supabase response format
    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[integrated-analysis-v3] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
