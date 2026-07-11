// Deployed automatically via Cloudflare Workers Builds on push to main.
export interface Env {
  APPS_SCRIPT_URL: string;
  APPS_SCRIPT_TOKEN: string;
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
  "/api/auth/verify-pin": { methods: ["POST"] }
};

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
  "/api/admin/staff"
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
  "/api/admin/tv-message/clear"
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
  ["/api/admin/staff", ""]
] as const;

const WARM_AFTER_WRITE_KEYS = [
  ["/api/dashboard", ""],
  ["/api/tv", ""],
  ["/api/bootstrap/draw", ""]
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

async function fetchUpstream(env: Env, pathname: string, method: string, query: Record<string, string>, body: unknown) {
  const upstream = await fetch(env.APPS_SCRIPT_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      token: env.APPS_SCRIPT_TOKEN,
      path: pathname,
      method,
      query,
      body
    })
  });

  return {
    ok: upstream.ok,
    status: upstream.status,
    text: await upstream.text()
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
  const upstream = await fetchUpstream(env, pathname, "GET", queryFromUrl(url), null);

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
      const upstream = await fetchUpstream(env, url.pathname, request.method, queryFromUrl(url), body);

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
