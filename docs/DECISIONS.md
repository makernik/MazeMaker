# Decisions

Architectural and design decisions for the Printable Maze Generator.

---

## D-006 — Self-hosted fonts (2026-02-02)

**Context:** UI rules require "Fonts should be self-hosted or bundled" and "No runtime dependency on Google Fonts CDN" for offline resilience.

**Decision:** Use @fontsource (Fraunces + Inter) as npm dependencies; import their CSS in main.css so Vite bundles the font files. Remove Google Fonts links from index.html. System font fallbacks (Georgia, system-ui) remain in CSS for resilience.

---

## D-005 — Error handling: single inline message, no stack traces (2026-02-02)

**Context:** AGENTS.md requires "Repeated generation failure → single inline error" and "No stack traces in UI".

**Decision:** On generation failure, show one fixed message in the status area only. First failure: "Generation failed. Please try again." After two or more consecutive failures: "Generation failed again. Check the console for details." Log full error to `console.error` only; never surface `error.message` or `error.stack` in the UI. No retry loops, modals, or alerts.

---

## D-004 — "Rounded" style means rounded corners (2026-01-31)

**Context:** The spec lists "Square" and "Rounded" maze styles. Organic/curvy paths and polar/circular mazes were considered but deemed too complex for v0.

**Decision:** "Rounded" in v0 means rounded corners on wall intersections, not organic curves or circular topology.

**Alternatives deferred:** Organic curves, polar mazes (see DEFERRED_IDEAS.md).

---

## D-003 — pdf-lib for PDF generation (2026-01-31)

**Context:** Need vector-first PDF rendering for crisp print output at any DPI.

**Decision:** Use pdf-lib (~250KB, pure JS, excellent vector path support).

**Alternatives considered:** jsPDF (more raster-focused), PDFKit (heavier, Node-oriented).

---

## D-002 — Vanilla JS + Vite (2026-01-31)

**Context:** Spec emphasizes "clean, inspectable demonstration" and minimal tooling.

**Decision:** Use Vanilla JS with Vite for dev/build. No framework.

**Alternatives considered:** React (more boilerplate), Svelte (less common).

---

## D-001 — Prim's algorithm for maze generation (2026-01-31)

**Context:** Need a deterministic perfect-maze algorithm. Different algorithms produce different maze characteristics.

**Decision:** Use Prim's algorithm for all age ranges in v0. Prim's creates mazes with short branching dead-ends, which are more intuitive and forgiving for younger children.

**Future consideration:** Use Prim's for ages 3-8 and Recursive Backtracker for ages 9+ to provide age-appropriate challenge levels (see DEFERRED_IDEAS.md).
