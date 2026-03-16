---
name: "GitHub Pages Deployment — maze.makernik.com"
overview: "Deploy the maze generator as a public static site at maze.makernik.com via GitHub Pages + GitHub Actions. Covers Vite build verification, CNAME wiring, DNS at Porkbun, and the Actions workflow."
todos: []
isProject: false
---

# Plan: GitHub Pages Deployment — maze.makernik.com

**Status:** approved
**Last updated:** 2026-03-15
**Owner:** MakerNik
**Related:** v1_spec.md (GitHub Pages deployment), DECISIONS.md (to add D-019)

---

## Hosting Decision — Read This First

### Why GitHub Pages + maze.makernik.com (recommended)

GitHub Pages is a first-class static hosting service built into GitHub. It reads your repo's built output and serves it directly, with TLS managed automatically. For this project it is the right tool:

- **Free**, no credentials to manage, no SFTP, no FTP
- **Automatic HTTPS** via Let's Encrypt — GitHub handles cert renewal
- **Native GitHub Actions integration** — official actions for building and publishing; no third-party SFTP actions needed
- **Custom subdomain** `maze.makernik.com` works cleanly: one DNS CNAME record at Porkbun, one `CNAME` file in the repo, done
- **No Vite base path change required** — because you're serving from a custom domain at the root (`/`), not a GitHub subdirectory like `/MazeMaker/`. The current `vite.config.js` is already correct.

### Why NOT Porkbun static hosting + makernik.com/maze

Serving at a *path* (`makernik.com/maze`) on a single static host requires:

1. The main `makernik.com` site and the maze must coexist on the same host, or you need reverse proxy routing — neither is simple
2. Vite would need `base: '/maze/'` added to `vite.config.js`, and all asset paths would change
3. GitHub Actions SFTP push to Porkbun is possible (via `SamKirkland/FTP-Deploy-Action` or `appleboy/scp-action`) but requires storing FTP/SFTP credentials as GitHub Secrets, full or incremental sync logic, and manual HTTPS certificate management — significantly more moving parts for no benefit over Pages

**Porkbun static hosting uses FTP, not SFTP.** GitHub Actions can handle FTP, but it is slower, less reliable, and you would be responsible for every aspect of the deployment pipeline.

**Verdict:** `maze.makernik.com` on GitHub Pages. The subdomain architecture is correct. `hello.makernik.com` and `maze.makernik.com` each point to separate GitHub repos' Pages sites — no conflict, no coupling.

---

## Overview

Wire up GitHub Pages deployment for the Vite-built maze generator. When code is pushed to `main`, GitHub Actions builds the project and publishes `dist/` to GitHub Pages. The site is reachable at `maze.makernik.com` via a Porkbun DNS CNAME record.

## Scope

**In scope:**

- `npm run build` smoke test and `dist/` output verification
- `src/public/CNAME` file with `maze.makernik.com`
- `.github/workflows/deploy.yml` — GitHub Actions workflow (build + publish)
- GitHub repo Settings > Pages configuration (source: GitHub Actions)
- Porkbun DNS: one CNAME record `maze` → `<github-username>.github.io`
- README update with live URL
- DECISIONS.md entry D-019

**Out of scope:**

- Custom domain HTTPS (automatic, handled by GitHub Pages)
- `404.html` / client-side routing (single-page app with no routes — not needed)
- Environments other than production (no staging)
- Vite base path change (not needed with custom domain)

---

## Architecture

```
git push main
    ↓
GitHub Actions: deploy.yml
    ↓
npm ci → npm run build → dist/
    ↓
actions/upload-pages-artifact  (uploads dist/)
    ↓
actions/deploy-pages            (publishes to GitHub Pages)
    ↓
GitHub Pages CDN
    ↓
maze.makernik.com (via Porkbun DNS CNAME → <github-username>.github.io)
```

**Files touched:**

- `src/public/CNAME` — new file (Vite copies `src/public/` into `dist/` at build time)
- `.github/workflows/deploy.yml` — new file
- `README.md` — add live URL line
- `DECISIONS.md` — add D-019

**Key interfaces / contracts:**

- Vite `root: 'src'` means the static assets folder is `src/public/`, not `public/`. The `CNAME` file must live at `src/public/CNAME` so Vite copies it to `dist/CNAME` during build.
- GitHub Pages reads the custom domain from `dist/CNAME` and manages TLS for it.
- The GitHub Actions workflow requires `permissions: pages: write, id-token: write` to publish to Pages.
- The repo must have Pages enabled in Settings with source set to "GitHub Actions" (not "Deploy from branch").

---

## Checkpoints

### C0 — Build verification (local)
Confirm `npm run build` produces a clean `dist/` with all assets at root-relative paths. Open `dist/index.html` and verify no broken asset references. Run `npm run test` to confirm all tests still pass. No file changes in this checkpoint — just verification.

**Commands:**
```bash
npm run test
npm run build
ls dist/
# should show: index.html, assets/, fonts/ (or similar)
```

**Pass criteria:** Build exits 0. `dist/index.html` references `/assets/...` paths (root-relative). No `../` relative paths in asset references. All tests green.

---

### C1 — CNAME file
Create `src/public/CNAME` containing exactly one line: `maze.makernik.com`.

Vite's `root: 'src'` means `src/public/` is the static directory. Everything in it is copied verbatim to `dist/` at build time. No content transformation occurs — the CNAME file lands at `dist/CNAME` exactly as written.

**File to create:** `src/public/CNAME`
```
maze.makernik.com
```

**Verify after build:**
```bash
npm run build
cat dist/CNAME
# output: maze.makernik.com
```

**Pass criteria:** `dist/CNAME` exists and contains only `maze.makernik.com` (no trailing newline issues, no extra text).

---

### C2 — GitHub Actions workflow

Create `.github/workflows/deploy.yml`. This workflow:
- Triggers on push to `main` and on manual dispatch (`workflow_dispatch`)
- Uses Node 20
- Installs dependencies with `npm ci` (reproducible, lockfile-based)
- Runs `npm run build`
- Uploads `dist/` as a Pages artifact
- Deploys to GitHub Pages using the official Pages deployment action

**File to create:** `.github/workflows/deploy.yml`
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Notes on the workflow:**
- `concurrency: group: pages, cancel-in-progress: true` — if two pushes happen fast, the older deploy is cancelled, preventing race conditions
- `npm ci` is preferred over `npm install` in CI — it respects `package-lock.json` exactly
- `actions/configure-pages` sets the base URL for Pages; with a custom domain it resolves to `/`
- `actions/upload-pages-artifact` and `actions/deploy-pages` are the official GitHub-maintained deployment path (preferred over the older `peaceiris/actions-gh-pages` third-party action)
- The `environment: github-pages` block surfaces the deployed URL in the GitHub Actions run summary

---

### C3 — GitHub repo settings (manual step, not automated)

In the GitHub repository settings, enable GitHub Pages:

1. Go to **Settings → Pages**
2. Under **Source**, select **GitHub Actions** (not "Deploy from a branch")
3. Save

This must be done before the first workflow run. If Pages has never been enabled on this repo, the deploy job will fail with a permissions error until this is set.

**This is a one-time manual step.** It cannot be automated via a workflow file.

---

### C4 — DNS at Porkbun (manual step)

Add a CNAME DNS record in the Porkbun DNS dashboard for `makernik.com`:

| Type  | Host | Value                           | TTL  |
|-------|------|---------------------------------|------|
| CNAME | maze | `<github-username>.github.io`   | 600  |

Replace `<github-username>` with the actual GitHub account username (e.g. `MakerNik` or similar — use the exact casing from your GitHub profile URL).

**Important:** Porkbun may show a warning that a CNAME on a subdomain conflicts with other records. As long as there is no existing A or CNAME for `maze`, this is safe to add.

**DNS propagation:** Up to 10–30 minutes for Porkbun's nameservers. GitHub Pages will also need a few minutes to verify the domain and issue a TLS certificate after propagation.

**Verify propagation:**
```bash
# Run from any terminal once DNS propagates
dig maze.makernik.com CNAME +short
# Expected output: <github-username>.github.io.
```

---

### C5 — Custom domain in GitHub Pages settings (manual step)

After DNS propagates and the first workflow run has succeeded:

1. Go to **Settings → Pages** in the repo
2. Under **Custom domain**, enter `maze.makernik.com`
3. Click Save
4. Wait for the HTTPS certificate to be issued (1–5 minutes)
5. Check the **Enforce HTTPS** checkbox once the cert is ready

GitHub Pages verifies DNS ownership before issuing the cert. If DNS hasn't propagated yet, this step will show a "DNS check unsuccessful" error — wait and retry.

**Note:** GitHub also supports adding a TXT record for domain verification to prove ownership before enabling the custom domain. Porkbun makes this easy if needed, but usually the CNAME alone is sufficient for subdomains.

---

### C6 — End-to-end verification

1. Trigger a workflow run (push a trivial commit to `main` or use the manual `workflow_dispatch` button in the Actions tab)
2. Watch the Actions run complete — both `build` and `deploy` jobs should succeed with green checkmarks
3. Navigate to `https://maze.makernik.com` in a browser
4. Verify:
   - Page loads without console errors
   - Fonts render correctly (Fraunces, Inter)
   - All maze styles are selectable
   - PDF generation produces a downloadable file
   - No mixed-content warnings (HTTP assets on an HTTPS page)
5. Check `dist/CNAME` is present in the deployed artifact (visible in Actions run → uploaded artifact)

---

### C7 — Docs update

- Add a line to `README.md`: "**Live:** https://maze.makernik.com"
- Add entry `DECISIONS.md#D-019`: record the GitHub Pages + custom subdomain decision, why Porkbun SFTP was not chosen, and note that `base` in `vite.config.js` remains `/` (default) because the custom domain serves from root.

---

## Validation

**Tests to add/update:**
- No new unit tests required — this is pure infrastructure
- Existing test suite (`npm run test`) must remain green throughout

**Commands to run:**
```bash
# C0: local verification
npm run test
npm run build
cat dist/index.html | grep 'src=' | head -20   # asset paths should be /assets/...

# C1: CNAME in build output
cat dist/CNAME

# C4: DNS propagation check
dig maze.makernik.com CNAME +short

# C6: Deployed page check (after full pipeline)
curl -sI https://maze.makernik.com | head -5
# Should show HTTP/2 200 from GitHub Pages
```

**Pass criteria:**

- [ ] `npm run build` exits 0 with no warnings about missing files
- [ ] `dist/CNAME` contains `maze.makernik.com`
- [ ] GitHub Actions workflow runs green on push to `main`
- [ ] `https://maze.makernik.com` loads the app over HTTPS
- [ ] No browser console errors on load
- [ ] PDF download works end-to-end in the deployed version
- [ ] All maze styles generate without error

---

## Notes / Risks

**1. `src/public/` does not exist yet.**
Vite automatically uses `<root>/public/` as the static assets directory. Since `root: 'src'`, this is `src/public/`. The directory must be created. It will be empty except for `CNAME`.

**2. No Vite base path change needed.**
This is the key insight for custom domains. If the app were served at `github-username.github.io/MazeMaker/`, Vite would need `base: '/MazeMaker/'` and all asset references would break without it. With a custom domain at `maze.makernik.com`, the site is at the root — base stays `/`. The current `vite.config.js` is already correct and requires no changes.

**3. Actions versions.**
The workflow uses the latest major versions as of early 2026: `actions/checkout@v4`, `actions/setup-node@v4`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`. These are the current official recommendations. Pin to minor versions if you want strict reproducibility, but major versions are generally stable.

**4. First deploy requires manual repo settings.**
Pages source must be set to "GitHub Actions" before the workflow can publish. This is a one-time manual step with no workaround.

**5. `hello.makernik.com` is independent.**
Each GitHub repo gets its own GitHub Pages site. `hello.makernik.com` pointing to a different repo is completely separate. Adding `maze.makernik.com` to this repo's Pages does not touch `hello.makernik.com`. The only shared resource is the Porkbun DNS zone, and adding a new CNAME record for `maze` does not affect existing records.

**6. Porkbun "CNAME flattening" at the apex domain.**
This is irrelevant here since `maze` is a subdomain, not the apex (`@`). No CNAME flattening concerns.

**7. Build cache in CI.**
The workflow uses `cache: npm` in `actions/setup-node@v4`. This caches `~/.npm` between runs. `npm ci` still installs from `node_modules` scratch (for correctness) but downloads are cached. On a cold run this may take 30–60 seconds; warm runs will be faster.

**8. Self-host path (future).**
Once deployed, the README self-host section should direct users to `npm install && npm run dev`. The `dist/` output from `npm run build` can also be dropped onto any static host (Porkbun, Netlify, Cloudflare Pages) — it has no backend dependencies.

---

## Retrospective (fill after checkpoints)

**What worked:**

- ...

**What didn't work:**

- ...

**Gaps identified:**

- ...

**Lessons learned:**

- ...

---

**Next review:** After C6 (end-to-end verification at maze.makernik.com)
