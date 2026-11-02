'use strict';

/** Canonical Kannada lipi for the art form and common role labels. */
const CANONICAL_TALAMADDALE = 'ತಾಳಮದ್ದಳೆ';

// Only fix known orthographic variants in app chrome / generated prose.
// Do NOT apply this to the user's raw or cleaned pada transcript.
const TERM_FIXES = [
  [/ತಲಮದ್ದಲೆ/g, CANONICAL_TALAMADDALE],
  [/ತಲಮದ್ದಳೆ/g, CANONICAL_TALAMADDALE],
  [/ತಾಳಮದ್ದಲೆ/g, CANONICAL_TALAMADDALE],
  [/ತಾಳ\s+ಮದ್ದಳೆ/g, CANONICAL_TALAMADDALE],
  [/ಅರ್ಥದಾರಿ/g, 'ಅರ್ಥಧಾರಿ'],
  [/ಅರ್ಥಗಾರಿಕೆ/g, 'ಅರ್ಥಗಾರಿಕೆ']
];

function normalizeKannadaTerms(text) {
  let out = String(text ?? '');
  for (const [pattern, replacement] of TERM_FIXES) out = out.replace(pattern, replacement);
  return out;
}

const PRESERVE_KEYS = new Set([
  'cleaned_transcript', 'pada_raw', 'pada_cleaned', 'style_exemplar',
  'exemplar', 'previousArtha', 'rawArtha'
]);

function normalizeDeep(value, key = '') {
  if (PRESERVE_KEYS.has(key)) return value;
  if (typeof value === 'string') return normalizeKannadaTerms(value);
  if (Array.isArray(value)) return value.map((item) => normalizeDeep(item));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeDeep(v, k);
    return out;
  }
  return value;
}

function parseArthaLines(raw) {
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

/** Advisory only: never blocks the artiste's final edit. */
function assessArtha(raw, inputs = {}) {
  const lines = parseArthaLines(raw);
  const a = lines.filter((l) => l.speaker === 'A');
  const p = lines.filter((l) => l.speaker === 'P');
  const aWords = a.reduce((n, l) => n + countWords(l.text), 0);
  const pWords = p.reduce((n, l) => n + countWords(l.text), 0);
  const totalWords = aWords + pWords;
  const twoRoles = Boolean(String(inputs.prativadi || '').trim());
  const warnings = [];
  if (twoRoles) {
    if (p.length < 3) warnings.push('ಎರಡು ಪಾತ್ರಗಳಿವೆ; ಪ್ರತಿವಾದಿಯ ಮಾತುಗಳು ತೀರಾ ಕಡಿಮೆ. ವಾದ–ಪ್ರತಿವಾದವನ್ನು ವಿಸ್ತರಿಸಿ.');
    if (totalWords && pWords / totalWords < 0.25) warnings.push('ಪ್ರತಿವಾದಿಯ ಪಾಲು ಕಡಿಮೆ; ಅರ್ಥವು ಏಕಮುಖ ಭಾಷಣದಂತೆ ಕೇಳಬಹುದು.');
    const weakP = p.filter((l) => countWords(l.text) <= 3).length;
    if (p.length && weakP / p.length > 0.4) warnings.push('“ಹ”, “ಯಾಕೋ” ಮಾದರಿಯ ಸಣ್ಣ ಮಧ್ಯಸ್ಥ ಮಾತುಗಳ ಬದಲು ನಿರ್ದಿಷ್ಟ ಆಕ್ಷೇಪ/ಪ್ರಶ್ನೆಗಳನ್ನು ಕೊಡಿ.');
    let maxRun = 1, run = 1;
    for (let i = 1; i < lines.length; i += 1) {
      run = lines[i].speaker === lines[i - 1].speaker ? run + 1 : 1;
      maxRun = Math.max(maxRun, run);
    }
    if (maxRun > 2) warnings.push('ಒಂದೇ ಪಾತ್ರದ ಸತತ ಮಾತುಗಳು ಹೆಚ್ಚಾಗಿವೆ; ಪ್ರಶ್ನೆ–ಉತ್ತರದ ಲಯವನ್ನು ಪರಿಶೀಲಿಸಿ.');
  }
  const texts = lines.map((l) => l.text.trim());
  if (new Set(texts).size < texts.length) warnings.push('ಕೆಲವು ಮಾತುಗಳು ಪುನರಾವರ್ತನೆಯಾಗಿವೆ; ಅರ್ಥವನ್ನು ಮುಂದಕ್ಕೆ ಒಯ್ಯುವಂತೆ ತಿದ್ದಿ.');
  return {
    lines: lines.length,
    aLines: a.length,
    pLines: p.length,
    aWords,
    pWords,
    prativadiWordShare: totalWords ? Math.round((pWords / totalWords) * 100) : 0,
    twoRoles,
    warnings
  };
}

module.exports = {
  CANONICAL_TALAMADDALE,
  normalizeKannadaTerms,
  normalizeDeep,
  parseArthaLines,
  assessArtha
};
