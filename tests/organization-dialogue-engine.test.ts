/**
 * Tahap 23 — Organization Dialogue / Inference Engine (Fase 3).
 * Mengunci: saran komposisi tim deterministik, dialog org-level (pure),
 * inferensi per-anggota (pakai ulang inferBlueprint), auto-struktur, kontrak
 * sumber-kebenaran wiring, dan agregat overallConfidence.
 * Jalankan: npx tsx --test tests/organization-dialogue-engine.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyOrganizationBlueprint,
  createEmptyOrgMember,
  organizationBlueprintSchema,
  lintOrganizationBlueprint,
  type OrganizationBlueprint,
} from "../shared/blueprint/organization-blueprint-schema.ts";
import {
  suggestTeamComposition,
  applyTeamSuggestion,
  selectNextOrgQuestions,
  applyOrgAnswer,
  applyOrgAnswers,
  getOrgDialogueState,
  inferOrganization,
  ORG_QUESTION_BANK,
} from "../server/services/blueprint-engine/organization-dialogue-engine.ts";

/* --- Saran komposisi tim ------------------------------------------------ */

test("suggestTeamComposition mendeteksi domain konstruksi → lead + spesialis", () => {
  const s = suggestTeamComposition("Saya mau bantu kontraktor urus SBU dan tender konstruksi");
  assert.equal(s.domain, "Konstruksi");
  assert.ok(s.members.length >= 2);
  assert.equal(s.members[0].role, "orchestrator");
  assert.equal(s.members[0].localId, "m1");
  // localId unik & berurutan
  const ids = new Set(s.members.map((m) => m.localId));
  assert.equal(ids.size, s.members.length);
});

test("suggestTeamComposition fallback ke tim Umum untuk misi tak dikenal", () => {
  const s = suggestTeamComposition("zxqw blah blah sesuatu yang tak ada kata kuncinya");
  assert.equal(s.domain, "Umum");
  assert.equal(s.members[0].role, "orchestrator");
});

test("suggestTeamComposition deterministik (idempoten)", () => {
  const a = suggestTeamComposition("tim pemasaran konten dan iklan");
  const b = suggestTeamComposition("tim pemasaran konten dan iklan");
  assert.deepEqual(a, b);
});

test("maxSpecialists membatasi jumlah spesialis", () => {
  const s = suggestTeamComposition("konstruksi sbu tender", { maxSpecialists: 1 });
  // 1 lead + 1 spesialis
  assert.equal(s.members.length, 2);
});

/* --- Terapkan saran → OrganizationBlueprint ----------------------------- */

test("applyTeamSuggestion menghasilkan org valid: lead + edges lead→lainnya, lint bersih", () => {
  const org = createEmptyOrganizationBlueprint("tim keuangan dan pajak umkm");
  const s = suggestTeamComposition("tim keuangan dan pajak umkm");
  const next = applyTeamSuggestion(org, s);

  // Tetap valid menurut schema.
  organizationBlueprintSchema.parse(next);

  const lead = next.members.find((m) => m.role === "orchestrator")!;
  assert.equal(next.structure.leadLocalId, lead.localId);
  const others = next.members.filter((m) => m.localId !== lead.localId);
  assert.equal(next.structure.edges.length, others.length);
  for (const e of next.structure.edges) {
    assert.equal(e.fromLocalId, lead.localId);
  }
  assert.deepEqual(lintOrganizationBlueprint(next), []);
});

test("applyTeamSuggestion tidak memutasi input", () => {
  const org = createEmptyOrganizationBlueprint("hukum kontrak");
  const snapshot = JSON.stringify(org);
  applyTeamSuggestion(org, suggestTeamComposition("hukum kontrak"));
  assert.equal(JSON.stringify(org), snapshot);
});

/* --- Dialog org-level --------------------------------------------------- */

test("selectNextOrgQuestions menanyakan misi dulu, lalu berhenti saat terisi", () => {
  const org = createEmptyOrganizationBlueprint();
  const q1 = selectNextOrgQuestions(org);
  assert.ok(q1.some((q) => q.id === "org.mission"));

  const filled = applyOrgAnswer(org, "org.mission", "Bantu UMKM jualan online").organization;
  const q2 = selectNextOrgQuestions(filled);
  assert.ok(!q2.some((q) => q.id === "org.mission"));
  assert.ok(q2.some((q) => q.id === "org.name"));
});

test("applyOrgAnswer mengisi meta + mirror misi ke intent, pure", () => {
  const org = createEmptyOrganizationBlueprint();
  const snapshot = JSON.stringify(org);
  const res = applyOrgAnswer(org, "org.mission", "  Tim layanan pelanggan toko  ");
  assert.equal(res.applied, true);
  assert.equal(res.organization.meta.mission, "Tim layanan pelanggan toko"); // trim
  assert.equal(res.organization.meta.intent, "Tim layanan pelanggan toko"); // mirror
  assert.equal(JSON.stringify(org), snapshot); // input tak berubah
});

test("applyOrgAnswer menolak nodeId tak dikenal & jawaban kosong", () => {
  const org = createEmptyOrganizationBlueprint();
  assert.equal(applyOrgAnswer(org, "org.unknown", "x").applied, false);
  assert.equal(applyOrgAnswer(org, "org.name", "   ").applied, false);
});

test("applyOrgAnswer SELALU mengembalikan salinan baru (sukses & gagal)", () => {
  const org = createEmptyOrganizationBlueprint();
  // sukses
  assert.notEqual(applyOrgAnswer(org, "org.name", "Tim A").organization, org);
  // gagal: node tak dikenal
  assert.notEqual(applyOrgAnswer(org, "org.unknown", "x").organization, org);
  // gagal: jawaban kosong
  assert.notEqual(applyOrgAnswer(org, "org.name", "   ").organization, org);
});

test("applyOrgAnswers mengembalikan salinan baru walau answers kosong", () => {
  const org = createEmptyOrganizationBlueprint();
  assert.notEqual(applyOrgAnswers(org, {}).organization, org);
});

test("getOrgDialogueState menandai readyToCompose setelah misi terisi", () => {
  const org = createEmptyOrganizationBlueprint();
  assert.equal(getOrgDialogueState(org).readyToCompose, false);
  const filled = applyOrgAnswers(org, { "org.mission": "tim pemasaran", "org.name": "Tim Promosi" }).organization;
  const st = getOrgDialogueState(filled);
  assert.equal(st.hasName, true);
  assert.equal(st.hasMission, true);
  assert.equal(st.readyToCompose, true);
});

test("ORG_QUESTION_BANK punya id unik", () => {
  const ids = new Set(ORG_QUESTION_BANK.map((n) => n.id));
  assert.equal(ids.size, ORG_QUESTION_BANK.length);
});

/* --- Inferensi organisasi ----------------------------------------------- */

function composedOrg(): OrganizationBlueprint {
  const org = createEmptyOrganizationBlueprint("Bantu kontraktor urus SBU dan tender");
  org.meta.mission = "Bantu kontraktor urus SBU dan tender";
  return applyTeamSuggestion(org, suggestTeamComposition(org.meta.mission!));
}

test("inferOrganization mengisi field anggota (systemPrompt/slug) via inferBlueprint", () => {
  const res = inferOrganization(composedOrg());
  const lead = res.organization.members[0];
  const ai = lead.blueprint.modules.aiEngine.data as Record<string, any>;
  const id = lead.blueprint.modules.identity.data as Record<string, any>;
  assert.ok(typeof ai.systemPrompt === "string" && ai.systemPrompt.length > 0);
  assert.ok(typeof id.slug === "string" && id.slug.length > 0);
  assert.ok(res.memberInferences.every((m) => m.written > 0));
  assert.ok(res.overallConfidence > 0);
});

test("inferOrganization menyarankan struktur saat edges kosong", () => {
  const org = createEmptyOrganizationBlueprint("tim SDM rekrutmen");
  const lead = createEmptyOrgMember("m1", "orchestrator", "Ketua SDM");
  const spc = createEmptyOrgMember("m2", "specialist", "Rekrutmen");
  org.members = [lead, spc];
  org.structure = { leadLocalId: "m1", edges: [] };

  const res = inferOrganization(organizationBlueprintSchema.parse(org));
  assert.equal(res.edgesAdded.length, 1);
  assert.equal(res.organization.structure.edges[0].fromLocalId, "m1");
  assert.equal(res.organization.structure.edges[0].toLocalId, "m2");
});

test("inferOrganization menjaga kontrak: tidak menulis wiring di blueprint anggota", () => {
  const res = inferOrganization(composedOrg());
  // lint tetap bersih → tak ada agenticSubAgents/parentAgentId/agentId di anggota
  assert.deepEqual(lintOrganizationBlueprint(res.organization), []);
  for (const m of res.organization.members) {
    const orch = m.blueprint.modules.orchestration.data as Record<string, any>;
    assert.ok(!Array.isArray(orch.agenticSubAgents) || orch.agenticSubAgents.length === 0);
    assert.equal(orch.parentAgentId ?? null, null);
  }
});

test("inferOrganization tidak menimpa nilai buatan user", () => {
  const org = composedOrg();
  (org.members[0].blueprint.modules.identity.data as Record<string, any>).name = "Bos Besar";
  org.members[0].blueprint.modules.identity.fieldMeta = {
    name: { confidence: 1, source: "user", needsConfirmation: false },
  };
  const res = inferOrganization(org);
  assert.equal(
    (res.organization.members[0].blueprint.modules.identity.data as Record<string, any>).name,
    "Bos Besar",
  );
});

test("inferOrganization pure (input tak berubah) & mengisi nama org dari domain", () => {
  const org = composedOrg();
  const snapshot = JSON.stringify(org);
  const res = inferOrganization(org);
  assert.equal(JSON.stringify(org), snapshot);
  assert.equal(res.organization.meta.name, "Tim Konstruksi");
});
