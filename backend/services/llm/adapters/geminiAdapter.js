/**
 * Gemini Adapter for CareerSaathi AI
 * Connects to Google's official Gemini Generative Language REST API (v1beta).
 * Native Node.js fetch implementation (Zero external npm dependencies).
 */

const FALLBACK_MODEL = 'gemini-2.5-flash';

const sanitizeErrorMessage = (msg) => {
  if (!msg || typeof msg !== 'string') return 'Unknown error';
  return msg
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]')
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]');
};

const getGeminiConfig = () => {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const configuredModel = (process.env.GEMINI_MODEL || '').trim();
  const model = configuredModel || FALLBACK_MODEL;
  return { apiKey, model, fallbackModel: FALLBACK_MODEL };
};

/**
 * Executes prompt against Gemini API or mock transport.
 * @param {Object} params
 * @param {string} params.prompt - Formatted system and user prompt.
 * @param {Function} [params.transportOverride] - Optional mock transport for zero-cost automated tests.
 * @returns {Promise<string>} Raw text output from Gemini.
 */
const generateContent = async ({ prompt, transportOverride }) => {
  const { apiKey, model: primaryModel } = getGeminiConfig();

  // If mock transport is injected (used in automated tests), bypass network completely
  if (typeof transportOverride === 'function') {
    return await transportOverride({ prompt, model: primaryModel, fallbackModel: FALLBACK_MODEL });
  }

  if (!apiKey) {
    const error = new Error('AI Evaluation service is temporarily unconfigured: GEMINI_API_KEY is missing');
    error.statusCode = 503;
    throw error;
  }

  // Internal helper to execute a request against a specific model with transient retry
  const executeWithModel = async (modelToUse) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
    const maxRetries = 2;
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

          errDetails = sanitizeErrorMessage(errDetails);

          // Retry transient 503 or 429
          if ((response.status === 503 || response.status === 429) && attempt < maxRetries) {
            const delayMs = attempt * 1500;
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }

          const apiErr = new Error(`Gemini API error [${response.status}]: ${errDetails}`);
          apiErr.statusCode = response.status >= 500 ? 503 : response.status;
          apiErr.rawStatus = response.status;
          throw apiErr;
        }

        const data = await response.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

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
          timeoutErr.rawStatus = 504;
          lastError = timeoutErr;
        }
        if (attempt < maxRetries && (lastError.rawStatus === 503 || lastError.rawStatus === 429 || lastError.statusCode === 504)) {
          await new Promise((r) => setTimeout(r, attempt * 1500));
        } else {
          throw lastError;
        }
      }
    }

    throw lastError;
  };

  // 1. Attempt primary configured model
  try {
    return await executeWithModel(primaryModel);
  } catch (primaryErr) {
    const isRecoverableModelError =
      primaryErr.rawStatus === 404 || // Model not found or deprecated
      primaryErr.rawStatus === 503 || // High demand / upstream service unavailable
      primaryErr.rawStatus === 429;   // Model-specific quota exceeded

    // If primary failed with a recoverable model error and is not already the fallback model, try fallback
    if (isRecoverableModelError && primaryModel !== FALLBACK_MODEL) {
      try {
        return await executeWithModel(FALLBACK_MODEL);
      } catch (fallbackErr) {
        // Both primary and fallback failed; sanitize and throw informative error
        const cleanMsg = sanitizeErrorMessage(fallbackErr.message || primaryErr.message);
        const finalErr = new Error(`AI evaluation service unavailable: ${cleanMsg}`);
        finalErr.statusCode = fallbackErr.statusCode || 503;
        throw finalErr;
      }
    }

    // For non-recoverable errors (e.g. 400 Bad Request, 401/403 Auth failure) or if already fallback model
    const cleanMsg = sanitizeErrorMessage(primaryErr.message);
    const finalErr = new Error(cleanMsg);
    finalErr.statusCode = primaryErr.statusCode || 500;
    throw finalErr;
  }
};

module.exports = {
  providerName: 'gemini',
  FALLBACK_MODEL,
  sanitizeErrorMessage,
  getGeminiConfig,
  generateContent,
};
