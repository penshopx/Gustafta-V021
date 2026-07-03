import { createHash } from "crypto";

const GRAPH_API_VERSION = "v21.0";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  }
  return digits;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export interface MetaPurchaseParams {
  orderId: string;
  value: number;
  currency?: string;
  email?: string;
  phone?: string;
  name?: string;
  contents?: Array<{ id: string; quantity: number }>;
  contentName?: string;
  pixelId?: string;
  eventSourceUrl?: string;
  testEventCode?: string;
  eventName?: string;
  /** Browser attribution cookies forwarded from checkout (sent to Meta as-is, NOT hashed). */
  fbp?: string;
  fbc?: string;
  /** Optional stable identifier for the buyer (hashed before send). */
  externalId?: string;
}

export interface MetaCapiResult {
  sent: boolean;
  skippedReason?: string;
  eventsReceived?: number;
  fbtraceId?: string;
  error?: string;
}

function sanitizePixelId(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/[^0-9]/g, "");
  return digits || undefined;
}

function sanitizeToken(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.replace(/\s+/g, "");
  return trimmed || undefined;
}

export function isMetaCapiConfigured(): boolean {
  return !!(
    sanitizeToken(process.env.META_CAPI_ACCESS_TOKEN) &&
    sanitizePixelId(process.env.META_PIXEL_ID)
  );
}

export async function sendMetaPurchaseEvent(params: MetaPurchaseParams): Promise<MetaCapiResult> {
  const accessToken = sanitizeToken(process.env.META_CAPI_ACCESS_TOKEN);
  const pixelId = sanitizePixelId(params.pixelId) || sanitizePixelId(process.env.META_PIXEL_ID);

  if (!accessToken) {
    return { sent: false, skippedReason: "META_CAPI_ACCESS_TOKEN belum diset" };
  }
  if (!pixelId) {
    return { sent: false, skippedReason: "META_PIXEL_ID belum diset (dan tidak ada pixel per-agen)" };
  }

  const userData: Record<string, string[] | string> = {};
  if (params.email) userData.em = [sha256(normalizeEmail(params.email))];
  if (params.phone) userData.ph = [sha256(normalizePhone(params.phone))];
  if (params.name) {
    const parts = params.name.trim().split(/\s+/);
    if (parts[0]) userData.fn = [sha256(normalizeName(parts[0]))];
    if (parts.length > 1) userData.ln = [sha256(normalizeName(parts[parts.length - 1]))];
  }
  if (params.externalId) userData.external_id = [sha256(params.externalId.trim().toLowerCase())];
  // Browser cookies are sent as-is (Meta requirement — do NOT hash fbp/fbc).
  if (params.fbp) userData.fbp = params.fbp;
  if (params.fbc) userData.fbc = params.fbc;

  if (!userData.em && !userData.ph && !userData.fbp && !userData.fbc) {
    return { sent: false, skippedReason: "Tidak ada sinyal matching (email/telepon/fbp/fbc)" };
  }

  const event: Record<string, any> = {
    event_name: params.eventName || "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    event_id: `scalev_${params.orderId}`,
    action_source: "website",
    user_data: userData,
    custom_data: {
      currency: params.currency || "IDR",
      value: params.value,
      ...(params.contentName ? { content_name: params.contentName } : {}),
      ...(params.contents?.length
        ? { contents: params.contents, content_type: "product" }
        : {}),
    },
  };
  if (params.eventSourceUrl) event.event_source_url = params.eventSourceUrl;

  const body: Record<string, any> = { data: [event] };
  const testCode = params.testEventCode || process.env.META_TEST_EVENT_CODE;
  if (testCode) body.test_event_code = testCode;

  body.access_token = accessToken;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );
    const json: any = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = json?.error?.message || `HTTP ${resp.status}`;
      console.error(`[Meta CAPI] Gagal kirim event (pixel ${pixelId}):`, msg);
      return { sent: false, error: msg, fbtraceId: json?.error?.fbtrace_id };
    }
    console.log(
      `[Meta CAPI] Purchase terkirim (pixel ${pixelId}, order ${params.orderId}): events_received=${json.events_received}`,
    );
    return { sent: true, eventsReceived: json.events_received, fbtraceId: json.fbtrace_id };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "Timeout 10 detik" : err?.message || String(err);
    console.error("[Meta CAPI] Error:", msg);
    return { sent: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}
