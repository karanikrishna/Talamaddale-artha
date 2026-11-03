'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { once } = require('node:events');
const { validateLayer, buildMessages } = require('../lib/prompts');

function listen(server) {
  server.listen(0, '127.0.0.1');
  return once(server, 'listening').then(() => server.address().port);
}

async function mockUpstream(t) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    requests.push({ body, authorization: req.headers.authorization || '' });
    const user = body.messages.find((m) => m.role === 'user').content;
    const marker = (user.match(/MARKER=([^\n]+)/) || [])[1] || 'unknown';
    if (body.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `A: ${marker} ಪ್ರಶ್ನೆಗೆ ಉತ್ತರ.\n` } }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `P: ${marker} ಬಗ್ಗೆ ನಿರ್ದಿಷ್ಟ ಆಕ್ಷೇಪ ಏನು?\n` } }] })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    const data = {
      cleaned_transcript: marker,
      scene: marker,
      interpretive_problem: `ಸಮಸ್ಯೆ ${marker}`,
      lookup_questions: ['ಪ್ರಶ್ನೆ ೧', 'ಪ್ರಶ್ನೆ ೨', 'ಪ್ರಶ್ನೆ ೩']
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(data) } }] }));
  });
  const port = await listen(server);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { port, requests };
}

async function startApp(t, env) {
  const probe = http.createServer();
  const port = await listen(probe);
  await new Promise((resolve) => probe.close(resolve));
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => { if (child.exitCode === null) child.kill('SIGTERM'); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timeout')), 5000);
    child.stdout.on('data', (d) => { if (String(d).includes('Dynamic input mode')) { clearTimeout(timer); resolve(); } });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Server exited ${code}`)); });
  });
  return `http://127.0.0.1:${port}`;
}

function payload(marker) {
  return { inputs: { pada: `MARKER=${marker}`, prasanga: 'ಪರೀಕ್ಷಾ ಪ್ರಸಂಗ', pathra: 'ಪಾತ್ರ', mode: 'dialogue', prativadi: 'ಪ್ರತಿವಾದಿ', outputLanguage: 'kn' }, previous: {}, controls: {} };
}

test('dynamic server sends the current padya on every run and never returns the sample', async (t) => {
  const upstream = await mockUpstream(t);
  const base = await startApp(t, { LLM_BASE_URL: `http://127.0.0.1:${upstream.port}/v1`, LLM_API_KEY: 'test-server-key', LLM_MODEL: 'test-model' });
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.version, '1.3.0-swagatha-dialogue');
  assert.equal(health.dynamicInput, true);
  assert.equal(health.configured, true);
  const outputs = [];
  for (const marker of ['FIRST-PADYA', 'SECOND-PADYA']) {
    const res = await fetch(`${base}/api/llm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'json', layer: 1, config: {}, payload: payload(marker) }) });
    assert.equal(res.status, 200);
    const j = await res.json();
    outputs.push(j.data.scene);
    assert.equal(j.data.cleaned_transcript, `MARKER=${marker}`);
    assert.match(upstream.requests.at(-1).body.messages[1].content, new RegExp(marker));
  }
  assert.notEqual(outputs[0], outputs[1]);
  const stream = await fetch(`${base}/api/llm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'stream', layer: 5, config: {}, payload: payload('STREAM-PADYA') }) });
  const text = await stream.text();
  assert.match(text, /STREAM-PADYA/);
  assert.match(text, /^P:/m);
});

test('server rejects missing input and missing remote key instead of inventing an answer', async (t) => {
  const base = await startApp(t, { LLM_BASE_URL: 'https://api.openai.com/v1', LLM_API_KEY: '', LLM_MODEL: 'test-model' });
  let res = await fetch(`${base}/api/llm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'json', layer: 1, payload: { inputs: { pada: '', prasanga: '', pathra: '' } } }) });
  assert.equal(res.status, 400);
  res = await fetch(`${base}/api/llm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'json', layer: 1, config: {}, payload: payload('NO-KEY') }) });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /No model API key/);
});

test('server-owned key is not forwarded to a different browser-supplied provider', async (t) => {
  const upstream = await mockUpstream(t);
  const base = await startApp(t, { LLM_BASE_URL: 'https://api.openai.com/v1', LLM_API_KEY: 'secret-server-key', LLM_MODEL: 'test-model' });
  const res = await fetch(`${base}/api/llm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'json', layer: 1, config: { baseUrl: `http://127.0.0.1:${upstream.port}/v1`, allowNoKey: true }, payload: payload('OTHER-PROVIDER') }) });
  assert.equal(res.status, 200);
  assert.equal(upstream.requests.at(-1).authorization, '');
});

test('knowledge layer permits zero recalled sources and prompts prohibit reusing old padya', () => {
  const out = validateLayer(2, { passages: [] }, { inputs: { pada: 'ಹೊಸ ಪದ್ಯ' } });
  assert.equal(out.passages.length, 0);
  assert.match(out.uncertainty_note, /ಮೂಲ ಲಭ್ಯವಿಲ್ಲ/);
  const messages = buildMessages(1, payload('CURRENT'));
  assert.match(messages[0].content, /Never reuse an example, a previous padya, or a cached dialogue/);
  assert.match(messages[1].content, /MARKER=CURRENT/);
});


test('server accepts swagatha without pathra/prativadi and rejects invalid mode', async (t) => {
  const upstream = await mockUpstream(t);
  const base = await startApp(t, { LLM_BASE_URL: `http://127.0.0.1:${upstream.port}/v1`, LLM_API_KEY: 'test', LLM_MODEL: 'test' });
  const res = await fetch(`${base}/api/llm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'json', layer: 1, config: {}, payload: { inputs: { pada: 'ಸ್ವಗತ ಪದ್ಯ', prasanga: 'ಪ್ರಸಂಗ', mode: 'swagatha' } } }) });
  assert.equal(res.status, 200);
  const bad = await fetch(`${base}/api/llm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'json', layer: 1, config: {}, payload: { inputs: { pada: 'ಪದ್ಯ', prasanga: 'ಪ್ರಸಂಗ', mode: 'debate' } } }) });
  assert.equal(bad.status, 400);
});
