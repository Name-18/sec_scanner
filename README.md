# Security Header Scanner (MERN)

A full-stack tool that scans any website's HTTP response headers against
OWASP-recommended security headers, scores the site 0–100, assigns a grade
(A–F), and stores scan history in MongoDB.

## Stack
- **M**ongoDB — stores scan results/history
- **E**xpress — REST API (`/api/scan`, `/api/scans`)
- **R**eact (Vite) — dashboard UI
- **N**ode.js — server runtime
- **Gemini 2.5 Flash** — generates a short, prioritized fix plan from the scan results (same model family as TrustHire)

## GenAI feature: AI Fix Summary
After a scan, click "Generate" under **AI Fix Summary** to get a short,
prioritized, plain-English fix plan (with Express/helmet code snippets
where relevant) instead of reading through the raw header checklist.

- Only called on-demand (button click), not on every scan — keeps API usage low.
- Result is cached on the scan document in MongoDB, so re-visiting a scan
  from history doesn't re-call the API.
- **Fails gracefully**: if `GEMINI_API_KEY` is missing or the API call
  fails/times out, it falls back to a deterministic rule-based summary
  instead of breaking the feature — this is a good interview talking point
  (never let an external AI dependency take down a core feature).

### Setup
Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
and put it in `server/.env`:
```
GEMINI_API_KEY=your_key_here
```

## What it checks
Based on the OWASP Secure Headers Project:
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy` (CSP)
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `X-XSS-Protection` (legacy)
- `Set-Cookie` attributes (`Secure`, `HttpOnly`, `SameSite`) — only checked if the site sets cookies

Each header has a severity (high/medium/low) and contributes weighted points
to the final score. Missing or misconfigured headers show a specific
recommendation in the UI.

## Security notes (worth mentioning in interviews)
- The scan endpoint blocks `localhost`, `127.0.0.1`, and private IP ranges
  (`10.x`, `172.16–31.x`, `192.168.x`) to prevent the server being used for
  **SSRF** (Server-Side Request Forgery) against your own internal network.
- Requests have an 8s timeout and capped redirects to avoid hanging on
  malicious/slow targets.
- This tool only reads response headers — it does not attempt any actual
  exploitation, so it's safe to run against any public site you don't own
  (you're just checking what's publicly visible in the HTTP response).

## Setup

### 1. Prerequisites
- Node.js installed
- MongoDB running locally (or a MongoDB Atlas connection string)

### 2. Backend
```powershell
cd server
npm install
# .env already has PORT=5000 and MONGO_URI=mongodb://127.0.0.1:27017/sec-scanner
# edit MONGO_URI in .env if using Atlas instead of local MongoDB
npm start
```
Server runs on `http://localhost:5000`.

If you don't have `npm start` script yet, add this to `server/package.json`:
```json
"scripts": {
  "start": "node index.js"
}
```

### 3. Frontend
```powershell
cd client
npm install
npm run dev
```
Opens on `http://localhost:5173` (Vite default).

### 4. Use it
Open the frontend, type any domain (e.g. `github.com`, `google.com`,
your own deployed project's URL), hit Scan. Results + grade show instantly,
and past scans appear in the sidebar (click to revisit).

## API Reference

**POST** `/api/scan`
```json
{ "url": "example.com" }
```
Returns a scan document with `score`, `grade`, and `checks[]`.

**GET** `/api/scans`
Returns the 50 most recent scans, newest first.

**GET** `/api/scans/:id`
Returns a single scan by ID.

## Talking points for interviews
- **Why this project**: ties directly into HTTP/security fundamentals (OSI,
  headers, XSS/clickjacking/session hijacking defenses) rather than being a
  generic CRUD app.
- **SSRF prevention**: explain why you blocked private IPs before letting a
  server make outbound requests based on user input — a real vulnerability
  class (see: Capital One breach).
- **Scoring design**: weighted point system per header severity, not just a
  pass/fail count — shows you thought about prioritization.
- **Extensible**: easy to mention "next I'd add" — rate limiting on the scan
  endpoint, user accounts to save scan history per user, or a Node.js worker
  queue (Bull/Redis) if scanning became slow/heavy at scale.
- **GenAI integration**: explain why the AI summary is a separate, on-demand
  endpoint (cost control) and cached per scan (avoid redundant calls), plus
  the fallback-to-rule-based-summary design so an AI outage never breaks
  the core scanning feature — good systems-thinking to highlight.
