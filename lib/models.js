'use strict';

/**
 * Model fallback selection.
 *
 * Gemini's flagship Flash models regularly return
 * `503 UNAVAILABLE — This model is currently experiencing high demand`.
 * The lighter free-tier Flash-Lite models are far less contended, so when the
 * configured endpoint is Gemini we fall back to them automatically.
 * These are provider-side load decisions, not judgements about output quality.
 */
const GEMINI_LITE_FALLBACKS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

function isGeminiEndpoint(baseUrl) {
  return /generativelanguage\.googleapis\.com/i.test(String(baseUrl || ''));
}

/**
 * @returns {string[]} ordered fallback models, never containing the primary
 */
function resolveFallbackModels({ baseUrl, model, configured }) {
  const explicit = String(configured || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const list = explicit.length ? explicit : (isGeminiEndpoint(baseUrl) ? GEMINI_LITE_FALLBACKS : []);
  return Array.from(new Set(list)).filter((m) => m !== model);
}

module.exports = { GEMINI_LITE_FALLBACKS, isGeminiEndpoint, resolveFallbackModels };
