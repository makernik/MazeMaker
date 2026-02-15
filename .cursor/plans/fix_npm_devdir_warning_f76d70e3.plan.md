---
name: Fix npm devdir warning
overview: Fix the npm warning related to the dev dir (node-gyp development directory). The project has no "devdir" reference in code; the warning is almost certainly the node-gyp EACCES/permission or path warning when npm/node-gyp accesses the dev directory.
todos: []
isProject: false
---

# Fix npm devdir warning

## Context

- **"devdir"** refers to node-gyp’s development directory (default `~/.node-gyp` on Unix or `%USERPROFILE%\.node-gyp` on Windows), where Node headers are stored for building native addons.
- Your repo has **no direct reference** to "devdir". Dependencies in [package.json](package.json) are JS-only (vite, vitest, playwright, pdf-lib, fontsource); native builds can still be triggered by **optional** transitive dependencies (e.g. some optional esbuild/platform packages in the lockfile).
- Common npm messages involving the dev dir:
  1. **EACCES**: `gyp WARN EACCES user "root" does not have permission to access the dev dir` (typically when using `sudo npm install` or similar).
  2. **Path/config**: Warnings about the dev dir path or that it is missing/not writable.

## Assumption

The plan assumes the warning is **node-gyp dev dir** related (permission or path). If the exact message is different (e.g. a deprecated flag like `--production`), the fix will be different; the first checkpoint validates the warning.

---

## Checkpoints

### C0 — Confirm the exact warning

- Run `npm install` (and, if applicable, the same command the user runs, e.g. `npm run build` or `npm run test`) and capture the **full warning text**.
- If the message is **not** about "dev dir" / "devdir" / node-gyp (e.g. it says "use `--omit=dev`" or "use `--location=global`"), treat that as a different fix (update scripts or config accordingly) and skip the dev-dir-specific steps below.

### C1 — Project-level: ensure no unnecessary native installs (optional)

- Review [package.json](package.json) and [package-lock.json](package-lock.json): the stack is JS-only; optional native deps (e.g. optional esbuild platform packages) may still run node-gyp on install.
- If the warning only appears in this project, consider adding an [.npmrc](.npmrc) in the project root to control optional dependency behavior (e.g. `optional=false` only if you want to suppress optional installs; otherwise leave as-is). Document in [docs/DECISIONS.md](docs/DECISIONS.md) if we add project .npmrc.

### C2 — User/environment fix for node-gyp dev dir (main fix)

Apply one of the following depending on the exact warning:

**If EACCES (permission to access dev dir):**

- **Do not use `sudo**` for `npm install` in this project. Use a user-writable install (default for local installs).
- If the warning appears when installing **global** packages: configure npm to use a user-owned directory and add it to `PATH` (see [node-gyp docs](https://github.com/nodejs/node-gyp/blob/main/docs/Force-npm-to-use-global-node-gyp.md)), e.g.:
  - `npm config set prefix "%APPDATA%\npm"` (Windows) or `npm config set prefix "~/.npm-global"` (Unix).
  - Ensure that directory is in the user’s `PATH`.

**If path/missing dev dir:**

- Ensure the directory exists and is writable:
  - Windows: `%USERPROFILE%\.node-gyp`
  - Unix: `~/.node-gyp`
- If needed, set node-gyp’s dev dir explicitly (e.g. via environment or npm config) to a user-writable path; document in project README or docs if this is required for contributors.

### C3 — Document and validate

- If any project-level change is made (e.g. `.npmrc` or README note), document it in [docs/DECISIONS.md](docs/DECISIONS.md) (e.g. "D-XXX — npm/node-gyp dev dir warning").
- Re-run `npm install` (and the same command that showed the warning) and confirm the warning is gone or acceptable.

---

## Validation

- `npm install` completes without the devdir-related warning (or with an agreed, documented exception).
- `npm run test` and `npm run build` still pass.
- No unnecessary or undocumented global/system config changes; project-only changes documented.

---

## Out of scope

- Changing dependency versions solely to avoid optional native deps (unless we have a concrete need).
- Fixing other npm deprecation warnings (e.g. `--production` → `--omit=dev`) unless that was the warning the user meant by "devdir."

