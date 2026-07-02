---
name: Research Team news feed
description: How Gustafta's research team gets real "eyes" (free Google News RSS → per-agent KB) and the ownership/authz rules around it.
---

# Research Team live feed

Gustafta has a research sub-team (Kepala Tim Riset orchestrator → 4 sub-specialists: viral-lokal, tren-global, suara-pelanggan, kompetitor) that serves BOTH product-dev and sales-dev. Two of them consume a live feed.

**Feed mechanism (`server/lib/research-feed.ts`):** free Google News RSS (no API key) parsed with cheerio xmlMode → ingested as a Knowledge Base into the *specific feed agent's* `agentId` so RAG retrieval reaches it at chat time. Agents resolved by SLUG, never hardcoded IDs. Driven by a single `FEED_STREAMS` config array (source of truth) — 3 streams: `riset-viral-lokal` (product-domain pain points for the 80 claw), `riset-tren-global` (global tech/AI), `riset-iklan-pasar` (ads/viral market: TikTok Shop, FB ads — national+global). Topics can be a plain string or `{q,hl,gl}` to mix locales within one stream.

**Two goals:** the team serves BOTH (1) strengthening existing premium products (the 80 claw / MultiClaw Suite) and (2) strengthening Gustafta's market/sales. Orchestrator = Kepala Tim Riset (5 subs now: PRODUK_LOKAL, TREN_GLOBAL, SUARA_PELANGGAN, KOMPETITOR, IKLAN_PASAR).

**Method library (honest-by-design for FB/TikTok):** live automated data from Facebook Ad Library / TikTok needs API keys or paid tools — NOT done. Instead `ensureResearchMethodLibrary()` seeds a STATIC KB on the market agent (prefix `Panduan Metode Riset`, which the daily `Feed Riset%` prune does NOT match) containing a step-by-step playbook for FB Ad Library + TikTok Creative Center/Shop research. Idempotent (skip if exists). Embeds server-side (needs OpenAI key), so seed via the sweep, not the code_execution sandbox.

**Rules / gotchas:**
- Prune BEFORE re-ingest, but only delete KB whose name starts with `Feed Riset` (never nuke user-uploaded KB on the same agent). RAG retrieval works off chunks per agentId; feed KB must stay small because the no-embedding fallback concatenates ALL chunks.
- The sweep endpoint writes to MULTIPLE agents (lokal + global). **Authz must check `assertCanMutateAgent` on EVERY agent it mutates**, not just one — otherwise cross-agent privilege bleed if owners differ. (Caught in review.)
- Trigger: `POST /api/research/sweep` (isAuthenticated + per-agent mutate authz) + daily `scheduleAtWIB("Research Feed Sweep", 6, 30, ...)` in server/index.ts. Scheduler runs server-side, no HTTP auth.
- Embeddings DID succeed in the server env (AI_INTEGRATIONS_OPENAI_API_KEY present), so vector search works — but code is robust without it.

**Why:** honest-by-design — feed is *public news aggregation*, NOT real-time social-media scraping. Prompts must treat it as an early signal and tag unverified claims with `[ASUMSI:…|basis:…|verifikasi-ke:…]` + ◆ GERBANG MANUSIA.

**Ownership caveat (July 2026):** the dev DB was reset by migration — users table empty, all agents unowned (`user_id=''`). The research team (Kepala 1476; subs 1472 produk-lokal / 1473 global / 1474 suara-pelanggan / 1475 kompetitor / 1497 iklan-pasar) was created unowned. Non-admin `GET /api/agents` only lists own/shared agents, so these won't show in a user's dashboard until ownership is transferred (set `user_id` to the real account after they log in with indokon@gmail.com).
