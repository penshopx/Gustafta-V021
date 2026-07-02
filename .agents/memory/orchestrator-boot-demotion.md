---
name: Orchestrator boot demotion vs runtime trigger
description: Why directly-created/Org-Builder orchestrator agents lose is_orchestrator at boot, and why the team still works anyway.
---

# Orchestrator boot demotion vs runtime orchestration trigger

`server/fix-orchestrators.ts` → `fixOrphanedOrchestrators()` runs at server boot. It finds every agent where `is_orchestrator = true AND toolbox_id IS NULL` and **demotes** it: `is_orchestrator=false`, `orchestrator_role='standalone'`, and links it to a default HUB toolbox. It only KEEPS the flag when the agent's `bigIdeaId` maps to a series' bigIdeas and that hub has no orchestrator yet.

**Consequence:** an orchestrator created directly (SQL/storage) OR via the Organization Builder (`/api/organization/configure` → `applyOrganizationToBuilder`, which creates orchestrators with NO toolbox) will lose `is_orchestrator` on the *next* restart.

**But the team still works.** Runtime multi-agent orchestration in `/api/messages/stream` triggers on `Array.isArray(agenticSubAgents) && length > 0` ONLY — it does NOT check `is_orchestrator`. `fixOrphanedOrchestrators` never clears `agentic_sub_agents`, so delegation keeps firing.

**Why:** don't fight the flag. It's cosmetic for runtime chat. Dashboard sub-agent counts are also computed from `agenticSubAgents` (parseSubAgentsValue), not the flag.

**How to apply:** when building an AI team by hand or via the org engine, make sure `agentic_sub_agents` is a non-empty array of `{role, agentId(numeric), description}`. Do NOT expect `is_orchestrator=true` to persist across restarts unless the agent is properly placed in a hub (toolbox + bigIdea). Setting the flag true on an orphan is pointless — it flips back next boot.
