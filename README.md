# ತಾಳಮದ್ದಳೆ ಅರ್ಥ · Talamaddale Artha

A single-page workshop that turns a Yakshagana **ತಾಳಮದ್ದಳೆ** padya into a strong **ಅರ್ಥ** through five rhythmic beats. It supports both **ಸ್ವಗತ / Swagatha** (one-role introduction/monologue) and **ಸಂವಾದ / Dialogue** (two-role argument).

> ಅರ್ಥವು ಪದ್ಯದ ಸಾಲು-ಸಾಲಿನ ಶಬ್ದಾರ್ಥ ಮಾತ್ರವಲ್ಲ. It is the character’s interpretive stand in the moment: self-revealed in swagatha, tested by a prativadi in dialogue. The app keeps the final choice with the artiste.

## Dynamic input behaviour (v1.3.0)

The live app now starts **blank**. Choose **Swagatha** or **Dialogue**, enter your own padya and prasanga, connect a model, and select **Generate fresh artha**. Pathra and prativadi are optional overrides; the model may infer them cautiously from the padya/prasanga. Editing the padya or other content inputs immediately clears old analysis and dialogue, cancels an in-flight run, and prevents stale responses from reappearing. The app never substitutes the example for a failed or missing model response.

- **Mode is explicit.** Swagatha never invents a second role. Dialogue uses A:/P: exchange.
- **Manual generation is the default.** Select Generate fresh artha after editing.
- **Auto-analyse after editing** is an explicit opt-in checkbox. After a 1.6-second typing pause it runs beats 1–4; it still pauses for the artiste’s reading choice before the response. It can incur API charges.
- Response-setting changes clear only the old dialogue and keep the current analysis/reading.
- Argument/reading changes clear the old dialogue so it cannot look current.
- The **Load example** button is optional and clearly labelled **Example only — not generated**.
- `public/preview.html` remains a read-only static demonstration. The deployed app at `/` is the dynamic application.

A live OpenAI-compatible model is required for new interpretation. There is no offline meaning generator and no API key is bundled.

## Optional example

The example snapshot uses the transcription you supplied:

- **Prasanga:** ಗುರುದಕ್ಷಿಣೆ
- **Pathra:** ದ್ರೋಣ, speaking to ದ್ರುಪದ
- **Pada:** the OCR-marked Kannada text exactly as pasted, including its verse bars and numbering
- All five panels populated, so Context, Knowledge, Arguments, Reading and Response are visible immediately.

The prefilled response is now a substantive ದ್ರೋಣ–ದ್ರುಪದ ವಾದ–ಪ್ರತಿವಾದ, not a set of filler interjections. The style exemplar is a freshly written sketch, not a copied book passage. If you have a permitted artha excerpt from a book or performance, paste it into **Optional inputs → ಅರ್ಥ ಮಾದರಿ / style exemplar**. Layer 5 follows cadence and argumentative movement only; it does not copy sentences.

This is a fixed sample, not an offline generator. Every live run uses your configured model.

## Run it

```bash
cd talamaddale-artha
npm start
# or: node server.js
```

The server binds to `0.0.0.0:3000` and is suitable for the Arena live preview. No npm packages are required; Node 20+ built-ins only.

Open **Model settings** and enter an OpenAI-compatible chat-completions endpoint:

| Field | Example | Note |
| --- | --- | --- |
| Base URL | `https://api.openai.com/v1` | A URL already ending in `/chat/completions` is accepted as-is. |
| API key | `sk-…` | Stored in `localStorage` in your browser, sent to this app’s server only as a proxy header for each request. Not written to disk by the app. Leave blank for a local endpoint. |
| Model | `gpt-4o-mini` | Change to any chat model your endpoint serves. |
| Temperature | `0.7` | Blank omits the parameter, useful for reasoning models that reject it. |
| Max tokens | `1800` | Token parameter can be `max_tokens`, `max_completion_tokens`, or omitted. |

Server environment defaults are also supported: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. Browser fields override them.

## Five-beat pipeline

1. **Context** — removes `[ಸಂಗೀತ]` and `>>` / `&gt;&gt;`, then identifies scene, identity, state of mind, addressee, rasa, bhava, story so far, the interpretive problem, stakes, ambiguities and 3–5 lookup questions. One JSON LLM call.
2. **Knowledge** — recalls up to 10 passages; if none is securely recalled it shows **ಮೂಲ ಲಭ್ಯವಿಲ್ಲ** instead of inventing support. It considers the fixed sixteen-source corpus: Valmiki Ramayana, Mahabharata, Bhagavata, Garuda, Markandeya, Vishnu, Shiva, Skanda, Padma, Brahmanda, Agni, Varaha, Narada, Linga, Kurma and Matsya. Each passage carries source, location, gist, bearing, confidence, variant flag, and a `Regional tradition` label where appropriate. The UI highlights which of the sixteen were used. One JSON LLM call.
3. **Arguments** — 4–7 interpretive arguments tested for prasanga fit, knowability at that moment, cross-source consistency and source support, with verdict, reason, prativadi objection, possible reply and interpretive gain. Tick or untick any argument. One JSON LLM call.
4. **Reading** — exactly three unranked strong readings differing in rasa, stance or emphasis, each with a central claim, arguments and risk. The pipeline **pauses** until the artiste picks one or writes their own. One JSON LLM call.
5. **Response** — streams `A:` lines for Swagatha, or `A:` / `P:` lines for Dialogue. In Dialogue the prativadi must raise substantive objections and the pathra must answer them; filler-only interjections are discouraged. In Swagatha the single role introduces itself and develops a situated judgment without an invented interlocutor. Uses only kept arguments and the chosen reading. Controls: register, length, prativadi style, free-text note. One streaming LLM call. **Copy** preserves `A:` / `P:` prefixes and joins with ` >> `. An advisory panel shows prativadi word share and discussion warnings.

Every layer has an **Edit JSON** override (or **Edit response lines** for layer 5), a per-layer **Retry / Rerun from here** button, and its own error panel. Global **Stop** and **Clear** are in the header. Clear keeps inputs and settings.

## ಅರ್ಥಗಾರಿಕೆ guidance and books

The prompt layer includes short craft principles informed by ತಾಳಮದ್ದಳೆ scholarship, especially:

- *ಜಾಗರ* — ಎಂ. ಪ್ರಭಾಕರ ಜೋಶಿ: ತಾಳಮದ್ದಳೆ, ಅರ್ಥಗಾರಿಕೆ, ವಾದದ ಮಿತಿ, ಆಕರ-ಔಚಿತ್ಯ.
- *ಕೇದಗೆ* — ಎಂ. ಪ್ರಭಾಕರ ಜೋಶಿ: ತಾಳಮದ್ದಳೆ ಮಾತುಗಾರಿಕೆ, ಅರ್ಥಗಾರಿಕೆ: ಸೃಜನಶೀಲದೃಷ್ಟಿ.

These are **guidance pointers**, not a copied artha corpus. The app does not bundle book passages. Use the optional exemplar field for material you have permission to use.

## Kannada lipi guard

The canonical form is **ತಾಳಮದ್ದಳೆ**. Known variants in generated prose and streamed lines are normalized to the canonical form. The raw and cleaned padya transcript is **not** silently rewritten, so OCR evidence remains visible.

## Honesty about knowledge

The app states this in the Knowledge panel and repeats it in prompts: passages are **recalled by the model and not read from printed editions**. Confidence is shown per passage. The model is told never to invent chapter or verse numbers and to write `location uncertain` when unsure. **The server also enforces this**: chapter, verse, section, canto, book, sarga and adhyaya numbers are stripped from locations and prose, the location becomes `location uncertain`, and the passage is tagged `precise citation withheld`. Broad kanda / parva / skandha names are allowed only without numeric detail. Kannada retellings and stage tradition are labelled **Regional tradition**. The sources are Itihāsa plus Purāṇa; Ramayana and Mahabharata are not themselves Purāṇas, but they are part of the requested sixteen-source corpus.

## Design

- Palm-leaf grey-green ground, lamp-black response stage, kumkum red as the single accent.
- Locally bundled **Noto Serif Kannada** WOFF2 files, including Kannada, Latin and Latin-ext subsets — no external font requests.
- Five-beat progress bar with running, paused, done and error states.
- Responsive single-column layout on phones; sticky input rail on wide screens.
- Dark mode, persisted in `localStorage`, with `prefers-color-scheme` as the starting default.

## Static file preview

`public/preview.html` is a **read-only demonstration**, not the dynamic generator. It is a **self-contained copy** for the workspace file viewer: CSS, JavaScript, the Noto Serif Kannada fonts and the example snapshot are all inlined as data URIs. It shows the complete five-beat working state with no server, no network and no external resources. Live LLM calls are intentionally stubbed with a clear message; use the running app on port 3000 for model runs.

Rebuild it after editing the source files:

```bash
node tools/build-preview.js
```

The build script also guards against two easy mistakes: `String.replace` mangling `$$` inside inlined JavaScript, and inline scripts running before the DOM exists. It uses function replacers and moves all scripts to the end of `<body>`.

## Files

```text
server.js                 Built-in Node HTTP server + OpenAI-compatible LLM proxy
lib/prompts.js            Five layer prompts, transcript cleaner, JSON validation,
                          citation-number sanitizer
lib/guidance.js           ತಾಳಮದ್ದಳೆ craft guidance and book pointers
lib/kannada.js            Kannada lipi guard and discussion assessment
public/index.html         Single-page app shell (live app)
public/preview.html       Self-contained static file-viewer preview
public/styles.css         Visual identity, dark mode, responsive layout
public/app.js             Pipeline state, rendering, overrides, streaming, controls
public/sample-state.js    Optional, clearly labelled example snapshot
public/fonts/*.woff2      Noto Serif Kannada subsets
tools/build-preview.js    Inlines all assets into public/preview.html
```

## Tests

```bash
npm test
node tools/build-preview.js
```

## Deploy

`render.yaml`, `Procfile`, `.env.example` and `DEPLOY.md` are included. See **[DEPLOY.md](DEPLOY.md)** for the full download → GitHub → Render walkthrough, including environment variables, security notes and troubleshooting.

Quick summary: run `npm start` locally, push to GitHub, then create a Render **Web Service** (or Blueprint). For an existing deployment, replace the GitHub files and redeploy the same service — see **UPDATE-DEPLOYED.md**. Render sets `PORT`; the app binds `0.0.0.0` and exposes `/api/health`.

## References

1. Dr. M. Prabhakara Joshy, “Talamaddale”, Yakshagana.com — on *artha*, the arthadhari as re-creator, and the spoken word’s rhythm: https://yakshagana.com/talamaddale/
2. India Art Review, “Talamaddale, The Vocal Ensemble of Coastal Karnataka” — on unscripted oration, prasanga, and Purāṇa sources: https://indiaartreview.com/stories/talamaddale-yakshagana-karnataka-art/
3. Wikipedia, “Drupada” — summary of the Ādi Parva Drona–Drupada background used only to shape the sample snapshot: https://en.wikipedia.org/wiki/Drupada
