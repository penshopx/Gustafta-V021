# Gustafta
Gustafta is an AI chatbot builder platform that enables users to create, configure, and deploy intelligent conversational assistants, including the integrated LexCom Legal AI system.

## Run & Operate
- **Run Development Server**: `npm run dev`
- **Build**: `npm run build`
- **Typecheck**: `npm run check`
- **Run Tests**: `npx tsx --test tests/*.test.ts` (Node built-in `node:test`; tidak ada script `npm test`). Mis. regresi authz: `npx tsx --test tests/agent-authz-guard.test.ts`
- **Codegen (Drizzle)**: `npx drizzle-kit generate`
- **DB Push (Drizzle)**: `npx drizzle-kit push`
- **Environment Variables**: `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY` (for Midtrans payment integration)

## Stack
- **Frontend**: React 18 + TypeScript, Tailwind CSS, shadcn/ui, TanStack React Query, Vite
- **Backend**: Express 5 + TypeScript, Node.js (`tsx`), Drizzle ORM + Zod, PostgreSQL
- **Payment**: Scalev.id (menggantikan Midtrans)
- **AI Models**: OpenAI (gpt-4o-mini/gpt-4o/gpt-4-turbo/gpt-3.5-turbo), DeepSeek (deepseek-chat/deepseek-reasoner), Qwen (qwen-turbo/qwen-plus/qwen-max), Google Gemini (gemini-1.5-flash/gemini-1.5-pro/gemini-2.0-flash), Anthropic via proxy (claude-3-haiku/claude-3-sonnet/claude-3-5-sonnet), Custom

## Where things live
- **Database Schema**: `shared/schema.ts` (source of truth; `db/schema.ts` is symlinked)
- **API Routes**: `server/routes.ts`
- **Inter-Agent API v2**: `server/routes.ts` ~line 2806 (orchestration block), ~line 3926 (`callAgentInternal` v2)
- **Legal AI Configuration**: `server/lib/legal-agents.ts`
- **Legal Landing/Chat**: `client/src/pages/legal-landing.tsx` (route `/legal`), `client/src/pages/legal-chat.tsx` (route `/legal/chat`)
- **Chaesa Lexbot Widget**: `client/src/components/chaesa-widget.tsx`
- **MultiClaw Orchestration Planner**: `client/src/components/agentic-ai-panel.tsx`
- **Rakit Tim Agen (Trilogi)**: `client/src/pages/tutor-builder.tsx` (route `/tutor-builder`)
- **Trilogi OpenClaw Chat**: `client/src/pages/trilogi-chat.tsx` (route `/trilogi-chat/:orchestratorId`)
- **Test Tracker**: `client/src/pages/test-tracker.tsx` (route `/test-tracker`) — 6 tab: Tender + Federation + Pilot + KONSTRA + AI Tutor + SBUClaw
- **RAB Kalkulator Otomatis**: `client/src/pages/rab-kalkulator.tsx` (route `/rab-kalkulator`) — GPT-4o JSON → tabel terstruktur + CSV export + PDF export (jsPDF). Backend: `POST /api/tools/rab-kalkulator`.
- **AI Vision K3 Inspector**: `client/src/pages/k3-vision.tsx` (route `/k3-vision`) — upload foto → GPT-4o Vision → laporan temuan K3 + skor kepatuhan. Backend: `POST /api/tools/k3-vision`.
- **Generator Penawaran/Proposal Jasa**: `client/src/pages/proposal-jasa.tsx` (route `/proposal-jasa`) — form kebutuhan calon klien Jasa Order → GPT-4o JSON → draf proposal terstruktur (ringkasan, solusi, lingkup, tim agen, tahapan, estimasi setup+bulanan, syarat, asumsi, penutup) + salin/unduh .txt. Backend: `POST /api/tools/proposal-jasa` (public tool, grounded via `buildSalesPlaybookDoc`+`buildGustaftaFoundationDoc` + harga kanonik SERVICE_TIERS/HOSTING; honest [ASUMSI], ◆ gerbang manusia). On-demand (per klien), BUKAN pipeline harian. **Claw-aware (Fase F)**: prompt di-ground dengan `formatClawCatalogForPrompt()` (dari `CLAW_PACKAGES`) → bila kebutuhan klien cocok, output field `claw_rekomendasi` menawarkan PAKET claw sebagai "manajemen AI siap pakai" (departemen). Nama divalidasi ke katalog via `resolveClawPackageName()` (cegah claw ngarang), wajib sebut biaya lisensi premium+bulanan tersendiri. Tetap sertakan `tim_agen` custom. Tes: `tests/claw-packages.test.ts`.
- **AI Tools Hub**: `client/src/pages/ai-tools-hub.tsx` (route `/ai-tools`) — directory semua AI tools standalone + penjelasan Model Router.
- **Model Router**: `server/lib/model-router.ts` — utility `chooseModel(task)` + `callWithRouter()` untuk intelligent LLM routing: GPT-4o (orchestration/vision), DeepSeek (math/RAB), Gemini (large docs), Qwen (data extraction).
- **Pipeline Marketing Gustafta**: `server/lib/research-feed.ts` → `runResearchSweep()` (dijadwalkan harian 06:30 WIB di `server/index.ts`). 4 tahap berurutan fire-and-forget: (1) RISET feed → (2) MATERI IKLAN per platform (`generateDailyAdMaterials`, agen `mkt-materi-iklan` id 1522) → (3) SEQUENCE RETENSI email/WA (`generateDailyRetentionSequence`, agen `mkt-retensi-sequence` id 1553; grounded via `buildGustaftaFoundationDoc`/KB `Fondasi Gustafta` = visi+Trilogi+produk/jasa) → (4) AMUNISI JUALAN (`generateDailyClosingKit`, agen `mkt-closing-asisten` id 1564: keberatan+jawaban, skrip closing WA, follow-up prospek; grounded via `buildSalesPlaybookDoc`/KB `Fondasi Penjualan` + Fondasi Gustafta; agen juga chatbot bantu jualan RAG). Orkestrator: Kepala Tim Marketing (id 1511, 7 sub: KONTEN/MEDSOS/IKLAN/MATERI_IKLAN/RISET/RETENSI/CLOSING). Semua draf, ◆ gerbang manusia. Detail: `docs/marketing-pipeline.md`.
- **Blueprint Engine (Tahap 1–10)**: engine pure di `server/services/blueprint-engine/*` (Dialogue/Inference/Confidence/Gap/Critic/Simulation/Evolution + Mapping/Configuration), skema di `shared/blueprint/blueprint-schema.ts`. API wiring (Tahap 10): `server/blueprint-engine-routes.ts` → `POST /api/blueprint/{start,answer,state,analyze,configure}` (stateless, `isAuthenticated`). `/configure` = satu-satunya jalur tulis, **safe-by-default `dryRun`** (tulis hanya bila `dryRun:false` eksplisit); mode `update` wajib pemilik/admin. UI Wizard (Tahap 11): `client/src/pages/blueprint-builder.tsx` (route `/blueprint-builder`, auth-gated) — alur intro/intent → dialog (render `dialogue.nextQuestions` per `inputType`) → analisis (scorecard confidence/gap/critique/simulation) → configure (preview `dryRun:true` lalu create `dryRun:false`). Terpisah dari `dialog-gustafta.tsx` (lead-gen publik). Pintu masuk (Tahap 12): kartu "Rancang Agen" di Aksi Cepat `dashboard.tsx` + CTA sekunder di hero & CTA final `/blueprint` (tombol dialog lama tak diubah). Builder Handoff (Tahap 13): `/configure` mode `create` men-stamp `ownerUserId` (sesi) ke agen baru lewat `ConfigurationOptions.ownerUserId` → agen muncul di dashboard pemilik & bisa di-`update`; tombol "Buka di Builder" di wizard meng-aktivasi agen lalu navigasi ke `/dashboard`. Roadmap: `docs/blueprint-engine/00-roadmap.md`.

## Architecture decisions
- **5-Level Modular Hierarchy**: Agents organized Master → Series HUB → Sub-HUB → Specialist → Deep Specialist.
- **Two-Panel Dashboard Layout**: Separates global navigation from selected content.
- **Multi-Provider LLM Fallback**: Chain: OpenAI → DeepSeek → Qwen → Gemini.
- **Inter-Agent API v2 (L2.5)**: Orchestrator agents call sub-agents in parallel via `callAgentInternal()` (25s AbortController timeout, min 1500 maxTokens, conversation history passed). Results injected as `LAPORAN SUB-AGEN` block before orchestrator synthesizes. SSE events: `orchestrating_start`, `sub_agent_start`, `sub_agent_done`, `aggregating`. Config via `agenticSubAgents` jsonb on agents table.
- **FEDERATION_MODE v2 Guard**: Seed checks for `FEDERATION_MODE v2` marker in prompts to avoid overwriting upgraded orchestrator prompts.

## Product
- **Kerangka Produk (acuan resmi — 3 sumbu terpisah, jangan dicampur)**:
  1. **Cara dapat chatbot (3 jalur) + program Creator**: (a) **Chatbot Biasa** (kosongan, user merakit) = lisensi standar + bulanan · (b) **Chatbot Premium** (siap pakai, dibuat Gustafta/Creator) = lisensi premium (lebih tinggi) + bulanan · (c) **Jasa Order** (custom, belum ada di katalog, Gustafta merakit) = biaya setup sekali (termasuk lisensi) + bulanan. **Biaya bulanan (hosting + token) dikenakan ke SEMUA produk** (biasa & premium) dan mengikuti 4 tier platform; 100% ke Gustafta. **Beda chatbot biasa vs premium HANYA di biaya lisensi** (premium tidak dirakit sendiri). **Program Creator (marketplace)**: Creator menjual chatbot premium di toko Gustafta — bagi hasil **80% Creator / 20% Gustafta dihitung dari biaya LISENSI saja** (bulanan tetap 100% ke Gustafta). **Semua pengguna wajib punya lisensi (hak pakai)**; di jalur Jasa lisensi tidak ditagih terpisah. Konstanta: `MARKETPLACE`/`MARKETPLACE_INFO` di `pricing.ts`.
  2. **Tier langganan platform (4)**: Starter → Profesional → Bisnis → Enterprise. Naik tier = naik kuota + tambah chatbot premium + tambah Mini Apps. Angka di `client/src/data/pricing.ts`, gating di `shared/feature-plans.ts`.
  3. **Starter Kit = produk onboarding sekali bayar (Rp 245rb), BUKAN tier** (lisensi + panduan + trial 7 hari; pintu masuk lintas-tier). Jangan sejajarkan dengan tier "Starter". Di jalur Jasa, Starter Kit otomatis dibundel **gratis** (tanpa tagihan tambahan) — yang diberikan di situ panduan/enablement, bukan lisensi kedua. Detail: `.agents/memory/gustafta-pricing-model.md`.
- **AI Chatbot Builder**: Create, configure, and deploy intelligent conversational agents.
- **LexCom Legal AI**: Integrated system with 12 specialized legal agents and a floating "Chaesa Lexbot" widget.
- **Federation Layer (131 hubs — COMPLETE)**: 131 hub orchestrators with `agenticSubAgents` configured, SYNTHESIS ORCHESTRATOR marker, SCORECARD/WIN PROBABILITY 4-dimension table, T5-HANDOVER, F3-FALLBACK MODE, MASTER STANDAR v2.0 — semua 129/129 complete.
- **ABD v1.1 Upgrade (934/944 agents — COMPLETE)**: SBU (339) + SKK (53) + ASKOM/LSP (52) + Universal (609). Marker per kategori: `SBU_ABD_v1.1_UPGRADED`, `SKK_ABD_v1.1_UPGRADED`, `ASKOM_ABD_v1.1_UPGRADED`, `ABD_v1.1_UPGRADED`. 10 agen sisa seeded ABD-compliant by design.
- **Mini Apps (43 types — COMPLETE)**: Registered in schema.ts (`miniAppTypeSchema`) & mini-apps-panel.tsx (both 43, in sync). 26 tipe AI-powered punya handler di `/api/mini-app/:id/run` (server/routes.ts); 17 tipe "basic" (checklist, calculator, dll.) berfungsi sebagai template data terstruktur tanpa AI-run (by design). Hub cards: violet Kreator, emerald Bekerja, orange Berusaha.
- **Dynamic Knowledge Base**: Hierarchical classification, versioning, source attribution, multiple upload types.
- **Chatbot Templates & Gustafta Store**: Public marketplace with payment integration.
- **Gustafta Apps Feature Access System**: Plan-gated. Tiers: `free`(0) `starter`(1) `profesional`(2) `bisnis`(3) `enterprise`(4). Source: `shared/feature-plans.ts`. Hook: `use-feature-access.ts`. Gate: `feature-gate.tsx`. Admin activates via `POST /api/subscriptions/activate/:id`.
- **Kelas Premium 1–4 (band harga LISENSI)**: Sumbu harga lisensi premium berjenjang. Sumber tunggal `shared/premium-classes.ts` (`priceForClass`/`isPremiumClass`/`DEFAULT_LICENSE_PRICE`=299rb/`resolveLicensePrice`). Band K1=Rp1jt · K2=Rp2,5jt · K3=Rp5jt · K4=Rp10jt. **Harga lisensi (sekali bayar) = kolom `agents.licensePrice` (int nullable), TERPISAH dari `agents.monthlyPrice`** (bulanan hosting/token). Harga jual lisensi efektif SELALU via `resolveLicensePrice(licenseClass, licensePrice)` (band bila premium → licensePrice bebas → DEFAULT). Bila berkelas, `licensePrice` diikat ke band; enforcement berlapis: create route (validasi range) + PATCH (kelas EFEKTIF body∨record) + `createAgent`/`updateAgent` storage backstop. Marketplace 80/20 tercatat di `storeOrders` (`agentId`,`creatorUserId`,`creatorShare`,`platformShare`) pada `/api/store/order` (agentId & productId→agen) + `/order/manual`. `mapAgentRow` WAJIB expose licenseClass+licensePrice. Terpisah dari `premiumClass` (standard/private) & 4 tier bulanan. UI: `product-settings-panel.tsx`, badge di `store.tsx`. Detail: `.agents/memory/gustafta-pricing-model.md`.

## MultiClaw Suite (80 halaman)
Semua pakai `PremiumPageGuard` feature="advanced_ai_tools" requiredPlan="profesional". SSE streaming, sub-agent panel dots, legend strip, 6 sample prompts.

**Paket Bidang (model Kombinasi)**: `shared/claw-packages.ts` = sumber tunggal 10 paket bidang (67 route) + `BASE_CLAW_ROUTES` (13 claw dasar Starter) = 80 claw. Aturan: Profesional pilih 2 paket (`PRO_PACKAGE_SLOTS`), pilihan TERKUNCI setelah simpan (atomic claim, reset via `POST /api/admin/claw-packages/reset/:userId`); Bisnis/Enterprise buka semua; paket terpilih meng-override feature flag lama (claw eks-Bisnis ikut terbuka). Gating di `PremiumPageGuard` via `useLocation()` + `packageForRoute()` — TANPA edit 80 halaman claw. API: `GET /api/claw-packages/my`, `POST /api/claw-packages/select`. Kolom: `users.selected_claw_packages varchar[]`. UI pilih: `client/src/pages/paket-bidang.tsx` (route `/paket-bidang`). Hook: `use-claw-packages.ts`.

Endpoint: `GET /api/{nama}-claw/orchestrator` → `{ id, name, tagline, avatar }`. Semua route pakai `getAgentBySlug` sebagai primary lookup — JANGAN ganti ke hardcoded ID.

**Tabel lengkap 80 route (rute → nama → agen → hub slug → theme): `docs/multiclaw-routes.md`.** Saat menambah/mengubah claw, update tabel di docs itu (bukan di sini).

## Whitelabel Partner Mode
- **Deteksi mitra per host**: hook `client/src/hooks/use-partner-branding.ts` → `GET /api/partner/by-host?host=` (null bila bukan host mitra). Tabel `partners` (kolom `host` unique, `active`, `brand_name`, `logo_url`, `primary_color`, `tagline`, `description`, `contact_phone`, `contact_email`, `default_agent_id`, `hide_platform_branding`). Admin: `client/src/pages/admin-partners.tsx`.
- **Halaman partner-aware**: `partner-landing.tsx` (root `/` di host mitra; CTA utama → `/dialog-gustafta`, tombol "Chat Asisten AI" bila `defaultAgentId` ada), `shared-header.tsx`, `dialog-gustafta.tsx` (greeting/judul/avatar/toast/share/WA/footer/fallback blueprint pakai brand mitra; WA ke `contactPhone` mitra), `dashboard.tsx` (banner upsell Gustafta disembunyikan, teks "Dialog Gustafta"→"Dialog Konsultasi", logo/nama sidebar+welcome pakai mitra, kartu `/packs` & `/monitor-marketing` disembunyikan).
- **Aturan**: SEMUA halaman baru yang tampil di host mitra wajib cek `usePartnerBranding()` sebelum menampilkan branding/upsell Gustafta. Uji lokal: insert row `partners` dengan `host='localhost'`, hapus setelah selesai.

## Tender Data Relay (SIRUP)
- `sirup.lkpp.go.id` TIDAK bisa diakses dari hosting ini (blokir geo/IP) — scraper terjadwal selalu gagal ke data demo. `isb.lkpp.go.id` reachable (jalur resmi, butuh akun/token LKPP — rencana jangka panjang).
- Solusi sementara: **relay eksternal**. Skrip `scripts/tender-relay.mjs` dijalankan di komputer/server Indonesia (Node 18+, tanpa dependensi) → kirim ke `POST /api/tender-ingest` (auth header `x-tender-ingest-key` = secret `TENDER_INGEST_KEY`, timing-safe compare, batch maks 500, upsert dedup per `tenderId`).
- Data masuk ke sumber `sourceType="sirup"` (dibuat otomatis "SIRUP LKPP (Relay Eksternal)"). Alert harian 08:00 WIB (`runTenderAlertNotification` di `server/index.ts`) memakai tabel `tenders` — otomatis bekerja setelah relay jalan.

## User preferences
Preferred communication style: Simple, everyday language.

## Gotchas
- **FEDERATION_MODE v2 marker**: Embedded in DB prompts for upgraded orchestrators. Seed checks this. NEVER remove.
- **Agent Cache 5 min TTL**: Restart server after bulk SQL prompt/agenticSubAgents updates.
- **LexCom Admin Key**: Admin KB uploads require `x-legal-admin-key` header.
- **Disabled Agents**: `/api/chat/config/:agentId` and `/api/widget/config/:agentId` return 503 if disabled.
- **callAgentInternal signature**: `(agentId, userMessage, conversationHistory?, timeoutMs=25000)` — v2.
- **Sub-agent maxTokens**: `Math.max(1500, Math.min(3000, subAgent.maxTokens ?? 1500))` — min guaranteed 1500.
- **FALLBACK template**: `[ASUMSI: {nilai} | basis: {regulasi/heuristik} | verifikasi-ke: {pihak}]`
- **agenticSubAgents JSON format**: `[{"role": "KODE", "agentId": 123, "description": "..."}]`
- **Orchestrator routes**: SELALU gunakan `getAgentBySlug(slug)` sebagai primary lookup. JANGAN `getAgent("hardcoded-id")` — ID drift setelah re-seed menyebabkan route mengembalikan agen yang salah tanpa error.

## Pointers
- **Inter-Agent API**: `server/routes.ts` orchestration block ~line 2806
- **Test Tracker Storage** (localStorage): `gustafta_test_tracker_v1` (Tender) · `gustafta_fed_tracker_v1` (Federation) · `gustafta_pilot_tracker_v1` (Pilot) · `gustafta_konstra_tracker_v1` (KONSTRA) · `gustafta_konstra_signoff_v1` (Sprint 4 Sign-Off)
