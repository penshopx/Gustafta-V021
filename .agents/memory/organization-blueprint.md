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

## Materialization rule for later (Tahap 20)
- Reuse the atomic-clone lesson: creating N agents for a team must be transactional or partial orgs leak. Stamp `ownerUserId` on every created agent (same trap as single-agent `/configure` create — agent vanishes from owner's dashboard if userId not stamped post-parse).
