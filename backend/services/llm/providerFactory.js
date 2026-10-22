/**
 * Provider Factory for CareerSaathi AI LLM Services
 * Resolves active LLM adapter dynamically based on LLM_PROVIDER.
 */

const geminiAdapter = require('./adapters/geminiAdapter');
const ollamaAdapter = require('./adapters/ollamaAdapter');

const providers = {
  gemini: geminiAdapter,
  ollama: ollamaAdapter,
};

/**
 * Returns the configured LLM provider adapter.
 * @param {string} [overrideProvider]
 * @returns {Object} Active provider adapter
 */
const getActiveProvider = (overrideProvider) => {
  const providerKey = (
    overrideProvider ||
    process.env.LLM_PROVIDER ||
    'gemini'
  ).toLowerCase().trim();

  const provider = providers[providerKey];
  if (!provider) {
    throw new Error(
      `Unsupported LLM_PROVIDER: "${providerKey}". Supported providers are: ${Object.keys(
        providers
      ).join(', ')}`
    );
  }

  return provider;
};

module.exports = {
  getActiveProvider,
  registeredProviders: Object.keys(providers),
};
