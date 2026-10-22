/**
 * Ollama Adapter Specification for CareerSaathi AI (Future Clone Extension)
 * Designed for use on a separate, capable PC with local Ollama running.
 * Standard endpoint: http://localhost:11434/api/generate
 */

const getOllamaConfig = () => {
  const host = (process.env.OLLAMA_HOST || 'http://localhost:11434').trim();
  const model = (process.env.OLLAMA_MODEL || 'llama3:8b').trim();
  return { host, model };
};

/**
 * Executes prompt against local Ollama service.
 * @param {Object} params
 * @param {string} params.prompt
 * @param {Function} [params.transportOverride]
 * @returns {Promise<string>}
 */
const generateContent = async ({ prompt, transportOverride }) => {
  if (typeof transportOverride === 'function') {
    return await transportOverride({ prompt });
  }

  const { host, model } = getOllamaConfig();
  const url = `${host}/api/generate`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: 'json',
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama service returned HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Ollama request timed out after 60 seconds');
    }
    throw err;
  }
};

module.exports = {
  providerName: 'ollama',
  getOllamaConfig,
  generateContent,
};
