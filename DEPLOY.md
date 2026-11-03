# GitHub → Render deployment guide

This guide takes the downloaded ZIP, puts it on GitHub, and deploys the live app on Render. The app already listens on `0.0.0.0` and uses `process.env.PORT || 3000`, so it works behind Render’s proxy without code changes.

> The bundled `public/preview.html` is a static, no-server copy for the file viewer. The real app is `public/index.html`, served by `server.js`. On Render, `/` is the live app; `/preview.html` is the static preview.

---

## 1. Download and test locally

1. Download `talamaddale-artha-v1.3.2.zip`.
2. Extract it. You should get a folder named `talamaddale-artha/`.
3. Open a terminal in that folder and run:

```bash
cd talamaddale-artha
npm install
npm start
```

4. Open `http://localhost:3000`.

You should see a blank dynamic workspace. Choose Swagatha or Dialogue, enter padya and prasanga, connect an OpenAI-compatible endpoint under **Model settings**, then select **Generate fresh artha**. The optional Load example button is not a generator.

To test with server-side defaults instead of browser settings:

```bash
cp .env.example .env
# edit .env and add LLM_API_KEY, then restart
npm start
```

`.env` is ignored by Git. Never commit a real key.

---

## 2. Push to GitHub

### Option A — GitHub website + Git commands

1. Go to <https://github.com/new>.
2. Create a repository, for example `talamaddale-artha`.
3. Choose **Public** or **Private**. Do **not** add a README, `.gitignore` or license — the ZIP already contains them.
4. Copy the repository URL. It looks like:

```text
https://github.com/YOUR_USERNAME/talamaddale-artha.git
```

5. In your terminal, inside the extracted folder:

```bash
git init
git add .
git commit -m "Initial commit: Talamaddale Artha"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/talamaddale-artha.git
git push -u origin main
```

If GitHub asks for authentication, use a **Personal Access Token** as the password, or use the GitHub CLI option below.

### Option B — GitHub CLI

```bash
cd talamaddale-artha
git init
git add .
git commit -m "Initial commit: Talamaddale Artha"
gh repo create talamaddale-artha --public --source=. --remote=origin --push
```

Use `--private` instead of `--public` if you prefer.

### Check what was pushed

```bash
git status
git ls-files
```

Make sure `.env` is **not** in `git ls-files`. The following should be present:

```text
.gitignore
.env.example
DEPLOY.md
Procfile
README.md
render.yaml
package.json
package-lock.json
server.js
lib/prompts.js
public/index.html
public/app.js
public/styles.css
public/sample-state.js
public/preview.html
public/fonts/*.woff2
tools/build-preview.js
```

---

## 3. New deployment option: Render Blueprint

For an **existing** deployment, use `UPDATE-DEPLOYED.md` instead of creating another service.


The included `render.yaml` tells Render exactly how to build and run the app.

1. Go to <https://dashboard.render.com> and sign in with GitHub.
2. Authorize Render to access your repositories.
3. Click **New +** → **Blueprint**.
4. Select your `talamaddale-artha` repository and the `main` branch.
5. Render should detect `render.yaml` and show one web service named `talamaddale-artha`.
6. Fill in the environment variables marked `sync: false`:

| Variable | Recommended value | Notes |
| --- | --- | --- |
| `NODE_VERSION` | `22` | Already set in `render.yaml`. |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Or any OpenAI-compatible base URL. A URL ending in `/chat/completions` also works. |
| `LLM_MODEL` | `gpt-4o-mini` | Change to a model your endpoint actually serves. |
| `LLM_API_KEY` | your key | **Secret.** Set it in Render, never in Git. Leave blank if each user will enter their own key in **Model settings**. |

7. Click **Apply** / **Create Resources**.
8. Wait for the build and health check. Render uses `GET /api/health`.
9. Open the generated URL, usually:

```text
https://talamaddale-artha.onrender.com
```

For an existing Render Web Service connected to GitHub, every later push to the deployed branch triggers a new deploy when Auto-Deploy is on. You can also use **Manual Deploy → Deploy latest commit**. Do not create a second service just to update this one.

---

## 4. Manual Render setup, if you do not use the Blueprint

1. **New +** → **Web Service**.
2. Connect the GitHub repository.
3. Configure:

| Field | Value |
| --- | --- |
| Name | `talamaddale-artha` |
| Region | choose the nearest |
| Branch | `main` |
| Runtime / Environment | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

4. Add `NODE_VERSION=22` and the three `LLM_*` variables under **Environment**.
5. Create the Web Service.

`Procfile` (`web: npm start`) is included as a fallback, but the explicit Start Command above is what Render uses.

---

## 5. Update the deployment later

```bash
cd talamaddale-artha
# edit files
git add .
git commit -m "Describe your change"
git push
```

Render will redeploy automatically. If you changed `public/app.js`, `public/styles.css` or `public/sample-state.js` and also want the standalone file preview updated, regenerate it before committing:

```bash
node tools/build-preview.js
git add public/preview.html
git commit -m "Rebuild static preview"
git push
```

---

## 6. Security and cost note

The app has **no login or rate limiting**. Anyone who can open the Render URL can use a server-configured `LLM_API_KEY`, and that usage may be billed to you.

For a public link, choose one of these:

- Leave `LLM_API_KEY` blank on Render and let each artiste enter their own key in **Model settings**. Browser-entered keys are proxied per request and are not written to disk by the app.
- Set a server key, but use a provider key with a strict spend limit and keep the Render URL private.
- Add authentication, an allowlist, or rate limiting before sharing widely.

Also note that Render’s free plan sleeps when idle, so the first request after inactivity can be slow.

---

## 7. Troubleshooting

| Symptom | Check |
| --- | --- |
| Blank page or 404 | Confirm Start Command is `npm start` and the service logs show `Talamaddale Artha running`. The server binds `0.0.0.0` and respects `PORT`. |
| Health check fails | Open `/api/health` directly. It should return `{"ok":true,...}`. |
| `Layer 1 failed` / upstream 401 | Wrong `LLM_API_KEY`, or the key was never set in Render. |
| Upstream 404 | `LLM_BASE_URL` is wrong. Use the provider’s `/v1` root, or a full `/chat/completions` URL. |
| Model rejects `temperature` or `max_tokens` | Open **Model settings**, clear Temperature, and switch Token-limit parameter to `max_completion_tokens` or `omit`. |
| Kannada text looks wrong | Make sure `public/fonts/*.woff2` was committed. The fonts are local; no Google Fonts request is made. |
| Static preview shows an LLM error | Expected. `preview.html` is serverless; use the live `/` route for model calls. |
| Changes do not appear | Check the Render deploy log, then confirm you pushed to the branch Render watches (`main`). |

---

## What is inside the ZIP

The ZIP contains the complete app, the self-contained static preview, the Render Blueprint, the deployment guide, and build tooling. It does **not** contain `node_modules`, `.env`, a real API key, or any test/mock server files.
