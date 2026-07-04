---
name: Blueprint reflection module (Dialog Reflektif 3 Gerbang)
description: How the reflection module interacts with dialogue essentials, agent mapping, and inference — and the test pitfalls it creates.
---

# Blueprint reflection module (Dialog Reflektif 3 Gerbang)

The Blueprint Engine has a `reflection` module (22 fields, 3 gates: dialog/kolaborasi/kreasi)
framed as a "sertifikat pembelajaran reflektif" / peta pemahaman — NOT psychometric.
Output surface = `buildMasteryProfile()` (pure engine) → `POST /api/blueprint/analyze` → builder card.

## Non-obvious constraints (respect these on any Blueprint change)

- **Reflection is a NON-AGENT module.** It must stay in `NON_AGENT_MODULES` in `mapping-engine.ts`
  so it is never written to `agents` columns. Adding an agent-facing module? Do NOT add it there.
- **Reflection questions are priority 1 = dialogue-essential** (priority ≤ `ESSENTIAL_MAX_PRIORITY`).
  So they count toward `remainingEssential`/`essentialComplete` even though the module is
  `optional: true` in `confidence-engine` MODULE_SPECS. "Optional for confidence" ≠ "optional for dialogue".
- **They sit near the FRONT of `QUESTION_BANK`** (right after `intent`, before `identity.*`).
  The first batch of `selectNextQuestions` is now `["intent","reflection.educationBackground","reflection.knowledgeSource"]`.

## Test pitfall (this bit us once)

Any test that calls `selectNextQuestions(bp, { max: N })` and expects a later field
(e.g. `identity.description`) must use a **large enough `max`** — the 22 reflection essentials
now occupy the early slots. `max: 10` silently truncates before identity fields, causing both
false negatives (expected-included fails) AND false positives (expected-excluded passes for the
wrong reason). Use `max: 50` when the assertion is about presence/absence of a specific field.

**Why:** the reflection expansion changed batch ordering and essential counts platform-wide;
downstream dialogue tests that hard-code the first-N ids or rely on a tight `max` window break.

## Inference enrichment (safety)

`inference-engine.ts` reads reflection to fill `goals.primaryOutcome`, `monetization.productTargetUser`,
`policy.domainCharter` at confidence 0.5 (auto needsConfirmation) ONLY when empty. It must never
overwrite `source="user"` data — the engine's existing `evaluateRule` guard enforces this; keep it.
