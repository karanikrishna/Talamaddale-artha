'use strict';

const { guidanceBlock } = require('./guidance');
const { normalizeDeep, CANONICAL_TALAMADDALE, resolveMode } = require('./kannada');

const SOURCE_CATALOG = [
  'Valmiki Ramayana',
  'Mahabharata',
  'Bhagavata Purana',
  'Garuda Purana',
  'Markandeya Purana',
  'Vishnu Purana',
  'Shiva Purana',
  'Skanda Purana',
  'Padma Purana',
  'Brahmanda Purana',
  'Agni Purana',
  'Varaha Purana',
  'Narada Purana',
  'Linga Purana',
  'Kurma Purana',
  'Matsya Purana'
];

function cleanPada(raw) {
  const input = String(raw || '');
  const musicCues = (input.match(/\[\s*(?:ಸಂಗೀತ|music)[^\]]*\]/giu) || []).length;
  const separators = (input.match(/(?:&gt;\s*&gt;|>>|»|››)/g) || []).length;
  let text = input
    .replace(/\[\s*(?:ಸಂಗೀತ|music)[^\]]*\]/giu, '')
    .replace(/&gt;\s*&gt;/g, '\n')
    .replace(/>>|»|››/g, '\n')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return {
    cleaned_transcript: text,
    cleaning_note: `Removed ${musicCues} music cue${musicCues === 1 ? '' : 's'} and ${separators} ">>" separator${separators === 1 ? '' : 's'}. Verse bars and numbering were kept as transcribed.`
  };
}

function languageInstruction(code) {
  if (code === 'en') {
    return 'Write all human-readable prose in clear, natural English.';
  }
  if (code === 'kn-en') {
    return 'Write all human-readable prose in Kannada script and add a short English gloss in parentheses at the end of each prose field. For the spoken response, add the English gloss in parentheses on the same A: or P: line. Do not create separate gloss keys.';
  }
  return 'Write all human-readable prose in natural Kannada script. Use English only for proper names, technical labels, and source titles where needed.';
}

function commonContext(payload) {
  const i = payload.inputs || {};
  return {
    mode: resolveMode(i),
    prasanga: i.prasanga || '',
    pathra: i.pathra || '',
    prativadi: i.prativadi || '',
    output_language: i.outputLanguage || 'kn',
    pada_raw: i.pada || '',
    pada_cleaned: (payload.previous && payload.previous['1'] && payload.previous['1'].cleaned_transcript) || cleanPada(i.pada || '').cleaned_transcript,
    style_exemplar: i.exemplar || ''
  };
}

function jsonOnly(system, user) {
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

function buildMessages(layer, payload) {
  const p = Number(layer);
  const ctx = commonContext(payload);
  const lang = languageInstruction(ctx.output_language);
  const base = `You are assisting a Yakshagana ${CANONICAL_TALAMADDALE} arthadhari. The correct Kannada lipi is ತಾಳಮದ್ದಳೆ; never write ತಲಮದ್ದಲೆ or ತಾಳಮದ್ದಲೆ. Artha is not a line-by-line meaning or translation of the padya. It is a strong, situated interpretation spoken as the character: a claim about dharma, motive, relationship, power, memory, or consequence, tested against the prasanga and the other role. Treat every finding as advice that the artiste may override. Performance mode is explicit: swagatha is a one-role introduction/monologue; dialogue is a two-role exchange. Never force a second role into swagatha. ${lang} Return ONE JSON object only. No markdown, no code fences, no commentary before or after the JSON. Use the CURRENT PADA and CURRENT PRASANGA in the user message as the only input for this run. Never reuse an example, a previous padya, or a cached dialogue. Do not invent facts. Say "location uncertain" or "not securely recalled" when appropriate.

CRAFT GUIDANCE (paraphrased from ತಾಳಮದ್ದಳೆ scholarship; do not quote it as a source passage):
${guidanceBlock()}`;

  if (p === 1) {
    const cleaning = cleanPada(ctx.pada_raw);
    ctx.pada_cleaned = cleaning.cleaned_transcript;
    const system = `${base}

LAYER 1 — ACQUISITION OF CONTEXT.
The deterministic cleaner has already removed [ಸಂಗೀತ] music cues and ">>" / "&gt;&gt;" from the pada. Do not reintroduce them. The transcript may contain OCR damage or unusual spelling; do not silently correct it. Name uncertain words in "ambiguities".

Return exactly these keys:
{
  "cleaned_transcript": "the supplied cleaned text, verbatim",
  "cleaning_note": "what was removed",
  "scene": "scene within the prasanga",
  "speaker_identity": "who the pathra is here",
  "performance_mode": "swagatha | dialogue",
  "role_introduction_focus": "for swagatha: identity, entry, purpose, self-understanding; for dialogue: null or short note",
  "state_of_mind": "speaker's state of mind",
  "addressed_to": "who is being addressed",
  "rasa": "dominant rasa",
  "bhava": "dominant bhava",
  "story_so_far": "short summary of the story so far",
  "interpretive_problem": "the central tension this pada forces the character to confront; not a paraphrase",
  "interpretive_stakes": "what becomes true, justified, wounded, or exposed if the character's reading is accepted",
  "ambiguities": ["what the transcript leaves unclear", "..."],
  "lookup_questions": ["3 to 5 precise questions to look up", "..."]
}`;
    const user = `Performance mode: ${ctx.mode}
Prasanga: ${ctx.prasanga}
Pathra (speaker): ${ctx.pathra || 'not supplied — infer cautiously from the padya and prasanga; mark uncertainty'}
Prativadi (other role, if known): ${ctx.prativadi || 'not supplied'}
Output language: ${ctx.output_language}

RAW PADA:
${ctx.pada_raw}

CLEANED PADA (use this verbatim as cleaned_transcript):
${ctx.pada_cleaned}

CLEANING NOTE (use this):
${cleaning.cleaning_note}

STYLE EXEMPLAR ARTHA (for tone only; do not copy sentences):
${ctx.style_exemplar || 'not supplied'}

Return 3 to 5 lookup_questions. Keep the summary short.`;
    return jsonOnly(system, user);
  }

  if (p === 2) {
    const system = `${base}

LAYER 2 — RETRIEVAL OF KNOWLEDGE.
Search this fixed sixteen-source corpus by recall: ${SOURCE_CATALOG.join('; ')}.
Valmiki Ramayana and Mahabharata are Itihasa; the remaining fourteen are Purana. Consider all sixteen, but do not force a passage from a source that has no securely recalled bearing. Return up to 10 securely recalled passages; return fewer, or an empty list, rather than inventing support.

Honesty rules:
- These passages are recalled by the model and NOT read from printed editions. Put that sentence in "uncertainty_note".
- NEVER invent chapter, verse, section, canto, adhyaya, sarga, or book numbers anywhere in the JSON. If unsure, set "location" to exactly "location uncertain". A broad kanda, parva, or skandha name is allowed only when confidently recalled. The server also strips precise citation-like details before showing the result.
- Label anything taken from Kannada retellings or stage tradition as "Regional tradition" in "tradition_label".
- "confidence" must be one of "high", "medium", or "low".
- "variant_versions" must be a boolean flag for known variant versions or recensions.
- "bearing" must explain how the passage bears on THIS pada, not on the epic in general.
- "used_sources" must contain only names from the sixteen-source corpus that actually appear in passages.

Return exactly these keys:
{
  "searched_sources": ["all sixteen source names"],
  "used_sources": ["subset of the sixteen"],
  "uncertainty_note": "recalled by the model, not read from printed editions",
  "regional_tradition_note": "how regional tradition is marked",
  "passages": [
    {
      "id": "p1",
      "source": "one of the sixteen, or Regional tradition",
      "location": "kanda / parva / skandha, or location uncertain",
      "gist": "short gist",
      "bearing": "how it bears on the pada",
      "confidence": "high | medium | low",
      "variant_versions": true,
      "tradition_label": "Regional tradition or null",
      "location_note": "why the location is certain or uncertain"
    }
  ]
}`;
    const user = `Prasanga: ${ctx.prasanga}
Pathra: ${ctx.pathra || 'not supplied — infer cautiously'}
Prativadi: ${ctx.prativadi || 'not supplied'}
Output language: ${ctx.output_language}

CLEANED PADA:
${ctx.pada_cleaned}

LAYER 1 JSON:
${JSON.stringify(payload.previous && payload.previous['1'] ? payload.previous['1'] : {}, null, 2)}

Pay particular attention to these lookup questions:
${JSON.stringify((payload.previous && payload.previous['1'] && payload.previous['1'].lookup_questions) || [], null, 2)}

Return up to 10 securely recalled passages; return fewer, or an empty list, rather than inventing support. Do not cite printed chapter or verse numbers.`;
    return jsonOnly(system, user);
  }

  if (p === 3) {
    const system = `${base}

LAYER 3 — TESTING OF ARGUMENTS.
Turn the retrieved passages and the pada's interpretive problem into 4 to 7 arguments the pathra could make at this moment. Each claim must be an interpretive position, not a restatement of the padya's meaning. In swagatha, counter-claims are internal tests of the role's self-presentation, not words put into another character's mouth. Do not rank them. Test every argument on four axes: fit to the prasanga, whether the pathra could know it at that moment, consistency across sources, and strength of source support. For each argument, state the prativadi's strongest likely objection and a possible reply that stays inside the character's knowledge and the prasanga.

Return exactly these keys:
{
  "arguments": [
    {
      "id": "a1",
      "claim": "the argument in one sentence",
      "fit_to_prasanga": "assessment",
      "knowable_at_moment": "could the pathra know this now?",
      "cross_source_consistency": "assessment across sources",
      "source_support": "strength of support",
      "verdict": "use | use with care | hold back",
      "reason": "reason for the verdict",
      "prativadi_objection": "the strongest objection a prativadi is likely to raise",
      "possible_reply": "a direct reply the pathra could give without leaving the moment",
      "interpretive_gain": "what this argument reveals beyond the literal meaning of the padya",
      "passage_ids": ["p1"],
      "override_note": "The artiste may tick or untick this argument."
    }
  ],
  "advice_note": "These verdicts are advice, not rules."
}`;
    const user = `Performance mode: ${ctx.mode}
Prasanga: ${ctx.prasanga}
Pathra: ${ctx.pathra || 'not supplied — infer cautiously'}
Prativadi: ${ctx.mode === 'dialogue' ? (ctx.prativadi || 'not supplied') : 'not applicable in swagatha'}
Output language: ${ctx.output_language}

CLEANED PADA:
${ctx.pada_cleaned}

LAYER 1 JSON:
${JSON.stringify(payload.previous && payload.previous['1'] ? payload.previous['1'] : {}, null, 2)}

LAYER 2 JSON:
${JSON.stringify(payload.previous && payload.previous['2'] ? payload.previous['2'] : {}, null, 2)}

Return 4 to 7 arguments and nothing else.`;
    return jsonOnly(system, user);
  }

  if (p === 4) {
    const system = `${base}

LAYER 4 — HUMAN-CENTRED INTERPRETATION.
Offer EXACTLY THREE readings of the pada. They must be strong interpretations, not three paraphrases. They must differ in rasa, stance, or emphasis, and each must answer the interpretive_problem from Layer 1. Do not rank, score, recommend, or label any of them "best". The artiste chooses, or writes their own. Each reading must name the argument ids it leans on, the central claim it makes, and its artistic risk.

Return exactly these keys:
{
  "readings": [
    {
      "id": "r1",
      "rasa": "rasa",
      "stance": "stance",
      "emphasis": "emphasis",
      "summary": "short reading",
      "central_claim": "the interpretive thesis this reading asks the audience to consider",
      "argument_ids": ["a1"],
      "risk": "what this reading risks on stage"
    }
  ],
  "pause_note": "The pipeline pauses here until the artiste picks a reading or writes their own."
}`;
    const user = `Prasanga: ${ctx.prasanga}
Pathra: ${ctx.pathra || 'not supplied — infer cautiously'}
Prativadi: ${ctx.prativadi || 'not supplied'}
Output language: ${ctx.output_language}

CLEANED PADA:
${ctx.pada_cleaned}

LAYER 1 JSON:
${JSON.stringify(payload.previous && payload.previous['1'] ? payload.previous['1'] : {}, null, 2)}

LAYER 3 JSON:
${JSON.stringify(payload.previous && payload.previous['3'] ? payload.previous['3'] : {}, null, 2)}

Return exactly three readings. Do not rank them.`;
    return jsonOnly(system, user);
  }

  if (p === 5) {
    const c = payload.controls || {};
    const kept = Array.isArray(payload.keptArguments) ? payload.keptArguments : [];
    const chosen = payload.chosenReading || {};
    const variation = Number(payload.variation || 0);
    const regen = payload.regenerate
      ? `This is regenerate variation ${variation}. Produce a fresh wording: choose a different opening comparison, vary the order in which the kept arguments arrive, and do not repeat the previous artha sentence for sentence. Stay inside the same chosen reading and the same kept arguments. Previous artha for avoidance only:\n${String(payload.previousArtha || '').slice(0, 3000)}\n`
      : '';
    const twoRoles = ctx.mode === 'dialogue';
    const system = `You are generating ${CANONICAL_TALAMADDALE} ಅರ್ಥಗಾರಿಕೆ in the explicit mode "${ctx.mode}", not a detached commentary. Produce ONLY plain text lines. Every line MUST begin with "A:" for the pathra${twoRoles ? ' or "P:" for the prativadi' : '; do NOT output any "P:" line'}. No markdown, no JSON, no headings, no blank lines, no citations, no source names, no chapter numbers, no commentary.

CORE RULE: The artha must be a strong interpretation of the padya. Do not merely explain words, translate lines, or summarize the story. Use the padya as the occasion for a character to defend a position about dharma, motive, relationship, power, memory, or consequence. The chosen reading is the thesis; the kept arguments are the support. ${twoRoles ? 'The prativadi tests it in dialogue.' : 'In swagatha, the role tests its own self-understanding through reflective questions; no second speaker is invented.'}

${twoRoles ? `DIALOGUE MODE — TWO ROLES.
- The prativadi is a full debating role, not a prompter. P: lines must ask specific questions, raise specific objections, or force a distinction.
- Do NOT use P: lines as only "ಹ", "ಯಾಕೋ", "ಏನನ್ನು", "ಹೌದೋ" or similar filler.
- A: must answer the immediately preceding P: objection before moving to a new point.
- Alternate A:/P: frequently. Aim for roughly 35–50% of the spoken words from P:.
- Let the disagreement develop: claim → objection → reply → deeper objection → qualified conclusion or open question.
- Start with A: and end with A: only after the last P: challenge has been answered or honestly left open.` : `SWAGATHA MODE — ONE ROLE ONLY.
- This is ಸ್ವಗತ: the role introduces itself and unfolding self-understanding in a first-person monologue.
- Output ONLY A: lines. Never create P:, a prativadi, an interlocutor, or a debate exchange.
- Build: entry/identity → purpose in this prasanga → emotional/ethical tension → interpretive claim → resolved or open self-understanding.
- Rhetorical questions may be asked by the same role to itself or the audience; they are not another character's lines.
- Do not reduce the swagatha to a biography list or padya paraphrase; let the role reveal a situated judgment.`}

The pathra speaks in FIRST PERSON. ${twoRoles ? 'Address the prativadi by name or role when natural.' : 'Address the audience or the role’s own conscience; do not address an invented second role.'} Keep the language speakable on stage: rhetorical questions, comparisons, and a slow build are welcome, but every flourish must serve the argument. Follow the style exemplar's cadence only; DO NOT copy its sentences. Use only the kept arguments and the chosen reading. Do not introduce new episodes, citations, or arguments. Do not read out citations.

Register: ${c.register || 'argumentative'}.
Length: ${c.length || 'medium'} (short: about 10-14 lines; medium: about 16-22 lines; long: about 24-32 lines).
${twoRoles ? `Prativadi style: ${c.prativadiStyle || 'dialogue'} (dialogue: balanced examination; gentle: respectful but substantive objections; sharp: forceful, precise challenges). Even in gentle mode, objections must be substantive.` : 'Prativadi style: not applicable in swagatha.'}
Free-text note from the artiste: ${c.note || 'none'}.
${lang}
${regen}`;
    const user = `Prasanga: ${ctx.prasanga}
Performance mode: ${ctx.mode}
Pathra (A:): ${ctx.pathra || 'the role inferred from the padya/prasanga'}
Prativadi (P:): ${twoRoles ? (ctx.prativadi || 'not supplied — infer a contextually appropriate interlocutor if possible; otherwise use a generic ಪ್ರತಿವಾದಿ and do not invent a named identity') : 'not applicable — swagatha'}
Output language: ${ctx.output_language}

PADA:
${ctx.pada_cleaned}

CONTEXT AND INTERPRETIVE PROBLEM:
${JSON.stringify(payload.previous && payload.previous['1'] ? payload.previous['1'] : {}, null, 2)}

CHOSEN READING / THESIS:
${JSON.stringify(chosen, null, 2)}

KEPT ARGUMENTS ONLY:
${JSON.stringify(kept, null, 2)}

STYLE EXEMPLAR (cadence only; do not copy sentences):
${ctx.style_exemplar || 'not supplied'}

CRAFT GUIDANCE:
${guidanceBlock()}

${twoRoles ? 'Begin streaming A:/P: lines now. Make the discussion itself carry the interpretation.' : 'Begin streaming A: lines only now. Make the swagatha itself carry the interpretation.'}`;
    return jsonOnly(system, user);
  }

  throw new Error(`Unknown layer ${layer}`);
}

function sanitizeCitationWords(text) {
  return String(text || '').replace(
    /(?:chapter|verse|shloka|śloka|sarga|adhyāya|adhyaya|section|canto|book)\s*(?:no\.?\s*)?(?:[ivxlcdm]+|\d+[a-z]?)/gi,
    '[precise citation withheld]'
  );
}

function sanitizeLocation(location) {
  const raw = String(location || '').trim();
  const hasPreciseDetail = /\d|[IVXLCDM]{2,}|chapter|verse|shloka|śloka|sarga|adhyāya|adhyaya|section|canto|book/i.test(raw);
  if (!raw || hasPreciseDetail) {
    return { location: 'location uncertain', sanitized: true };
  }
  return { location: raw, sanitized: false };
}

function extractJson(text) {
  if (typeof text !== 'string') throw new Error('Model returned no text.');
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try {
    return JSON.parse(s);
  } catch (_) {
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return JSON.parse(s.slice(first, last + 1));
    }
  }
  throw new Error('Model did not return valid JSON.');
}

function asArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function validateLayer(layer, data, payload) {
  const p = Number(layer);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Model JSON was not an object.');
  }
  const out = normalizeDeep({ ...data });

  if (p === 1) {
    const cleaning = cleanPada((payload.inputs && payload.inputs.pada) || '');
    out.cleaned_transcript = cleaning.cleaned_transcript;
    out.cleaning_note = cleaning.cleaning_note;
    out.ambiguities = asArray(out.ambiguities);
    out.lookup_questions = asArray(out.lookup_questions).slice(0, 5);
    if (out.lookup_questions.length < 3 || out.lookup_questions.length > 5) {
      throw new Error('Layer 1 must return 3 to 5 lookup questions.');
    }
    out.performance_mode = (payload.inputs && payload.inputs.mode) || out.performance_mode || 'swagatha';
    out.role_introduction_focus = out.role_introduction_focus || null;
    for (const key of ['scene', 'speaker_identity', 'state_of_mind', 'addressed_to', 'rasa', 'bhava', 'story_so_far', 'interpretive_problem', 'interpretive_stakes']) {
      if (!out[key]) out[key] = 'Not stated by the model.';
    }
    return out;
  }

  if (p === 2) {
    out.searched_sources = SOURCE_CATALOG.slice();
    out.passages = asArray(out.passages).slice(0, 10);
    if (out.passages.length > 10) {
      throw new Error('Layer 2 may return at most 10 passages.');
    }
    if (!out.passages.length) out.uncertainty_note = 'ಮೂಲ ಲಭ್ಯವಿಲ್ಲ — no source passage was securely recalled. The interpretation must not pretend to have source support.';
    out.passages = out.passages.map((passage, idx) => {
      const q = { ...passage };
      const loc = sanitizeLocation(q.location);
      q.id = q.id || `p${idx + 1}`;
      q.source = q.source || 'Regional tradition';
      q.location = loc.location;
      q.location_sanitized = loc.sanitized;
      q.gist = sanitizeCitationWords(q.gist || 'Gist not recalled.');
      q.bearing = sanitizeCitationWords(q.bearing || 'Bearing not stated.');
      const confidence = String(q.confidence || 'low').toLowerCase();
      q.confidence = ['high', 'medium', 'low'].includes(confidence) ? confidence : 'low';
      q.variant_versions = Boolean(q.variant_versions);
      q.tradition_label = q.tradition_label || null;
      q.location_note = sanitizeCitationWords(q.location_note || 'Location not independently verified.');
      if (loc.sanitized) {
        q.location_note += ' Precise chapter/verse-like detail was withheld because passages are recalled, not read from printed editions.';
      }
      return q;
    });
    const used = new Set(out.passages.map((q) => q.source).filter((s) => SOURCE_CATALOG.includes(s)));
    out.used_sources = Array.isArray(out.used_sources)
      ? out.used_sources.filter((s) => SOURCE_CATALOG.includes(s))
      : [];
    for (const s of used) if (!out.used_sources.includes(s)) out.used_sources.push(s);
    out.uncertainty_note = sanitizeCitationWords(out.uncertainty_note || 'Passages are recalled by the model and not read from printed editions. Confidence is shown on each passage.');
    out.regional_tradition_note = sanitizeCitationWords(out.regional_tradition_note || 'Kannada retellings and stage tradition are labelled "Regional tradition".');
    out.location_enforcement = 'The server replaces chapter, verse, section, canto, book, sarga and adhyaya numbers with "location uncertain" before the passage is shown. Broad kanda / parva / skandha names are allowed only without numeric detail.';
    return out;
  }

  if (p === 3) {
    out.arguments = asArray(out.arguments).slice(0, 7);
    if (out.arguments.length < 4 || out.arguments.length > 7) {
      throw new Error('Layer 3 must return 4 to 7 arguments.');
    }
    const allowed = ['use', 'use with care', 'hold back'];
    out.arguments = out.arguments.map((arg, idx) => {
      const a = { ...arg };
      a.id = a.id || `a${idx + 1}`;
      a.claim = a.claim || 'Claim not stated.';
      a.fit_to_prasanga = a.fit_to_prasanga || 'Not assessed.';
      a.knowable_at_moment = a.knowable_at_moment || 'Not assessed.';
      a.cross_source_consistency = a.cross_source_consistency || 'Not assessed.';
      a.source_support = a.source_support || 'Not assessed.';
      const verdict = String(a.verdict || 'hold back').toLowerCase();
      a.verdict = allowed.includes(verdict) ? verdict : 'hold back';
      a.reason = a.reason || 'Reason not stated.';
      a.prativadi_objection = a.prativadi_objection || 'Objection not stated.';
      a.possible_reply = a.possible_reply || 'Reply not stated.';
      a.interpretive_gain = a.interpretive_gain || 'Interpretive gain not stated.';
      a.passage_ids = asArray(a.passage_ids);
      a.override_note = a.override_note || 'The artiste may tick or untick this argument.';
      return a;
    });
    out.advice_note = out.advice_note || 'These verdicts are advice, not rules.';
    return out;
  }

  if (p === 4) {
    out.readings = asArray(out.readings);
    if (out.readings.length !== 3) {
      throw new Error('Layer 4 must return exactly three readings.');
    }
    out.readings = out.readings.map((r, idx) => {
      const q = { ...r };
      q.id = q.id || `r${idx + 1}`;
      q.rasa = q.rasa || 'rasa not stated';
      q.stance = q.stance || 'stance not stated';
      q.emphasis = q.emphasis || 'emphasis not stated';
      q.summary = q.summary || 'Summary not stated.';
      q.central_claim = q.central_claim || q.summary;
      q.argument_ids = asArray(q.argument_ids);
      q.risk = q.risk || 'Risk not stated.';
      return q;
    });
    out.pause_note = out.pause_note || 'The pipeline pauses here until the artiste picks a reading or writes their own.';
    return out;
  }

  return out;
}

module.exports = {
  SOURCE_CATALOG,
  cleanPada,
  buildMessages,
  extractJson,
  validateLayer
};
