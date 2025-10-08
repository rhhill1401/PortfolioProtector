/**
 * OpenAI GPT-5 Client Wrapper
 *
 * Handles API calls to OpenAI Chat Completions API with retry logic and error handling.
 * Uses GPT-5 reasoning models to get detailed thinking and structured JSON output.
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

// Use env var for model selection, default to GPT-5 reasoning model
const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-5-preview';

/**
 * Call OpenAI Chat Completions API with retry logic
 *
 * Uses reasoning-capable models (GPT-5 family) to get structured recommendations.
 * Enables JSON mode for structured output and logs reasoning when available.
 *
 * @param systemPrompt - System instructions
 * @param userPrompt - User message
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @param timeout - Timeout in milliseconds (default: 120000 for reasoning models)
 * @returns AI response text (structured JSON when using GPT-5 models)
 */
export async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  maxRetries = 3,
  timeout = 120000, // Longer timeout for reasoning models
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Call Chat Completions API with JSON mode for structured output
      const response = await openai.chat.completions.create(
        {
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000, // More tokens for reasoning output
          // Request JSON output for GPT-5 reasoning models
          response_format: { type: 'json_object' },
        },
        { signal: controller.signal },
      );

      clearTimeout(timeoutId);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      // Log reasoning metadata if available (some models expose this)
      const reasoning = (response.choices[0]?.message as any)?.reasoning;
      if (reasoning) {
        const reasoningStr = typeof reasoning === 'string'
          ? reasoning
          : JSON.stringify(reasoning);
        console.log('[OpenAI] Reasoning steps:', reasoningStr.substring(0, 200) + '...');
      }

      return content;
    } catch (error) {
      lastError = error as Error;
      console.error(`OpenAI call failed (attempt ${attempt}/${maxRetries}):`, error);

      if (attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`OpenAI call failed after ${maxRetries} attempts: ${lastError?.message}`);
}
