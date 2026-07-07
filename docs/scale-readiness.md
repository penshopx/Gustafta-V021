# Kesiapan Skala — 1000 Peserta Serempak (Indobuildtech 2026)

Dokumen ini merangkum pengerasan (hardening) agar Gustafta tahan lonjakan ~1000
peserta yang mendaftar/mencoba serempak saat soft-launch acara, plus cara
menyalakan "Mode Acara" dan menguji beban.

## 1. Mode Acara (Event Mode)

Rate limiter (`server/lib/rate-limiter.ts`) punya dua profil batas: normal dan
acara. Aktifkan Mode Acara saat hari-H agar peserta tidak cepat kena limit.

**Cara nyalakan (pilih salah satu):**
- Set env `EVENT_MODE=on` (atau `1`/`true`), atau
- Set jendela waktu otomatis: `EVENT_MODE_START` dan `EVENT_MODE_END` (ISO
  timestamp, mis. `2026-07-15T00:00:00+07:00`). Mode aktif hanya dalam rentang itu.

**Batas yang berlaku (per menit, bisa di-override via env):**

| Env                  | Normal | Acara | Keterangan                          |
|----------------------|--------|-------|-------------------------------------|
| `CHAT_LIMIT_AUTH`    | 120    | 240   | user login (kunci per-AKUN)         |
| `CHAT_LIMIT_ANON`    | 30     | 60    | anonim (kunci per-IP)               |

> **Penting — WiFi venue:** user login dibatasi **per-akun**, bukan per-IP. Di
> venue acara ratusan peserta berbagi satu IP WiFi; keying per-IP akan membuat
> mereka saling mengunci. Anonim tetap per-IP (belum punya identitas).

Admin dikecualikan dari limit.

## 2. Koneksi Database (connection pool)

Semua koneksi kini lewat **satu pool** (`server/db.ts`) — sebelumnya ada pool
ganda (app + session store) yang menggandakan pemakaian koneksi.

- `DB_POOL_MAX` (default `12`) — maksimum koneksi per instance. Naikkan hati-hati;
  batas Postgres = jumlah_instance × DB_POOL_MAX harus di bawah kuota provider.
- `DATABASE_URL_POOLED` (opsional) — bila provider menyediakan endpoint pooler
  (mis. PgBouncer/Neon pooler), set ini agar koneksi lewat pooler eksternal.
- Session store (`connect-pg-simple`) **memakai ulang** pool aplikasi (opsi
  `pool`), bukan membuka koneksi sendiri.

## 3. Perlindungan Beban Dialog (jalur kritis acara)

Endpoint publik `/api/dialog-gustafta*` (chat + 3 gerbang JSON: profil, gambaran,
blueprint) adalah jalur yang paling ditekan peserta. Dilindungi oleh
`server/lib/dialog-load-guard.ts`:

1. **Gerbang konkurensi (p-limit):** batasi panggilan LLM serempak
   (`DIALOG_MAX_CONCURRENCY`, default 12) + antrean terbatas (`DIALOG_MAX_QUEUE`,
   default 40). Bila penuh → tolak CEPAT dengan **HTTP 503 + pesan ramah** dan
   header `Retry-After`, alih-alih menumpuk request sampai time out beruntun.
2. **Fallback lintas-provider:** OpenAI (model cepat/hemat) → DeepSeek → Qwen →
   OpenRouter → Nvidia → Gemini, mengikuti kunci API yang tersedia. Satu provider
   down/limit tidak mematikan seluruh dialog.
3. **Model hemat:** default `DIALOG_MODEL=gpt-4o-mini` (bisa di-override), agar
   dialog acara murah & cepat tanpa mengubah agen produksi.

## 4. Pemilihan Leader untuk Scheduler (multi-instance)

Saat di-deploy Autoscale, bisa jalan **beberapa instance** serempak. Tanpa
koordinasi, tiap instance akan menjalankan job harian (scrape tender, alert WA,
backup DB, research sweep, broadcast) → kirim WA/email ganda + beban LLM berlipat.

`server/lib/scheduler-leader.ts` memastikan **hanya satu instance (leader)** yang
menjalankan job pada satu waktu:
- Satu baris `system_config` (key `scheduler_leader`) menyimpan instanceId +
  heartbeat. Klaim/renew **atomik** lewat satu `INSERT ... ON CONFLICT ... WHERE`.
- Leader mem-perpanjang tiap 30 detik; TTL 90 detik. Bila leader mati, instance
  lain otomatis mengambil alih setelah TTL lewat.
- Semua job (`scheduleAtWIB` + broadcast checker) hanya jalan bila
  `isSchedulerLeader()` true; kalau bukan leader, job di-skip diam-diam.

## 5. Uji Beban

Skrip tanpa dependensi: `scripts/load-test.mjs` (Node 18+). Melaporkan
throughput, tingkat error, dan persentil latensi (p50/p90/p95/p99).

```bash
# Health check ringan
node scripts/load-test.mjs --url "$REPLIT_DEV_DOMAIN/health" -n 500 -c 50

# Endpoint GET publik yang murah
node scripts/load-test.mjs --url "$REPLIT_DEV_DOMAIN/api/store/agents" -n 1000 -c 100
```

> **JANGAN** arahkan uji beban ke endpoint LLM (`/api/dialog-gustafta*`,
> `/api/chat/*`) — mahal dan rate-limited. Uji jalur murah (health, aset publik,
> daftar store) untuk memvalidasi HTTP/DB/pool. Perlindungan LLM sudah diuji lewat
> gerbang konkurensi (poin 3).

**Baseline dev (health, 300 req @ 40 konkurensi):** ~500 req/s, 0% error,
p95 ≈ 194ms. Produksi (Autoscale) akan menskalakan instance sesuai beban.

## 6. Checklist hari-H

- [ ] Set `EVENT_MODE=on` (atau jendela `EVENT_MODE_START`/`END`).
- [ ] Pastikan kunci LLM fallback terisi (minimal OpenAI + 1 cadangan).
- [ ] Verifikasi `DB_POOL_MAX` × perkiraan instance < kuota koneksi Postgres.
- [ ] Jalankan `load-test.mjs` ke domain published (jalur murah) sebelum acara.
- [ ] Konfirmasi hanya satu leader scheduler di log (`[SchedulerLeader] … menjadi LEADER`).
- [ ] Setelah acara: `EVENT_MODE=off` (atau biarkan jendela lewat).
