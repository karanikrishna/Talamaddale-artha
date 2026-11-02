(() => {
  'use strict';

  const SAMPLE = window.TALAMADDALE_SAMPLE;
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
    pada: $('#pada'), prasanga: $('#prasanga'), pathra: $('#pathra'),
    prativadi: $('#prativadi'), outputLanguage: $('#outputLanguage'), exemplar: $('#exemplar'),
    register: $('#register'), length: $('#length'), prativadiStyle: $('#prativadiStyle'), responseNote: $('#responseNote'),
    runBtn: $('#runBtn'), resetExampleBtn: $('#resetExampleBtn'), stopBtn: $('#stopBtn'), clearBtn: $('#clearBtn'),
    themeToggle: $('#themeToggle'), settingsBtn: $('#settingsBtn'), settingsBtn2: $('#settingsBtn2'),
    continueBtn: $('#continueBtn'), generateBtn: $('#generateBtn'), regenerateBtn: $('#regenerateBtn'), copyBtn: $('#copyBtn'),
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
    variation: 0
  };

  let stageRaf = 0;
  let previousArthaForRegenerate = '';

  /* ---------- inputs, settings, theme ---------- */

  function setInputsToDom() {
    dom.pada.value = state.inputs.pada || '';
    dom.prasanga.value = state.inputs.prasanga || '';
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
      pathra: dom.pathra.value.trim(),
      prativadi: dom.prativadi.value.trim(),
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
        tokenParam: c.tokenParam || 'max_tokens'
      };
    } catch (_) {
      return { baseUrl: '', apiKey: '', model: '', temperature: '', maxTokens: '', tokenParam: 'max_tokens' };
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
  }

  function saveSettings() {
    const c = {
      baseUrl: $('#cfgBaseUrl').value.trim(),
      apiKey: $('#cfgApiKey').value.trim(),
      model: $('#cfgModel').value.trim(),
      temperature: $('#cfgTemperature').value,
      maxTokens: $('#cfgMaxTokens').value,
      tokenParam: $('#cfgTokenParam').value
    };
    storage.set('talamaddale-config', JSON.stringify(c));
    dom.settingsDialog.close();
    showToast('Model settings saved in this browser.');
  }

  function clearSettings() {
    storage.remove('talamaddale-config');
    loadSettingsToDialog();
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

  async function checkServerConfig() {
    try {
      const res = await fetch('/api/health');
      const j = await res.json();
      const defaults = [j.serverHasKey && 'API key', j.serverHasBaseUrl && 'base URL', j.serverHasModel && 'model'].filter(Boolean);
      dom.serverConfigNote.textContent = defaults.length
        ? `Server environment has ${defaults.join(', ')}. Browser fields override those values; blank fields fall back to them.`
        : 'No server environment defaults detected. Enter an OpenAI-compatible endpoint and key, or use a local endpoint with a blank key.';
    } catch (_) {
      dom.serverConfigNote.textContent = 'Could not check server defaults. The app will still use browser fields.';
    }
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
    const twoRoles = Boolean(String(inputs.prativadi || '').trim());
    const warnings = [];
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
    if (!state.arthaLines.length) {
      dom.stage.append(el('div', 'stage-empty', 'The artha will appear here as A: and P: lines.'));
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
    dom.stageCount.textContent = `${state.arthaLines.length} lines · ${a} A / ${p} P`;
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
        dom.discussionQuality.hidden = true;
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
    showToast('ಅರ್ಥ ನಕಲಾಗಿದೆ; A:/P: ಪಾತ್ರಗಳೊಂದಿಗೆ >> ಬಳಸಲಾಗಿದೆ.');
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
    if (!data) { body.append(emptyMsg('No context yet. Run the pipeline or load the example.')); return; }
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
    if (!data) { body.append(emptyMsg('No passages yet. Run the pipeline or load the example.')); return; }
    const passages = Array.isArray(data.passages) ? data.passages : [];
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
    if (!data) { body.append(emptyMsg('No arguments yet. Run the pipeline or load the example.')); return; }
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
    const map = { empty: 'Empty', sample: 'Sample', done: 'Done', running: 'Running', paused: 'Paused', error: 'Retry' };
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

  function renderAll() {
    for (let n = 1; n <= 5; n += 1) renderLayer(n);
    renderBeats();
    updateButtons();
  }

  function updateButtons() {
    const running = Boolean(state.runningLayer);
    const reading = hasReading();
    dom.runBtn.disabled = running;
    dom.stopBtn.disabled = !state.abortController;
    dom.continueBtn.disabled = !reading || running;
    dom.generateBtn.disabled = !reading || running;
    dom.regenerateBtn.disabled = !state.rawArtha.trim() || running;
    dom.copyBtn.disabled = !state.arthaLines.length;
    dom.readingHint.textContent = reading
      ? 'Reading chosen. The response will use only kept arguments and this reading.'
      : 'Choose a reading or write your own.';
  }

  function hideAllEditors() {
    $$('.override-editor').forEach((editor) => { editor.hidden = true; });
  }

  function loadSample() {
    stopAll(false);
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
    dom.sampleBadge.hidden = false;
    dom.pauseNote.textContent = 'The artistic choice stays with the artiste. The pipeline pauses here.';
    setInputsToDom();
    hideAllEditors();
    renderAll();
    setStatus('Prefilled example — all five beats shown. Configure a model and run the pipeline to recompute.');
  }

  function clearResults() {
    stopAll(false);
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
    renderAll();
    setStatus('Results cleared. Inputs and model settings were kept.');
  }

  function stopAll(showMessage = true) {
    if (!state.abortController) return;
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
      setStatus('Stopped. Use a layer’s Retry button to continue from there.');
      showToast('Stopped.');
    }
  }

  /* ---------- LLM calls ---------- */

  function buildPayload(layer, extra = {}) {
    syncInputs();
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
    syncInputs();
    if (!state.inputs.pada.trim() || !state.inputs.prasanga.trim() || !state.inputs.pathra.trim()) {
      showToast('Pada, prasanga and pathra are required.');
      return;
    }
    const start = Math.max(1, Math.min(4, Number(startLayer) || 1));
    for (let n = start; n <= 5; n += 1) {
      state.layers[String(n)] = null;
      state.errors[String(n)] = null;
      state.layerStatus[String(n)] = 'empty';
      state.beats[String(n)] = 'pending';
    }
    // A rerun from layer 4 keeps layer 3 and the artiste's tick/untick overrides.
    if (start <= 3) {
      state.argumentDefaults = {};
      state.argumentSelection = {};
    }
    state.readingChoice = null;
    state.customReading = '';
    state.rawArtha = '';
    state.arthaLines = [];
    state.sample = false;
    dom.sampleBadge.hidden = true;
    state.abortController = new AbortController();
    const signal = state.abortController.signal;
    renderAll();

    for (let n = start; n <= 4; n += 1) {
      state.runningLayer = n;
      state.layerStatus[String(n)] = 'running';
      state.beats[String(n)] = 'running';
      renderLayer(n);
      renderBeats();
      updateButtons();
      setStatus(`Beat ${n} of 5 · one live LLM call returning JSON…`);
      try {
        const data = await callJsonLayer(n, signal);
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        state.layers[String(n)] = data;
        state.errors[String(n)] = null;
        state.layerStatus[String(n)] = 'done';
        state.beats[String(n)] = 'done';
        if (n === 3) ensureArgumentDefaults(false);
        if (n === 4) {
          state.layerStatus['4'] = 'paused';
          state.beats['4'] = 'paused';
          state.readingChoice = null;
          state.customReading = '';
        }
        renderLayer(n);
        renderBeats();
      } catch (err) {
        handleLayerError(n, err, signal);
        return;
      }
    }
    state.runningLayer = null;
    state.abortController = null;
    renderAll();
    setStatus('Paused at beat 4 · Reading. Choose one of the three readings or write your own; nothing is ranked.');
    showToast('Paused for your interpretation.');
  }

  function handleLayerError(n, err, signal) {
    const aborted = (err && err.name === 'AbortError') || (signal && signal.aborted);
    state.errors[String(n)] = aborted ? 'Stopped by the artiste.' : (err && err.message ? err.message : 'Unknown error.');
    state.layerStatus[String(n)] = 'error';
    state.beats[String(n)] = 'error';
    state.runningLayer = null;
    state.abortController = null;
    renderAll();
    setStatus(aborted ? 'Stopped. Retry the layer when ready.' : `Beat ${n} needs attention. Retry just this layer; earlier results were kept.`);
  }

  async function generateArtha(regenerate = false) {
    if (state.runningLayer) return;
    if (!hasReading()) { showToast('Choose a reading first.'); return; }
    syncInputs();
    previousArthaForRegenerate = regenerate ? state.rawArtha : '';
    state.variation = regenerate ? state.variation + 1 : 0;
    state.abortController = new AbortController();
    const signal = state.abortController.signal;
    state.runningLayer = 5;
    state.sample = false;
    dom.sampleBadge.hidden = true;
    state.errors['5'] = null;
    state.layerStatus['5'] = 'running';
    state.beats['5'] = 'running';
    state.rawArtha = '';
    state.arthaLines = [];
    renderLayer(5);
    renderBeats();
    updateButtons();
    setStatus('Beat 5 of 5 · streaming A: / P: lines…');
    const payload = buildPayload(5, {
      regenerate,
      previousArtha: previousArthaForRegenerate,
      variation: state.variation
    });

    try {
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'stream', layer: 5, config: getConfig(), payload }),
        signal
      });
      if (!res.ok) {
        const text = await res.text();
        let j = null;
        try { j = JSON.parse(text); } catch (_) { /* ignore */ }
        throw new Error((j && j.error) || `Stream failed (${res.status}).`);
      }
      if (!res.body) throw new Error('The server returned no stream body.');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        state.rawArtha += decoder.decode(chunk.value, { stream: true });
        state.arthaLines = parseArtha(state.rawArtha);
        scheduleStageRender();
      }
      state.rawArtha += decoder.decode();
      state.arthaLines = parseArtha(state.rawArtha);
      renderStage();
      state.layerStatus['5'] = 'done';
      state.beats['5'] = 'done';
      setStatus(regenerate ? 'Fresh artha streamed. Copy, edit, or regenerate again.' : 'Artha streamed. Copy, edit, or regenerate.');
    } catch (err) {
      const aborted = (err && err.name === 'AbortError') || signal.aborted;
      state.errors['5'] = aborted ? 'Stopped by the artiste. Partial lines were kept.' : (err && err.message ? err.message : 'Unknown error.');
      state.layerStatus['5'] = 'error';
      state.beats['5'] = 'error';
      setStatus(aborted ? 'Stopped during streaming. Partial artha kept.' : 'Beat 5 needs attention. Use Generate or Regenerate to retry.');
    } finally {
      state.runningLayer = null;
      state.abortController = null;
      renderLayer(5);
      renderBeats();
      updateButtons();
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
    const card = $(`#layer${n}`);
    const editor = $('.override-editor', card);
    const ta = $('textarea', editor);
    try {
      if (n === 5) {
        const raw = ta.value.trim();
        if (!raw) throw new Error('Write at least one A: or P: line.');
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
      state.sample = false;
      dom.sampleBadge.hidden = true;
      editor.hidden = true;
      renderAll();
      setStatus(`Layer ${n} override saved. Downstream layers may be stale; use “Rerun from here” if you want a fresh chain.`);
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
    dom.settingsBtn.addEventListener('click', () => { loadSettingsToDialog(); dom.settingsDialog.showModal(); });
    dom.settingsBtn2.addEventListener('click', () => { loadSettingsToDialog(); dom.settingsDialog.showModal(); });
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
      state.argumentSelection[target.dataset.argId] = target.checked;
      state.sample = false;
      dom.sampleBadge.hidden = true;
      renderLayer(3);
      updateButtons();
      setStatus('Argument override noted. Regenerate the response to use the new kept set.');
    });

    $('#layer4 .layer-body').addEventListener('change', (event) => {
      const target = event.target;
      if (target.name === 'reading') {
        state.readingChoice = target.value === 'custom'
          ? { type: 'custom', id: 'custom' }
          : { type: 'model', id: target.value };
        state.sample = false;
        dom.sampleBadge.hidden = true;
        updateButtons();
      }
    });

    $('#layer4 .layer-body').addEventListener('input', (event) => {
      if (event.target.id !== 'customReadingText') return;
      state.customReading = event.target.value;
      if (state.customReading.trim()) {
        state.readingChoice = { type: 'custom', id: 'custom' };
        const radio = $('#customReadingRadio');
        if (radio) radio.checked = true;
      }
      state.sample = false;
      dom.sampleBadge.hidden = true;
      updateButtons();
    });

    [dom.register, dom.length, dom.prativadiStyle, dom.responseNote].forEach((node) => {
      node.addEventListener('change', () => {
        state.sample = false;
        dom.sampleBadge.hidden = true;
        updateButtons();
      });
    });
  }

  /* ---------- boot ---------- */

  const storedTheme = storage.get('talamaddale-theme');
  applyTheme(storedTheme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  wireEvents();
  loadSettingsToDialog();
  checkServerConfig();
  loadSample();
})();
