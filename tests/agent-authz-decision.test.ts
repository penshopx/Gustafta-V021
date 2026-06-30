import { test } from "node:test";
import assert from "node:assert/strict";

import { decideAgentMutation } from "../server/lib/agent-authz";

// Tahap 17 — validasi SEMANTIK runtime otorisasi mutasi agen (bukan sekadar
// keberadaan guard di source seperti agent-authz-guard.test.ts). Menguji
// langsung fungsi keputusan murni untuk seluruh matriks aktor.

test("belum login (userId kosong) → 401 Unauthorized", () => {
  const r = decideAgentMutation({ userId: "", isAdmin: false, agentOwnerId: "u2" });
  assert.deepEqual(r, { ok: false, status: 401, error: "Unauthorized" });
});

test("admin → boleh memutasi agen milik orang lain", () => {
  assert.deepEqual(
    decideAgentMutation({ userId: "admin1", isAdmin: true, agentOwnerId: "u2" }),
    { ok: true },
  );
});

test("admin → boleh memutasi agen sistem (tanpa pemilik)", () => {
  assert.deepEqual(
    decideAgentMutation({ userId: "admin1", isAdmin: true, agentOwnerId: "" }),
    { ok: true },
  );
});

test("pemilik → boleh memutasi agennya sendiri", () => {
  assert.deepEqual(
    decideAgentMutation({ userId: "u1", isAdmin: false, agentOwnerId: "u1" }),
    { ok: true },
  );
});

test("non-admin atas agen sistem (tanpa pemilik) → 403 admin-only", () => {
  const r = decideAgentMutation({ userId: "u1", isAdmin: false, agentOwnerId: "" });
  assert.equal(r.ok, false);
  assert.equal((r as { status: number }).status, 403);
  assert.match((r as { error: string }).error, /sistem/i);
});

test("non-pemilik atas agen milik orang lain → 403 bukan pemilik", () => {
  const r = decideAgentMutation({ userId: "u1", isAdmin: false, agentOwnerId: "u2" });
  assert.equal(r.ok, false);
  assert.equal((r as { status: number }).status, 403);
  assert.match((r as { error: string }).error, /pemilik/i);
});

test("defense-in-depth: userId kosong tetap 401 walau isAdmin=true", () => {
  // Tanpa identitas, klaim admin tidak boleh dipercaya — 401 didahulukan.
  const r = decideAgentMutation({ userId: "", isAdmin: true, agentOwnerId: "u2" });
  assert.equal(r.ok, false);
  assert.equal((r as { status: number }).status, 401);
});
