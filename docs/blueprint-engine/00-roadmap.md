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

## Fase 3 — AI Organization (Dialog → Blueprint → Konfigurasi melahirkan TIM agen)
> Prinsip sama: aditif, bertahap, berhenti & review. Pengguna tetap no-code
> (Dialog–Blueprint–Konfigurasi); yang bertambah = alur itu bisa merancang satu
> *organisasi* agen, bukan cuma satu chatbot.

| Tahap | Engine / Deliverable | Sentuh kode app? | Status |
|------|----------------------|------------------|--------|
| **18** | **Organization Blueprint Schema** — model data JSON untuk organisasi AI (banyak anggota memakai ulang single-agent Blueprint + struktur kolaborasi `localId`) | Tidak (tipe/skema baru, belum disambung) | ✅ SELESAI — `shared/blueprint/organization-blueprint-schema.ts` + `18-organization-blueprint-schema.md` + `tests/organization-blueprint-schema.test.ts` |
| **19** | **Organization Mapping Engine** — `OrganizationBlueprint` → rencana N agen (pakai ulang single-agent mapping per anggota) + wiring orchestrator→sub-agen by `localId`; **sumber-kebenaran wiring = `structure.edges` saja** (field linkage anggota dibuang), `isOrchestrator` dipaksa dari `role` | Ya (fungsi murni, belum disambung) | ✅ SELESAI — `server/services/blueprint-engine/organization-mapping-engine.ts` + `tests/organization-mapping-engine.test.ts` (7/7) |
| **20** | **Organization Configuration Engine** — materialisasi tim secara atomik (2 fase: create agen+anak → wiring), resolve `localId → agentId`, stamp `ownerUserId` di SETIAP agen, `dryRun` default, **penulisan nyata WAJIB `storage.runInTransaction`** (kalau tak ada → batal, bukan tulis parsial); anak ditulis `strict` agar gagal = rollback | Ya (engine baru, belum disambung) | ✅ SELESAI — `server/services/blueprint-engine/organization-configuration-engine.ts` + `tests/organization-configuration-engine.test.ts` (7/7) |
| **21** | **API + Transactional Storage wiring** — `DbStorage.runInTransaction` nyata (tx-scoped `ConfigStorage`, 6 metode create/update di-parametrasi `exec` opsional, cache di-guard `if(exec===db)`) + route `POST /api/organization/{analyze,configure}` (stateless, `isAuthenticated`, `configure` default `dryRun:true`, stamp `ownerUserId`) | Ya (storage + route baru) | ✅ SELESAI — `server/organization-engine-routes.ts` + `runInTransaction` di `server/db-storage.ts` |
| **22** | **UI Wizard Organisasi** — halaman wizard frontend yang membangun `OrganizationBlueprint` client-side & memakai API Tahap 21 (auth-gated, additif) | Ya (page + route + kartu dashboard; flow lama tak diubah) | ✅ SELESAI — `client/src/pages/organization-builder.tsx` (route `/organization-builder`): intro (nama+misi) → members (tambah/hapus anggota, role orchestrator/specialist/support, tugas, prompt lanjutan opsional) → review (`/analyze` lint+plan+wiring) → configure (preview `dryRun` lalu create `dryRun:false`). Topologi di-gate keras: tepat 1 Ketua Tim + ≥1 anggota lain; state error khusus saat `applied:false`. Kartu "Rakit Tim AI" di Aksi Cepat Dashboard. |
| **23** | **Organization Dialogue / Inference Engine** — engine MURNI (tanpa DB/LLM/UI) versi org dari Dialogue (Tahap 5) + Inference (Tahap 6): dialog org-level (nama+misi), `suggestTeamComposition(misi)` deterministik (domain→1 Ketua Tim + spesialis), `inferOrganization` (isi meta org + PAKAI ULANG `inferBlueprint` per anggota + auto `structure.edges` bila kosong + `overallConfidence` agregat). Menjaga kontrak sumber-kebenaran wiring (`stripMemberWiring`). Semua fungsi pure (fresh copy di SEMUA cabang). Belum disambung ke route/UI. | Tidak (engine murni, belum disambung) | ✅ SELESAI — `server/services/blueprint-engine/organization-dialogue-engine.ts` + `tests/organization-dialogue-engine.test.ts` (18/18) |
| **24** | **Penyambungan dialog org ke wizard** — mode "Susun otomatis dari misi" di `/organization-builder`. Route tipis read-only `POST /api/organization/suggest` (auth-gated, validasi misi non-kosong, clamp `maxSpecialists` 1–5) memanggil `suggestTeamComposition` (Tahap 23) → `{ domain, members }`. Tombol "Susun Otomatis" di step intro mengisi draft anggota lalu pengguna meninjau lewat alur lama (analyze→preview→create). Jalur manual TAK diubah (aditif). | Ya (route baru + tombol; flow lama utuh) | ✅ SELESAI — `POST /api/organization/suggest` + tombol `btn-compose-auto` di `organization-builder.tsx` |
| **25** | **Kontrol auto-compose di wizard** — buka param `maxSpecialists` (1–5, default 3) lewat dropdown "Jumlah Spesialis" di kartu auto-compose, dan tampilkan bidang (`domain`) terdeteksi secara persisten sebagai badge + ubah teks bantuan di step anggota. State `composedDomain` di-clear pada jalur manual & `reset()`. Murni klien (TANPA perubahan server/engine). Skor kesiapan SENGAJA tak ditambah (jenuh ~100% karena `buildOrg()` mengisi semua field). | Ya (klien saja; flow lama utuh) | ✅ SELESAI — dropdown `select-max-specialists` + badge `badge-composed-domain` di `organization-builder.tsx` |
| **26** | **Penyambungan inferensi per-anggota ke wizard ("Sempurnakan Detail")** — buka engine `inferOrganization` (Tahap 23) lewat route tipis read-only `POST /api/organization/infer` ({organization} → {overallConfidence, edgesAdded, memberInferences, warnings, members[]}). Tombol "Sempurnakan Detail" di step anggota memanggil infer atas org versi **RAW** (`buildOrg(fillDefaults=false)` — TIDAK mengisi systemPrompt default agar inferensi tahu field kosong), lalu mengisi HANYA field draft yang kosong (responsibility, systemPrompt) — input pengguna TAK PERNAH ditimpa. Tampilkan `overallConfidence` sebagai "Kesiapan setelah penyempurnaan %". Read-only; flow analyze→preview→create utuh. | Ya (route baru read-only + tombol; flow lama utuh) | ✅ SELESAI — `POST /api/organization/infer` + tombol `btn-enrich-members` + readout `text-readiness` di `organization-builder.tsx` |
| **27** | **Regenerasi anggota tunggal ("Buatkan/Tulis ulang otomatis")** — tombol per-kartu anggota (`btn-regenerate-{localId}`) di bagian instruksi sistem lanjutan. `regenerateMember(localId)` membangun org **RAW** (`buildOrg(false)`), mengosongkan HANYA `systemPrompt` anggota target di payload agar inferensi membuatkannya, POST ke `/api/organization/infer`, lalu menimpa HANYA `systemPrompt` anggota itu — judul/tugas anggota & anggota lain TAK tersentuh. Label tombol toggle "Buatkan otomatis" (kosong) vs "Tulis ulang otomatis" (sudah ada isi); disabled saat sibuk/judul kosong. Read-only; flow analyze→preview→create utuh. | Ya (klien saja, reuse route /infer; flow lama utuh) | ✅ SELESAI — tombol `btn-regenerate-{localId}` + `regenerateMember()` di `organization-builder.tsx` |
| 28+ | (lanjutan opsional: dialog org-level interaktif / simpan-edit tim) | Ya | ⏳ BELUM |

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
