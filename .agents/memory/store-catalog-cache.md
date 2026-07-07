---
name: Store catalog cache
description: Why GET /api/store/catalog is cached and how staleness is bounded
---

# Store catalog caching

`GET /api/store/catalog` (server/routes.ts) computes its item list by fetching
ALL active agents (900+ rows, heavy text/jsonb columns), running a child-count
group-by, then filtering/mapping/paginating in memory. Doing that per-request
made p95 ≈ 2.5s @ 40 concurrency.

Fix: a module-level cache keyed by `(category, search)` holds the fully-computed
item list; pagination stays per-request (slice). It uses:
- 30s fresh TTL + single-flight (concurrent misses trigger ONE build),
- stale-while-revalidate up to ~10 min (serve stale instantly, refresh in bg),
- bounded map (max 100 keys) so user-supplied search terms can't grow it,
- boot pre-warm of the default (no-filter) listing.

**Why:** the expensive cost is the enrich-all-agents query, not pool exhaustion;
caching + single-flight collapses a stampede into one build. Warm p95 ≈ 190ms.

**How to apply:** the catalog reflects data changes within ~30s (fresh TTL),
longer if served stale. That lag is acceptable for a public listing but if a
future feature needs immediate reflection (e.g. admin toggling isListed and
expecting instant visibility), add explicit cache invalidation on that mutation
rather than shortening the TTL. Same pattern fits other fetch-everything-then-
paginate public GETs.
