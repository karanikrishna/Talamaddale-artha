# Update your existing GitHub + Render deployment (v1.3.2 automatic model fallback)

This update makes the **deployed web app** dynamic. It does not require a new Render service.

## What changed

- The live app starts blank, not with a fixed example.
- Explicit **Mode** selector: **Swagatha** (one role) or **Dialogue** (two roles). Swagatha does not invent a prativadi.
- Changing the padya clears old results and cancels obsolete generation.
- **Generate fresh artha** sends the current padya to your configured AI model.
- Optional **Auto-analyse after editing** runs beats 1–4 after a typing pause, then waits for your reading choice.
- Missing API keys or model errors are shown honestly; the example is never substituted.
- `preview.html` is only a read-only demonstration. Use the Render URL ending in `/`.

## 1. Download and extract

Download `talamaddale-artha-v1.3.2.zip` and extract it. Open the extracted `talamaddale-artha` folder. You should see `server.js`, `package.json`, `public/`, `lib/`, `tests/`, and this file.

## 2. Replace files in your existing GitHub repository

Open:

https://github.com/karanikrishna/Talamaddale-artha

1. Click **Add file → Upload files**.
2. In Windows File Explorer, open the extracted `talamaddale-artha` folder.
3. Select **all files and folders inside it** (Ctrl+A). Enable View → Show → Hidden items so `.gitignore` and `.env.example` are included.
4. Drag the selection into GitHub's upload area. Do **not** drag the outer folder itself and do **not** use “choose your files” for folders.
5. Check that the upload list contains paths such as `public/app.js`, `lib/prompts.js`, and `tests/dynamic.test.js`.
6. Commit message: `Update to v1.3.2 automatic model fallback`.
7. Commit directly to **main**.

GitHub will overwrite matching files and add the new test/update files. Do not create a new repository.

## 3. Redeploy the same Render service

Open https://dashboard.render.com and select your existing **talamaddale-artha Web Service**.

- If **Auto-Deploy** is on, the GitHub commit should start a deploy automatically.
- Otherwise click **Manual Deploy → Deploy latest commit**.
- Wait until the service is **Live**.

Keep the existing settings:

```text
Branch: main
Root Directory: blank
Build Command: npm install
Start Command: npm start
```

Do not create a second service and do not switch to Static Site.

## 4. Verify the new version

Open:

```text
https://YOUR-SERVICE.onrender.com/api/health
```

You should see:

```json
"version": "1.3.2-model-fallback",
"dynamicInput": true
```

Then open the main URL `/` and hard-refresh Windows: **Ctrl+F5**. The page should start blank and show **Generate fresh artha**.

## 5. Connect a model

Dynamic interpretation requires an OpenAI-compatible AI model. The update does not include a free AI key.

Safer option for a public URL:

1. Open **Model settings** in the app.
2. Enter your provider Base URL, model, and your own API key.
3. Save in the browser.
4. Choose Swagatha or Dialogue, then enter padya and prasanga. Add pathra/prativadi only if you want to override inference.
5. Click **Generate fresh artha**.
6. Choose a reading at beat 4, then **Continue to Response**.

For OpenAI, Base URL is usually `https://api.openai.com/v1`; choose a model available to your account. API usage may be billed by the provider.

**Do not put a personal API key in GitHub.** If you add `LLM_API_KEY` in Render environment variables, anyone who can use the public app may spend that key because the app has no login/rate limiting. Prefer browser-entered keys until authentication is added.

## 6. If it still looks static

- Make sure you opened `/`, not `/preview.html`.
- Check `/api/health` for `1.3.2-model-fallback`.
- Hard-refresh with Ctrl+F5.
- Check Render Logs for the latest commit and a successful deploy.
- Make sure GitHub has `public/app.js`, not only root-level `app.js`.
- Make sure a model is connected; without a key the app will ask for Model settings rather than inventing meaning.


---

## If you see "503 — This model is currently experiencing high demand"

That message comes from the model provider, not from this app. It means the provider's
servers were busy. Your API key, your deployment and your padya are all fine.

From v1.3.2 the app retries automatically **and then switches to a lighter fallback model** on its own. If it still fails after all of that:

1. Wait a minute and press **↻ Retry this layer**. Already-generated layers are kept.
2. Open **Model settings** and switch to a lighter model. For Gemini:
   `gemini-3.5-flash-lite` or `gemini-3.1-flash-lite`.
3. Keep **Max tokens** at `8000` for Gemini 3.x thinking models.
4. Avoid **Auto-analyse** during peak load; it fires several calls per edit.


## Check which version is actually deployed

The single most common cause of "the error persists" is that the new files were
never uploaded, so the old code is still running. Always verify:

```text
https://YOUR-SERVICE.onrender.com/api/health
```

The `version` field must read `1.3.2-model-fallback`. If it shows an older
version, the GitHub upload or the Render deploy did not complete — the browser
cache is not the issue.

## Use Test connection before generating

**Model settings → Test connection** makes one tiny call and reports:

- `✓ Connected to "model" in 1.2s` — everything is fine.
- `✓ Working — but "X" was unavailable, so it fell back to "Y"` — set `Y` as your main model.
- `✕ ...401...` — the API key is wrong.
- `✕ ...503...` — the provider is overloaded; wait or change model.
