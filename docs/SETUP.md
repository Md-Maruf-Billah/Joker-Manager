# Setup Guide

## 1. Frontend

Install and run locally:

```bash
npm install
npm run dev
```

In mock mode, data is stored in browser local storage. Clear site data or use another browser profile to reset manually.

## 2. Google Sheet

1. Create a Google Sheet named `Joker Jackpot Database`.
2. Open Extensions, Apps Script.
3. Copy `apps-script/Code.gs` into the Apps Script editor.
4. Copy `apps-script/appsscript.json` into the manifest.
5. In Apps Script project settings, add a script property:

```text
SERVER_TOKEN=your-long-random-token
```

6. Run `setupJokerJackpotDatabase`.
7. Deploy as a Web App.
8. Set access to anyone with the link. The Apps Script still rejects requests without `SERVER_TOKEN`.

## 3. Cloudflare Worker

From `worker/`:

```bash
npm install
copy wrangler.toml.example wrangler.toml
wrangler secret put APPS_SCRIPT_URL
wrangler secret put APPS_SCRIPT_TOKEN
npm run deploy
```

Use the Web App URL for `APPS_SCRIPT_URL`. Use the same token for `APPS_SCRIPT_TOKEN` and Apps Script `SERVER_TOKEN`.

## 4. Cloudflare Pages

In the frontend project:

- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://your-worker-url`

## 5. Production Staff Password

The setup script creates one demo staff account:

- Username: `staff`
- Password: `7777`

Replace it before live use. Passwords are stored as salted SHA-256 hashes by Apps Script, not raw values.
