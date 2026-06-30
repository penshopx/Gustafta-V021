import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Regresi Tahap 16 — kunci hasil pengerasan keamanan Tahap 14–15.
//
// Seluruh keluarga endpoint `/api/agents/:id/*` yang MEMUTASI agen, MEMBACA
// konfigurasi privat (systemPrompt/KB/integrasi), atau MENJALANKAN model LLM
// wajib lewat otorisasi kepemilikan — `isAuthenticated` saja TIDAK cukup
// (kalau tidak, user mana pun yang login bisa menyalahgunakan agen milik
// orang lain / ~900 agen sistem bawaan).
//
// Test ini bersifat statis (membaca source routes.ts) — sengaja begitu agar:
//   1) tidak butuh DB, sesi, atau server hidup (cepat & deterministik), dan
//   2) gagal keras kalau ada refactor yang diam-diam menghapus guard.
// Pola ini mengikuti `tests/routes-helper-usage.test.ts`.

const __dirname = dirname(fileURLToPath(import.meta.url));
const routesPath = resolve(__dirname, "../server/routes.ts");
const src = readFileSync(routesPath, "utf8");

// Ambil blok handler sebuah route: dari literal registrasinya sampai registrasi
// route berikutnya (`\n  app.` pada indentasi 2 spasi). Untuk route terakhir,
// pakai 4000 karakter sesudahnya sebagai batas aman.
function routeBlock(registrationLiteral: string): string {
  const start = src.indexOf(registrationLiteral);
  assert.ok(
    start !== -1,
    `Registrasi route tidak ditemukan: ${registrationLiteral}. ` +
      "Kalau path/method-nya berubah, PERBARUI test ini — jangan hapus guard otorisasinya.",
  );
  const nextIdx = src.indexOf("\n  app.", start + registrationLiteral.length);
  const end = nextIdx === -1 ? Math.min(src.length, start + 4000) : nextIdx;
  return src.slice(start, end);
}

// ── 1. Helper assertCanMutateAgent: mendelegasikan keputusan ke fungsi murni ──
// Cabang otorisasi (401/admin/agen-sistem 403/non-owner 403) diuji menyeluruh
// di tests/agent-authz-decision.test.ts (mengimpor decideAgentMutation langsung).
// Di sini cukup memastikan helper masih ada & masih memakai fungsi murni itu.
test("assertCanMutateAgent mendelegasikan keputusan ke decideAgentMutation (logika authz murni & teruji)", () => {
  assert.match(
    src,
    /import\s*\{[^}]*decideAgentMutation[^}]*\}\s*from\s*["']\.\/lib\/agent-authz["']/,
    "routes.ts harus mengimpor decideAgentMutation dari ./lib/agent-authz.",
  );
  const defIdx = src.indexOf("async function assertCanMutateAgent(");
  assert.ok(
    defIdx !== -1,
    "Helper assertCanMutateAgent WAJIB tetap ada di routes.ts (standar guard mutasi agen).",
  );
  const nextIdx = src.indexOf("\n  app.", defIdx);
  const body = src.slice(defIdx, nextIdx === -1 ? defIdx + 2000 : nextIdx);

  assert.match(
    body,
    /getDbRole|ADMIN_USER_IDS/,
    "Status admin tetap ditentukan via DB role dan/atau ADMIN_USER_IDS.",
  );
  assert.match(
    body,
    /decideAgentMutation\s*\(/,
    "assertCanMutateAgent harus menyerahkan keputusan akhir ke decideAgentMutation.",
  );
});

// ── 2. Endpoint mutasi / exfiltration mentah / cost-LLM: wajib assertCanMutateAgent ──
const STRICT_GUARDED: Array<[string, string]> = [
  ["PATCH /api/agents/:id", 'app.patch("/api/agents/:id"'],
  ["PATCH /api/agents/:id/toggle-enabled", 'app.patch("/api/agents/:id/toggle-enabled"'],
  ["PATCH /api/agents/:id/folder", 'app.patch("/api/agents/:id/folder"'],
  ["POST /api/agents/:id/apply-import", 'app.post("/api/agents/:id/apply-import"'],
  ["POST /api/agents/:id/publish-template", 'app.post("/api/agents/:id/publish-template"'],
  ["GET /api/agents/:id/export", 'app.get("/api/agents/:id/export"'],
  ["POST /api/agents/:id/marketing/generate", 'app.post("/api/agents/:id/marketing/generate"'],
  ["POST /api/agents/:id/storytelling/generate", 'app.post("/api/agents/:id/storytelling/generate"'],
  ["POST /api/agents/:id/landing-page/generate", 'app.post("/api/agents/:id/landing-page/generate"'],
  ["POST /api/agents/:id/marketing-kit/generate", 'app.post("/api/agents/:id/marketing-kit/generate"'],
  ["POST /api/agents/:id/generate-ad-copy", 'app.post("/api/agents/:id/generate-ad-copy"'],
  ["POST /api/agents/:id/generate-creative-prompts", 'app.post("/api/agents/:id/generate-creative-prompts"'],
];

for (const [label, literal] of STRICT_GUARDED) {
  test(`${label} dijaga assertCanMutateAgent (anti IDOR / eksfiltrasi / abuse biaya LLM)`, () => {
    const block = routeBlock(literal);
    assert.match(
      block,
      /assertCanMutateAgent\s*\(\s*req\s*,/,
      `Handler ${label} WAJIB memanggil assertCanMutateAgent(req, agent) sebelum memutasi / membaca config privat / menjalankan LLM. ` +
        "Tanpa ini, user mana pun yang login bisa menyalahgunakan agen milik orang lain.",
    );
  });
}

// ── 2b. Aksi DESTRUKTIF/KEPEMILIKAN: wajib assertOwnerOrAdminAgent (BUKAN editor) ──
// delete & archive adalah aksi kepemilikan; kolaborator Editor TIDAK boleh.
// Guard ketat ini sengaja tidak melakukan lookup peran kolaborator sehingga
// editor otomatis 403. Lihat assertOwnerOrAdminAgent di routes.ts.
const OWNER_ONLY_GUARDED: Array<[string, string]> = [
  ["PATCH /api/agents/:id/archive", 'app.patch("/api/agents/:id/archive"'],
  ["DELETE /api/agents/:id", 'app.delete("/api/agents/:id"'],
];

for (const [label, literal] of OWNER_ONLY_GUARDED) {
  test(`${label} dijaga assertOwnerOrAdminAgent (owner/admin saja — editor ditolak)`, () => {
    const block = routeBlock(literal);
    assert.match(
      block,
      /assertOwnerOrAdminAgent\s*\(\s*req\s*,/,
      `Handler ${label} WAJIB memanggil assertOwnerOrAdminAgent(req, agent) — aksi destruktif/kepemilikan ` +
        "hanya boleh oleh owner atau admin, BUKAN kolaborator Editor.",
    );
  });
}

// ── 3. Ekspor dokumen (ebook/docgen): gate anti-eksfiltrasi KB agen privat ──
// Berbeda dari grup ketat: ekspor "render" ini SENGAJA tetap terbuka untuk
// agen sistem bersama (tanpa userId) & agen publik (isPublic). Yang wajib
// ditutup hanyalah membocorkan KB agen PRIVAT milik user lain.
const DOC_EXPORT_GATED: Array<[string, string]> = [
  ["GET /api/agents/:id/export/ebook", 'app.get("/api/agents/:id/export/ebook"'],
  ["GET /api/agents/:id/export/docgen", 'app.get("/api/agents/:id/export/docgen"'],
];

for (const [label, literal] of DOC_EXPORT_GATED) {
  test(`${label} menolak KB agen privat milik user lain (gate isPublic + 403)`, () => {
    const block = routeBlock(literal);
    assert.match(
      block,
      /isPublic/,
      `${label} harus mempertimbangkan agent.isPublic dalam gate akses.`,
    );
    assert.match(
      block,
      /status\(403\)|status:\s*403/,
      `${label} harus mengembalikan 403 untuk agen privat milik user lain.`,
    );
  });
}

// ── 4. Sanity: aktivasi agen (Tahap 14) tetap dijaga sebelum mutasi singleton global ──
test("POST /api/agents/:id/activate mengecek kepemilikan/admin sebelum setActiveAgent (Tahap 14)", () => {
  const block = routeBlock('app.post("/api/agents/:id/activate"');
  const guardIdx = block.search(/assertCanMutateAgent\s*\(|ownerId|isOwner|isAdmin/);
  const mutateIdx = block.indexOf("setActiveAgent");
  assert.ok(guardIdx !== -1, "activate harus punya cek kepemilikan/admin.");
  assert.ok(mutateIdx !== -1, "activate harus memanggil setActiveAgent.");
  assert.ok(
    guardIdx < mutateIdx,
    "Cek otorisasi HARUS sebelum setActiveAgent (state aktif = singleton global app-wide).",
  );
});
