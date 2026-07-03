import { test } from "node:test";
import assert from "node:assert/strict";
import { MemStorage } from "../server/storage";

// Regresi keamanan-data untuk job "Owner Usage Cleanup" (server/index.ts).
//
// Job terjadwal itu MENGHAPUS PERMANEN baris `owner_monthly_usage` yang lebih
// lama dari jendela retensi (bulan berjalan + 2 bulan sebelumnya). Karena baris
// bulan berjalan-lah yang menegakkan kuota, salah hitung cutoff bisa menghapus
// hitungan yang MASIH DIPAKAI dan mereset kuota seseorang secara diam-diam.
//
// Test ini membuktikan kontrak inti: `deleteOwnerMonthlyUsageBefore(cutoff)`
// hanya membuang baris dengan bulan KETAT lebih lama dari cutoff, dan tidak
// pernah menyentuh bulan berjalan atau 2 bulan sebelumnya (yang tepat di batas).
//
// Pakai MemStorage (in-memory) agar cepat & deterministik tanpa DB — logika
// perbandingan bulannya identik dengan DbStorage (perbandingan string "YYYY-MM"
// yang aman karena zero-padded).

// Format sebuah tanggal UTC menjadi "YYYY-MM".
function ym(d: Date): string {
  return d.toISOString().slice(0, 7);
}

// Bulan (start-of-month, UTC) yang bergeser `offset` bulan dari `base`.
function monthOffset(base: Date, offset: number): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1));
}

// Hitung cutoff persis seperti job di server/index.ts: awal-bulan dikurangi 2
// bulan, diformat "YYYY-MM". Retensi = bulan berjalan + 2 bulan sebelumnya.
function cutoffMonthFor(now: Date): string {
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  return ym(cutoff);
}

test("cleanup hanya menghapus bulan yang KETAT lebih lama dari cutoff retensi 3 bulan", async () => {
  const storage = new MemStorage();
  const owner = "owner-A";

  // Anggap "sekarang" = pertengahan bulan tertentu; pilih tanggal yang stabil.
  const now = new Date(Date.UTC(2026, 6, 15)); // Juli 2026
  const cutoff = cutoffMonthFor(now); // "2026-05" (Mei) — retensi mulai Mei

  const current = ym(now); // 2026-07 (bulan berjalan)
  const prev1 = ym(monthOffset(now, -1)); // 2026-06
  const prev2 = ym(monthOffset(now, -2)); // 2026-05 (== cutoff, HARUS bertahan)
  const old1 = ym(monthOffset(now, -3)); // 2026-04 (harus terhapus)
  const old2 = ym(monthOffset(now, -6)); // 2026-01 (harus terhapus)
  const old3 = ym(monthOffset(now, -14)); // 2025-05 (harus terhapus)

  // cutoff seharusnya tepat sama dengan prev2 (batas bawah jendela retensi).
  assert.equal(cutoff, prev2, "cutoff harus tepat = bulan berjalan minus 2 (batas retensi).");

  // Seed hitungan berbeda-beda per bulan agar bisa cek nilainya tak berubah.
  const seed: Array<[string, number]> = [
    [current, 42],
    [prev1, 7],
    [prev2, 3],
    [old1, 99],
    [old2, 5],
    [old3, 1],
  ];
  for (const [month, count] of seed) {
    for (let i = 0; i < count; i++) {
      await storage.incrementOwnerMonthlyUsage(owner, month);
    }
  }

  // Sanity: semua tersimpan sesuai seed sebelum cleanup.
  for (const [month, count] of seed) {
    assert.equal(
      await storage.getOwnerMonthlyUsage(owner, month),
      count,
      `seed gagal untuk ${month}`,
    );
  }

  const deleted = await storage.deleteOwnerMonthlyUsageBefore(cutoff);

  // Tepat 3 baris lama (old1, old2, old3) yang terhapus.
  assert.equal(deleted, 3, "cleanup harus menghapus tepat 3 baris lama.");

  // Bulan berjalan + 2 bulan sebelumnya HARUS utuh dengan nilai persis sama.
  assert.equal(await storage.getOwnerMonthlyUsage(owner, current), 42, "bulan berjalan tidak boleh tersentuh.");
  assert.equal(await storage.getOwnerMonthlyUsage(owner, prev1), 7, "bulan -1 harus utuh.");
  assert.equal(await storage.getOwnerMonthlyUsage(owner, prev2), 3, "bulan -2 (tepat cutoff) harus utuh.");

  // Bulan lama HARUS hilang (getOwnerMonthlyUsage kembali 0 = baris tidak ada).
  assert.equal(await storage.getOwnerMonthlyUsage(owner, old1), 0, "bulan -3 harus terhapus.");
  assert.equal(await storage.getOwnerMonthlyUsage(owner, old2), 0, "bulan -6 harus terhapus.");
  assert.equal(await storage.getOwnerMonthlyUsage(owner, old3), 0, "bulan -14 harus terhapus.");
});

test("cutoff bersifat KETAT lebih-kecil: baris tepat di bulan cutoff tidak pernah terhapus", async () => {
  const storage = new MemStorage();
  const owner = "owner-B";

  const now = new Date(Date.UTC(2026, 0, 10)); // Januari 2026 — uji lintas tahun
  const cutoff = cutoffMonthFor(now); // "2025-11" (November 2025)

  const current = ym(now); // 2026-01
  const prev1 = ym(monthOffset(now, -1)); // 2025-12
  const prev2 = ym(monthOffset(now, -2)); // 2025-11 (== cutoff)
  const justOld = ym(monthOffset(now, -3)); // 2025-10 (< cutoff → terhapus)

  assert.equal(cutoff, prev2, "cutoff harus melintasi batas tahun dengan benar.");

  await storage.incrementOwnerMonthlyUsage(owner, current);
  await storage.incrementOwnerMonthlyUsage(owner, prev1);
  await storage.incrementOwnerMonthlyUsage(owner, prev2);
  await storage.incrementOwnerMonthlyUsage(owner, justOld);

  const deleted = await storage.deleteOwnerMonthlyUsageBefore(cutoff);

  assert.equal(deleted, 1, "hanya baris tepat sebelum cutoff (2025-10) yang terhapus.");
  assert.equal(await storage.getOwnerMonthlyUsage(owner, prev2), 1, "baris tepat DI bulan cutoff harus bertahan (perbandingan ketat <).");
  assert.equal(await storage.getOwnerMonthlyUsage(owner, justOld), 0, "baris tepat SEBELUM cutoff harus terhapus.");
});

test("cleanup tidak menyentuh baris owner lain dan menghormati per-owner isolation", async () => {
  const storage = new MemStorage();
  const now = new Date(Date.UTC(2026, 6, 15));
  const cutoff = cutoffMonthFor(now);
  const current = ym(now);
  const old = ym(monthOffset(now, -5));

  await storage.incrementOwnerMonthlyUsage("owner-X", current);
  await storage.incrementOwnerMonthlyUsage("owner-X", old);
  await storage.incrementOwnerMonthlyUsage("owner-Y", current);
  await storage.incrementOwnerMonthlyUsage("owner-Y", old);

  const deleted = await storage.deleteOwnerMonthlyUsageBefore(cutoff);

  // Kedua baris lama (X & Y) terhapus; kedua baris bulan berjalan bertahan.
  assert.equal(deleted, 2, "baris lama kedua owner harus terhapus.");
  assert.equal(await storage.getOwnerMonthlyUsage("owner-X", current), 1, "bulan berjalan owner-X utuh.");
  assert.equal(await storage.getOwnerMonthlyUsage("owner-Y", current), 1, "bulan berjalan owner-Y utuh.");
  assert.equal(await storage.getOwnerMonthlyUsage("owner-X", old), 0, "bulan lama owner-X terhapus.");
  assert.equal(await storage.getOwnerMonthlyUsage("owner-Y", old), 0, "bulan lama owner-Y terhapus.");
});
