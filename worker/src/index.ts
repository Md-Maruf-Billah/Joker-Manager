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
  "/api/dashboard": { methods: ["GET"] },
  "/api/tv": { methods: ["GET"] },
  "/api/tournament-types": { methods: ["GET"] },
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
  "/api/auth/verify-pin": { methods: ["POST"] }
};

// Apps Script requests are inherently slow (typically multiple seconds).
// Read-only GET routes are cached at the edge for a few seconds so repeat
// visits and multiple staff loading the same page don't each pay that
// latency. Cache keys are normalized to just the path+query (not origin) so
// every client shares one entry. Every successful write purges all of these
// so nobody ever sees stale data immediately after their own action.
const CACHEABLE_GET_ROUTES = new Set([
  "/api/dashboard",
  "/api/tv",
  "/api/tournament-types",
  "/api/draw/pending",
  "/api/cards",
  "/api/history",
  "/api/admin/audit-log",
  "/api/admin/staff"
]);
const CACHE_TTL_SECONDS = 8;

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
  ctx.waitUntil(
    Promise.all([...CACHEABLE_GET_ROUTES].map((path) => cache.delete(cacheKeyFor(path, ""))))
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

    if (isCacheableGet) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const text = await cached.text();
        return new Response(text, {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "x-cache": "hit",
            ...corsHeaders(request, env)
          }
        });
      }
    }

    try {
      const body = await readBody(request);
      const query: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        query[key] = value;
      });

      const upstream = await fetch(env.APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          token: env.APPS_SCRIPT_TOKEN,
          path: url.pathname,
          method: request.method,
          query,
          body
        })
      });

      const text = await upstream.text();

      if (isCacheableGet && upstream.ok) {
        ctx.waitUntil(
          cache.put(
            cacheKey,
            new Response(text, {
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": `max-age=${CACHE_TTL_SECONDS}`
              }
            })
          )
        );
      } else if (request.method !== "GET" && upstream.ok) {
        await purgeReadCache(ctx);
      }

      return new Response(text, {
        status: upstream.ok ? 200 : upstream.status,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-cache": "miss",
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
