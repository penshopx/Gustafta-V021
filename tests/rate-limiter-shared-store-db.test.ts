import { test, after } from "node:test";
import assert from "node:assert/strict";

import { PostgresRateLimitStore } from "../server/lib/rate-limiter";

// Integrasi (butuh DB nyata) — memverifikasi JALUR STORE BERSAMA default benar-benar
// bisa MENULIS & MEMBACA tabel `rate_limit_buckets`, dan bahwa SQL atomik-nya
// (UPSERT + CASE reset-window) berperilaku benar terhadap Postgres SUNGGUHAN.
//
// Kenapa ini penting: unit test lain menyuntik InMemoryRateLimitStore untuk
// mensimulasikan DB bersama — itu membuktikan logika adapter, TAPI bukan SQL
// PostgresRateLimitStore. Regresi di UPSERT/CASE (mis. reset window salah, race
// tak ter-serialisasi, atau tabel/kolom hilang di lingkungan deploy) akan DIAM-DIAM
// membiarkan klien menembus batas di produksi tanpa satu tes pun gagal. Tes ini
// gagal keras kalau perilakunya berubah, sehingga migrasi 0008_rate_limit_buckets
// WAJIB ikut ter-deploy.
//
// Dilewati otomatis bila tidak ada DATABASE_URL (mis. CI tanpa DB), agar unit test
// lain tetap jalan.

const hasDb = !!process.env.DATABASE_URL;
const skip = hasDb ? false : "DATABASE_URL tidak diset — lewati tes integrasi DB";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// Satu pool dibagi semua tes di file ini; ditutup sekali lewat `after` supaya tes
// kedua dst. tidak kehabisan koneksi (jangan pool.end() di dalam tiap tes).
let poolPromise: Promise<import("pg").Pool> | null = null;
async function getPool() {
  if (!poolPromise) poolPromise = import("../server/db").then((m) => m.pool);
  return poolPromise;
}

function uniqueKey(prefix: string): string {
  return `${prefix}__it_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

after(async () => {
  if (!hasDb || !poolPromise) return;
  const pool = await poolPromise;
  await pool.end();
});

test(
  "hit(): tulis/baca + kenaikan dalam window + reset saat window lewat (SQL nyata)",
  { skip },
  async () => {
    const pool = await getPool();
    const store = new PostgresRateLimitStore((text, params) =>
      pool.query(text, params),
    );
    const key = uniqueKey("agent:");
    const now = Date.now();

    try {
      // Hit pertama membuat baris → count 1, window baru.
      const first = await store.hit(key, HOUR_MS, now);
      assert.equal(first.count, 1, "hit pertama harus count=1");
      assert.equal(
        first.resetAt,
        now + HOUR_MS,
        "resetAt hit pertama = now + window",
      );

      // Hit kedua dalam window sama → count naik, resetAt TETAP.
      const second = await store.hit(key, HOUR_MS, now + 1000);
      assert.equal(second.count, 2, "hit kedua (window sama) harus count=2");
      assert.equal(
        second.resetAt,
        now + HOUR_MS,
        "resetAt tidak berubah dalam window",
      );

      // Melewati reset_at → CASE me-reset ke 1 dengan window baru.
      const after = now + HOUR_MS + 1;
      const reset = await store.hit(key, HOUR_MS, after);
      assert.equal(reset.count, 1, "setelah window lewat harus reset ke 1");
      assert.equal(reset.resetAt, after + HOUR_MS, "window baru terbentuk");
    } finally {
      await pool.query("DELETE FROM rate_limit_buckets WHERE bucket_key = $1", [
        key,
      ]);
    }
  },
);

test(
  "hit(): kenaikan SEREMPAK pada key sama ter-serialisasi jadi satu hitungan (UPSERT mengunci baris)",
  { skip },
  async () => {
    const pool = await getPool();
    // Simulasikan banyak instance autoscale: masing-masing store punya koneksi/
    // query sendiri lewat pool yang sama, semua menaikkan bucket yang identik.
    const store = new PostgresRateLimitStore((text, params) =>
      pool.query(text, params),
    );
    const key = uniqueKey("agent:");
    const now = Date.now();
    const CONCURRENT = 50;

    try {
      const results = await Promise.all(
        Array.from({ length: CONCURRENT }, () =>
          store.hit(key, HOUR_MS, now),
        ),
      );

      // Setiap hit menerima count berjalan yang unik 1..N (tak ada yang kembar) →
      // bukti UPSERT ter-serialisasi, bukan lost-update.
      const counts = results.map((r) => r.count).sort((a, b) => a - b);
      assert.deepEqual(
        counts,
        Array.from({ length: CONCURRENT }, (_, i) => i + 1),
        "N hit serempak harus menghasilkan count 1..N tanpa duplikat/lompatan",
      );

      // Sumber kebenaran di DB harus tepat N (tidak ada increment yang hilang).
      const { rows } = await pool.query(
        "SELECT count FROM rate_limit_buckets WHERE bucket_key = $1",
        [key],
      );
      assert.equal(
        Number(rows[0].count),
        CONCURRENT,
        "count final di DB harus = jumlah hit serempak",
      );

      // Semua berbagi satu window (resetAt sama) karena masih dalam window.
      const resetAts = new Set(results.map((r) => r.resetAt));
      assert.equal(resetAts.size, 1, "semua hit serempak berbagi satu window");
    } finally {
      await pool.query("DELETE FROM rate_limit_buckets WHERE bucket_key = $1", [
        key,
      ]);
    }
  },
);

test(
  "reset(): menghapus bucket sehingga hit berikutnya mulai dari 1",
  { skip },
  async () => {
    const pool = await getPool();
    const store = new PostgresRateLimitStore((text, params) =>
      pool.query(text, params),
    );
    const key = uniqueKey("agent:");
    const now = Date.now();

    try {
      await store.hit(key, HOUR_MS, now);
      await store.hit(key, HOUR_MS, now + 1);

      await store.reset(key);
      const { rows } = await pool.query(
        "SELECT count FROM rate_limit_buckets WHERE bucket_key = $1",
        [key],
      );
      assert.equal(rows.length, 0, "reset() harus menghapus baris bucket");

      // Hit setelah reset membuat baris baru mulai dari 1.
      const afterReset = await store.hit(key, HOUR_MS, now + 2);
      assert.equal(afterReset.count, 1, "hit setelah reset harus mulai dari 1");
    } finally {
      await pool.query("DELETE FROM rate_limit_buckets WHERE bucket_key = $1", [
        key,
      ]);
    }
  },
);

test(
  "prefix minute: (per-menit) dan agent: (per-jam) berbagi tabel tanpa tabrakan",
  { skip },
  async () => {
    const pool = await getPool();
    const store = new PostgresRateLimitStore((text, params) =>
      pool.query(text, params),
    );
    const suffix = `__it_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const minuteKey = `minute:${suffix}`;
    const agentKey = `agent:${suffix}`;
    const now = Date.now();

    try {
      // Naikkan bucket per-menit beberapa kali; bucket per-jam sekali.
      await store.hit(minuteKey, MINUTE_MS, now);
      const minute2 = await store.hit(minuteKey, MINUTE_MS, now + 100);
      const agent1 = await store.hit(agentKey, HOUR_MS, now);

      assert.equal(minute2.count, 2, "bucket minute: menghitung independen");
      assert.equal(
        agent1.count,
        1,
        "bucket agent: tidak terpengaruh kenaikan bucket minute:",
      );

      // Window tiap prefix mengikuti windowMs-nya sendiri (menit vs jam).
      assert.equal(minute2.resetAt, now + MINUTE_MS, "window minute: = 60 detik");
      assert.equal(agent1.resetAt, now + HOUR_MS, "window agent: = 60 menit");

      // Verifikasi keduanya benar-benar dua baris terpisah di tabel yang sama.
      const { rows } = await pool.query(
        "SELECT bucket_key, count FROM rate_limit_buckets WHERE bucket_key = ANY($1) ORDER BY bucket_key",
        [[agentKey, minuteKey]],
      );
      assert.equal(rows.length, 2, "harus ada dua baris terpisah");
      const byKey = Object.fromEntries(
        rows.map((r: any) => [r.bucket_key, Number(r.count)]),
      );
      assert.equal(byKey[minuteKey], 2, "baris minute: = 2");
      assert.equal(byKey[agentKey], 1, "baris agent: = 1");
    } finally {
      await pool.query(
        "DELETE FROM rate_limit_buckets WHERE bucket_key = ANY($1)",
        [[minuteKey, agentKey]],
      );
    }
  },
);
