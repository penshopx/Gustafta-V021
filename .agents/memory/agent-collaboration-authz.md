---
name: Agent Collaboration (Editor/Viewer) authz
description: How shared-agent permissions split across routes; which actions editors may vs may not do.
---

# Agent Collaboration (Editor/Viewer) authz

Owners/admins share an agent by email (`agentCollaborators` table) granting **Editor** (mutate config) or **Viewer** (read-only). Authz decisions live in pure, tested functions `decideAgentMutation` / `decideAgentReadAccess` (`server/lib/agent-authz.ts`); routes only gather inputs.

## The split that matters (route guards in server/routes.ts)
- **Config mutation = editor-allowed** → guard `assertCanMutateAgent` (looks up collaborator role, passes it to `decideAgentMutation`). Routes: `PATCH /api/agents/:id`, `toggle-enabled`, `folder`, plus builder/LLM-cost routes.
- **Destructive / ownership = owner-or-admin ONLY** → guard `assertOwnerOrAdminAgent`, which calls `decideAgentMutation` with `collaboratorRole: null` so an editor falls through to 403. Routes: `DELETE /api/agents/:id`, `PATCH /api/agents/:id/archive`.
- **Activate** (`POST /api/agents/:id/activate`) keeps its own explicit owner/admin check (mutates a GLOBAL singleton).
- **Share management** (`/api/agents/:id/collaborators` GET/POST/PATCH/DELETE) → `assertCanManageCollaborators`, strict owner-or-admin (editors excluded).

**Why:** editor was originally allowed to delete/archive because those routes reused `assertCanMutateAgent` — a privilege-escalation flagged in review. The fix is the deliberate "don't even look up the collaborator role for destructive routes" pattern.

**How to apply:** when adding any new agent route, classify it first. Destructive or ownership-lifecycle → `assertOwnerOrAdminAgent`. Pure config edit → `assertCanMutateAgent`. Never reuse `assertCanMutateAgent` for delete/archive/activate/share.

## Test contract (regression locks)
- `tests/agent-authz-guard.test.ts`: static source-grep groups — `STRICT_GUARDED` must call `assertCanMutateAgent`; `OWNER_ONLY_GUARDED` (delete, archive) must call `assertOwnerOrAdminAgent`. Moving a route between buckets requires moving it here too.
- `tests/agent-authz-decision.test.ts`: pure matrix incl. "destructive: editor (role=null) → 403; owner/admin → ok".
- System agent = `agents.userId === ""` → admin-only in BOTH pure functions; editor role never bypasses it.
