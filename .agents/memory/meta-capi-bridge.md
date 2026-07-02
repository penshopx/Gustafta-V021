---
name: Meta CAPI bridge
description: Server-side Purchase events to Meta from the Scalev webhook — why it exists and its invariants
---

# Meta Conversions API bridge (Scalev → Meta)

**Rule:** Purchase tracking to Meta runs server-side from the Scalev webhook (`server/lib/meta-capi.ts`), fire-and-forget — it must NEVER block or fail the webhook response, and it must skip gracefully when `META_CAPI_ACCESS_TOKEN`/`META_PIXEL_ID` are unset.

**Why:** The user's direct Scalev↔Meta integration keeps failing, so Gustafta relays events. Scalev retries webhooks; Meta dedups via `event_id = scalev_{orderId}` so replays are safe even before the store order is recorded.

**How to apply:**
- Per-agent `agents.metaPixelId` overrides the platform `META_PIXEL_ID` (resolved via scalev mapping → agent).
- PII must be SHA-256 hashed & normalized (email lowercase/trim; Indonesian phone digits-only with leading 0 → 62).
- Access token goes in the POST body, not the URL (avoids proxy/log leakage).
- Verify config via admin endpoints `/api/admin/meta-capi/status` and `/test` (supports `test_event_code` → Meta Events Manager Test Events tab).
