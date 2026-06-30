---
name: Blueprint Engine API wiring
description: How the pure Blueprint engines (Tahap 1-9) connect to HTTP, and the safe-write + ownership conventions that must hold.
---

# Blueprint Engine → API

The Tahap 1–9 engines (`server/services/blueprint-engine/*`) are pure/stateless. They are exposed via `/api/blueprint/{start,answer,state,analyze,configure}` (own module, registered in `registerRoutes`). The API is **stateless**: the client carries the whole Blueprint JSON in each request body; there is no DB table for in-progress blueprints.

## Conventions that MUST hold
- **`/configure` is the ONLY write path.** It is **safe-by-default**: `dryRun` is treated as `true` unless the client sends `dryRun:false` explicitly. Never flip this default to write-by-default.
- **Update ownership is enforced at the route layer**, not the engine. `update` mode fetches the target agent and rejects with 403 unless caller is the owner (`agent.userId === session user`) or an admin.
- Pipeline after any blueprint change = `applyAnswers` → `inferBlueprint` → `applyConfidence` → `getDialogueState`. Keep this order so "next questions" reflect inferred/scored state.

**Why:** the engines write real `agents` rows; a naive `update` that trusts a client-supplied `agentId` is a cross-tenant IDOR. Safe-by-default `dryRun` prevents accidental writes during UI integration.
**How to apply:** when adding the dialog UI or new write surfaces, reuse `/configure` semantics; do not bypass the ownership check or the dryRun default.

## Non-obvious constraint: agent ownership is NOT in the insert type
- `InsertAgent` (z.infer of `insertAgentSchema`) **omits `userId`** — you cannot type-safely pass `userId` into `storage.createAgent(...)`. The existing `/api/agents` create route adds `userId` pre-parse but Zod strips it too.
- Consequence: agents created via the Configuration Engine are **not owned** through the insert (default `userId=""`). Enforcing create-time ownership would require schema/storage changes — out of scope for API wiring. The real cross-tenant risk surface is **update**, which is guarded.

## Dialogue UI: boolean answer submission (Tahap 11)
- `/answer` treats any present key in `answers` as a real user-sourced answer (updates source/confidence). For boolean dialogue questions, **only submit the key if the user actually toggled it** — never default untouched booleans to `false`, or you silently write wrong answers and skew confidence/progression.
- `multiselect` inputType must send an **array** (not a single Select string). Skip empty arrays before submitting.

**Why:** an architect review caught the wizard sending `false` for every untouched boolean, corrupting elicitation.
**How to apply:** in any blueprint dialogue UI, build the answers payload from explicitly-touched fields only.
