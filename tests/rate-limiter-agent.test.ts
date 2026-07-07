import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";

import { chatAgentIdRateLimiter } from "../server/lib/rate-limiter";

// Regresi — melindungi lapisan proteksi KEDUA: batas per-AGEN per jam untuk
// pemanggil ANONIM (`chatAgentIdRateLimiter`). Inilah yang mencegah satu agen
// publik dihajar bot/skrip. Batas: 100 permintaan tak-terautentikasi / jam
// per agentId, disimpan di Map in-memory privat dengan reset berbasis Date.now().
//
// Karena Map & konstanta bersifat privat, tes ini:
//  - memakai agentId unik per kasus agar tiap kasus mulai dari bucket bersih;
//  - mengendalikan waktu via stub Date.now() untuk menguji cabang reset window
//    tanpa menunggu 1 jam nyata.

const AGENT_MAX_UNAUTHENTICATED = 100;
const AGENT_WINDOW_MS = 60 * 60 * 1000;

// ── Helper: objek Request/Response tiruan minimal ────────────────────────────
function anonReq(agentId: unknown): Request {
  return {
    isAuthenticated: () => false,
    body: { agentId },
  } as unknown as Request;
}

function authedReq(agentId: unknown): Request {
  return {
    isAuthenticated: () => true,
    user: { id: "user-A" },
    body: { agentId },
  } as unknown as Request;
}

interface FakeRes {
  res: Response;
  statusCode: number | null;
  jsonBody: any;
  headers: Record<string, string>;
}

function fakeRes(): FakeRes {
  const state: FakeRes = {
    statusCode: null,
    jsonBody: undefined,
    headers: {},
    res: null as unknown as Response,
  };
  const res = {
    setHeader(name: string, value: string) {
      state.headers[name] = value;
      return res;
    },
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(body: any) {
      state.jsonBody = body;
      return res;
    },
  } as unknown as Response;
  state.res = res;
  return state;
}

// Menjalankan middleware sekali; mengembalikan apakah next() dipanggil.
function run(req: Request, res: Response): boolean {
  let nextCalled = false;
  chatAgentIdRateLimiter(req, res, () => {
    nextCalled = true;
  });
  return nextCalled;
}

// ── 1. Request terautentikasi mem-bypass limiter per-agen ────────────────────
test("request login mem-bypass limiter per-agen (tak dibatasi 100/jam)", () => {
  const agentId = "agent-auth-bypass";
  // Jauh melampaui cap; semua harus lolos karena terautentikasi.
  for (let i = 0; i < AGENT_MAX_UNAUTHENTICATED + 50; i++) {
    const r = fakeRes();
    const passed = run(authedReq(agentId), r.res);
    assert.equal(passed, true, `request login ke-${i + 1} harus lolos`);
    assert.equal(r.statusCode, null, "request login tidak boleh kena 429");
  }
});

// ── 2. Anonim di bawah cap lolos; melewati cap → 429 + Retry-After ───────────
test("anonim: lolos sampai cap, lalu 429 dengan Retry-After", () => {
  const agentId = "agent-anon-cap";

  // Tepat AGENT_MAX_UNAUTHENTICATED request pertama harus lolos.
  for (let i = 0; i < AGENT_MAX_UNAUTHENTICATED; i++) {
    const r = fakeRes();
    const passed = run(anonReq(agentId), r.res);
    assert.equal(passed, true, `anonim ke-${i + 1} (<= cap) harus lolos`);
    assert.equal(r.statusCode, null, "belum boleh 429 di bawah/di cap");
  }

  // Request berikutnya melewati cap → harus 429.
  const blocked = fakeRes();
  const passed = run(anonReq(agentId), blocked.res);
  assert.equal(passed, false, "request melewati cap tidak boleh lolos");
  assert.equal(blocked.statusCode, 429, "melewati cap harus 429");
  assert.ok(
    blocked.headers["Retry-After"],
    "respons 429 harus menyertakan header Retry-After",
  );
  const retryAfter = Number(blocked.headers["Retry-After"]);
  assert.ok(
    Number.isFinite(retryAfter) && retryAfter > 0,
    "Retry-After harus angka detik positif",
  );
});

// ── 3. Setelah window reset, anonim lolos lagi (kendalikan waktu) ────────────
test("setelah window reset, anonim lolos lagi", () => {
  const agentId = "agent-window-reset";
  const realNow = Date.now;
  const t0 = 1_000_000_000_000; // basis waktu tetap
  try {
    Date.now = () => t0;

    // Habiskan cap pada window pertama.
    for (let i = 0; i < AGENT_MAX_UNAUTHENTICATED; i++) {
      const r = fakeRes();
      assert.equal(run(anonReq(agentId), r.res), true);
    }
    // Konfirmasi terblokir di window pertama.
    const blocked = fakeRes();
    assert.equal(run(anonReq(agentId), blocked.res), false);
    assert.equal(blocked.statusCode, 429);

    // Majukan waktu melewati akhir window → entri harus reset.
    Date.now = () => t0 + AGENT_WINDOW_MS + 1;

    const afterReset = fakeRes();
    const passed = run(anonReq(agentId), afterReset.res);
    assert.equal(passed, true, "setelah reset window, anonim harus lolos lagi");
    assert.equal(afterReset.statusCode, null, "setelah reset tidak boleh 429");
  } finally {
    Date.now = realNow;
  }
});

// ── 4. Tanpa agentId di body → middleware lolos begitu saja ──────────────────
test("tanpa agentId di body → lolos (limiter tak berlaku)", () => {
  const r = fakeRes();
  const passed = run(anonReq(undefined), r.res);
  assert.equal(passed, true, "tanpa agentId harus lolos");
  assert.equal(r.statusCode, null, "tanpa agentId tidak boleh 429");
});
