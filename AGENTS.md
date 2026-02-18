Below is a **slightly tightened version** of the AGENTS.md.
No new concepts. No expansion. Just sharper authority, fewer words, and less room for interpretation by Cursor.

---

# AGENTS.md — Printable Maze Generator

This file defines **how agents work in this repo**.
This project is intentionally small. Preserve that.

---

## Agent Operating Mode (Required)

* **Default loop**: read → plan → implement → validate → report
* **Multi-file or architectural changes** require a plan first
* Prefer **small, reversible changes**
* If blocked, ask **≤3 targeted questions**
* Do not infer or extend product scope

---

## Plans Policy (Cursor-Native)

* All non-trivial work **starts with a plan**
* Plans live in:

  ```
  /plans/
  ```
* Plans are **living documents**, executed across runs

### Required Plan Sections

Every plan must include:

* **Status**: draft | approved | executing | parked | done | superseded
* **Scope**: included + explicitly excluded
* **Expected file tree**
* **Checkpoints** (C0, C1, C2…): small, testable
* **Validation**: tests, commands, pass criteria

### Execution Rules

* Execute **one checkpoint per run** unless explicitly asked
* After each checkpoint:

  * update plan status
  * record validation results

---

## Source of Truth (Strict Order)

If conflicts exist, stop and raise them.

1. `/plans/v0_spec.md` ← **single source of truth**
2. `/plans/*.md` (implementation plans)
3. `docs/DECISIONS.md`
4. Tests
5. Code comments

**Version:** Release version lives in `package.json` (`version`). v0 = first release (e.g. 0.1.0). See DECISIONS D-013.

README is descriptive only. Never authoritative.

---

## Required Reads Before Code Changes

* `/plans/v0_spec.md`
* Current plan in `/plans/`
* `docs/DECISIONS.md`
* `docs/DEFERRED_IDEAS.md`
* `.cursor/rules/ui_rules.mdc` (for UI work)

Deferred ideas are **not todos**. Do not implement unless explicitly requested.

---

## Methodology (Non-Negotiable)

* Change plans or decisions **before** changing code if behavior or architecture shifts
* Deterministic behavior once parameters/seed are set
* When correctness is uncertain:

  * do **not** guess
  * log internally
  * no user-facing output

---

## Project Invariants (Hard)

* Local web app only
* Offline after download
* No persistence, accounts, or cloud
* No AI
* Black & white output
* US Letter (8.5 × 11)
* One maze per page
* Perfect mazes only
* PDF is the primary output
* Debug mode hidden and non-default

Violations require explicit user approval.

---

## UI Rules (Enforced)

All UI work must follow `.cursor/rules/ui_rules.mdc`.

Key constraints:
* Asymmetrical layout (controls left, ~30–35% width)
* Typography: Fraunces (display) + Inter (body) only
* Muted, print-aware colors
* No animations in v0
* No gamification

---

## Failure & Scope Discipline

* Repeated generation failure → single inline error
* Console logging allowed
* No retry loops, modals, alerts, or UX expansion

---

## Stopping Condition

* If the request is complete and validation passes: **stop**
* Do **not**:

  * extend scope
  * refactor adjacent code
  * implement deferred ideas
  * “clean up” unless asked

---
