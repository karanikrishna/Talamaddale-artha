(() => {
  'use strict';

  const SAMPLE = window.TALAMADDALE_SAMPLE;
  const STATIC_PREVIEW = Boolean(window.TALA_STATIC_PREVIEW);
  const APP_VERSION = '1.3.0-swagatha-dialogue';
  const SOURCES = [
    'Valmiki Ramayana', 'Mahabharata', 'Bhagavata Purana', 'Garuda Purana',
    'Markandeya Purana', 'Vishnu Purana', 'Shiva Purana', 'Skanda Purana',
    'Padma Purana', 'Brahmanda Purana', 'Agni Purana', 'Varaha Purana',
    'Narada Purana', 'Linga Purana', 'Kurma Purana', 'Matsya Purana'
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clone = (value) => JSON.parse(JSON.stringify(value));

  // The workspace file preview can run in an opaque-origin iframe where
  // localStorage access throws. Keep settings/theme best-effort.
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* no persistence */ } },
    remove(key) { try { localStorage.removeItem(key); } catch (_) { /* no persistence */ } }
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function fmt(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return value.length ? value.map(fmt).join(' · ') : '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  const dom = {
    pada: $('#pada'), prasanga: $('#prasanga'), pathra: $('#pathra'), mode: $('#mode'),
    prativadi: $('#prativadi'), outputLanguage: $('#outputLanguage'), exemplar: $('#exemplar'),
    register: $('#register'), length: $('#length'), prativadiStyle: $('#prativadiStyle'), responseNote: $('#responseNote'),
    runBtn: $('#runBtn'), resetExampleBtn: $('#resetExampleBtn'), stopBtn: $('#stopBtn'), clearBtn: $('#clearBtn'),
    themeToggle: $('#themeToggle'), settingsBtn: $('#settingsBtn'), settingsBtn2: $('#settingsBtn2'),
    continueBtn: $('#continueBtn'), generateBtn: $('#generateBtn'), regenerateBtn: $('#regenerateBtn'), copyBtn: $('#copyBtn'),
    autoGenerate: $('#autoGenerate'), connectionStatus: $('#connectionStatus'), connectionHint: $('#connectionHint'),
    outputLabel: $('#outputLabel'), appVersion: $('#appVersion'),
    prativadiField: $('#prativadiField'), prativadiRequired: $('#prativadiRequired'), prativadiStyleField: $('#prativadiStyleField'),
    responseHeading: $('#responseHeading'), responseSubheading: $('#responseSubheading'), stageLegend: $('#stageLegend'),
    readingHint: $('#readingHint'), pauseNote: $('#pauseNote'), pipelineStatus: $('#pipelineStatus'), sampleBadge: $('#sampleBadge'),
    stage: $('#stage'), stageCount: $('#stageCount'), discussionQuality: $('#discussionQuality'), toast: $('#toast'),
    beats: $$('#beats li'), settingsDialog: $('#settingsDialog'), serverConfigNote: $('#serverConfigNote')
  };

  const state = {
    inputs: {},
    controls: {},
    layers: { '1': null, '2': null, '3': null, '4': null },
    errors: {},
    layerStatus: { '1': 'empty', '2': 'empty', '3': 'empty', '4': 'empty', '5': 'empty' },
    beats: { '1': 'pending', '2': 'pending', '3': 'pending', '4': 'pending', '5': 'pending' },
    argumentSelection: {},
    argumentDefaults: {},
    readingChoice: null,
    customReading: '',
    rawArtha: '',
    arthaLines: [],
    sample: true,
    runningLayer: null,
    abortController: null,
    variation: 0,
    epoch: 0,
    inputKey: '',
    controlKey: '',
    health: null,
    autoTimer: null,
    composing: false
  };

  let stageRaf = 0;
  let previousArthaForRegenerate = '';

  /* ---------- inputs, settings, theme ---------- */

  function setInputsToDom() {
    dom.pada.value = state.inputs.pada || '';
    dom.prasanga.value = state.inputs.prasanga || '';
    dom.mode.value = state.inputs.mode || 'swagatha';
    dom.pathra.value = state.inputs.pathra || '';
    dom.prativadi.value = state.inputs.prativadi || '';
    dom.outputLanguage.value = state.inputs.outputLanguage || 'kn';
    dom.exemplar.value = state.inputs.exemplar || '';
    dom.register.value = state.controls.register || 'argumentative';
    dom.length.value = state.controls.length || 'medium';
    dom.prativadiStyle.value = state.controls.prativadiStyle || 'dialogue';
    dom.responseNote.value = state.controls.note || '';
  }

  function syncInputs() {
    state.inputs = {
      pada: dom.pada.value,
      prasanga: dom.prasanga.value.trim(),
      mode: dom.mode.value,
      pathra: dom.pathra.value.trim(),
      prativadi: dom.mode.value === 'dialogue' ? dom.prativadi.value.trim() : '',
      outputLanguage: dom.outputLanguage.value,
      exemplar: dom.exemplar.value
    };
    state.controls = {
      register: dom.register.value,
      length: dom.length.value,
      prativadiStyle: dom.prativadiStyle.value,
      note: dom.responseNote.value
    };
  }

  function getConfig() {
    try {
      const c = JSON.parse(storage.get('talamaddale-config') || '{}');
      return {
        baseUrl: c.baseUrl || '',
        apiKey: c.apiKey || '',
        model: c.model || '',
        temperature: c.temperature === undefined ? '' : c.temperature,
        maxTokens: c.maxTokens === undefined ? '' : c.maxTokens,
        tokenParam: c.tokenParam || 'max_tokens',
        allowNoKey: c.allowNoKey === true
      };
    } catch (_) {
      return { baseUrl: '', apiKey: '', model: '', temperature: '', maxTokens: '', tokenParam: 'max_tokens', allowNoKey: false };
    }
  }

  function loadSettingsToDialog() {
    const c = getConfig();
    $('#cfgBaseUrl').value = c.baseUrl;
    $('#cfgApiKey').value = c.apiKey;
    $('#cfgModel').value = c.model;
    $('#cfgTemperature').value = c.temperature;
    $('#cfgMaxTokens').value = c.maxTokens;
    $('#cfgTokenParam').value = c.tokenParam;
    $('#cfgAllowNoKey').checked = c.allowNoKey;
  }

  function saveSettings() {
    const baseUrl = $('#cfgBaseUrl').value.trim();
    if (baseUrl) {
      try {
        const u = new URL(baseUrl);
        if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw new Error();
      } catch (_) {
        showToast('Enter a complete HTTP(S) Base URL without embedded credentials.');
        return;
      }
    }
    const c = {
      baseUrl,
      apiKey: $('#cfgApiKey').value.trim(),
      model: $('#cfgModel').value.trim(),
      temperature: $('#cfgTemperature').value,
      maxTokens: $('#cfgMaxTokens').value,
      tokenParam: $('#cfgTokenParam').value,
      allowNoKey: $('#cfgAllowNoKey').checked
    };
    storage.set('talamaddale-config', JSON.stringify(c));
    dom.settingsDialog.close();
    renderConnection();
    updateButtons();
    showToast('Model settings saved. Generate fresh artha to use them.');
  }

  function clearSettings() {
    storage.remove('talamaddale-config');
    loadSettingsToDialog();
    renderConnection();
    updateButtons();
    showToast('Saved model settings cleared. Server defaults still apply.');
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    storage.set('talamaddale-theme', theme);
    const dark = theme === 'dark';
    dom.themeToggle.innerHTML = '';
    dom.themeToggle.append(document.createTextNode(dark ? '☀ ' : '◐ '), el('span', '', dark ? 'Light' : 'Dark'));
    dom.themeToggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  function toggleTheme() {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  }

  function modelReady() {
    const c = getConfig();
    return Boolean((state.health && state.health.configured) || c.apiKey || (c.allowNoKey && c.baseUrl));
  }

  function renderConnection() {
    let status = 'setup', text = 'Model not connected', hint = 'Open Model settings and enter your provider URL, model and API key. Without a live model, this app cannot interpret a new padya.';
    if (STATIC_PREVIEW) {
      status = 'preview'; text = 'Read-only static preview'; hint = 'This file demonstrates the interface only. Open your Render URL at / to generate artha for your own padya.';
    } else if (state.health && state.health.error) {
      status = 'error'; text = 'Backend not reachable'; hint = 'Open the deployed Render URL, not preview.html. Check that the Render service is Live.';
    } else if (modelReady()) {
      status = 'ready'; text = 'Model configured — ready to generate'; hint = 'Every generation sends the current padya to your configured model. API charges may apply. Configuration is not a live connection test.';
    } else if (state.health) {
      hint = 'No API key is configured. Open Model settings. For a deliberately keyless endpoint, enter its URL and tick the no-key option.';
    }
    dom.connectionStatus.textContent = text;
    dom.connectionStatus.dataset.state = status;
    dom.connectionHint.textContent = hint;
    dom.serverConfigNote.textContent = hint;
  }

  async function checkServerConfig() {
    if (STATIC_PREVIEW) { dom.appVersion.textContent = '1.2.0 · static demonstration'; renderConnection(); return; }
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (!res.ok) throw new Error('Health check failed');
      const j = await res.json();
      if (!j.ok) throw new Error('Backend unavailable');
      state.health = j;
      dom.appVersion.textContent = `${j.version || APP_VERSION} · dynamic input`;
    } catch (_) {
      state.health = { error: true };
    }
    renderConnection();
    updateButtons();
  }

  function openSettings() {
    loadSettingsToDialog();
    if (typeof dom.settingsDialog.showModal === 'function') dom.settingsDialog.showModal();
    else dom.settingsDialog.setAttribute('open', '');
  }

  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => dom.toast.classList.remove('show'), 2600);
  }

  /* ---------- artha helpers ---------- */

  function normalizeKannadaTerms(text) {
    return String(text ?? '')
      .replace(/ತಲಮದ್ದಲೆ|ತಲಮದ್ದಳೆ|ತಾಳಮದ್ದಲೆ|ತಾಳ\s+ಮದ್ದಳೆ/g, 'ತಾಳಮದ್ದಳೆ')
      .replace(/ಅರ್ಥದಾರಿ/g, 'ಅರ್ಥಧಾರಿ');
  }

  function currentMode() { return dom.mode && dom.mode.value === 'dialogue' ? 'dialogue' : 'swagatha'; }

  function parseArtha(raw) {
    return String(raw || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !/^```/.test(line) && !/^\[DONE\]$/i.test(line))
      .map((line) => {
        const m = line.match(/^([AP]):\s*(.*)$/);
        if (m) return { speaker: m[1], text: normalizeKannadaTerms(m[2]) };
        return { speaker: 'A', text: normalizeKannadaTerms(line.replace(/^A:\s*/, '')) };
      })
      .filter((line) => line.text.trim());
  }

  function countWords(text) {
    return (String(text || '').match(/[^\s]+/g) || []).length;
  }

  function assessArtha(lines, inputs) {
    const a = lines.filter((l) => l.speaker === 'A');
    const p = lines.filter((l) => l.speaker === 'P');
    const aWords = a.reduce((n, l) => n + countWords(l.text), 0);
    const pWords = p.reduce((n, l) => n + countWords(l.text), 0);
    const totalWords = aWords + pWords;
    const twoRoles = (inputs.mode || currentMode()) === 'dialogue';
    const warnings = [];
    if (!twoRoles && p.length) warnings.push('ಸ್ವಗತದಲ್ಲಿ ಪ್ರತಿವಾದಿಯ ಮಾತುಗಳಿವೆ; ಏಕಪಾತ್ರ ಅರ್ಥವಾಗಿ ತಿದ್ದಿ ಅಥವಾ ಸಂವಾದ ಮೋಡ್ ಆಯ್ಕೆಮಾಡಿ.');
    if (twoRoles) {
      if (p.length < 3) warnings.push('ಎರಡು ಪಾತ್ರಗಳಿವೆ; ಪ್ರತಿವಾದಿಯ ಮಾತುಗಳು ತೀರಾ ಕಡಿಮೆ.');
      if (totalWords && pWords / totalWords < 0.25) warnings.push('ಪ್ರತಿವಾದಿಯ ಪಾಲು ಕಡಿಮೆ; ಅರ್ಥವು ಏಕಮುಖ ಭಾಷಣದಂತೆ ಕೇಳಬಹುದು.');
      const weakP = p.filter((l) => countWords(l.text) <= 3).length;
      if (p.length && weakP / p.length > 0.4) warnings.push('ಸಣ್ಣ ಮಧ್ಯಸ್ಥ ಮಾತುಗಳ ಬದಲು ನಿರ್ದಿಷ್ಟ ಆಕ್ಷೇಪ/ಪ್ರಶ್ನೆಗಳನ್ನು ಕೊಡಿ.');
      let maxRun = 1, run = 1;
      for (let i = 1; i < lines.length; i += 1) {
        run = lines[i].speaker === lines[i - 1].speaker ? run + 1 : 1;
        maxRun = Math.max(maxRun, run);
      }
      if (maxRun > 2) warnings.push('ಒಂದೇ ಪಾತ್ರದ ಸತತ ಮಾತುಗಳು ಹೆಚ್ಚಾಗಿವೆ; ಪ್ರಶ್ನೆ–ಉತ್ತರದ ಲಯವನ್ನು ಪರಿಶೀಲಿಸಿ.');
    }
    const texts = lines.map((l) => l.text.trim());
    if (new Set(texts).size < texts.length) warnings.push('ಕೆಲವು ಮಾತುಗಳು ಪುನರಾವರ್ತನೆಯಾಗಿವೆ.');
    return { twoRoles, pWords, totalWords, share: totalWords ? Math.round((pWords / totalWords) * 100) : 0, warnings };
  }

  function scheduleStageRender() {
    if (stageRaf) return;
    stageRaf = requestAnimationFrame(() => {
      stageRaf = 0;
      renderStage();
    });
  }

  function renderStage() {
    dom.stage.replaceChildren();
    dom.stage.setAttribute('aria-busy', state.runningLayer === 5 ? 'true' : 'false');
    if (!state.arthaLines.length) {
      const message = state.runningLayer === 5 ? 'Generating a fresh response from the current padya…' : ((state.inputs.pada.trim() && state.inputs.prasanga.trim()) ? 'Fresh input is ready. Generate the analysis, choose a reading, then generate the response.' : 'Enter your padya and choose a mode. The generated artha will appear here.');
      dom.stage.append(el('div', 'stage-empty', message));
      dom.stageCount.textContent = '0 lines';
      if (dom.discussionQuality) dom.discussionQuality.hidden = true;
      return;
    }
    state.arthaLines.forEach((line) => {
      const row = el('div', `stage-line ${line.speaker}`);
      const who = line.speaker === 'A'
        ? `A · ${state.inputs.pathra || 'pathra'}`
        : `P · ${state.inputs.prativadi || 'prativadi'}`;
      row.append(el('div', 'stage-speaker', who), el('p', 'stage-text', line.text));
      dom.stage.append(row);
    });
    const a = state.arthaLines.filter((l) => l.speaker === 'A').length;
    const p = state.arthaLines.length - a;
    dom.stageCount.textContent = currentMode() === 'dialogue' ? `${state.arthaLines.length} lines · ${a} A / ${p} P` : `${state.arthaLines.length} lines · ಸ್ವಗತ`;
    if (currentMode() === 'swagatha' && p) dom.stageCount.textContent += ` · ${p} P lines need review`;
    const quality = assessArtha(state.arthaLines, state.inputs);
    if (dom.discussionQuality) {
      dom.discussionQuality.replaceChildren();
      if (quality.twoRoles) {
        dom.discussionQuality.hidden = false;
        dom.discussionQuality.append(el('strong', '', `ಪ್ರತಿವಾದಿಯ ಪಾಲು: ${quality.share}% · ${p} ಮಾತುಗಳು`));
        if (quality.warnings.length) {
          const ul = el('ul');
          quality.warnings.forEach((w) => ul.append(el('li', '', w)));
          dom.discussionQuality.append(ul);
        } else {
          dom.discussionQuality.append(el('span', '', ' · ಸಂವಾದದ ಸಮತೋಲನ ಸರಿಯಾಗಿದೆ. ಅಂತಿಮ ತೀರ್ಮಾನ ಕಲಾವಿದರದು.'));
        }
      } else {
        dom.discussionQuality.hidden = false;
        dom.discussionQuality.replaceChildren(el('strong', '', 'ಸ್ವಗತ · ಏಕಪಾತ್ರ'));
        if (quality.warnings.length) {
          const ul = el('ul'); quality.warnings.forEach((w) => ul.append(el('li', '', w))); dom.discussionQuality.append(ul);
        } else dom.discussionQuality.append(el('span', '', ' · ಪಾತ್ರದ ಪರಿಚಯ ಮತ್ತು ಸ್ವಗತ ಅರ್ಥ. ಅಂತಿಮ ತೀರ್ಮಾನ ಕಲಾವಿದರದು.'));
      }
    }
    dom.stage.scrollTop = dom.stage.scrollHeight;
  }

  async function copyArtha() {
    if (!state.arthaLines.length) return;
    const text = state.arthaLines.map((l) => `${l.speaker}: ${l.text.trim()}`).join(' >> ');
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = el('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* no-op */ }
      ta.remove();
    }
    showToast('ಅರ್ಥ ನಕಲಾಗಿದೆ; ಪಾತ್ರ ಸೂಚನೆಗಳೊಂದಿಗೆ >> ಬಳಸಲಾಗಿದೆ.');
  }

  /* ---------- structured rendering helpers ---------- */

  function addKV(parent, key, value, wide = false) {
    const box = el('div', wide ? 'kv wide' : 'kv');
    box.append(el('span', 'k', key), el('span', 'v', fmt(value)));
    parent.append(box);
  }

  function addList(parent, title, items) {
    if (!Array.isArray(items) || !items.length) return;
    const wrap = el('div', 'list-block');
    wrap.append(el('h3', '', title));
    const ul = el('ul');
    items.forEach((item) => ul.append(el('li', '', fmt(item))));
    wrap.append(ul);
    parent.append(wrap);
  }

  function emptyMsg(text) {
    return el('div', 'stage-empty', text);
  }

  function tag(text, extra = '') {
    return el('span', `tag ${extra}`.trim(), text);
  }

  function renderLayer1(body, data) {
    if (!data) { body.append(emptyMsg('No context yet. Enter the current padya and select Generate fresh artha.')); return; }
    body.append(el('div', 'cleaned-box', data.cleaned_transcript || ''));
    body.append(el('p', 'cleaning-note', data.cleaning_note || ''));
    const grid = el('div', 'kv-grid');
    addKV(grid, 'Scene', data.scene);
    addKV(grid, 'Speaker identity', data.speaker_identity);
    addKV(grid, 'State of mind', data.state_of_mind);
    addKV(grid, 'Addressed to', data.addressed_to);
    addKV(grid, 'Rasa', data.rasa);
    addKV(grid, 'Bhava', data.bhava);
    addKV(grid, 'Story so far', data.story_so_far, true);
    addKV(grid, 'Interpretive problem', data.interpretive_problem, true);
    addKV(grid, 'Interpretive stakes', data.interpretive_stakes, true);
    body.append(grid);
    addList(body, 'What the transcript leaves unclear', data.ambiguities);
    addList(body, 'Questions to look up', data.lookup_questions);
  }

  function renderLayer2(body, data) {
    if (!data) { body.append(emptyMsg('No passages yet. Generate the analysis for the current padya.')); return; }
    const passages = Array.isArray(data.passages) ? data.passages : [];
    if (!passages.length) body.append(el('p', 'source-empty', 'ಮೂಲ ಲಭ್ಯವಿಲ್ಲ — no passage was securely recalled. Do not treat the interpretation as source-verified.'));
    const used = new Set((Array.isArray(data.used_sources) ? data.used_sources : passages.map((p) => p.source).filter((s) => SOURCES.includes(s))));
    const chips = el('div', 'source-chips');
    SOURCES.forEach((name) => chips.append(el('span', used.has(name) ? 'source-chip used' : 'source-chip', name)));
    body.append(chips);
    body.append(el('p', 'source-count', `${used.size} of 16 sources used · ${16 - used.size} searched without a securely recalled direct passage. Regional tradition is shown separately.`));
    if (data.uncertainty_note) body.append(el('p', 'cleaning-note', data.uncertainty_note));
    if (data.regional_tradition_note) body.append(el('p', 'cleaning-note', data.regional_tradition_note));
    if (data.location_enforcement) body.append(el('p', 'cleaning-note', data.location_enforcement));

    passages.forEach((p, idx) => {
      const card = el('article', 'passage');
      const head = el('div', 'passage-head');
      const left = el('div');
      left.append(el('div', 'passage-source', `${p.id || `p${idx + 1}`} · ${p.source || 'Regional tradition'}`));
      left.append(el('div', 'passage-location', p.location || 'location uncertain'));
      const tags = el('div', 'tag-row');
      tags.append(tag(`confidence: ${p.confidence || 'low'}`, 'neutral'));
      if (p.variant_versions) tags.append(tag('variant versions', 'variant'));
      if (p.tradition_label) tags.append(tag(p.tradition_label));
      if (String(p.location || '').toLowerCase().includes('uncertain')) tags.append(tag('location uncertain', 'neutral'));
      if (p.location_sanitized) tags.append(tag('precise citation withheld', 'variant'));
      head.append(left, tags);
      card.append(head);
      const gist = el('p'); gist.append(el('strong', '', 'Gist'), document.createTextNode(p.gist || '—')); card.append(gist);
      const bearing = el('p'); bearing.append(el('strong', '', 'Bearing'), document.createTextNode(p.bearing || '—')); card.append(bearing);
      if (p.location_note) card.append(el('p', 'cleaning-note', p.location_note));
      body.append(card);
    });
  }

  function isKept(id) {
    if (Object.prototype.hasOwnProperty.call(state.argumentSelection, id)) return Boolean(state.argumentSelection[id]);
    return Boolean(state.argumentDefaults[id]);
  }

  function ensureArgumentDefaults(preserveSelections) {
    const args = (state.layers['3'] && Array.isArray(state.layers['3'].arguments)) ? state.layers['3'].arguments : [];
    const defaults = {};
    args.forEach((a, idx) => {
      const id = a.id || `a${idx + 1}`;
      defaults[id] = ['use', 'use with care'].includes(String(a.verdict || 'hold back').toLowerCase());
    });
    state.argumentDefaults = defaults;
    const nextSelections = {};
    args.forEach((a, idx) => {
      const id = a.id || `a${idx + 1}`;
      nextSelections[id] = preserveSelections && Object.prototype.hasOwnProperty.call(state.argumentSelection, id)
        ? state.argumentSelection[id]
        : defaults[id];
    });
    state.argumentSelection = nextSelections;
  }

  function getKeptArguments() {
    const args = (state.layers['3'] && Array.isArray(state.layers['3'].arguments)) ? state.layers['3'].arguments : [];
    return args.filter((a) => isKept(a.id));
  }

  function renderLayer3(body, data) {
    if (!data) { body.append(emptyMsg('No arguments yet. Generate the analysis for the current padya.')); return; }
    ensureArgumentDefaults(true);
    const args = Array.isArray(data.arguments) ? data.arguments : [];
    const kept = args.filter((a) => isKept(a.id)).length;
    body.append(el('p', 'kept-count', `${kept} of ${args.length} arguments kept · tick or untick to override the verdict.`));

    args.forEach((a, idx) => {
      const id = a.id || `a${idx + 1}`;
      const checked = isKept(id);
      const overridden = checked !== Boolean(state.argumentDefaults[id]);
      const card = el('article', 'argument');
      const top = el('div', 'argument-top');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = checked;
      cb.dataset.argId = id;
      cb.setAttribute('aria-label', `Keep argument ${id}`);
      top.append(cb, el('div', 'argument-claim', a.claim || 'Claim not stated.'));
      card.append(top);

      const meta = el('div', 'argument-meta');
      meta.append(tag(`verdict: ${a.verdict || 'hold back'}`, 'neutral'));
      if (overridden) meta.append(tag('artiste override'));
      if (Array.isArray(a.passage_ids) && a.passage_ids.length) meta.append(tag(`passages: ${a.passage_ids.join(', ')}`, 'neutral'));
      card.append(meta);

      const tests = el('div', 'test-grid');
      [
        ['Fit to prasanga', a.fit_to_prasanga],
        ['Knowable at this moment', a.knowable_at_moment],
        ['Consistency across sources', a.cross_source_consistency],
        ['Strength of source support', a.source_support]
      ].forEach(([k, v]) => {
        const t = el('div', 'test');
        t.append(el('b', '', k), document.createTextNode(v || 'Not assessed.'));
        tests.append(t);
      });
      card.append(tests);
      if (a.reason) {
        const p = el('p'); p.append(el('strong', '', 'Reason '), document.createTextNode(a.reason)); card.append(p);
      }
      card.append(el('div', 'objection', `Prativadi may object: ${a.prativadi_objection || 'Objection not stated.'}`));
      if (a.possible_reply) card.append(el('div', 'reply', `Possible reply: ${a.possible_reply}`));
      if (a.interpretive_gain) card.append(el('p', 'hint', `Interpretive gain: ${a.interpretive_gain}`));
      body.append(card);
    });
    if (data.advice_note) body.append(el('p', 'hint', data.advice_note));
  }

  function hasReading() {
    if (!state.readingChoice) return false;
    if (state.readingChoice.type === 'custom') return Boolean(state.customReading.trim());
    const readings = (state.layers['4'] && Array.isArray(state.layers['4'].readings)) ? state.layers['4'].readings : [];
    return readings.some((r) => r.id === state.readingChoice.id);
  }

  function getChosenReading() {
    if (!hasReading()) return null;
    if (state.readingChoice.type === 'custom') {
      return {
        id: 'custom',
        rasa: 'artiste’s own',
        stance: 'artiste’s own reading',
        emphasis: state.customReading.trim(),
        summary: state.customReading.trim(),
        argument_ids: getKeptArguments().map((a) => a.id),
        risk: 'The artiste owns this interpretive choice.',
        custom: true
      };
    }
    const readings = (state.layers['4'] && Array.isArray(state.layers['4'].readings)) ? state.layers['4'].readings : [];
    return readings.find((r) => r.id === state.readingChoice.id) || null;
  }

  function renderLayer4(body, data) {
    if (!data) { body.append(emptyMsg('No readings yet. Run the pipeline or load the example.')); return; }
    const readings = Array.isArray(data.readings) ? data.readings : [];
    const grid = el('div', 'readings');
    readings.forEach((r, idx) => {
      const id = r.id || `r${idx + 1}`;
      const label = el('label', 'reading');
      const radio = el('input');
      radio.type = 'radio';
      radio.name = 'reading';
      radio.value = id;
      radio.checked = state.readingChoice && state.readingChoice.type === 'model' && state.readingChoice.id === id;
      label.append(radio);
      label.append(el('h3', '', r.stance || `Reading ${idx + 1}`));
      label.append(el('span', 'rasa', r.rasa || 'rasa not stated'));
      label.append(el('p', '', r.summary || ''));
      if (r.central_claim) label.append(el('p', 'thesis', `Thesis: ${r.central_claim}`));
      label.append(el('p', 'leans', `Emphasis: ${r.emphasis || '—'}`));
      label.append(el('p', 'leans', `Leans on: ${(r.argument_ids || []).join(', ') || '—'}`));
      label.append(el('p', 'risk', `Risk: ${r.risk || '—'}`));
      grid.append(label);
    });
    body.append(grid);

    const custom = el('div', 'custom-reading');
    const head = el('div');
    const radio = el('input');
    radio.type = 'radio';
    radio.name = 'reading';
    radio.value = 'custom';
    radio.id = 'customReadingRadio';
    radio.checked = state.readingChoice && state.readingChoice.type === 'custom';
    const radioLabel = el('label', '', 'Write your own reading');
    radioLabel.htmlFor = 'customReadingRadio';
    head.append(radio, radioLabel);
    const ta = el('textarea');
    ta.id = 'customReadingText';
    ta.rows = 3;
    ta.placeholder = 'Your rasa, stance, emphasis, and what the artha should build toward…';
    ta.value = state.customReading || '';
    custom.append(head, ta);
    body.append(custom);
    if (data.pause_note) dom.pauseNote.textContent = data.pause_note;
  }

  /* ---------- generic layer rendering ---------- */

  function setStatus(text) { dom.pipelineStatus.textContent = text; }

  function renderBeats() {
    dom.beats.forEach((li, idx) => { li.dataset.state = state.beats[String(idx + 1)] || 'pending'; });
  }

  function statusText(n) {
    const map = { empty: 'Not generated', sample: 'Example', done: 'Generated', running: 'Generating…', paused: 'Your choice', error: 'Needs attention' };
    return map[state.layerStatus[String(n)]] || 'Empty';
  }

  function renderErrorBox(card, n) {
    const box = $('.error-box', card);
    box.replaceChildren();
    const err = state.errors[String(n)];
    if (!err) { box.hidden = true; return; }
    box.hidden = false;
    box.append(el('pre', '', err));
    const btn = el('button', 'mini-btn', n === 5 ? '↻ Retry response' : '↻ Retry this layer');
    btn.type = 'button';
    btn.addEventListener('click', () => (n === 5 ? generateArtha(false) : runFrom(n)));
    box.append(btn);
  }

  function renderLayer(n) {
    const card = $(`#layer${n}`);
    const chip = $('[data-status]', card);
    chip.textContent = statusText(n);
    chip.dataset.value = state.layerStatus[String(n)] || 'empty';
    const retry = $('.retry-btn', card);
    if (retry) {
      retry.hidden = false;
      retry.textContent = state.layerStatus[String(n)] === 'error'
        ? '↻ Retry'
        : (state.layerStatus[String(n)] === 'empty' ? 'Run from here' : '↻ Rerun from here');
    }
    renderErrorBox(card, n);

    if (n <= 4) {
      const pre = $('.json-details pre', card);
      pre.textContent = JSON.stringify(state.layers[String(n)] || {}, null, 2);
      const body = $('.layer-body', card);
      body.replaceChildren();
      if (n === 1) renderLayer1(body, state.layers['1']);
      if (n === 2) renderLayer2(body, state.layers['2']);
      if (n === 3) renderLayer3(body, state.layers['3']);
      if (n === 4) renderLayer4(body, state.layers['4']);
    } else {
      renderStage();
    }
  }

  function renderModeUi() {
    const dialogue = currentMode() === 'dialogue';
    if (dom.prativadiRequired) dom.prativadiRequired.hidden = true;
    dom.prativadi.disabled = STATIC_PREVIEW || !dialogue;
    dom.prativadiStyleField.hidden = !dialogue;
    dom.prativadiStyle.disabled = STATIC_PREVIEW || !dialogue;
    dom.responseHeading.textContent = dialogue ? 'ಅರ್ಥ ಸಂವಾದ / Adaptive Response' : 'ಅರ್ಥ ಸ್ವಗತ / Adaptive Response';
    dom.responseSubheading.textContent = dialogue ? 'Strong interpretation through A: / P: discussion.' : 'One-role introduction and self-understanding; no invented prativadi.';
    dom.stageLegend.textContent = dialogue ? 'A: = ಪಾತ್ರ, P: = ಪ್ರತಿವಾದಿ. ಸಂವಾದವೇ ಅರ್ಥವನ್ನು ಮುಂದಕ್ಕೆ ಒಯ್ಯುತ್ತದೆ.' : 'ಸ್ವಗತ: A: ಮಾತ್ರ. ಒಂದೇ ಪಾತ್ರದ ಪರಿಚಯ, ನಿಲುವು ಮತ್ತು ಅರ್ಥ.';
  }

  function renderAll() {
    renderModeUi();
    dom.outputLabel.hidden = state.sample || !(Object.values(state.layers).some(Boolean) || state.arthaLines.length);
    for (let n = 1; n <= 5; n += 1) renderLayer(n);
    renderBeats();
    updateButtons();
  }

  function updateButtons() {
    const running = Boolean(state.runningLayer);
    const reading = hasReading();
    dom.runBtn.disabled = running || STATIC_PREVIEW;
    dom.autoGenerate.disabled = STATIC_PREVIEW;
    dom.settingsBtn.disabled = STATIC_PREVIEW;
    dom.settingsBtn2.disabled = STATIC_PREVIEW;
    dom.stopBtn.disabled = !state.abortController;
    dom.continueBtn.disabled = !reading || running;
    dom.generateBtn.disabled = !reading || running;
    dom.regenerateBtn.disabled = !state.rawArtha.trim() || running || STATIC_PREVIEW;
    dom.continueBtn.disabled = !reading || running || STATIC_PREVIEW;
    dom.generateBtn.disabled = !reading || running || STATIC_PREVIEW;
    dom.copyBtn.disabled = !state.arthaLines.length || running;
    $$('.edit-btn').forEach((btn) => { btn.disabled = running || STATIC_PREVIEW; });
    $$('.retry-btn').forEach((btn) => { btn.disabled = running || STATIC_PREVIEW; });
    dom.readingHint.textContent = reading
      ? 'Reading chosen. The response will use only kept arguments and this reading.'
      : 'Choose a reading or write your own.';
  }

  function hideAllEditors() {
    $$('.override-editor').forEach((editor) => { editor.hidden = true; });
  }

  function fingerprint(value) { return JSON.stringify(value); }

  function cancelAutoGenerate() {
    if (state.autoTimer) window.clearTimeout(state.autoTimer);
    state.autoTimer = null;
  }

  function scheduleAutoGenerate(responseOnly = false) {
    cancelAutoGenerate();
    if (!dom.autoGenerate.checked || STATIC_PREVIEW || state.composing) return;
    syncInputs();
    if (!state.inputs.pada.trim() || !state.inputs.prasanga.trim()) return;
    if (!modelReady()) {
      setStatus('Input changed. Connect a model before automatic generation can run.');
      return;
    }
    setStatus('Input changed. Automatic live generation will start after you pause typing…');
    state.autoTimer = window.setTimeout(() => {
      state.autoTimer = null;
      if (!dom.autoGenerate.checked || state.runningLayer) return;
      if (responseOnly && hasReading()) generateArtha(false);
      else runFrom(1);
    }, 1600);
  }

  function resetOutputState() {
    state.layers = { '1': null, '2': null, '3': null, '4': null };
    state.errors = {};
    state.argumentDefaults = {};
    state.argumentSelection = {};
    state.readingChoice = null;
    state.customReading = '';
    state.rawArtha = '';
    state.arthaLines = [];
    state.sample = false;
    state.layerStatus = { '1': 'empty', '2': 'empty', '3': 'empty', '4': 'empty', '5': 'empty' };
    state.beats = { '1': 'pending', '2': 'pending', '3': 'pending', '4': 'pending', '5': 'pending' };
    state.runningLayer = null;
    state.variation = 0;
    dom.sampleBadge.hidden = true;
    dom.pauseNote.textContent = 'The artistic choice stays with the artiste. The pipeline pauses here.';
    hideAllEditors();
  }

  function invalidateForInput() {
    syncInputs();
    const nextInput = fingerprint(state.inputs);
    const nextControl = fingerprint(state.controls);
    if (nextInput === state.inputKey && nextControl === state.controlKey) return;
    const contentChanged = nextInput !== state.inputKey;
    state.epoch += 1;
    cancelAutoGenerate();
    if (state.abortController) state.abortController.abort();
    state.abortController = null;
    if (stageRaf) { cancelAnimationFrame(stageRaf); stageRaf = 0; }
    if (contentChanged) {
      resetOutputState();
      state.inputKey = nextInput;
      state.controlKey = nextControl;
      renderAll();
      setStatus('Input changed — old results cleared. Generate fresh artha for this padya.');
    } else {
      state.controlKey = nextControl;
      state.rawArtha = '';
      state.arthaLines = [];
      state.errors['5'] = null;
      state.layerStatus['5'] = 'empty';
      state.beats['5'] = 'pending';
      state.runningLayer = null;
      renderAll();
      setStatus('Response settings changed. Generate a new response; the current analysis and reading are kept.');
    }
    scheduleAutoGenerate(!contentChanged);
  }

  function invalidateResponseForChoice() {
    state.epoch += 1;
    if (state.abortController) state.abortController.abort();
    state.abortController = null;
    state.runningLayer = null;
    state.rawArtha = '';
    state.arthaLines = [];
    state.errors['5'] = null;
    state.layerStatus['5'] = 'empty';
    state.beats['5'] = 'pending';
    renderLayer(5); renderBeats(); updateButtons();
    scheduleAutoGenerate(true);
  }

  function startBlank() {
    state.epoch += 1;
    cancelAutoGenerate();
    state.inputs = { pada: '', prasanga: '', pathra: '', mode: 'swagatha', prativadi: '', outputLanguage: 'kn', exemplar: '' };
    state.controls = { register: 'argumentative', length: 'medium', prativadiStyle: 'dialogue', note: '' };
    resetOutputState();
    state.abortController = null;
    state.inputKey = fingerprint(state.inputs);
    state.controlKey = fingerprint(state.controls);
    setInputsToDom();
    renderAll();
    setStatus('Choose Swagatha or Dialogue, enter padya and prasanga, connect a model, then generate.');
  }

  function loadSample() {
    stopAll(false);
    cancelAutoGenerate();
    dom.autoGenerate.checked = false;
    state.epoch += 1;
    state.inputs = clone(SAMPLE.inputs);
    state.controls = clone(SAMPLE.controls);
    state.layers = clone(SAMPLE.layers);
    state.errors = {};
    state.argumentDefaults = clone(SAMPLE.argumentDefaults);
    state.argumentSelection = clone(SAMPLE.argumentSelection);
    state.readingChoice = clone(SAMPLE.readingChoice);
    state.customReading = SAMPLE.customReading || '';
    state.rawArtha = SAMPLE.rawArtha || '';
    state.arthaLines = parseArtha(state.rawArtha);
    state.sample = true;
    state.layerStatus = { '1': 'sample', '2': 'sample', '3': 'sample', '4': 'sample', '5': 'sample' };
    state.beats = { '1': 'done', '2': 'done', '3': 'done', '4': 'done', '5': 'done' };
    state.runningLayer = null;
    state.abortController = null;
    state.variation = 0;
    state.inputKey = fingerprint(state.inputs);
    state.controlKey = fingerprint(state.controls);
    dom.sampleBadge.hidden = false;
    dom.pauseNote.textContent = 'The artistic choice stays with the artiste. The pipeline pauses here.';
    setInputsToDom();
    hideAllEditors();
    renderAll();
    setStatus('Example only — not a live answer. Edit any input to clear it, or enter your own padya and generate fresh artha.');
  }

  function clearResults() {
    state.epoch += 1;
    cancelAutoGenerate();
    if (state.abortController) state.abortController.abort();
    state.abortController = null;
    syncInputs();
    resetOutputState();
    renderAll();
    setStatus('Results cleared. Inputs and model settings were kept. Generate fresh artha when ready.');
  }

  function stopAll(showMessage = true) {
    cancelAutoGenerate();
    if (!state.abortController) return;
    state.epoch += 1;
    const stoppedLayer = state.runningLayer;
    state.abortController.abort();
    state.abortController = null;
    if (stoppedLayer) {
      state.errors[String(stoppedLayer)] = 'Stopped by the artiste.';
      state.layerStatus[String(stoppedLayer)] = 'error';
      state.beats[String(stoppedLayer)] = 'error';
    }
    state.runningLayer = null;
    renderAll();
    if (showMessage) {
      setStatus('Stopped. Retry the current layer or generate fresh artha when ready.');
      showToast('Stopped.');
    }
  }

  /* ---------- LLM calls ---------- */

  function buildPayload(layer, extra = {}) {
    const previous = {};
    for (let i = 1; i <= 4; i += 1) previous[String(i)] = state.layers[String(i)];
    return {
      layer,
      inputs: clone(state.inputs),
      previous,
      controls: clone(state.controls),
      keptArguments: getKeptArguments(),
      chosenReading: getChosenReading(),
      regenerate: Boolean(extra.regenerate),
      previousArtha: extra.previousArtha || '',
      variation: extra.variation || 0
    };
  }

  async function callJsonLayer(n, signal) {
    const payload = buildPayload(n);
    const res = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'json', layer: n, config: getConfig(), payload }),
      signal
    });
    const text = await res.text();
    let j;
    try { j = JSON.parse(text); } catch (_) { j = null; }
    if (!res.ok || !j || !j.ok) throw new Error((j && j.error) || `Layer ${n} failed (${res.status}).`);
    return j.data;
  }

  async function runFrom(startLayer) {
    if (state.runningLayer) return;
    cancelAutoGenerate();
    syncInputs();
    const missing = [['pada', dom.pada], ['prasanga', dom.prasanga]].filter(([key]) => !state.inputs[key].trim());
    [dom.pada, dom.prasanga, dom.pathra, dom.prativadi].forEach((node) => node.removeAttribute('aria-invalid'));
    if (missing.length) {
      missing.forEach(([, node]) => node.setAttribute('aria-invalid', 'true'));
      missing[0][1].focus();
      setStatus('Padya and prasanga are required. Choose a mode; roles may be inferred or overridden.');
      showToast('Fill the required fields for the chosen mode.');
      return;
    }
    if (STATIC_PREVIEW) { showToast('This is a static preview. Open the deployed Render URL to generate.'); return; }
    if (!state.health || state.health.error) await checkServerConfig();
    if (!modelReady()) {
      renderConnection();
      setStatus('Connect a live model first. No example or fake meaning will be substituted.');
      openSettings();
      return;
    }
    let start = Math.max(1, Math.min(4, Number(startLayer) || 1));
    if (state.sample || start > 1 && !state.layers[String(start - 1)]) start = 1;
    state.inputKey = fingerprint(state.inputs);
    state.controlKey = fingerprint(state.controls);
    for (let n = start; n <= 4; n += 1) {
      state.layers[String(n)] = null;
      state.errors[String(n)] = null;
      state.layerStatus[String(n)] = 'empty';
      state.beats[String(n)] = 'pending';
    }
    if (start <= 3) { state.argumentDefaults = {}; state.argumentSelection = {}; }
    state.readingChoice = null;
    state.customReading = '';
    state.rawArtha = '';
    state.arthaLines = [];
    state.sample = false;
    dom.sampleBadge.hidden = true;
    hideAllEditors();
    state.epoch += 1;
    const epoch = state.epoch;
    state.abortController = new AbortController();
    const signal = state.abortController.signal;
    const current = () => epoch === state.epoch && !signal.aborted;
    renderAll();

    for (let n = start; n <= 4; n += 1) {
      if (!current()) return;
      state.runningLayer = n;
      state.layerStatus[String(n)] = 'running';
      state.beats[String(n)] = 'running';
      renderLayer(n); renderBeats(); updateButtons();
      setStatus(`Beat ${n} of 5 · generating from the current padya…`);
      try {
        const data = await callJsonLayer(n, signal);
        if (!current()) return;
        state.layers[String(n)] = data;
        state.errors[String(n)] = null;
        state.layerStatus[String(n)] = 'done';
        state.beats[String(n)] = 'done';
        if (n === 3) ensureArgumentDefaults(false);
        if (n === 4) {
          state.layerStatus['4'] = 'paused'; state.beats['4'] = 'paused';
          state.readingChoice = null; state.customReading = '';
        }
        renderLayer(n); renderBeats();
      } catch (err) {
        if (!current()) return;
        handleLayerError(n, err, signal);
        return;
      }
    }
    if (!current()) return;
    state.runningLayer = null;
    state.abortController = null;
    renderAll();
    setStatus('Fresh analysis ready · choose one of three readings or write your own, then select Continue to Response.');
    showToast('Choose your interpretation to continue.');
  }

  function handleLayerError(n, err, signal) {
    const aborted = (err && err.name === 'AbortError') || (signal && signal.aborted);
    state.errors[String(n)] = aborted ? 'Stopped by the artiste.' : (err && err.message ? err.message : 'Unknown error.');
    state.layerStatus[String(n)] = 'error';
    state.beats[String(n)] = 'error';
    state.runningLayer = null;
    state.abortController = null;
    renderAll();
    setStatus(aborted ? 'Stopped. Retry when ready.' : `Beat ${n} needs attention. Check the model settings, then retry. No sample answer was substituted.`);
  }

  async function generateArtha(regenerate = false) {
    if (state.runningLayer) return;
    cancelAutoGenerate();
    if (STATIC_PREVIEW) { showToast('Open the deployed Render URL for live generation.'); return; }
    if (!hasReading() || !state.layers['1'] || !state.layers['2'] || !state.layers['3'] || !state.layers['4']) {
      showToast('Generate the analysis and choose a reading first.'); return;
    }
    if (!modelReady()) { openSettings(); return; }
    previousArthaForRegenerate = regenerate ? state.rawArtha : '';
    state.variation = regenerate ? state.variation + 1 : 0;
    state.epoch += 1;
    const epoch = state.epoch;
    state.abortController = new AbortController();
    const signal = state.abortController.signal;
    const current = () => epoch === state.epoch && !signal.aborted;
    state.runningLayer = 5;
    state.errors['5'] = null;
    state.layerStatus['5'] = 'running'; state.beats['5'] = 'running';
    state.rawArtha = ''; state.arthaLines = [];
    renderLayer(5); renderBeats(); updateButtons();
    setStatus('Beat 5 of 5 · streaming a fresh A: / P: interpretation of the current padya…');
    const payload = buildPayload(5, { regenerate, previousArtha: previousArthaForRegenerate, variation: state.variation });
    try {
      const res = await fetch('/api/llm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'stream', layer: 5, config: getConfig(), payload }), signal
      });
      if (!current()) return;
      if (!res.ok) {
        const text = await res.text();
        let j = null; try { j = JSON.parse(text); } catch (_) { /* ignore */ }
        throw new Error((j && j.error) || `Stream failed (${res.status}).`);
      }
      if (!res.body) throw new Error('The server returned no stream body.');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const chunk = await reader.read();
        if (!current()) { await reader.cancel().catch(() => {}); return; }
        if (chunk.done) break;
        state.rawArtha += decoder.decode(chunk.value, { stream: true });
        state.arthaLines = parseArtha(state.rawArtha);
        scheduleStageRender();
      }
      if (!current()) return;
      state.rawArtha += decoder.decode();
      if (!parseArtha(state.rawArtha).length) throw new Error('The model returned no dialogue. Check the model and retry.');
      state.arthaLines = parseArtha(state.rawArtha);
      state.layerStatus['5'] = 'done'; state.beats['5'] = 'done';
      setStatus('Fresh artha generated for the current input · ಎಐ-ಸಹಾಯಿತ ಸೂಚನೆ. Review, edit or regenerate.');
    } catch (err) {
      if (!current()) return;
      const aborted = (err && err.name === 'AbortError') || signal.aborted;
      state.errors['5'] = aborted ? 'Stopped by the artiste. Partial lines were kept.' : (err && err.message ? err.message : 'Unknown error.');
      state.layerStatus['5'] = 'error'; state.beats['5'] = 'error';
      setStatus(aborted ? 'Stopped during streaming. Partial artha kept.' : 'Beat 5 needs attention. Check the error and retry; no example was substituted.');
    } finally {
      if (current()) {
        state.runningLayer = null; state.abortController = null;
        renderLayer(5); renderBeats(); updateButtons();
      }
    }
  }

  /* ---------- overrides ---------- */

  function normalizeOverride(n, obj) {
    const out = { ...obj };
    if (n === 1) {
      out.ambiguities = Array.isArray(out.ambiguities) ? out.ambiguities : [];
      out.lookup_questions = Array.isArray(out.lookup_questions) ? out.lookup_questions : [];
    }
    if (n === 2) {
      out.searched_sources = SOURCES.slice();
      out.passages = Array.isArray(out.passages) ? out.passages : [];
      const used = new Set(out.passages.map((p) => p.source).filter((s) => SOURCES.includes(s)));
      out.used_sources = Array.isArray(out.used_sources) ? out.used_sources.filter((s) => SOURCES.includes(s)) : [];
      used.forEach((s) => { if (!out.used_sources.includes(s)) out.used_sources.push(s); });
      out.uncertainty_note = out.uncertainty_note || 'Overridden by the artiste. Passage confidence and locations were not re-verified.';
    }
    if (n === 3) {
      out.arguments = Array.isArray(out.arguments) ? out.arguments : [];
      out.arguments.forEach((a, idx) => { a.id = a.id || `a${idx + 1}`; });
    }
    if (n === 4) {
      out.readings = Array.isArray(out.readings) ? out.readings : [];
      if (out.readings.length !== 3) throw new Error('Layer 4 must keep exactly three readings.');
      out.readings.forEach((r, idx) => { r.id = r.id || `r${idx + 1}`; });
    }
    return out;
  }

  function openEditor(n) {
    if (state.runningLayer) { showToast('Wait for generation to finish, or press Stop, before editing.'); return; }
    if (STATIC_PREVIEW) { showToast('This is a static demonstration. Use the deployed app to edit and generate.'); return; }
    const card = $(`#layer${n}`);
    const editor = $('.override-editor', card);
    const ta = $('textarea', editor);
    editor.hidden = !editor.hidden;
    if (!editor.hidden) {
      ta.value = n === 5 ? state.rawArtha : JSON.stringify(state.layers[String(n)] || {}, null, 2);
      ta.focus();
    }
  }

  function saveOverride(n) {
    if (state.runningLayer || STATIC_PREVIEW) return;
    const card = $(`#layer${n}`);
    const editor = $('.override-editor', card);
    const ta = $('textarea', editor);
    try {
      if (n === 5) {
        const raw = ta.value.trim();
        if (!raw) throw new Error('Write at least one response line.');
        state.rawArtha = raw;
        state.arthaLines = parseArtha(raw);
        state.layerStatus['5'] = 'done';
        state.beats['5'] = 'done';
        state.errors['5'] = null;
      } else {
        const obj = JSON.parse(ta.value);
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Expected one JSON object.');
        state.layers[String(n)] = normalizeOverride(n, obj);
        state.errors[String(n)] = null;
        state.layerStatus[String(n)] = 'done';
        state.beats[String(n)] = 'done';
        if (n === 3) ensureArgumentDefaults(true);
        if (n === 4 && state.readingChoice && state.readingChoice.type === 'model') {
          const exists = state.layers['4'].readings.some((r) => r.id === state.readingChoice.id);
          if (!exists) state.readingChoice = null;
        }
        if (n === 4) {
          dom.pauseNote.textContent = state.layers['4'].pause_note || 'The artistic choice stays with the artiste.';
          if (!hasReading()) {
            state.layerStatus['4'] = 'paused';
            state.beats['4'] = 'paused';
          }
        }
      }
      if (n < 5) {
        for (let downstream = n + 1; downstream <= 4; downstream += 1) {
          state.layers[String(downstream)] = null;
          state.layerStatus[String(downstream)] = 'empty';
          state.beats[String(downstream)] = 'pending';
          state.errors[String(downstream)] = null;
        }
        if (n <= 3) { state.argumentDefaults = {}; state.argumentSelection = {}; state.readingChoice = null; state.customReading = ''; }
        state.rawArtha = ''; state.arthaLines = [];
        state.layerStatus['5'] = 'empty'; state.beats['5'] = 'pending'; state.errors['5'] = null;
      }
      state.sample = false;
      dom.sampleBadge.hidden = true;
      editor.hidden = true;
      renderAll();
      setStatus(`Layer ${n} override saved. Downstream results cleared. Rerun from the next layer to rebuild the chain.`);
      showToast('Override saved.');
    } catch (err) {
      showToast(`Could not save: ${err.message}`);
    }
  }

  /* ---------- event wiring ---------- */

  function wireEvents() {
    dom.runBtn.addEventListener('click', () => runFrom(1));
    dom.resetExampleBtn.addEventListener('click', loadSample);
    dom.clearBtn.addEventListener('click', clearResults);
    dom.stopBtn.addEventListener('click', () => stopAll(true));
    dom.themeToggle.addEventListener('click', toggleTheme);
    dom.settingsBtn.addEventListener('click', openSettings);
    dom.settingsBtn2.addEventListener('click', openSettings);
    $('#saveSettingsBtn').addEventListener('click', saveSettings);
    $('#clearSettingsBtn').addEventListener('click', clearSettings);
    $('.close-dialog').addEventListener('click', () => dom.settingsDialog.close());
    $$('#settingsForm [data-close]').forEach((btn) => btn.addEventListener('click', () => dom.settingsDialog.close()));
    dom.continueBtn.addEventListener('click', () => {
      generateArtha(false);
      $('#layer5').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    dom.generateBtn.addEventListener('click', () => generateArtha(false));
    dom.regenerateBtn.addEventListener('click', () => generateArtha(true));
    dom.copyBtn.addEventListener('click', copyArtha);

    $$('.layer-card').forEach((card) => {
      const n = Number(card.dataset.layer);
      const edit = $('.edit-btn', card);
      if (edit) edit.addEventListener('click', () => openEditor(n));
      $('.cancel-override', card).addEventListener('click', () => { $('.override-editor', card).hidden = true; });
      $('.save-override', card).addEventListener('click', () => saveOverride(n));
      const retry = $('.retry-btn', card);
      if (retry) retry.addEventListener('click', () => runFrom(n));
    });

    $('#layer3 .layer-body').addEventListener('change', (event) => {
      const target = event.target;
      if (!target.matches('input[type="checkbox"][data-arg-id]')) return;
      if (state.runningLayer) { renderLayer(3); showToast('Wait for generation or press Stop before changing arguments.'); return; }
      state.argumentSelection[target.dataset.argId] = target.checked;
      invalidateResponseForChoice();
      state.sample = false;
      dom.sampleBadge.hidden = true;
      renderLayer(3);
      updateButtons();
      setStatus('Argument selection changed. Old response cleared; generate a new response to use the kept set.');
    });

    $('#layer4 .layer-body').addEventListener('change', (event) => {
      const target = event.target;
      if (target.name === 'reading') {
        if (state.runningLayer) { renderLayer(4); showToast('Wait for generation or press Stop before choosing a reading.'); return; }
        state.readingChoice = target.value === 'custom'
          ? { type: 'custom', id: 'custom' }
          : { type: 'model', id: target.value };
        invalidateResponseForChoice();
        state.sample = false;
        dom.sampleBadge.hidden = true;
        updateButtons();
      }
    });

    $('#layer4 .layer-body').addEventListener('input', (event) => {
      if (event.target.id !== 'customReadingText') return;
      if (state.runningLayer) { renderLayer(4); return; }
      state.customReading = event.target.value;
      invalidateResponseForChoice();
      if (state.customReading.trim()) {
        state.readingChoice = { type: 'custom', id: 'custom' };
        const radio = $('#customReadingRadio');
        if (radio) radio.checked = true;
      }
      state.sample = false;
      dom.sampleBadge.hidden = true;
      updateButtons();
    });

    const contentFields = [dom.pada, dom.prasanga, dom.pathra, dom.mode, dom.prativadi, dom.outputLanguage, dom.exemplar];
    const responseFields = [dom.register, dom.length, dom.prativadiStyle, dom.responseNote];
    [...contentFields, ...responseFields].forEach((node) => {
      node.addEventListener('compositionstart', () => { state.composing = true; cancelAutoGenerate(); });
      node.addEventListener('compositionend', () => { state.composing = false; invalidateForInput(); });
      node.addEventListener('input', () => { if (!state.composing) invalidateForInput(); });
      node.addEventListener('change', () => { if (!state.composing) invalidateForInput(); });
    });
    dom.autoGenerate.addEventListener('change', () => {
      cancelAutoGenerate();
      if (dom.autoGenerate.checked) {
        showToast('Automatic model calls enabled. API charges may apply.');
        scheduleAutoGenerate(false);
      } else setStatus('Automatic generation off. Use Generate fresh artha when ready.');
    });
  }

  /* ---------- boot ---------- */

  const storedTheme = storage.get('talamaddale-theme');
  applyTheme(storedTheme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  wireEvents();
  loadSettingsToDialog();
  checkServerConfig();
  if (STATIC_PREVIEW) {
    loadSample();
    [dom.pada, dom.prasanga, dom.pathra, dom.mode, dom.prativadi, dom.outputLanguage, dom.exemplar, dom.register, dom.length, dom.prativadiStyle, dom.responseNote].forEach((node) => { node.disabled = true; });
    dom.clearBtn.disabled = true;
  } else startBlank();
})();
