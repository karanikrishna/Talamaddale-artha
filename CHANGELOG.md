# Changelog

## 1.3.2 — Automatic model fallback + connection test

- When the configured model stays overloaded after retries, the app now **automatically tries a fallback model** instead of failing the layer.
- Gemini endpoints get built-in fallbacks (`gemini-3.5-flash-lite`, then `gemini-3.1-flash-lite`) with no configuration needed.
- New **Fallback models** field in Model settings, and `LLM_FALLBACK_MODELS` on the server, for custom chains.
- New **Test connection** button and `/api/test-model` endpoint: verifies the key, model and endpoint in one click and reports which model actually answered.
- The UI states when a layer used a fallback model, so output is never silently attributed to the wrong model.
- Auth/request errors (401/403/400) still fail fast and are never masked by a fallback.
- Fallback selection extracted to `lib/models.js` with unit tests; added end-to-end tests for overload recovery, auth-error safety and the test endpoint.

## 1.3.1 — Resilient upstream calls

- Transient provider failures (HTTP 408/409/425/429/500/502/503/504/529) are now retried automatically with exponential backoff and jitter, honouring `Retry-After`.
- Fixes the common Gemini "503 UNAVAILABLE — This model is currently experiencing high demand" failure, which previously aborted the whole layer on the first attempt.
- Streaming (beat 5) retries before any text is sent, so a retry never duplicates or corrupts partial artha.
- Permanent errors (401/403/400/404) are **not** retried, so a bad key or model name still fails fast.
- Overload errors now explain that the cause is provider-side and suggest a lighter model instead of showing a raw JSON dump.
- Tunable with `LLM_MAX_ATTEMPTS` (default 4) and `LLM_RETRY_BASE_MS` (default 1200); `/api/health` reports the policy.
- Added three regression tests: recovery after 503, persistent-overload messaging plus no-retry on 401, and streaming retry.

## 1.3.0 — Swagatha + Dialogue modes

- Added explicit **Mode** input: ಸ್ವಗತ / Swagatha and ಸಂವಾದ / Dialogue, following the attached Arthadhari Intelligence slides.
- Swagatha is a one-role introduction/monologue: only `A:` lines, no invented prativadi, no forced debate.
- Dialogue remains a two-role exchange with substantive `P:` objections and `A:` replies.
- Pathra and prativadi are optional overrides; padya + prasanga + mode are the primary inputs.
- Mode changes invalidate old output; server validates mode and prompts are mode-aware across layers 1, 3 and 5.
- Updated guidance, UI labels, quality panel, docs and tests for both modes.

## 1.2.0 — Dynamic input update

- Live app starts blank instead of presenting a fixed example as the working result.
- Editing padya/prasanga/pathra/prativadi/language/exemplar clears stale results and aborts obsolete requests.
- Added prominent **Generate fresh artha** action and opt-in **Auto-analyse after editing** (beats 1–4, then human reading choice).
- Response controls and artist choices invalidate only the downstream dialogue; JSON overrides invalidate downstream layers.
- Added model-connection status, required-field validation, explicit no-key endpoint option, and stale-stream protection.
- Server validates current input, rejects missing remote API keys, redacts upstream key errors, and never forwards a server key to a different browser-supplied provider.
- Knowledge layer may return zero securely recalled passages and shows **ಮೂಲ ಲಭ್ಯವಿಲ್ಲ** rather than forcing invented citations.
- Static preview is explicitly read-only; deployed `/` is the dynamic app.
- Added dynamic server tests and browser smoke coverage; updated Render blueprint to `runtime: node` and Node 22.

## 1.1.0 — ತಾಳಮದ್ದಳೆ ಅರ್ಥ update

- Corrected the Kannada lipi to **ತಾಳಮದ್ದಳೆ** in the app title, prompts, sample and docs.
- Added a Kannada term guard for known variants in generated prose and streamed lines; raw/cleaned padya transcripts are not silently rewritten.
- Reworked Layer 5 so two supplied roles produce a substantive A:/P: discussion: claim, objection, reply, deeper objection, and an open or qualified conclusion.
- Removed filler-only prativadi behavior as the target. Added an advisory discussion-quality panel (prativadi word share, filler/run/repetition warnings).
- Strengthened Layers 1, 3 and 4 around an interpretive problem, interpretive gain, possible replies and central claims rather than padya paraphrase.
- Added craft guidance informed by ತಾಳಮದ್ದಳೆ scholarship, with pointers to *ಜಾಗರ* and *ಕೇದಗೆ*; no book artha passages are copied into the app.
- Replaced the prefilled example with a stronger ದ್ರೋಣ–ದ್ರುಪದ discussion and balanced prativadi participation.
- Copy now preserves A:/P: speaker prefixes.
