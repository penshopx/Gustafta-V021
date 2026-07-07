---
name: Access-code voucher system
description: How participant voucher/access codes grant subscription access; the safety rules that must hold.
---

# Access-code voucher system

Voucher codes (e.g. offline-seminar bonuses) let a logged-in user self-redeem a code → an active subscription grant, with no payment. Tables: `access_codes` + `access_code_redemptions` (unique index on `(code_id, user_id)`).

## Rules that must hold (learned via review)

- **Redeem must NEVER touch `users.isActive`.** `isActive` defaults to `true` for new signups and only becomes `false` via deliberate admin suspend/pending. Forcing it `true` on redeem is an account-state bypass (reactivates suspended/blocked users). Tier access is unlocked by the *subscription grant alone*, not this flag.
  - **Why:** architect flagged it as a serious authz bypass; suspended accounts must stay suspended.

- **Grant is a normal active subscription**, mirroring the early-adopter grant path: PLAN_CONFIGS-derived `chatbotLimit`, `amount:0`, and `grantedBy` = the code's `createdBy` (audit — every admin-mediated active-sub insert must stamp grantedBy). Redemption expires the user's prior active subs then inserts one new active row (single "active" invariant).

- **Redemption is atomic** inside one `db.transaction`: quota guarded by conditional `UPDATE ... WHERE redemption_count < max_redemptions RETURNING` (0 rows → `exhausted`); same-user double-redeem prevented by the unique index. The transaction's `.catch` maps unique-conflict (23505 / `uniq_access_code_redemption` / duplicate key) to `{ok:false, reason:"already"}` so a losing concurrent request returns a clean business 400, not a 500. Non-constraint errors rethrow.

- Storage methods (`createAccessCode`/`listAccessCodes`/`setAccessCodeActive`/`redeemAccessCode`) are called via `(storage as any)` — intentionally NOT on IStorage/MemStorage, matching the existing `getSubscriptionById` convention.

## How to apply
When adding new unique constraints inside `redeemAccessCode`'s transaction, narrow the `.catch` match to the specific constraint name so unrelated conflicts aren't silently remapped to "already".
