---
name: Gustafta pricing/product model
description: Durable product rules for the "Produk & Layanan" pages (landing.tsx, produk.tsx) — license vs setup, no permanent free tier, trial flow.
---

# Gustafta — Model Produk & Layanan (landing.tsx + produk.tsx)

Aturan produk yang harus dijaga konsisten lintas halaman pemasaran. Ini keputusan bisnis pemilik, bukan sekadar detail kode — jangan "memperbaiki" dengan menambah balik tier yang sudah dihapus.

- **Produk chatbot (langganan / Store Creator) = hanya biaya LISENSI, TANPA biaya setup.** Produk sudah jadi, tinggal pakai.
- **Layanan Jasa (modul dirakit tim Gustafta) = ada biaya SETUP (sekali bayar).** Inilah satu-satunya jalur yang punya biaya setup.
- **Tidak ada tier "Gratis" permanen.** "Gratis" HANYA berarti bonus 7 hari trial.
- **Funnel wajib:** isi Blueprint (Dialog Gustafta) → beli Starter Kit → bonus 7 hari. Tidak boleh ada tombol yang langsung mulai trial; CTA trial harus mengarah ke `/dialog-gustafta` dulu.

## Kerangka 3-sumbu (acuan resmi — pisahkan, jangan dicampur)

Pemilik sempat menyamakan "Starter Kit" sebagai level paling bawah dari tangga tier. Itu KELIRU. Pisahkan jadi 3 sumbu independen:

1. **Cara mendapatkan chatbot (3 jalur):** Produk (lisensi+langganan, kelola sendiri) · Layanan Jasa (tim rakit, ada setup) · Chatbot Store (beli jadi, lisensi sekali bayar).
2. **Tingkat langganan platform (4 tier):** Starter → Profesional → Bisnis → Enterprise. Naik tier = naik kuota (pesan/bot/KB/sub-akun) + tambah chatbot premium + tambah Mini Apps. Sumber angka: `client/src/data/pricing.ts` + gating `shared/feature-plans.ts`.
3. **Starter Kit = produk onboarding sekali bayar (Rp 245rb), BUKAN tier.** Isi: lisensi + panduan + trial 7 hari. Pintu masuk ke tier mana pun. Di UI JANGAN sejajarkan "Starter Kit" dengan tier "Starter" — beri label beda (mis. "Paket Perkenalan").

**Nama tier teratas = "Enterprise"** (bukan "Corporate"/"Korporat") — konsisten dengan implementasi yang sudah jalan.

**Why:** mencampur Starter Kit dengan tier Starter membuat halaman pricing rancu (pengguna kira Starter Kit = level termurah, padahal add-on onboarding lintas-tier).
**How to apply:** saat menyentuh halaman pricing/leveling, jaga ketiga sumbu tetap terpisah; jangan turunkan Starter Kit jadi "tier ke-0".

**Why:** pemilik ingin menghindari kebingungan harga (orang mengira chatbot jadi kena setup) dan menyaring lead lewat Blueprint sebelum memberi akses gratis.

**How to apply:** saat mengubah copy/CTA/pricing di `landing.tsx` atau `produk.tsx` (atau halaman `/pricing`, `/packs` bila relevan), pastikan tidak menambah tier gratis permanen, tidak melabeli produk chatbot dengan "setup", dan CTA trial tetap lewat Blueprint.
