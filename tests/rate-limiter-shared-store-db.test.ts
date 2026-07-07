import { test } from "node:test";
import assert from "node:assert/strict";

import { PostgresRateLimitStore } from "../server/lib/rate-limiter";

// Integrasi (butuh DB nyata) — memverifikasi JALUR STORE BERSAMA default benar-benar
// bisa MENULIS & MEMBACA tabel `rate_limit_buckets`. Ini menutup risiko yang
// ditemukan review: bila tabel tidak ada di lingkungan deploy, setiap hit ke store
// bersama akan gagal dan middleware DIAM-DIAM jatuh ke Map in-memory per-instance
// (cap lintas-instance tidak lagi ditegakkan). Tes ini gagal keras kalau tabel/
// kolom hilang, jadi migrasi 0008_rate_limit_buckets WAJIB ikut ter-deploy.
//
// Dilewati otomatis bila tidak ada DATABASE_URL (mis. CI tanpa DB), agar unit test
// lain tetap jalan.

const hasDb = !!process.env.DATABASE_URL;

test(
  "store bersama Postgres default menulis & membaca rate_limit_buckets (integrasi)",
  { skip: hasDb ? false : "DATABASE_URL tidak diset — lewati tes integrasi DB" },
  async () => {
    const { pool } = await import("../server/db");
    const store = new PostgresRateLimitStore((text, params) =>
      pool.query(text, params),
    );

    const key = `agent:__it_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const windowMs = 60 * 60 * 1000;
    const now = Date.now();

    try {
      // Hit pertama membuat baris → count 1.
      const first = await store.hit(key, windowMs, now);
      assert.equal(first.count, 1, "hit pertama harus count=1");
      assert.equal(
        first.resetAt,
        now + windowMs,
        "resetAt hit pertama = now + window",
      );

      // Hit kedua dalam window sama → count naik, resetAt tetap.
      const second = await store.hit(key, windowMs, now + 1000);
      assert.equal(second.count, 2, "hit kedua (window sama) harus count=2");
      assert.equal(
        second.resetAt,
        now + windowMs,
        "resetAt tidak berubah dalam window",
      );

      // Melewati window → reset ke 1 dengan window baru.
      const after = now + windowMs + 1;
      const reset = await store.hit(key, windowMs, after);
      assert.equal(reset.count, 1, "setelah window lewat harus reset ke 1");
      assert.equal(reset.resetAt, after + windowMs, "window baru terbentuk");
    } finally {
      await pool.query("DELETE FROM rate_limit_buckets WHERE bucket_key = $1", [
        key,
      ]);
      await pool.end();
    }
  },
);
