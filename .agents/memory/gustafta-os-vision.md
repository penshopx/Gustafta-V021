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
- **Fase 0 — OS Shell / Kurasi** (AMAN, tanpa ubah backend): tata 373 halaman ke 5 pintu masuk pilar. Kebutuhan #1 menurut ketiga sumber. ← MULAI DI SINI.
- **Fase 1 — Workroom MVP**: satu-satunya konsep betul-betul baru. Dibangun DI ATAS Otak Proyek + deliverables. **Domain percontohan pertama = TENDER Konstruksi & PBJP** (aset terkuat: TenderaClaw, KonstraTender, tabel `tenders`/`tender_sessions`/`bj_tenders`). Alur: Tahapan → Human Gate ◆ → Log → Deliverable Pack.
- **Fase 2 — Aktifkan Academy** pakai `lms_*` eksisting; capstone menghasilkan deliverable Workroom sbg bukti portofolio.
- **Fase 3 — Competency polish**: badge + portofolio.

**Why:** roadmap ChatGPT ditulis seolah greenfield & menyarankan pecah modul+DB sendiri — berisiko menghancurkan platform hidup. Notion jauh lebih baik krn berpijak aset nyata. Kesepakatan pemilik: adaptasi bertahap, kurasi dulu.
