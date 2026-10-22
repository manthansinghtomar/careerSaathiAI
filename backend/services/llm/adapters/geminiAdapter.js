/**
 * Gemini Adapter for CareerSaathi AI
 * Connects to Google's official Gemini Generative Language REST API (v1beta).
 * Native Node.js fetch implementation (Zero external npm dependencies).
 */

const getGeminiConfig = () => {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const model = (process.env.GEMINI_MODEL || 'gemini-3.8-flash').trim();
  return { apiKey, model };
};

/**
 * Executes prompt against Gemini API or mock transport.
 * @param {Object} params
 * @param {string} params.prompt - Formatted system and user prompt.
 * @param {Function} [params.transportOverride] - Optional mock transport for zero-cost automated tests.
 * @returns {Promise<string>} Raw text output from Gemini.
 */
const generateContent = async ({ prompt, transportOverride }) => {
  // If mock transport is injected (used in automated tests), bypass network completely
  if (typeof transportOverride === 'function') {
    return await transportOverride({ prompt });
  }

  const { apiKey, model } = getGeminiConfig();

  if (!apiKey) {
    const error = new Error('AI Evaluation service is temporarily unconfigured: GEMINI_API_KEY is missing');
    error.statusCode = 503;
    throw error;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errDetails = '';
        try {
          const errJson = await response.json();
          errDetails = errJson.error?.message || response.statusText;
        } catch (_) {
          errDetails = response.statusText;
        }

        // Retry transient 503 or 429
        if ((response.status === 503 || response.status === 429) && attempt < maxRetries) {
          const delayMs = attempt * 1500;
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        if (response.status === 429) {
          const rateLimitErr = new Error(`Gemini rate limit exceeded: ${errDetails}`);
          rateLimitErr.statusCode = 429;
          throw rateLimitErr;
        }

        const apiErr = new Error(`Gemini API error [${response.status}]: ${errDetails}`);
        apiErr.statusCode = response.status >= 500 ? 503 : 500;
        throw apiErr;
      }

      const data = await response.json();
      const candidateText =
        data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText || typeof candidateText !== 'string') {
        const emptyErr = new Error('Gemini API returned an empty or invalid candidate structure');
        emptyErr.statusCode = 502;
        throw emptyErr;
      }

      return candidateText;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('Gemini API request timed out after 15 seconds');
        timeoutErr.statusCode = 504;
        throw timeoutErr;
      }
      if (attempt >= maxRetries) {
        throw err;
      }
      // Wait before retry
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }

  throw lastError;
};

module.exports = {
  providerName: 'gemini',
  getGeminiConfig,
  generateContent,
};
