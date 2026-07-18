// Deployed automatically via Cloudflare Workers Builds on push to main.
export interface Env {
  APPS_SCRIPT_URL: string;
  APPS_SCRIPT_TOKEN: string;
  WAITLIST_APPS_SCRIPT_URL: string;
  WAITLIST_APPS_SCRIPT_TOKEN: string;
  ALLOWED_ORIGINS?: string;
}

type RouteConfig = {
  methods: string[];
};

const routes: Record<string, RouteConfig> = {
  "/api/auth/login-bootstrap": { methods: ["POST"] },
  "/api/dashboard": { methods: ["GET"] },
  "/api/tv": { methods: ["GET"] },
  "/api/tournament-types": { methods: ["GET"] },
  "/api/bootstrap/add-tournament": { methods: ["GET"] },
  "/api/bootstrap/draw": { methods: ["GET"] },
  "/api/bootstrap/history": { methods: ["GET"] },
  "/api/bootstrap/admin": { methods: ["GET"] },
  "/api/tournament-types/save": { methods: ["POST"] },
  "/api/tournament/create": { methods: ["POST"] },
  "/api/draw/pending": { methods: ["GET"] },
  "/api/cards": { methods: ["GET"] },
  "/api/draw/submit": { methods: ["POST"] },
  "/api/history": { methods: ["GET"] },
  "/api/run/edit": { methods: ["POST"] },
  "/api/run/void": { methods: ["POST"] },
  "/api/admin/adjustment": { methods: ["POST"] },
  "/api/admin/audit-log": { methods: ["GET"] },
  "/api/admin/export-backup": { methods: ["GET"] },
  "/api/admin/staff": { methods: ["GET"] },
  "/api/admin/staff/create": { methods: ["POST"] },
  "/api/admin/staff/set-pin": { methods: ["POST"] },
  "/api/admin/staff/set-active": { methods: ["POST"] },
  "/api/admin/tv-message/push": { methods: ["POST"] },
  "/api/admin/tv-message/clear": { methods: ["POST"] },
  "/api/auth/verify-pin": { methods: ["POST"] },
  "/api/waitlist/bootstrap": { methods: ["GET"] },
  "/api/waitlist/board": { methods: ["GET"] },
  "/api/waitlist/entries/create": { methods: ["POST"] },
  "/api/waitlist/entries/remove": { methods: ["POST"] },
  "/api/waitlist/games/save": { methods: ["POST"] }
};

// The Waitlist feature lives on a completely separate Google Sheet and Apps
// Script deployment from Joker Jackpot (own execution-time quota, zero shared
// data). Staff still log in with one shared password, though: rather than
// duplicating the Staff roster into the Waitlist sheet (which would drift out
// of sync), every waitlist WRITE is authenticated here in the Worker by first
// calling Joker Jackpot's existing, unmodified /api/auth/verify-pin route,
// and only forwarded to the Waitlist Apps Script once that succeeds. Reads
// (the board and bootstrap) need no auth and go straight to the Waitlist
// upstream, same as every other public GET route in this app.
const WAITLIST_PATH_PREFIX = "/api/waitlist/";
const WAITLIST_AUTH_ROUTES = new Set([
  "/api/waitlist/entries/create",
  "/api/waitlist/entries/remove",
  "/api/waitlist/games/save"
]);

type Upstream = { url: string; token: string };

function jackpotUpstream(env: Env): Upstream {
  return { url: env.APPS_SCRIPT_URL, token: env.APPS_SCRIPT_TOKEN };
}

function upstreamFor(env: Env, pathname: string): Upstream {
  if (pathname.startsWith(WAITLIST_PATH_PREFIX)) {
    return { url: env.WAITLIST_APPS_SCRIPT_URL, token: env.WAITLIST_APPS_SCRIPT_TOKEN };
  }
  return jackpotUpstream(env);
}

// Apps Script requests are inherently slow (typically multiple seconds).
// Read-only GET routes are cached at the edge and kept as a stale fallback
// after the short freshness window. That lets screens render immediately
// while the Worker refreshes slow Sheet reads in the background. Cache keys
// are normalized to just the path+query (not origin) so every client shares
// one entry. Every successful write purges the read cache before returning,
// then warms the routes staff and TV screens are most likely to need next.
const CACHEABLE_GET_ROUTES = new Set([
  "/api/dashboard",
  "/api/tv",
  "/api/tournament-types",
  "/api/bootstrap/add-tournament",
  "/api/bootstrap/draw",
  "/api/bootstrap/history",
  "/api/bootstrap/admin",
  "/api/draw/pending",
  "/api/cards",
  "/api/history",
  "/api/admin/audit-log",
  "/api/admin/staff",
  "/api/waitlist/bootstrap",
  "/api/waitlist/board"
]);
const MUTATING_ROUTES = new Set([
  "/api/tournament-types/save",
  "/api/tournament/create",
  "/api/draw/submit",
  "/api/run/edit",
  "/api/run/void",
  "/api/admin/adjustment",
  "/api/admin/staff/create",
  "/api/admin/staff/set-pin",
  "/api/admin/staff/set-active",
  "/api/admin/tv-message/push",
  "/api/admin/tv-message/clear",
  "/api/waitlist/entries/create",
  "/api/waitlist/entries/remove",
  "/api/waitlist/games/save"
]);
// The TV display polls every 30s (see TvDisplayPage.tsx). Every poll that lands
// past the freshness window triggers a background Apps Script call, and each of
// those measured ~4-9s in production. A short window (this used to be 8s) means
// almost every single TV poll pays that cost, continuously, for as long as any
// screen is open — both slower for viewers and a meaningful, needless amount of
// load against the Apps Script account's execution quota. Any real state change
// (a tournament created, a draw submitted, etc.) already purges and immediately
// re-warms the cache on write, so genuine freshness never depends on this window
// — it only controls how long an *idle* cache entry survives before Apps Script
// gets called again. Keeping it just under the TV's poll interval means routine
// polling almost always hits a warm cache instead of re-triggering a fetch.
const CACHE_FRESH_SECONDS = 25;
const CACHE_RETAIN_SECONDS = 6 * 60 * 60;
const REFRESH_PARAM = "__jm_refresh";

const PURGE_CACHE_KEYS = [
  ["/api/dashboard", ""],
  ["/api/tv", ""],
  ["/api/tournament-types", ""],
  ["/api/tournament-types", "?includeInactive=true"],
  ["/api/bootstrap/add-tournament", ""],
  ["/api/bootstrap/draw", ""],
  ["/api/bootstrap/history", ""],
  ["/api/bootstrap/admin", ""],
  ["/api/draw/pending", ""],
  ["/api/cards", ""],
  ["/api/history", ""],
  ["/api/admin/audit-log", ""],
  ["/api/admin/staff", ""],
  ["/api/waitlist/bootstrap", ""],
  ["/api/waitlist/board", ""]
] as const;

const WARM_AFTER_WRITE_KEYS = [
  ["/api/dashboard", ""],
  ["/api/tv", ""],
  ["/api/bootstrap/draw", ""],
  ["/api/waitlist/board", ""]
] as const;

// @cloudflare/workers-types' CacheStorage type doesn't declare `default`
// even though the Workers runtime provides it (same class of gap as the
// URLSearchParams iterator issue elsewhere in this file).
function edgeCache(): Cache {
  return (caches as unknown as { default: Cache }).default;
}

function cacheKeyFor(pathname: string, search: string) {
  return new Request(`https://joker-manager-cache.internal${pathname}${search}`);
}

async function purgeReadCache(ctx: ExecutionContext) {
  const cache = edgeCache();
  const deletion = Promise.all(PURGE_CACHE_KEYS.map(([path, search]) => cache.delete(cacheKeyFor(path, search))));
  ctx.waitUntil(deletion);
  await deletion;
}

function queryFromUrl(url: URL) {
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return query;
}

async function fetchUpstream(upstream: Upstream, pathname: string, method: string, query: Record<string, string>, body: unknown) {
  const response = await fetch(upstream.url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      token: upstream.token,
      path: pathname,
      method,
      query,
      body
    })
  });

  return {
    ok: response.ok,
    status: response.status,
    text: await response.text()
  };
}

function cachedResponse(text: string) {
  return new Response(text, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `max-age=${CACHE_RETAIN_SECONDS}`,
      "x-jm-cached-at": String(Date.now())
    }
  });
}

async function refreshReadCache(env: Env, pathname: string, search: string) {
  const url = new URL(`https://joker-manager-cache.internal${pathname}${search}`);
  const upstream = await fetchUpstream(upstreamFor(env, pathname), pathname, "GET", queryFromUrl(url), null);

  if (upstream.ok) {
    await edgeCache().put(cacheKeyFor(pathname, search), cachedResponse(upstream.text));
  }
}

async function warmReadCache(env: Env) {
  await Promise.all(
    WARM_AFTER_WRITE_KEYS.map(([path, search]) =>
      refreshReadCache(env, path, search).catch(() => undefined)
    )
  );
}

function allowedOrigins(env: Env) {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders(request: Request, env: Env) {
  const requestOrigin = request.headers.get("origin") ?? "";
  const origins = allowedOrigins(env);
  const allowOrigin = origins.includes(requestOrigin) ? requestOrigin : origins[0] ?? "";

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin"
  };
}

function json(request: Request, env: Env, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(request, env)
    }
  });
}

async function readBody(request: Request) {
  if (request.method === "GET") {
    return null;
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Expected JSON request body.");
  }

  return request.json();
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env)
      });
    }

    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get(REFRESH_PARAM) === "1";
    url.searchParams.delete(REFRESH_PARAM);
    const route = routes[url.pathname];

    if (!route) {
      return json(request, env, { ok: false, error: "[JM-WORKER-001] Unknown API route." }, 404);
    }

    if (!route.methods.includes(request.method)) {
      return json(request, env, { ok: false, error: "[JM-WORKER-002] Method not allowed." }, 405);
    }

    const origin = request.headers.get("origin");
    const origins = allowedOrigins(env);
    if (origin && origins.length > 0 && !origins.includes(origin)) {
      return json(request, env, { ok: false, error: "[JM-WORKER-003] Origin is not allowed." }, 403);
    }

    const isCacheableGet = request.method === "GET" && CACHEABLE_GET_ROUTES.has(url.pathname);
    const cache = edgeCache();
    const cacheKey = cacheKeyFor(url.pathname, url.search);

    if (isCacheableGet && !forceRefresh) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const text = await cached.text();
        const cachedAt = Number(cached.headers.get("x-jm-cached-at") ?? "0");
        const ageSeconds = cachedAt ? Math.max(0, Math.round((Date.now() - cachedAt) / 1000)) : 0;
        const cacheState = ageSeconds > CACHE_FRESH_SECONDS ? "stale" : "hit";

        if (cacheState === "stale") {
          ctx.waitUntil(refreshReadCache(env, url.pathname, url.search));
        }

        return new Response(text, {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "x-cache": cacheState,
            "x-cache-age": String(ageSeconds),
            ...corsHeaders(request, env)
          }
        });
      }
    }

    try {
      const body = await readBody(request);

      if (WAITLIST_AUTH_ROUTES.has(url.pathname)) {
        const bodyRecord = (body ?? {}) as Record<string, unknown>;
        const authCheck = await fetchUpstream(jackpotUpstream(env), "/api/auth/verify-pin", "POST", {}, {
          staffName: bodyRecord.staffName,
          pin: bodyRecord.pin
        });
        const authPayload = authCheck.ok ? (JSON.parse(authCheck.text) as { ok: boolean; error?: string }) : { ok: false };

        if (!authCheck.ok || !authPayload.ok) {
          return json(request, env, { ok: false, error: authPayload.error ?? "[JM-WORKER-004] Authentication failed." }, 401);
        }
      }

      const upstream = await fetchUpstream(upstreamFor(env, url.pathname), url.pathname, request.method, queryFromUrl(url), body);

      if (isCacheableGet && upstream.ok) {
        ctx.waitUntil(
          cache.put(
            cacheKey,
            cachedResponse(upstream.text)
          )
        );
      } else if (MUTATING_ROUTES.has(url.pathname) && upstream.ok) {
        await purgeReadCache(ctx);
        ctx.waitUntil(warmReadCache(env));
      }

      return new Response(upstream.text, {
        status: upstream.ok ? 200 : upstream.status,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-cache": forceRefresh ? "refresh" : "miss",
          ...corsHeaders(request, env)
        }
      });
    } catch (error) {
      return json(
        request,
        env,
        {
          ok: false,
          error: error instanceof Error ? `[JM-WORKER-900] ${error.message}` : "[JM-WORKER-900] Worker request failed."
        },
        500
      );
    }
  }
};
