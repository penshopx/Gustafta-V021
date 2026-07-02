---
name: Research Team news feed
description: How Gustafta's research team gets real "eyes" (free Google News RSS → per-agent KB) and the ownership/authz rules around it.
---

# Research Team live feed

Gustafta has a research sub-team (Kepala Tim Riset orchestrator → 4 sub-specialists: viral-lokal, tren-global, suara-pelanggan, kompetitor) that serves BOTH product-dev and sales-dev. Two of them consume a live feed.

**Feed mechanism (`server/lib/research-feed.ts`):** free Google News RSS (no API key) parsed with cheerio xmlMode → ingested as a Knowledge Base into the *specific feed agent's* `agentId` so RAG retrieval reaches it at chat time. Agents resolved by SLUG (`riset-viral-lokal`, `riset-tren-global`), never hardcoded IDs.

**Rules / gotchas:**
- Prune BEFORE re-ingest, but only delete KB whose name starts with `Feed Riset` (never nuke user-uploaded KB on the same agent). RAG retrieval works off chunks per agentId; feed KB must stay small because the no-embedding fallback concatenates ALL chunks.
- The sweep endpoint writes to MULTIPLE agents (lokal + global). **Authz must check `assertCanMutateAgent` on EVERY agent it mutates**, not just one — otherwise cross-agent privilege bleed if owners differ. (Caught in review.)
- Trigger: `POST /api/research/sweep` (isAuthenticated + per-agent mutate authz) + daily `scheduleAtWIB("Research Feed Sweep", 6, 30, ...)` in server/index.ts. Scheduler runs server-side, no HTTP auth.
- Embeddings DID succeed in the server env (AI_INTEGRATIONS_OPENAI_API_KEY present), so vector search works — but code is robust without it.

**Why:** honest-by-design — feed is *public news aggregation*, NOT real-time social-media scraping. Prompts must treat it as an early signal and tag unverified claims with `[ASUMSI:…|basis:…|verifikasi-ke:…]` + ◆ GERBANG MANUSIA.

**Ownership caveat (July 2026):** the dev DB was reset by migration — users table empty, all ~1253 agents unowned (`user_id=''`). The research team (Kepala 1476; subs 1472 lokal / 1473 global / 1474 suara-pelanggan / 1475 kompetitor) was created unowned. Non-admin `GET /api/agents` only lists own/shared agents, so these won't show in a user's dashboard until ownership is transferred (set `user_id` to the real account after they log in with indokon@gmail.com).
