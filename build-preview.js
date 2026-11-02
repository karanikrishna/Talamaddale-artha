'use strict';

/* Builds public/preview.html: a single self-contained file for the workspace
   file viewer. All CSS, JS and fonts are inlined; live LLM calls are stubbed
   because the sandboxed viewer has no network. The live app remains index.html. */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const FONTS = path.join(PUB, 'fonts');

function read(rel) {
  return fs.readFileSync(path.join(PUB, rel), 'utf8');
}

function inlineFonts(css) {
  return css.replace(/url\(['"]?fonts\/([^'")]+)['"]?\)/g, (_match, file) => {
    const bytes = fs.readFileSync(path.join(FONTS, file));
    return `url('data:font/woff2;base64,${bytes.toString('base64')}')`;
  });
}

function inlineScript(source) {
  const safe = source.replace(/<\/script/gi, '<\\/script');
  return `<script>\n${safe}\n</script>`;
}

const stub = `
window.TALA_STATIC_PREVIEW = true;
(function () {
  // Opaque-origin sandboxed iframes can deny localStorage. Best-effort shim.
  try {
    window.localStorage.getItem('__tala_probe__');
  } catch (_) {
    var memory = {};
    try {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
          getItem: function (k) { return Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null; },
          setItem: function (k, v) { memory[k] = String(v); },
          removeItem: function (k) { delete memory[k]; },
          clear: function () { memory = {}; }
        }
      });
    } catch (_) { /* app also wraps storage access in try/catch */ }
  }
  if (!window.matchMedia) window.matchMedia = function () { return { matches: false, addEventListener: function () {}, removeEventListener: function () {} }; };
  var nativeFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  function jsonResponse(body, ok, status) {
    return Promise.resolve({
      ok: ok,
      status: status,
      headers: { get: function () { return 'application/json'; } },
      body: null,
      text: function () { return Promise.resolve(JSON.stringify(body)); },
      json: function () { return Promise.resolve(body); }
    });
  }
  window.fetch = function (url, options) {
    var u = String(url);
    if (u.indexOf('/api/health') !== -1) {
      return jsonResponse({ ok: true, mode: 'static-preview', serverHasKey: false, serverHasBaseUrl: false, serverHasModel: false }, true, 200);
    }
    if (u.indexOf('/api/llm') !== -1) {
      return jsonResponse({ ok: false, error: 'Static file preview: live LLM calls need the running server on port 3000.' }, false, 503);
    }
    if (nativeFetch) return nativeFetch(url, options);
    return Promise.reject(new Error('No network in this static preview.'));
  };
})();
`;

let html = read('index.html');
const css = inlineFonts(read('styles.css'));
const sample = read('sample-state.js');
const app = read('app.js');

// Function replacers are essential: String.replace otherwise interprets
// "$$" and "$&" inside the inlined JavaScript as replacement patterns.
const cssBlock = `<style>\n${css}\n</style>`;
// The original files are deferred, so move the inlined scripts to the end of
// <body>; inline scripts in <head> would run before the DOM exists.
const scriptsBlock = `${inlineScript(sample)}\n  ${inlineScript(stub)}\n  ${inlineScript(app)}`;
html = html.replace('<link rel="stylesheet" href="styles.css">', () => cssBlock);
html = html.replace('<script defer src="sample-state.js"></script>', () => '');
html = html.replace('<script defer src="app.js"></script>', () => '');
html = html.replace('</body>', () => `  ${scriptsBlock}\n</body>`);

const banner = `\n  <div class="static-banner"><strong>Static file preview.</strong> This self-contained copy shows the full prefilled five-beat state without a server. Live LLM calls are disabled here; use the running app on port 3000 for model runs.</div>\n`;
html = html.replace(/(<div class="principles">[\s\S]*?<\/div>)/, (match) => match + banner);

if (/<link[^>]+href=["']styles\.css|<script[^>]+src=["'](?:app|sample-state)\.js/.test(html)) {
  throw new Error('Preview still contains external asset references.');
}
if (/url\(['"]?fonts\//.test(html)) {
  throw new Error('Preview still contains external font references.');
}

const out = path.join(PUB, 'preview.html');
fs.writeFileSync(out, html, 'utf8');
console.log(`Wrote ${out} (${Buffer.byteLength(html)} bytes, fully self-contained)`);
