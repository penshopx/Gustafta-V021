---
name: Gustafta AI OS — 5 Pilar direction
description: Agreed product/architecture direction for evolving Gustafta from "chatbot builder" into an AI Operating System. Read before any structural/navigation/roadmap work.
---

# Gustafta AI Operating System — arah yang disepakati

Sumber: sintesis 3 dokumen (diagnosis kode + roadmap ChatGPT + kurikulum Notion). Semua sepakat: **masalahnya kurasi, bukan kekurangan produk** (~70% fondasi sudah ada). Pemilik solo, dibangun dengan Replit.

## Model produk: 5 PILAR (framing wajah produk)
1. **COACH** — chatbot pendamping per domain (tanpa orchestrator)
2. **CLAW** — tim agen spesialis multi-agent (MultiClaw/OpenClaw)
3. **WORKROOM** — ruang kerja manusia+agen: workflow + Human Gate ◆ + log + deliverable pack
4. **ACADEMY** — kursus berjenjang Starter→Professional→Advanced→Enterprise
5. **COMPETENCY & MONETIZATION** — badge/sertifikat, portofolio, langganan, afiliasi, voucher, analytics

## Aturan arsitektur (non-negotiable)
- **Modular MONOLITH, bukan microservices.** Solo dev tidak boleh punya 8 layanan + 8 DB terpisah. Batas modul = logis (DDD), satu app + satu DB.
- **Petakan konsep ke tabel yang SUDAH ADA — JANGAN bikin tabel kembar.** Data model Notion (courses/deliverables/affiliates/vouchers) menduplikasi tabel eksisting; itu keliru.
- **Adaptasi tanpa menghancurkan** yang sudah jalan (billing, 934 agen, partner, marketplace).
- **Human Gate ◆ wajib** di setiap workflow penting (uang/kontrak/keselamatan/sertifikasi/submit final).

## Pemetaan 5 Pilar → tabel eksisting (per audit)
- COACH + CLAW → `agents` (`isOrchestrator`+`agenticSubAgents` membedakan coach vs claw), `knowledge_bases`/`knowledge_chunks`/`knowledge_taxonomy`
- WORKROOM → benih di `project_brain_templates`/`project_brain_instances` (Otak Proyek) + `agentic_deliverables`. **GAP nyata**: belum ada tabel `workrooms`, `workflow_stages`, `human_gates`, `workroom_logs` (decision/assumption/risk/change) → INI yang baru dibuat saat Fase 1.
- ACADEMY → mesin SUDAH ADA: `lms_courses`/`lms_lessons`/`lms_enrollments`/`lms_lesson_progress` + `digital_certificates`/`shared_certificates`. Tinggal isi kurikulum + sambung capstone→Builder.
- COMPETENCY & MONETIZATION → `affiliates`/`mlm_commissions`, `vouchers`/`voucher_redemptions`, `certificates`, `analytics`, `store_products`/`store_orders`, `subscriptions_new`, `wa_broadcasts`. **GAP kecil**: badge + portofolio.

## Roadmap bertahap (disepakati)
- **Fase 0 — OS Shell / Kurasi** ✅ SELESAI: navigator 5 pilar di route `/os` (`client/src/pages/gustafta-os.tsx`), additive/frontend-only, entry card di dashboard "Aksi Cepat".
- **Fase 1 — Workroom MVP** ✅ SELESAI: tabel BARU `workrooms`/`workroom_gates`/`workroom_logs` (bukan reuse — benih Otak Proyek/deliverables tak cocok untuk stage-machine). Domain pertama = TENDER. Stage machine (6 tahap) + Human Gate ◆ + jurnal log (decision/assumption/risk/change/deliverable) + analisis AI GPT-4o (kelayakan+win-probability, JSON, honest [ASUMSI]). Routes `/api/workrooms*` (semua isAuthenticated + `getOwnedWorkroom` ownership guard = anti-IDOR). UI: `/workroom` (list+create) & `/workroom/:id` (detail). Deliverable disimpan sbg log type "deliverable" (meta.result), BUKAN tabel agentic_deliverables (keyed by agentId, tak cocok).
  - **Why tabel baru, bukan reuse**: agentic_deliverables & project_brain_* terikat agentId, sedangkan workroom milik user & butuh stage/gate/log terpisah. Sesuai aturan "tabel baru HANYA untuk yang belum ada".
- **Fase 2 — Aktifkan Academy** ✅ SELESAI: mesin `lms_*` + 5 kursus SUDAH ADA (seed `server/routes-lms.ts`, route `/lms`, `/lms/course/:id`) — jadi "aktivasi" = SAMBUNGKAN Academy ke Workroom (loop belajar→praktik), BUKAN bikin konten baru. Implementasi = **capstone bridge** (frontend-only, tanpa perubahan skema): kursus `category==="konstruksi"` (SBU/SKK/K3, id 3-5) menampilkan kartu Capstone → tombol buat Workroom Tender via `POST /api/workrooms` yg SUDAH ADA dengan `context={source:"capstone",courseId,courseTitle}` → navigate ke `/workroom/:id`. Workroom detail tampilkan banner backlink ke `/lms/course/:courseId` bila `context.source==="capstone"`. Mapping capstone→domain di const `CAPSTONE_BY_CATEGORY` (lms-course.tsx); saat ini hanya konstruksi→tender krn itu satu-satunya domain Workroom yg ada.
  - **Why capstone via context, bukan tabel/kolom baru**: reuse endpoint & tabel Workroom Fase 1; `context` jsonb sudah fleksibel. Aturan "tabel baru HANYA yg belum ada" → tak ada yg baru dibutuhkan.
  - **Gotcha**: halaman yg perlu bedakan 404 vs error WAJIB pakai `queryFn` custom (cek `res.status===404` → return null); default queryFn throw di semua non-2xx → `isError` selalu true, "not found" tak pernah tampil.
- **Fase 3 — Competency polish**: badge + portofolio.

**Why:** roadmap ChatGPT ditulis seolah greenfield & menyarankan pecah modul+DB sendiri — berisiko menghancurkan platform hidup. Notion jauh lebih baik krn berpijak aset nyata. Kesepakatan pemilik: adaptasi bertahap, kurasi dulu.
