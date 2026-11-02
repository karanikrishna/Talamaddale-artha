'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildMessages, validateLayer, cleanPada } = require('../lib/prompts');
const { normalizeKannadaTerms, assessArtha, parseArthaLines } = require('../lib/kannada');
const { BOOK_REFERENCES, CRAFT_GUIDANCE_KN } = require('../lib/guidance');

function loadSample() {
  const file = path.join(__dirname, '..', 'public', 'sample-state.js');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox);
  return sandbox.window.TALAMADDALE_SAMPLE;
}

test('canonical Kannada lipi is ತಾಳಮದ್ದಳೆ', () => {
  assert.equal(normalizeKannadaTerms('ತಲಮದ್ದಲೆ ತಾಳಮದ್ದಲೆ ತಾಳ ಮದ್ದಳೆ'), 'ತಾಳಮದ್ದಳೆ ತಾಳಮದ್ದಳೆ ತಾಳಮದ್ದಳೆ');
  assert.equal(normalizeKannadaTerms('ಅರ್ಥದಾರಿ'), 'ಅರ್ಥಧಾರಿ');
});

test('raw padya OCR is preserved by cleaner', () => {
  const raw = 'ಸಾೋಹವಂದು ಮರವಯರಯಿತ್ರ | ಅಧಿಕರರಜನಯ';
  const cleaned = cleanPada(raw).cleaned_transcript;
  assert.equal(cleaned, raw);
});

test('layer 5 prompt requires substantive two-role discussion', () => {
  const payload = {
    inputs: { pada: 'ಪದ್ಯ', prasanga: 'ಗುರುದಕ್ಷಿಣೆ', pathra: 'ದ್ರೋಣ', prativadi: 'ದ್ರುಪದ', outputLanguage: 'kn' },
    controls: { prativadiStyle: 'dialogue' },
    keptArguments: [], chosenReading: {}, previous: {}
  };
  const messages = buildMessages(5, payload);
  const system = messages[0].content;
  assert.match(system, /ತಾಳಮದ್ದಳೆ/);
  assert.match(system, /TWO-ROLE DISCUSSION IS MANDATORY/);
  assert.match(system, /Do NOT use P: lines as only/);
  assert.match(system, /strong interpretation/);
  assert.match(messages[1].content, /CRAFT GUIDANCE/);
});

test('layer 5 monologue when no prativadi', () => {
  const messages = buildMessages(5, { inputs: { pada: 'ಪದ್ಯ', pathra: 'ದ್ರೋಣ' }, previous: {} });
  assert.match(messages[0].content, /No prativadi was supplied/);
});

test('guidance references include ಜಾಗರ and ಕೇದಗೆ without copying artha', () => {
  const ids = BOOK_REFERENCES.map((b) => b.id);
  assert.ok(ids.includes('jagara'));
  assert.ok(ids.includes('kedage'));
  assert.match(CRAFT_GUIDANCE_KN, /ಅರ್ಥವು ಪದ್ಯದ ಸಾಲು-ಸಾಲಿನ ಶಬ್ದಾರ್ಥ ಮಾತ್ರವಲ್ಲ/);
  assert.match(CRAFT_GUIDANCE_KN, /ಪ್ರತಿವಾದಿಯ ಮಾತು/);
});

test('sample is a balanced two-role interpretation, not filler', () => {
  const sample = loadSample();
  const quality = assessArtha(sample.rawArtha, sample.inputs);
  assert.equal(quality.twoRoles, true);
  assert.ok(quality.pLines >= 6);
  assert.ok(quality.prativadiWordShare >= 30);
  assert.deepEqual(quality.warnings, []);
  const lines = parseArthaLines(sample.rawArtha);
  assert.ok(lines.every((l) => l.text.split(/\s+/).length > 3));
  assert.ok(sample.layers['1'].interpretive_problem);
  assert.ok(sample.layers['4'].readings.every((r) => r.central_claim));
});

test('validateLayer normalizes generated prose but preserves transcript', () => {
  const payload = { inputs: { pada: 'ತಲಮದ್ದಲೆ ಪದ್ಯ' } };
  const data = {
    cleaned_transcript: 'should be replaced by cleaner',
    scene: 'ತಲಮದ್ದಲೆ ರಂಗ',
    lookup_questions: ['೧', '೨', '೩'],
    ambiguities: []
  };
  const out = validateLayer(1, data, payload);
  assert.equal(out.scene, 'ತಾಳಮದ್ದಳೆ ರಂಗ');
  assert.equal(out.cleaned_transcript, 'ತಲಮದ್ದಲೆ ಪದ್ಯ');
});

test('app chrome uses canonical ತಾಳಮದ್ದಳೆ', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.match(html, /ತಾಳಮದ್ದಳೆ ಅರ್ಥ/);
  assert.doesNotMatch(html, /ತಲಮದ್ದಲೆ/);
});
