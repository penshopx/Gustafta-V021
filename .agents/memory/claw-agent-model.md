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

## Unrelated pre-existing boot noise (not caused by model work)
SKK/LSP seeds (seed-manajemen-lsp-extra, seed-skk-sipil-wave*) throw `exec.select/insert is not a function` at boot — they pass a partial transaction executor into `lookupSeriesNameForAgent`/`createAgent`. Non-fatal, seeds catch it. Not a claw/model issue.
