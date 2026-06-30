// Logika keputusan otorisasi MUTASI agen — murni (pure), tanpa akses DB/req,
// supaya bisa diuji menyeluruh (owner/admin/non-owner/agen-sistem/anonim).
//
// Pemanggil (route layer) bertanggung jawab menghitung `userId`, `isAdmin`
// (via DB role / ADMIN_USER_IDS), dan `agentOwnerId`, lalu menyerahkan
// keputusan akhir ke sini. Urutan cabang TIDAK boleh diubah:
//   1) belum login        → 401
//   2) admin              → boleh (apa pun, termasuk agen sistem/orang lain)
//   3) agen sistem (tanpa pemilik) & bukan admin → 403 admin-only
//   4) bukan pemilik      → 403
//   5) pemilik            → boleh

export type AgentAuthzResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export interface AgentMutationContext {
  /** ID user dari sesi; string kosong berarti belum login. */
  userId: string;
  /** Sudah dihitung pemanggil dari DB role + ADMIN_USER_IDS. */
  isAdmin: boolean;
  /** Pemilik agen target; string kosong = agen sistem/seeded tanpa pemilik. */
  agentOwnerId: string;
}

export function decideAgentMutation(ctx: AgentMutationContext): AgentAuthzResult {
  const { userId, isAdmin, agentOwnerId } = ctx;

  // 1) Belum login — diprioritaskan di atas segalanya (defense-in-depth:
  //    tanpa identitas, klaim admin pun tidak dipercaya).
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };

  // 2) Admin boleh memutasi agen mana pun.
  if (isAdmin) return { ok: true };

  // 3) Agen sistem/seeded (tanpa pemilik) hanya boleh diubah admin.
  if (!agentOwnerId) {
    return { ok: false, status: 403, error: "Forbidden: agen sistem hanya bisa diubah admin" };
  }

  // 4) Bukan pemilik agen.
  if (agentOwnerId !== userId) {
    return { ok: false, status: 403, error: "Forbidden: bukan pemilik agen" };
  }

  // 5) Pemilik agen.
  return { ok: true };
}
