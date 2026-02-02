# Decisions

Architectural and design decisions for the Printable Maze Generator.

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
