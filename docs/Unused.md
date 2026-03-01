# Unused Artifacts

Artifacts that are no longer used by the app (superseded or only referenced by tests/docs). Safe to remove after review unless noted.

**Reason:** Preview was switched from static sample images to a **live canvas** (one maze generated from current level + style). See DECISIONS D-012.

---

## Code & tests

| Artifact | Why unused | Safe to remove? |
|----------|------------|-----------------|
| **src/utils/samplePreview.js** | Preview no longer uses it; `main.js` does not import it. Only referenced by its own unit test. | Yes. Remove with `tests/samplePreview.test.js` if you drop sample path logic entirely. |
| **tests/samplePreview.test.js** | Tests `samplePreview.js` (getSampleImagePath, sampleTokenForAgeRange). That module is unused by the app. | Yes, if you remove `samplePreview.js`. |

---

## Scripts & assets

| Artifact | Why unused | Safe to remove? |
|----------|------------|-----------------|
| **scripts/create-sample-placeholder.cjs** | One-time script that created `public/samples/` and placeholder PNGs for the old static preview. No longer needed for preview. | Yes. |
| **public/samples/** | Directory and README described static images for the right-panel preview. Preview is now live canvas; no code loads these images. Any PNGs here (e.g. `3-classic.png`, `4-5-classic.png`) are unused. | Yes. Can delete the folder or keep README as a short “deprecated” note; README was updated to say unused. |

---

## Plans

| Artifact | Why unused | Safe to remove? |
|----------|------------|-----------------|
| **.cursor/plans/sample_preview_right_panel_742d0869.plan.md** | Implementation plan for the old static-sample preview (img in right panel, `public/samples/`). Superseded by **live_canvas_preview.plan.md**. | Optional. Keep for history or move to an “archive” folder; not executed anymore. |

---

## Obsolete references

- **docs/DECISIONS.md** — D-011 describes the old sample preview; D-012 supersedes it and points here.
- **public/samples/README.md** — Updated to state the folder is deprecated/unused.

No other docs or code paths are expected to reference the above artifacts; grep before removal if unsure.
