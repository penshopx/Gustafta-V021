import { rateLimit, ipKeyGenerator, type Options } from "express-rate-limit";
import type { Request, Response } from "express";

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function getUserId(req: Request): string | null {
  const r = req as any;
  return r.user?.claims?.sub || r.user?.id || r.session?.emailUser?.id || null;
}

function isAuthenticatedUser(req: Request): boolean {
  const r = req as any;
  if (r.isAuthenticated && r.isAuthenticated()) return true;
  if (r.session?.emailUser?.id) return true;
  return false;
}

function isAdminUser(req: Request): boolean {
  const userId = getUserId(req);
  if (!userId) return false;
  return ADMIN_USER_IDS.includes(String(userId));
}

/**
 * Mode Event — dipakai saat soft-launch / acara dengan lonjakan peserta serempak
 * (mis. Indobuildtech 2026). Saat aktif, batas per-akun & per-IP dinaikkan supaya
 * ratusan peserta yang sah tidak saling mengunci.
 *
 * Aktivasi (env, tanpa perlu deploy ulang kode):
 *  - EVENT_MODE = "on" / "1" / "true"  → paksa aktif
 *  - EVENT_MODE = "off"                → paksa nonaktif
 *  - atau rentang tanggal: EVENT_MODE_START & EVENT_MODE_END (ISO, mis. 2026-07-08)
 *    → aktif otomatis selama sekarang berada di dalam rentang.
 */
export function isEventMode(now: Date = new Date()): boolean {
  const flag = (process.env.EVENT_MODE || "").trim().toLowerCase();
  if (["on", "1", "true", "yes"].includes(flag)) return true;
  if (["off", "0", "false", "no"].includes(flag)) return false;

  const startRaw = (process.env.EVENT_MODE_START || "").trim();
  const endRaw = (process.env.EVENT_MODE_END || "").trim();
  if (!startRaw && !endRaw) return false;

  const t = now.getTime();
  const start = startRaw ? Date.parse(startRaw) : Number.NEGATIVE_INFINITY;
  const end = endRaw ? Date.parse(endRaw) : Number.POSITIVE_INFINITY;
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return t >= start && t <= end;
}

// Batas per menit untuk endpoint chat.
function intEnv(name: string, fallback: number): number {
  const n = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}
const AUTH_LIMIT_NORMAL = intEnv("CHAT_LIMIT_AUTH", 120);
const AUTH_LIMIT_EVENT = intEnv("CHAT_LIMIT_AUTH_EVENT", 240);
const ANON_LIMIT_NORMAL = intEnv("CHAT_LIMIT_ANON", 30);
const ANON_LIMIT_EVENT = intEnv("CHAT_LIMIT_ANON_EVENT", 60);

const retryAfterHandler = (
  _req: Request,
  res: Response,
  _next: any,
  options: Options
) => {
  const windowSec = Math.ceil((options.windowMs as number) / 1000);
  res.setHeader("Retry-After", String(windowSec));
  res.status(429).json({
    error: "Too Many Requests",
    message: "Terlalu banyak permintaan. Silakan coba lagi nanti.",
    retryAfter: windowSec,
  });
};

/**
 * Batas per-menit efektif untuk sebuah request chat.
 * Admin → 0 (di-skip terpisah). User login dapat kuota lebih besar dari anonim,
 * dan mode event menaikkan keduanya. Diekspor agar bisa diuji regresi langsung.
 */
export function chatRateLimitValue(req: Request, now: Date = new Date()): number {
  if (isAdminUser(req)) return 0;
  const event = isEventMode(now);
  if (isAuthenticatedUser(req)) return event ? AUTH_LIMIT_EVENT : AUTH_LIMIT_NORMAL;
  return event ? ANON_LIMIT_EVENT : ANON_LIMIT_NORMAL;
}

/**
 * Kunci bucket rate-limit untuk sebuah request chat.
 * User login dikunci per-AKUN (`user:<id>`) — BUKAN per-IP: di venue acara
 * ratusan peserta berbagi satu IP WiFi, jadi keying per-IP membuat mereka
 * saling mengunci. Anonim tetap dibatasi per-IP. Diekspor untuk uji regresi.
 */
export function chatRateLimitKey(req: Request): string {
  const userId = getUserId(req);
  if (isAuthenticatedUser(req) && userId) return `user:${userId}`;
  return ipKeyGenerator(req.ip ?? "");
}

export const chatIpRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: (req: Request) => chatRateLimitValue(req),
  keyGenerator: (req: Request) => chatRateLimitKey(req),
  skip: (req: Request) => isAdminUser(req),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: retryAfterHandler as any,
  message: "Terlalu banyak permintaan dari IP ini.",
});

const agentIdStore = new Map<string, { count: number; resetAt: number }>();
const AGENT_WINDOW_MS = 60 * 60 * 1000;
const AGENT_MAX_UNAUTHENTICATED = 100;

export function chatAgentIdRateLimiter(
  req: Request,
  res: Response,
  next: () => void
) {
  if (isAuthenticatedUser(req)) return next();

  const agentId = req.body?.agentId;
  if (!agentId) return next();

  const now = Date.now();
  const key = String(agentId);
  const entry = agentIdStore.get(key);

  if (!entry || now >= entry.resetAt) {
    agentIdStore.set(key, { count: 1, resetAt: now + AGENT_WINDOW_MS });
    return next();
  }

  entry.count += 1;
  if (entry.count > AGENT_MAX_UNAUTHENTICATED) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(429).json({
      error: "Too Many Requests",
      message:
        "Agen ini telah mencapai batas permintaan per jam. Silakan coba lagi nanti.",
      retryAfter: retryAfterSec,
    });
  }

  return next();
}

// .unref(): timer pembersih tak boleh menahan event loop tetap hidup.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of agentIdStore) {
      if (now >= entry.resetAt) agentIdStore.delete(key);
    }
  },
  10 * 60 * 1000
).unref();
