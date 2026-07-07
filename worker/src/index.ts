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
  async fetch(request: Request, env: Env): Promise<Response> {
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
      return new Response(text, {
        status: upstream.ok ? 200 : upstream.status,
        headers: {
          "content-type": "application/json; charset=utf-8",
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
