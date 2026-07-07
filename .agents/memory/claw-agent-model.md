---
name: Claw agent model config & durability
description: How the MultiClaw agents' LLM model is set, why raw DB updates don't stick, and the durable fix.
---

# Claw agent LLM model — durability rules

Claw agents (slug ILIKE '%claw%') answer mainly from their **system prompts** (expertise baked in), NOT from KB. Empty KB is by design; KB is optional enrichment. There is NO scheduled system auto-update of claw KBs (the research-feed only targets specific feed agents by slug, not the claw suite).

Answer QUALITY is driven by the **model tier**, not KB. Historically almost all claw agents ran on `gpt-4o-mini` (weak → shallow/wrong answers, e.g. SBUClaw once said "SBU = Surat Izin Usaha" instead of "Sertifikat Badan Usaha"). Upgrading to `gpt-4o` fixes this.

## Rule: a raw SQL UPDATE of ai_model does NOT stick
**Why:** ~7 construction-claw seed files (sipil/mep/k3/lingkungan/manprojak/arsitektur/surveipemetaan) force-`updateAgent` on EVERY server boot and re-apply their hardcoded model. So a bulk `UPDATE agents SET ai_model=...` gets reverted on the next restart/deploy for exactly those force-reseed agents.

**How to apply:** to change a claw model durably you MUST edit the seed source, not just the DB. The claw seed data arrays use a `model:` field (~65 `server/seed-*claw*.ts` files, 124 literals). Fix the literal there.

## Rule: seeds pass `model:` but createAgent reads `aiModel`
**Why:** on a FRESH DB (all seeds run create-path), most claw seeds call `createAgent({ ..., model: "..." })`, but `createAgent` in both `server/db-storage.ts` and `server/storage.ts` only read `insertAgent.aiModel` (defaulting to `gpt-4o-mini`). So `model:` was silently ignored on create → fresh DB would get mini regardless of the seed literal. `defaultModel()` also returns `gpt-4o-mini` when only OPENAI_API_KEY is set (no Qwen/DeepSeek).

**How to apply:** both storages now have a backstop: `aiModel: insertAgent.aiModel || (insertAgent as any).model || "gpt-4o-mini"`. Keep it — it maps the legacy `model` field so all `model:`-passing seeds create with the right model. Runtime resolution is `agent.aiModel || defaultModel()` (external chat path `~routes.ts:7023` uses `agent.aiModel || "gpt-4o-mini"`).

## Rule: prod is a SEPARATE DB — the durable fix is a boot-time idempotent UPDATE
**Why:** editing seed source only fixes the CREATE path (fresh DB). Existing rows in an already-populated DB are skipped by "skip if exists" seeds, so a dev-only model upgrade NEVER propagates to production (which has its own DB and only ever ran the original seed). Symptom: dev all `gpt-4o`, prod majority still `gpt-4o-mini` → deployed chatbots feel dumb even though dev is fine. Cannot write prod DB directly (only read-replica for queries); the only write channel into prod is code that runs at boot on deploy.

**How to apply:** there is now a `[ClawModelUpgrade]` block in `server/index.ts` placed AFTER all seed calls and before `startScheduler()` — `UPDATE agents SET ai_model='gpt-4o' WHERE slug ILIKE '%claw%' AND (ai_model IS NULL OR ai_model <> 'gpt-4o')`. Runs every boot (idempotent no-op once converged), and because it runs LAST it wins over the force-reseed claw files. It only takes effect in prod after a REDEPLOY. Keep this block; don't "clean it up" — it is the propagation mechanism, not a one-off.

## Unrelated pre-existing boot noise (not caused by model work)
SKK/LSP seeds (seed-manajemen-lsp-extra, seed-skk-sipil-wave*) throw `exec.select/insert is not a function` at boot — they pass a partial transaction executor into `lookupSeriesNameForAgent`/`createAgent`. Non-fatal, seeds catch it. Not a claw/model issue.
