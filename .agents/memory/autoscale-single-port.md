---
name: Autoscale single-port requirement
description: Why a Gustafta autoscale publish can fail at "Creating Autoscale service" with no runtime logs, and how port mappings get polluted.
---

# Autoscale deployments require exactly ONE external port

**Rule:** Replit Autoscale deployments support only a single external port. If `.replit` has more than one `[[ports]]` block with an `externalPort`, the publish **fails at the "Creating Autoscale service" (promote) step** — the build phase succeeds (image compiles + pushes), then service creation fails, and **no runtime deployment logs are captured** (the container never starts serving). This looks identical to a crash/health-check failure but the app is actually fine.

**Why:** Autoscale can't route to multiple external ports, so it rejects the service.

**How to apply / diagnose:**
- If a publish fails at "Creating Autoscale service" with no runtime logs, FIRST check `grep -c "\[\[ports\]\]" .replit`. More than one = the cause. Rule out crash/OOM/slow-boot only after confirming port count is 1.
- The fix is a **user UI action**: open the Ports pane and remove every port row except the app's main one (`localPort 5000 → externalPort 80`). The agent CANNOT edit `.replit` directly (blocked) and there is no agent tool for port removal.

**Gotcha — testing pollutes `.replit`:** Running a local server on a non-5000 port (e.g. `NODE_ENV=production PORT=5050 node dist/index.cjs` to test the prod build) makes Replit auto-add that port to `.replit` as a new `[[ports]]` block. These stale entries persist after the process is killed and will break the next autoscale publish. When testing the prod build locally, prefer port 5000, or expect to have the extra port removed before publishing. The mockup-sandbox dev workflow also adds its own port (e.g. 23636 → 3001) — that too must be gone before an autoscale publish.

**Verified healthy signals for Gustafta prod build (so you can skip re-checking these):** `npm run build` succeeds; `NODE_ENV=production node dist/index.cjs` boots in ~1s, serves `GET /` 200 in ~30ms, peak RSS ~331 MB (far under the 4 GB cr-2-4 machine); all env vars/secrets present in both dev and prod. So a promote failure is NOT code/env/memory — look at port config first.
