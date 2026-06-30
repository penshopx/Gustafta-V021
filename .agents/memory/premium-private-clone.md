---
name: Premium Privat (per-buyer agent clone)
description: Design + non-obvious constraints for "Premium Privat" — each buyer gets an editable private clone of a master agent.
---

# Premium Standar vs Premium Privat

Two-tier premium product. `agents.premiumClass` ("standard" | "private") marks how a store/premium agent is delivered:
- **standard** = one shared admin-curated bot; buyers get access (subscription) but cannot edit.
- **private** = each buyer gets their OWN clone (`agents.clonedFromAgentId` → master) that they CAN edit/feed with internal data.

## Why owner-edit "just works"
`decideAgentMutation` (server/lib/agent-authz.ts) already grants mutate to the owner when `agents.userId === userId`. So a clone stamped with `userId = buyer` is editable by that buyer with NO authz change — only the buyer-facing UI needs exposing. KB/config edit endpoints already gate on `assertCanMutateAgent`.

## Cloning constraints (cloneAgentForOwner in db-storage.ts) — all 3 are silent-failure traps
1. **Override `isPublic=false` AND `isListed=false`.** Raw row-copy inherits master's `isPublic`; many public/embed guards key off `isPublic`, so `isListed=false` alone does NOT make the clone private.
2. **Reset `customApiKey`/`customBaseUrl`/`customModelName` to "".** Copying them puts the seller's API key into the buyer's runtime = cross-tenant billing/secret leak (sanitizing API responses is not enough; model execution still uses the copied key). Clone falls back to platform default model.
3. **Copy `knowledge_chunks`, not just `knowledge_bases`.** RAG retrieval reads chunks. Copy KB rows capturing old→new KB id, then copy each KB's chunks remapping `knowledgeBaseId` + `agentId`. Skip this and the clone shows KB entries but retrieves nothing.

Also: set `isActive=false` on the clone (isActive behaves like a global active-agent singleton — see setActiveAgent). Omit id/createdAt/slug/accessToken; mint a fresh accessToken; null the slug.

**Intentional non-clone:** an orchestrator clone keeps `agenticSubAgents` pointing at the ORIGINAL system-owned sub-agent IDs. By design the "brain" (orchestrator + sub-agents) stays system-owned; the buyer only edits KB. Not a bug.

## Delivery (phased)
- Foundation (done): schema fields + `cloneAgentForOwner` + admin `POST /api/admin/agents/:id/deliver-private` {email} (requireAdmin; 404 if buyer email not registered yet).
- Later: wire Scalev webhook chatbot branch (server/routes.ts) to auto-clone when mapped master `premiumClass==="private"`; pending-delivery for unregistered emails (mirror pending_agent_invites); buyer "Update Pengetahuan" UI.
