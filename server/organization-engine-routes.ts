/**
 * ============================================================================
 * ORGANIZATION ENGINE — ROUTES (Fase 3 / Tahap 21)
 * ============================================================================
 *
 * Lapisan tipis yang MENYAMBUNGKAN engine Organisasi (Tahap 18–20, pure) ke
 * HTTP API. Sejajar dengan `blueprint-engine-routes.ts` (single-agent), tetapi
 * untuk merancang & mewujudkan SEBUAH TIM agen (orchestrator + spesialis).
 *
 * Semua endpoint stateless — klien membawa OrganizationBlueprint JSON di setiap
 * panggilan. Hanya `/configure` yang MENULIS ke DB, dan itupun:
 *   - default `dryRun:true` (aman; klien WAJIB kirim dryRun:false untuk menulis),
 *   - penulisan nyata berjalan ATOMIK di dalam satu transaksi (lihat engine),
 *   - SETIAP agen di-stamp `ownerUserId` = user sesi (muncul di dashboard-nya).
 *
 * Alur:
 *   analyze   → lint + validasi (read-only)
 *   configure → materialisasi tim lewat Organization Configuration Engine
 * ============================================================================
 */

import type { Express, Request, Response } from "express";
import { isAuthenticated } from "./replit_integrations/auth";
import {
  organizationBlueprintSchema,
  lintOrganizationBlueprint,
  type OrganizationBlueprint,
} from "@shared/blueprint/organization-blueprint-schema";
import { mapOrganizationToBuilder } from "./services/blueprint-engine/organization-mapping-engine";
import { applyOrganizationToBuilder } from "./services/blueprint-engine/organization-configuration-engine";
import { suggestTeamComposition } from "./services/blueprint-engine/organization-dialogue-engine";

/* ===========================================================================
 * Helper
 * ======================================================================== */

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Validasi body.organization → OrganizationBlueprint terketik. */
function parseOrganization(raw: unknown): OrganizationBlueprint {
  const parsed = organizationBlueprintSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new HttpError(400, `Organisasi tidak valid: ${issues}`);
  }
  return parsed.data;
}

/** Ambil id user dari sesi (pola sama dengan route existing). */
function sessionUserId(req: Request): string {
  const u = req.user as any;
  return u?.claims?.sub || u?.id || "";
}

/** Bungkus handler async → tangani HttpError & error tak terduga jadi JSON. */
function handler(fn: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof HttpError) {
        res.status(e.status).json({ error: e.message });
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: `Organization engine error: ${message}` });
    }
  };
}

/* ===========================================================================
 * Registrasi route
 * ======================================================================== */

export function registerOrganizationEngineRoutes(app: Express): void {
  /**
   * POST /api/organization/analyze  (read-only)
   * Body: { organization }
   * → lint organisasi + ringkasan rencana (jumlah agen, wiring) tanpa menulis.
   */
  app.post(
    "/api/organization/analyze",
    isAuthenticated,
    handler(async (req, res) => {
      const org = parseOrganization(req.body?.organization);
      const plan = mapOrganizationToBuilder(org);
      res.json({
        lint: lintOrganizationBlueprint(org),
        plan: {
          memberCount: plan.members.length,
          orchestratorCount: plan.members.filter((m) => m.role === "orchestrator").length,
          wiring: plan.wiring.map((w) => ({
            orchestratorLocalId: w.orchestratorLocalId,
            subAgentCount: w.subAgents.length,
          })),
          warnings: plan.warnings,
        },
      });
    }),
  );

  /**
   * POST /api/organization/configure
   * Body: { organization, dryRun?, mapping? }
   * → Wujudkan tim lewat Organization Configuration Engine.
   *
   * KEAMANAN: dryRun DEFAULT true. Klien WAJIB mengirim dryRun:false secara
   * eksplisit untuk benar-benar menulis ke DB. Penulisan nyata berjalan ATOMIK
   * (semua-atau-tidak) dan men-stamp kepemilikan ke user sesi.
   */
  app.post(
    "/api/organization/configure",
    isAuthenticated,
    handler(async (req, res) => {
      const org = parseOrganization(req.body?.organization);

      const userId = sessionUserId(req);
      if (!userId) throw new HttpError(401, "Sesi tidak valid.");

      // Default aman: tidak menulis kecuali klien minta eksplisit dryRun:false.
      const dryRun = req.body?.dryRun !== false;

      const result = await applyOrganizationToBuilder(org, {
        dryRun,
        mapping: req.body?.mapping,
        // Setiap agen tim dimiliki user pembuat (agar muncul di dashboard-nya).
        ownerUserId: userId,
      });

      res.json(result);
    }),
  );

  /**
   * POST /api/organization/suggest  (read-only)
   * Body: { mission, maxSpecialists? }
   * → Saran komposisi tim deterministik dari teks misi (Tahap 23 engine).
   *   Mengembalikan { domain, members } untuk diisi ke wizard — TIDAK menulis
   *   apa pun & tidak membangun OrganizationBlueprint penuh (klien yang merakit).
   */
  app.post(
    "/api/organization/suggest",
    isAuthenticated,
    handler(async (req, res) => {
      const mission = typeof req.body?.mission === "string" ? req.body.mission : "";
      if (!mission.trim()) throw new HttpError(400, "Misi tim belum diisi.");

      const raw = Number(req.body?.maxSpecialists);
      const maxSpecialists = Number.isFinite(raw)
        ? Math.max(1, Math.min(5, Math.floor(raw)))
        : 3;

      res.json(suggestTeamComposition(mission, { maxSpecialists }));
    }),
  );
}
