import { test } from "node:test";
import assert from "node:assert/strict";

import { MemStorage } from "../server/storage";
import { decideAgentMutation, decideAgentReadAccess } from "../server/lib/agent-authz";

// Integrasi NYATA (storage + keputusan otorisasi) untuk fitur berbagi agen.
//
// Berbeda dari tes statis (grep source) di agent-authz-guard.test.ts, tes ini
// menjalankan alur sesungguhnya: owner BERBAGI agen ke user lain via storage
// (getUserByEmail → addOrUpdateCollaborator), lalu untuk setiap upaya akses kita
// meniru PERSIS yang dilakukan route guard: lookup peran kolaborator dari storage
// → serahkan ke decideAgentMutation / decideAgentReadAccess. Ini membuktikan
// perilaku end-to-end, bukan sekadar keberadaan kode.

const ADMINS = new Set<string>(); // tidak ada admin di skenario dasar

// Tiru route guard mutasi: hitung peran kolaborator dari storage lalu putuskan.
async function canMutate(storage: MemStorage, agentId: string, agentOwnerId: string, userId: string) {
  const collaboratorRole = userId ? await storage.getCollaboratorRole(agentId, userId) : null;
  return decideAgentMutation({ userId, isAdmin: ADMINS.has(userId), agentOwnerId, collaboratorRole });
}

async function canRead(storage: MemStorage, agentId: string, agentOwnerId: string, userId: string) {
  const collaboratorRole = userId ? await storage.getCollaboratorRole(agentId, userId) : null;
  return decideAgentReadAccess({ userId, isAdmin: ADMINS.has(userId), agentOwnerId, collaboratorRole });
}

// Bangun dunia: owner + 1 agen privat milik owner + beberapa user lain.
async function setup() {
  const storage = new MemStorage();
  const owner = await storage.createUser({ email: "owner@contoh.id", firstName: "Oki", lastName: "Owner" } as any);
  const editor = await storage.createUser({ email: "editor@contoh.id", firstName: "Edi", lastName: "Editor" } as any);
  const viewer = await storage.createUser({ email: "viewer@contoh.id", firstName: "Vina", lastName: "Viewer" } as any);
  const stranger = await storage.createUser({ email: "stranger@contoh.id", firstName: "Sam", lastName: "Stranger" } as any);
  const agent = await storage.createAgent({ name: "Agen Privat Owner", userId: owner.id, isPublic: false } as any);
  return { storage, owner, editor, viewer, stranger, agent };
}

test("berbagi via email menyimpan peran yang benar (getUserByEmail → addOrUpdateCollaborator)", async () => {
  const { storage, owner, editor, agent } = await setup();
  const resolved = await storage.getUserByEmail("EDITOR@CONTOH.ID"); // case-insensitive
  assert.equal(resolved?.id, editor.id, "email harus di-resolve case-insensitive ke user yang benar");
  await storage.addOrUpdateCollaborator({ agentId: agent.id, userId: editor.id, role: "editor", invitedBy: owner.id });
  assert.equal(await storage.getCollaboratorRole(agent.id, editor.id), "editor");
});

test("Editor: boleh MUTASI config, TAPI ditolak baca? (baca juga boleh) — dan mutasi diizinkan", async () => {
  const { storage, owner, editor, agent } = await setup();
  await storage.addOrUpdateCollaborator({ agentId: agent.id, userId: editor.id, role: "editor", invitedBy: owner.id });
  assert.equal((await canMutate(storage, agent.id, owner.id, editor.id)).ok, true, "Editor harus boleh mutasi config");
  assert.equal((await canRead(storage, agent.id, owner.id, editor.id)).ok, true, "Editor harus boleh baca config");
});

test("Viewer: boleh BACA, DITOLAK mutasi (403)", async () => {
  const { storage, owner, viewer, agent } = await setup();
  await storage.addOrUpdateCollaborator({ agentId: agent.id, userId: viewer.id, role: "viewer", invitedBy: owner.id });
  assert.equal((await canRead(storage, agent.id, owner.id, viewer.id)).ok, true, "Viewer harus boleh baca");
  const m = await canMutate(storage, agent.id, owner.id, viewer.id);
  assert.equal(m.ok, false);
  assert.equal((m as any).status, 403, "Viewer mutasi harus 403");
});

test("Non-kolaborator (orang asing): DITOLAK baca & mutasi (403) pada agen privat", async () => {
  const { storage, owner, stranger, agent } = await setup();
  const r = await canRead(storage, agent.id, owner.id, stranger.id);
  const m = await canMutate(storage, agent.id, owner.id, stranger.id);
  assert.equal(r.ok, false); assert.equal((r as any).status, 403, "orang asing baca → 403");
  assert.equal(m.ok, false); assert.equal((m as any).status, 403, "orang asing mutasi → 403");
});

test("Anonim (belum login): DITOLAK 401 untuk baca & mutasi", async () => {
  const { storage, owner, agent } = await setup();
  const r = await canRead(storage, agent.id, owner.id, "");
  const m = await canMutate(storage, agent.id, owner.id, "");
  assert.equal((r as any).status, 401, "anonim baca → 401");
  assert.equal((m as any).status, 401, "anonim mutasi → 401");
});

test("Owner: selalu boleh baca & mutasi agennya sendiri", async () => {
  const { storage, owner, agent } = await setup();
  assert.equal((await canRead(storage, agent.id, owner.id, owner.id)).ok, true);
  assert.equal((await canMutate(storage, agent.id, owner.id, owner.id)).ok, true);
});

test("Admin: boleh baca & mutasi agen orang lain (termasuk privat)", async () => {
  const { storage, owner, stranger, agent } = await setup();
  const admins = new Set([stranger.id]);
  const collaboratorRole = await storage.getCollaboratorRole(agent.id, stranger.id);
  assert.equal(decideAgentMutation({ userId: stranger.id, isAdmin: admins.has(stranger.id), agentOwnerId: owner.id, collaboratorRole }).ok, true);
  assert.equal(decideAgentReadAccess({ userId: stranger.id, isAdmin: admins.has(stranger.id), agentOwnerId: owner.id, collaboratorRole }).ok, true);
});

test("Agen SISTEM (tanpa pemilik): user login biasa DITOLAK mutasi/baca-config (403), tetap milik admin", async () => {
  const { storage, editor } = await setup();
  const sys = await storage.createAgent({ name: "Agen Sistem", userId: "", isPublic: false } as any);
  // Bahkan kalau seseorang nekat menambahkan kolaborator, agen sistem tetap admin-only.
  const m = await canMutate(storage, sys.id, "", editor.id);
  const r = await canRead(storage, sys.id, "", editor.id);
  assert.equal(m.ok, false); assert.equal((m as any).status, 403, "agen sistem mutasi non-admin → 403");
  assert.equal(r.ok, false); assert.equal((r as any).status, 403, "agen sistem baca-config non-admin → 403");
});

test("Mengubah peran (editor → viewer) lewat share ulang menurunkan hak mutasi", async () => {
  const { storage, owner, editor, agent } = await setup();
  await storage.addOrUpdateCollaborator({ agentId: agent.id, userId: editor.id, role: "editor", invitedBy: owner.id });
  assert.equal((await canMutate(storage, agent.id, owner.id, editor.id)).ok, true);
  await storage.addOrUpdateCollaborator({ agentId: agent.id, userId: editor.id, role: "viewer", invitedBy: owner.id });
  assert.equal((await canMutate(storage, agent.id, owner.id, editor.id)).ok, false, "turun ke viewer → mutasi 403");
  assert.equal((await canRead(storage, agent.id, owner.id, editor.id)).ok, true, "viewer masih boleh baca");
});

test("Mencabut akses (removeCollaborator) mengembalikan ke status orang asing (403)", async () => {
  const { storage, owner, editor, agent } = await setup();
  await storage.addOrUpdateCollaborator({ agentId: agent.id, userId: editor.id, role: "editor", invitedBy: owner.id });
  assert.equal(await storage.removeCollaborator(agent.id, editor.id), true);
  assert.equal(await storage.getCollaboratorRole(agent.id, editor.id), null);
  const m = await canMutate(storage, agent.id, owner.id, editor.id);
  assert.equal(m.ok, false); assert.equal((m as any).status, 403, "setelah dicabut → 403");
});

test("Daftar agen yang dibagikan ke user (listAgentIdsForCollaborator) mencakup hanya yang di-share", async () => {
  const { storage, owner, editor, agent } = await setup();
  const agent2 = await storage.createAgent({ name: "Agen Kedua", userId: owner.id, isPublic: false } as any);
  await storage.addOrUpdateCollaborator({ agentId: agent.id, userId: editor.id, role: "editor", invitedBy: owner.id });
  const ids = await storage.listAgentIdsForCollaborator(editor.id);
  assert.deepEqual(ids, [agent.id], "hanya agen yang di-share yang muncul");
  assert.ok(!ids.includes(agent2.id), "agen yang TIDAK di-share tidak boleh muncul");
});

test("listCollaboratorsForAgent mengembalikan email & displayName untuk UI berbagi", async () => {
  const { storage, owner, editor, viewer, agent } = await setup();
  await storage.addOrUpdateCollaborator({ agentId: agent.id, userId: editor.id, role: "editor", invitedBy: owner.id });
  await storage.addOrUpdateCollaborator({ agentId: agent.id, userId: viewer.id, role: "viewer", invitedBy: owner.id });
  const list = await storage.listCollaboratorsForAgent(agent.id);
  assert.equal(list.length, 2);
  const byEmail = Object.fromEntries(list.map((c) => [c.email, c]));
  assert.equal(byEmail["editor@contoh.id"].role, "editor");
  assert.equal(byEmail["editor@contoh.id"].displayName, "Edi Editor");
  assert.equal(byEmail["viewer@contoh.id"].role, "viewer");
});

// Divergensi YANG DIKETAHUI & DISENGAJA antara MemStorage vs DatabaseStorage:
// DatabaseStorage memakai agentId integer; MemStorage memakai id agen UUID.
// AgentCollaborator.agentId bertipe number, jadi MemStorage mengembalikan
// agentId = 0 untuk id non-numerik (UUID). Lookup TETAP benar karena disimpan
// via rawAgentId. Test ini mengunci ekspektasi itu agar "parity" tidak menyesatkan:
// auth bergantung pada getCollaboratorRole(rawId,userId), BUKAN pada field agentId.
test("[divergensi terdokumentasi] MemStorage: agentId numerik = 0 untuk id UUID, tapi lookup tetap benar", async () => {
  const { storage, owner, editor, agent } = await setup();
  assert.ok(!/^\d+$/.test(agent.id), "prasyarat: id agen MemStorage adalah UUID (non-numerik)");
  const rec = await storage.addOrUpdateCollaborator({ agentId: agent.id, userId: editor.id, role: "editor", invitedBy: owner.id });
  // Field numerik tidak bermakna di MemStorage → 0 (BUKAN dipakai untuk authz).
  assert.equal(rec.agentId, 0, "agentId numerik untuk id UUID = 0 (divergensi disengaja)");
  // Sumber kebenaran authz: lookup via id string mentah tetap menemukan peran.
  assert.equal(await storage.getCollaboratorRole(agent.id, editor.id), "editor", "lookup via rawAgentId tetap benar");
});
