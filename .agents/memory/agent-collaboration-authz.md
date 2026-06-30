---
name: Agent Collaboration (Editor/Viewer) authz
description: Permission policy for shared agents — who may mutate, who may delete, who may chat/read. Route classification rules.
---

# Agent Collaboration (Editor/Viewer) authz

Owners/admins share an agent by email granting **Editor** (mutate config) or **Viewer** (read-only). All authz *decisions* live in pure, tested functions (`decideAgentMutation` / `decideAgentReadAccess`); route-layer guards only gather inputs (userId, isAdmin, agentOwnerId, collaboratorRole) and delegate.

## Classify every agent route before choosing a guard
There are FOUR capability tiers, each with its own guard. The bug that caused two review rejections was reusing one tier's guard for another.

1. **Config mutation → editor-allowed.** Editors may edit the agent's configuration. Guard looks up collaborator role and passes it through (editor ⇒ ok).
2. **Destructive / ownership (delete, archive) → owner-or-admin ONLY.** The guard deliberately does NOT look up collaborator role (passes null) so editors fall through to 403. Activate and collaborator-management are also owner-only.
3. **Chat / read of message history → tiered by visibility, NOT just "is logged in".** This is the IDOR surface (`/api/messages`, `/api/messages/stream`, `GET /api/messages/:agentId`, message export json/csv):
   - public agent (`isPublic`) → anyone, including anonymous/widget;
   - private + no owner (system/seeded shared agent, e.g. MultiClaw/Legal AI) → any logged-in user (entitlement enforced by the UI page guard, not here);
   - private + has owner → owner/admin/collaborator only.
4. **Private config read (builder) → owner/admin/collaborator**, with sensitive fields sanitized for non-admin.

**Why:** (a) editors were able to delete because delete reused the config-mutation guard; (b) any logged-in user could chat with / read another user's *private* agent by guessing the agentId because chat endpoints only checked `isAuthenticated`. Both were flagged in code review as broken access control.

**How to apply:** when adding ANY agent or message route, ask "which of the 4 tiers is this?" Never gate chat/read with a bare `isAuthenticated` — a system agent and a user's private agent need different rules. Never reuse the config-mutation guard for delete/archive/activate/share.

## Don't over-tighten system agents
~900 seeded agents have an empty owner and are intentionally shared. Tiers 2–3 must let logged-in users reach them; only *owner-set* private agents get the collaborator gate. Tightening system agents silently breaks the whole MultiClaw / Legal AI chat suite.

## Regression locks
Static source-grep tests assert each route family calls the correct guard (mutation vs owner-only vs chat-access), plus a pure decision matrix (editor/viewer/non-collaborator/system/anonymous). Moving a route between tiers requires updating these tests in lockstep, or the grep test fails loudly.
