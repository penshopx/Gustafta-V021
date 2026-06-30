# GUSTAFTA → AI Organization Builder — Master Roadmap

> **Visi:** Gustafta adalah **AI Organization Builder** — platform yang mengubah
> pengetahuan manusia menjadi organisasi AI yang mampu berpikir, berkolaborasi,
> menghasilkan karya, dan membangun bisnis secara berkelanjutan.

## Prinsip kerja (WAJIB)
1. **Tidak merombak aplikasi.** UI & Builder yang sudah ada TIDAK diubah. Aplikasi lama tetap hidup di setiap tahap.
2. **Aditif & bertahap.** Setiap tahap menambah "engine" baru di belakang layar — awalnya tersembunyi/belum terhubung — lalu disambungkan pelan-pelan.
3. **Builder = tujuan akhir, bukan awal.** Cara mengisi Builder yang berubah (dari Blueprint), bukan Builder-nya.
4. **Per tahap, berhenti & review.** Tidak loncat. Selesaikan satu tahap, tunjukkan hasil, baru lanjut.

## Pergeseran paradigma
**Lama:** `User → isi Form Builder → Chatbot`
**Baru:** `Dialog (Socratic) → AI Blueprint → Konfigurasi → Builder terisi otomatis → Ekosistem (chatbot, landing, mini apps, marketing, dst.)`

Trilogi Gustafta = framework berpikir di baliknya: **Dialog → Kolaborasi → Kreasi** (Insight → Blueprint → Value).

## Tahapan (urutan eksekusi)
| Tahap | Engine / Deliverable | Sentuh kode app? | Status |
|------|----------------------|------------------|--------|
| **1** | **AUDIT Builder** — katalog semua field konfigurasi (dokumen Markdown) | Tidak (read-only) | ✅ SELESAI — lihat `01-builder-audit.md` |
| **2** | **Blueprint Schema** — model data JSON yang mewakili seluruh konfigurasi Builder | Tidak (tipe/skema baru, belum disambung) | ✅ SELESAI — `shared/blueprint/blueprint-schema.ts` + `02-blueprint-schema.md` |
| **3** | **Mapping Engine** — peta setiap field Blueprint → field Builder | Tidak (fungsi murni, belum disambung) | ✅ SELESAI — `server/services/blueprint-engine/mapping-engine.ts` + `03-mapping-engine.md` |
| **4** | **Configuration Engine** — baca Blueprint, isi otomatis Builder (user tetap bisa edit) | Ya (engine baru, UI tak diubah, belum disambung) | ✅ SELESAI — `server/services/blueprint-engine/configuration-engine.ts` + `04-configuration-engine.md` |
| 5 | **Dialogue Engine V2** — wawancara Socratic adaptif, pertanyaan sesedikit mungkin | Ya (engine baru, pure, belum disambung) | ✅ SELESAI — `server/services/blueprint-engine/dialogue-engine.ts` + `05-dialogue-engine.md` |
| 6 | **Inference Engine** — simpulkan field dari sedikit input, beri alasan | Ya (engine baru, pure, belum disambung) | ✅ SELESAI — `server/services/blueprint-engine/inference-engine.ts` + `06-inference-engine.md` |
| 7 | **Confidence Engine** — skor keyakinan per field (bukan sekadar "completion %") | Ya (engine baru, pure, belum disambung) | ✅ SELESAI — `server/services/blueprint-engine/confidence-engine.ts` + `07-confidence-engine.md` |
| 8 | **Gap Analysis Engine** — cari field kosong/inkonsisten + rekomendasi | Ya (engine baru, pure, belum disambung) | ✅ SELESAI — `server/services/blueprint-engine/gap-analysis-engine.ts` + `08-gap-analysis-engine.md` |
| 9 | **Critic / Simulation / Evolution Engine** — kritik mutu, simulasi customer, belajar dari history | Ya (3 engine baru, pure, belum disambung) | ✅ SELESAI — `critic-engine.ts` + `simulation-engine.ts` + `evolution-engine.ts` + `09-critic-simulation-evolution.md` |
| **10** | **API Wiring** — sambung engine 1–9 ke HTTP API (stateless, klien bawa Blueprint JSON), tanpa UI baru | Ya (route baru; UI/Builder TIDAK diubah) | ✅ SELESAI — `server/blueprint-engine-routes.ts` → `/api/blueprint/{start,answer,state,analyze,configure}` |
| **11** | **UI Wizard** — halaman wizard frontend yang memakai API Tahap 10 (auth-gated, additif) | Ya (page baru; flow lama tak diubah) | ✅ SELESAI — `client/src/pages/blueprint-builder.tsx` (route `/blueprint-builder`): intro → dialog → analisis → configure (preview `dryRun` lalu create) |
| **12** | **Discoverability** — pintu masuk ke wizard dari Dashboard & landing `/blueprint`, tanpa mengubah CTA dialog lama | Ya (link additif) | ✅ SELESAI — kartu "Rancang Agen" di Aksi Cepat Dashboard + CTA sekunder di hero & CTA final `/blueprint` |
| **13** | **Builder Handoff** — "Builder terisi otomatis": agen hasil wizard dimiliki user & dibuka langsung di Builder | Ya (fix ownership create + tombol handoff) | ✅ SELESAI — `/configure` mode create men-stamp `ownerUserId` (agen muncul di dashboard pemilik & bisa di-update); tombol "Buka di Builder" aktifkan agen → `/dashboard` |
| **14** | **Security Hardening** — tutup celah otorisasi pada aktivasi agen (lanjutan temuan Tahap 13) | Ya (guard authz; perilaku normal tak diubah) | ✅ SELESAI — `POST /api/agents/:id/activate` kini cek eksistensi + kepemilikan (`403` bila bukan pemilik/admin) **sebelum** memutasi state aktif global; admin tetap bisa aktivasi apa pun |
| **15** | **Security Hardening lanjutan** — sapu seluruh keluarga `/api/agents/:id/*` dari celah broken-access-control (IDOR mutasi, eksfiltrasi config/KB, abuse biaya LLM) | Ya (guard authz; perilaku normal tak diubah) | ✅ SELESAI — helper `assertCanMutateAgent(req, agent)` (pemilik/admin; agen sistem → admin-only) diterapkan pada PATCH `:id`/toggle-enabled/archive/folder, DELETE `:id`, POST apply-import & publish-template, GET `:id/export` (mentah), dan 6 endpoint generasi AI (marketing/storytelling/landing-page/marketing-kit/ad-copy/creative-prompts). `export/ebook` & `export/docgen` diberi gate anti-eksfiltrasi KB agen privat milik user lain (tetap izinkan agen sistem & agen publik). |
| **16** | **Regression Tests (authz)** — kunci hasil Tahap 14–15 agar guard tak terhapus diam-diam saat refactor | Ya (test baru saja; kode app tak diubah) | ✅ SELESAI — `tests/agent-authz-guard.test.ts` (`node:test` + `tsx --test`, statis baca source). Cek: helper delegasi ke `decideAgentMutation`, 14 endpoint mutasi/exfiltrasi/cost wajib panggil guard, `export/ebook`+`docgen` gate `isPublic`+403, dan `activate` cek authz SEBELUM `setActiveAgent`. |
| **17** | **Authz decision unit tests** — validasi SEMANTIK runtime keputusan otorisasi (bukan sekadar keberadaan guard di source) | Ya (refactor kecil + test) | ✅ SELESAI — logika keputusan diekstrak ke fungsi murni `server/lib/agent-authz.ts` (`decideAgentMutation`); `assertCanMutateAgent` menghitung `userId`/`isAdmin` (DB role) lalu mendelegasi. `tests/agent-authz-decision.test.ts` menguji matriks aktor: anonim→401, admin→boleh (termasuk agen sistem/orang lain), pemilik→boleh, non-admin atas agen sistem→403, non-pemilik→403, + defense-in-depth (userId kosong tetap 401 walau isAdmin). |

## Tahap 10 — catatan penyambungan API
- **Stateless:** tak ada tabel DB untuk Blueprint in-progress; klien mengirim seluruh Blueprint JSON tiap request. Validasi via `blueprintSchema`.
- **`/configure` = satu-satunya jalur tulis** dan **aman secara default**: `dryRun` dianggap `true` kecuali klien kirim `dryRun:false` eksplisit.
- **Otorisasi:** mode `update` wajib pemilik agen (`agent.userId`) atau admin (403 bila bukan). Semua endpoint di balik `isAuthenticated`.
- **Pipeline tiap perubahan:** `applyAnswers` → `inferBlueprint` → `applyConfidence` → `getDialogueState`.
- **Langkah lanjut:** ✅ Tahap 11 (UI wizard `/blueprint-builder`) & Tahap 12 (discoverability) SELESAI.

## Tempat kerja engine (rencana, belum dibuat)
Direktori service baru terpisah dari Builder, mis. `server/services/blueprint-engine/` —
sehingga Builder existing tidak tersentuh sampai Tahap 4 menyambungkannya.

## Konsep penting yang diadopsi
- **AI Blueprint™** = "DNA" organisasi AI (bukan sekadar file): Identity, Persona, Policy, Knowledge, Agent, Mini Apps, Deliverables, Conversion, Marketing, Revenue, dst.
- **Confidence, bukan Completion** — setiap field punya skor keyakinan; yang ditanya hanya yang confidence-nya rendah.
- **Living Blueprint** — Blueprint terus berkembang makin kaya seiring dialog & pemakaian.
- **AI Organization** — output akhir bukan 1 chatbot, tapi organisasi agen (OpenClaw/MultiClaw) berstruktur, ber-workflow, dengan hak akses antar-agen.
