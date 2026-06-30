---
name: AI Organization Blueprint (Fase 3)
description: Data model + design contract for designing a TEAM of agents (not one) via the no-code Blueprint flow.
---

# AI Organization Blueprint — design contract

Fase 3 extends the no-code Dialog → Blueprint → Configuration flow so it can design a whole **organization of agents** (orchestrator + specialists that collaborate), not just one chatbot. Still 100% no-code for the user; the user only ever uses dialog/blueprint/configuration.

Foundation = `shared/blueprint/organization-blueprint-schema.ts` (`OrganizationBlueprint`), pure/additive (Tahap 18), not imported by app code yet. Roadmap: `docs/blueprint-engine/00-roadmap.md` (Fase 3 table), detail `docs/blueprint-engine/18-organization-blueprint-schema.md`.

## Shape
- `meta` — name/mission/intent/status + `agentIds` (localId→agentId, filled LATER by config engine).
- `members[]` — each seat = `{ localId, role: orchestrator|specialist|support, title?, responsibility?, blueprint }`. **Reuses the single-agent `blueprintSchema`** per member (no field duplication).
- `structure` — `{ leadLocalId?, edges[] }`; directed graph `fromLocalId→toLocalId` that becomes each orchestrator's `agenticSubAgents` after resolution.

## Non-obvious decisions (must hold across later stages)
- **localId, NOT agentId, at design time.** Agents have no DB id until creation. Members reference each other by `localId`; the Configuration Engine resolves `localId→agentId` AFTER creating agents, then writes `agenticSubAgents`. **Why:** edges need an agentId that doesn't exist yet (chicken-and-egg).
- **Single source of truth for wiring = org `structure.edges`**, NOT member-level `orchestration.agenticSubAgents` / `meta.agentId` / `parentAgentId`. `lintOrganizationBlueprint` WARNS if a member sets those. **How to apply:** the future Mapping Engine (Tahap 19) MUST treat org edges as authoritative and ignore/normalize member-level runtime linkage fields — otherwise dual source of truth.
- **Lint warns, never throws** — org is partial-by-design during dialogue.
- **`role` is authoritative for topology, not the member's blueprint.** The Mapping Engine (Tahap 19) forces `agentPatch.isOrchestrator = (role === "orchestrator")` for EVERY member — never just sets true for orchestrators. **Why:** a specialist/support member whose embedded single-agent blueprint carries `isOrchestrator:true` would otherwise leak through `mapBlueprintToBuilder`'s generic 1:1 field copy → a second source of truth for team topology. Same family of bug as the member-level edge fields.

## Tahap 19 — Organization Mapping Engine (done)
`server/services/blueprint-engine/organization-mapping-engine.ts` `mapOrganizationToBuilder(org, options?)` is pure: per member calls the existing single-agent `mapBlueprintToBuilder` (no duplicated logic; it returns a fresh object per call so mutating its `agentPatch` is safe), strips forbidden member wiring keys `["agenticSubAgents","parentAgentId"]`, forces `isOrchestrator` from role, and builds `wiring[]` (orchestrator→sub-agents) ONLY from `structure.edges`, still by `localId`. Edge handling: self-edges, dangling refs, and edges whose source isn't an orchestrator are skipped; duplicate sub-agent edges dropped with warning; orchestrators with no outgoing edge warned. `localId→agentId` resolution is deliberately deferred to Tahap 20.

## Tahap 20 — Organization Configuration Engine (done)
`server/services/blueprint-engine/organization-configuration-engine.ts` `applyOrganizationToBuilder(org, { storage, ownerUserId, dryRun })`. Validate-all-before-write; `dryRun` previews only.
- **Atomicity is mandatory, not best-effort.** Real (non-dryRun) writes REFUSE to run unless `storage.runInTransaction` exists — it does NOT fall back to non-transactional writes, because a partial team is worse than no team. Tahap 21 must implement `runInTransaction` on the real `DbStorage` (db.transaction pattern) before exposing org writes.
- **Two-phase inside the transaction.** Phase A: create every agent (+ its children) recording `localId→agentId`, deferring `isOrchestrator` (insertAgentSchema's refine requires bigIdeaId when isOrchestrator true). Phase B: set `isOrchestrator`/`orchestratorRole`/`agenticSubAgents` from the resolved wiring; coerce `agenticSubAgents.agentId` to numeric.
- **Children must be written `strict` so a child failure rolls back the whole org.** `applyChildren` (in single-agent `configuration-engine.ts`) gained a `strict=false` param: in strict mode any child validation OR insert failure THROWS instead of becoming a warning. The org engine calls it with `strict=true`; single-agent Tahap 4 path keeps default false (best-effort). **Why:** without this, a child insert failure inside the transaction was swallowed → tx committed a partial org while returning applied:true. **How to apply:** any future transactional batch reusing `applyChildren` MUST pass strict=true; treat default-false as the documented single-agent invariant.
- Stamp `ownerUserId` on EVERY created agent (same trap as single-agent `/configure` create — agent vanishes from owner's dashboard if userId not stamped post-parse).
