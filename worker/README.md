# Joker Manager Worker

The Worker is the public API gateway between the React app and Google Apps Script.

It does three jobs:

- Allows only known `/api/*` routes.
- Adds CORS headers for approved frontend origins.
- Attaches the private `APPS_SCRIPT_TOKEN` before forwarding to Apps Script.

## Setup

1. Copy `wrangler.toml.example` to `wrangler.toml`.
2. Set `ALLOWED_ORIGINS` to the Cloudflare Pages URL and any local dev URL.
3. Run `wrangler secret put APPS_SCRIPT_URL`.
4. Run `wrangler secret put APPS_SCRIPT_TOKEN`.
5. Deploy with `npm run deploy` from this folder.
