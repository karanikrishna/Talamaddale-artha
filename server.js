'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const { buildMessages, extractJson, validateLayer } = require('./lib/prompts');
const { normalizeKannadaTerms, resolveMode } = require('./lib/kannada');
const { BOOK_REFERENCES, CRAFT_GUIDANCE_KN } = require('./lib/guidance');

const APP_VERSION = '1.3.0-swagatha-dialogue';
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 2 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store'
  });
  res.end(text);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store'
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  try {
    rel = decodeURIComponent(rel);
  } catch (_) {
    return sendText(res, 400, 'Bad path');
  }
  const filePath = path.resolve(PUBLIC_DIR, '.' + rel);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== path.join(PUBLIC_DIR, 'index.html')) {
    return sendText(res, 403, 'Forbidden');
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return sendText(res, 404, 'Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function isLocalEndpoint(value) {
  try {
    const u = new URL(value);
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(u.hostname);
  } catch (_) {
    return false;
  }
}

function resolveConfig(config) {
  const c = config && typeof config === 'object' ? config : {};
  const defaultBase = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
  const requestedBase = String(c.baseUrl || '').trim();
  const baseUrl = (requestedBase || defaultBase).replace(/\/+$/, '');
  const browserKey = String(c.apiKey || '').trim();
  // Never send a server-owned key to a different provider supplied by a browser.
  const mayUseServerKey = !requestedBase || requestedBase.replace(/\/+$/, '') === defaultBase.replace(/\/+$/, '');
  const apiKey = browserKey || (mayUseServerKey ? String(process.env.LLM_API_KEY || '').trim() : '');
  let parsed;
  try {
    parsed = new URL(chatEndpoint(baseUrl));
  } catch (_) {
    const err = new Error('Model Base URL is invalid. Use a complete HTTPS URL, such as https://api.openai.com/v1.');
    err.status = 400;
    throw err;
  }
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    const err = new Error('The model endpoint must use HTTP(S), without embedded credentials.');
    err.status = 400;
    throw err;
  }
  const local = isLocalEndpoint(baseUrl);
  if (parsed.protocol === 'http:' && !local) {
    const err = new Error('Use HTTPS for a public model endpoint. HTTP is allowed only for a local model server.');
    err.status = 400;
    throw err;
  }
  const allowNoKey = c.allowNoKey === true || process.env.LLM_ALLOW_NO_KEY === 'true';
  if (!apiKey && !local && !allowNoKey) {
    const err = new Error('No model API key is configured. Open Model settings and enter your own key, or explicitly enable a public endpoint that needs no key. The example is never used as a generated answer.');
    err.status = 400;
    throw err;
  }
  const model = String(c.model || process.env.LLM_MODEL || 'gpt-4o-mini').trim();
  if (!model) {
    const err = new Error('Choose a model in Model settings.');
    err.status = 400;
    throw err;
  }
  return {
    baseUrl,
    apiKey,
    model,
    temperature: c.temperature === '' || c.temperature === null || c.temperature === undefined ? null : Number(c.temperature),
    maxTokens: c.maxTokens === '' || c.maxTokens === null || c.maxTokens === undefined ? null : Number(c.maxTokens),
    tokenParam: ['max_tokens', 'max_completion_tokens', 'none'].includes(c.tokenParam) ? c.tokenParam : 'max_tokens'
  };
}

function validateInput(payload) {
  const i = payload && payload.inputs;
  if (!i || typeof i !== 'object') {
    const err = new Error('Padya, prasanga and pathra are required.'); err.status = 400; throw err;
  }
  for (const [key, label] of [['pada', 'Padya'], ['prasanga', 'Prasanga']]) {
    if (typeof i[key] !== 'string' || !i[key].trim()) {
      const err = new Error(`${label} is required. Enter the current input before generating.`); err.status = 400; throw err;
    }
  }
  const mode = i.mode === undefined ? resolveMode(i) : String(i.mode).trim().toLowerCase();
  if (!['swagatha', 'dialogue'].includes(mode)) {
    const err = new Error('Mode must be swagatha or dialogue.'); err.status = 400; throw err;
  }
  
}

function safeUpstreamError(raw, cfg) {
  let text = String(raw || '').slice(0, 900);
  if (cfg.apiKey) text = text.split(cfg.apiKey).join('[redacted]');
  return text.replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]');
}

function chatEndpoint(baseUrl) {
  const clean = baseUrl.replace(/\/+$/, '');
  return clean.endsWith('/chat/completions') ? clean : `${clean}/chat/completions`;
}

function upstreamHeaders(cfg) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  return headers;
}

function requestBody(cfg, messages, stream) {
  const body = {
    model: cfg.model,
    messages,
    stream: Boolean(stream)
  };
  if (cfg.temperature !== null && Number.isFinite(cfg.temperature)) {
    body.temperature = cfg.temperature;
  }
  if (cfg.maxTokens !== null && Number.isFinite(cfg.maxTokens) && cfg.tokenParam !== 'none') {
    body[cfg.tokenParam] = Math.max(1, Math.round(cfg.maxTokens));
  }
  return body;
}

function contentFromMessage(message) {
  if (!message) return '';
  const c = message.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c.map((part) => (typeof part === 'string' ? part : part && (part.text || part.content) || '')).join('');
  }
  return '';
}

function contentFromResponse(data) {
  if (typeof data === 'string') return data;
  if (data && typeof data.output_text === 'string') return data.output_text;
  if (data && Array.isArray(data.choices) && data.choices[0]) {
    const direct = contentFromMessage(data.choices[0].message);
    if (direct) return direct;
    if (typeof data.choices[0].text === 'string') return data.choices[0].text;
  }
  if (data && Array.isArray(data.content)) {
    return data.content.map((part) => part && (part.text || '')).join('');
  }
  return '';
}

function deltaFromSsePayload(payload) {
  const trimmed = payload.trim();
  if (!trimmed) return null;
  if (trimmed === '[DONE]') return '__DONE__';
  try {
    const j = JSON.parse(trimmed);
    if (j && Array.isArray(j.choices) && j.choices[0]) {
      const delta = j.choices[0].delta;
      if (typeof delta === 'string') return delta;
      if (delta && typeof delta.content === 'string') return delta.content;
      if (delta && Array.isArray(delta.content)) {
        return delta.content.map((p) => (typeof p === 'string' ? p : p && (p.text || '') || '')).join('');
      }
      if (typeof j.choices[0].text === 'string') return j.choices[0].text;
    }
    if (j && typeof j.output_text === 'string') return j.output_text;
    if (j && j.delta && typeof j.delta.text === 'string') return j.delta.text;
    if (j && j.content_block && typeof j.content_block.text === 'string') return j.content_block.text;
    if (j && typeof j.text === 'string') return j.text;
  } catch (_) {
    return null;
  }
  return null;
}

async function callJsonLayer(req, res, body, signal) {
  const cfg = resolveConfig(body.config);
  const layer = Number(body.layer);
  validateInput(body.payload);
  const messages = buildMessages(layer, body.payload || {});
  const response = await fetch(chatEndpoint(cfg.baseUrl), {
    method: 'POST',
    headers: upstreamHeaders(cfg),
    body: JSON.stringify(requestBody(cfg, messages, false)),
    signal
  });
  const raw = await response.text();
  if (!response.ok) {
    const err = new Error(`Upstream ${response.status}: ${safeUpstreamError(raw, cfg)}`);
    err.status = 502;
    throw err;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (_) {
    const err = new Error(`Upstream returned non-JSON: ${safeUpstreamError(raw, cfg)}`);
    err.status = 502;
    throw err;
  }
  const text = contentFromResponse(data);
  if (!text.trim()) {
    const err = new Error('Upstream returned an empty completion.');
    err.status = 502;
    throw err;
  }
  const parsed = extractJson(text);
  const validated = validateLayer(layer, parsed, body.payload || {});
  return sendJson(res, 200, { ok: true, layer, data: validated, model: cfg.model });
}

async function callStreamLayer(req, res, body, signal) {
  const cfg = resolveConfig(body.config);
  validateInput(body.payload);
  const messages = buildMessages(5, body.payload || {});
  const response = await fetch(chatEndpoint(cfg.baseUrl), {
    method: 'POST',
    headers: { ...upstreamHeaders(cfg), Accept: 'text/event-stream' },
    body: JSON.stringify(requestBody(cfg, messages, true)),
    signal
  });
  const rawHead = response.headers.get('content-type') || '';
  if (!response.ok) {
    const raw = await response.text();
    const err = new Error(`Upstream ${response.status}: ${safeUpstreamError(raw, cfg)}`);
    err.status = 502;
    throw err;
  }

  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
    'Connection': 'keep-alive'
  });
  res.flushHeaders?.();

  // Some OpenAI-compatible servers ignore stream:true and return one JSON body.
  if (!response.body || !/event-stream|text\/plain|application\/x-ndjson/i.test(rawHead)) {
    const raw = await response.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (_) { /* use raw text */ }
    const text = data ? contentFromResponse(data) : raw;
    res.write(normalizeKannadaTerms(text || ''));
    res.end();
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lineBuffer = '';
  let done = false;

  // Normalize complete lines so known Kannada lipi variants are corrected even
  // when a model splits a word across streamed chunks. Partial lines are kept
  // until a newline or end-of-stream.
  function pushText(text) {
    lineBuffer += String(text || '');
    let idx;
    while ((idx = lineBuffer.indexOf('\n')) >= 0) {
      const line = lineBuffer.slice(0, idx);
      lineBuffer = lineBuffer.slice(idx + 1);
      res.write(normalizeKannadaTerms(line) + '\n');
    }
  }
  function flushText() {
    if (lineBuffer) {
      res.write(normalizeKannadaTerms(lineBuffer));
      lineBuffer = '';
    }
  }

  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;
    if (done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
      if (!line.trim() || line.startsWith(':')) continue;
      if (line.startsWith('data:')) {
        const delta = deltaFromSsePayload(line.slice(5));
        if (delta === '__DONE__') { done = true; break; }
        if (delta) pushText(delta);
      } else if (line.startsWith('{')) {
        // NDJSON-style providers.
        const delta = deltaFromSsePayload(line);
        if (delta === '__DONE__') { done = true; break; }
        if (delta) pushText(delta);
      }
    }
  }
  if (buffer.trim()) {
    const candidate = buffer.trim().startsWith('data:') ? buffer.trim().slice(5) : buffer.trim();
    const delta = deltaFromSsePayload(candidate);
    if (delta && delta !== '__DONE__') pushText(delta);
  }
  flushText();
  res.end();
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      mode: 'dynamic-live-llm',
      version: APP_VERSION,
      dynamicInput: true,
      modes: ['swagatha', 'dialogue'],
      configured: Boolean(process.env.LLM_API_KEY) || isLocalEndpoint(process.env.LLM_BASE_URL || '') || process.env.LLM_ALLOW_NO_KEY === 'true',
      serverHasKey: Boolean(process.env.LLM_API_KEY),
      serverHasBaseUrl: Boolean(process.env.LLM_BASE_URL),
      serverHasModel: Boolean(process.env.LLM_MODEL)
    });
  }
  if (url.pathname === '/api/guidance') {
    return sendJson(res, 200, { ok: true, canonical_term: 'ತಾಳಮದ್ದಳೆ', books: BOOK_REFERENCES, guidance: CRAFT_GUIDANCE_KN });
  }
  if (url.pathname !== '/api/llm' || req.method !== 'POST') {
    return sendJson(res, 404, { ok: false, error: 'Not found' });
  }
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  let body;
  try {
    const raw = await readBody(req);
    body = JSON.parse(raw || '{}');
  } catch (err) {
    return sendJson(res, 400, { ok: false, error: `Bad request: ${err.message}` });
  }
  try {
    const layer = Number(body.layer);
    if (body.kind === 'stream') {
      if (layer !== 5) throw new Error('Only layer 5 may stream.');
      await callStreamLayer(req, res, body, controller.signal);
    } else {
      if (![1, 2, 3, 4].includes(layer)) throw new Error('JSON layers are 1 to 4.');
      await callJsonLayer(req, res, body, controller.signal);
    }
  } catch (err) {
    if (err.name === 'AbortError' || controller.signal.aborted) {
      if (!res.headersSent) sendJson(res, 499, { ok: false, error: 'Stopped.' });
      else if (!res.writableEnded) res.end();
      return;
    }
    if (res.headersSent) {
      if (!res.writableEnded) res.end();
      return;
    }
    return sendJson(res, err.status || 500, { ok: false, error: err.message || 'LLM call failed.' });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((err) => {
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: err.message || 'Server error' });
      else if (!res.writableEnded) res.end();
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendText(res, 405, 'Method not allowed');
  }
  serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`Talamaddale Artha running at http://${HOST}:${PORT}`);
  console.log(`Dynamic input mode (${APP_VERSION}). Configure a model; every run uses the current padya.`);
});
