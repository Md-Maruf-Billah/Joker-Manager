# Joker Manager

Internal tracking and TV display tool for PlayLive Melbourne Joker Jackpot promotion.

This repo now contains:

- React + Vite + TypeScript frontend.
- Tailwind UI with Radix primitives and Lucide icons.
- Local mock API mode for staff-flow testing before Google Sheets is connected.
- Cloudflare Worker API gateway scaffold.
- Google Apps Script backend with Google Sheets setup and write locking.

## Local Development

Install dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev
```

Open the Vite URL and sign in with:

- Staff demo: `staff` / `7777`

Same account is used for login, draw submission, jackpot adjustment, and tournament type edits.

If `VITE_API_BASE_URL` is not set, the frontend uses local browser storage and mock business logic. Once the Worker is deployed, add a `.env.local` file:

```bash
VITE_API_BASE_URL=https://your-worker.your-subdomain.workers.dev
```

## Routes

- `/login`
- `/dashboard`
- `/add-tournament`
- `/draw-result`
- `/history`
- `/admin`
- `/tv`

## Build

```bash
npm run build
```

Cloudflare Pages should build with `npm run build` and publish `dist`.

## Preview Built App

```bash
npm run serve:dist
```

## Clean Generated Files

```bash
npm run clean
```
