Deployment Plan

Overview
- Frontend: Vite SPA with PWA plugin, configured via `VITE_BACKEND_URL` and optional `GEMINI_API_KEY`.
- Backend: FastAPI + `httpx` client for Spotify Web API, in-memory sessions and token storage, CORS restricted to `FRONTEND_URL`.
- Spotify: Uses Authorization Code flow with refresh tokens, cookies (`sid`) for session identification.

Environments & Secrets
- Spotify: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`.
- Backend: `FRONTEND_URL` (exact origin), optional `SPOTIFY_SCOPES` override.
- Frontend: `VITE_BACKEND_URL`, optional `GEMINI_API_KEY`.

Recommended Topology (Stage → Prod)
1) Frontend on Vercel/Netlify; Backend on Render/Fly.io/Cloud Run (containerized) or a small VM.
2) Custom domain with TLS (e.g., `app.example.com` for frontend, `api.example.com` for backend).
3) Update Spotify developer settings: redirect URI and allowed origins must match prod URLs.

Backend Runtime
- Start with `uvicorn` workers: `uvicorn api.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'`.
- If high traffic, run behind a reverse proxy (Nginx) or use `gunicorn` with `uvicorn.workers.UvicornWorker`.

Session & Token Storage
- Current app stores sessions in-memory (`SESSIONS`), which does not survive restarts or scale-out.
- Recommended options:
  - Encrypted, signed cookie containing session data (no server storage).
  - External store: Redis for session map and token persistence (simple and scalable). Set `REDIS_URL` to enable Redis; the app automatically falls back to in-memory if Redis is unavailable.
  - Database: Postgres if you plan to store user profiles, history, or analytics (not required for basic playback).

Security & Compliance
- Cookies: mark `sid` as `Secure`, `HttpOnly`, `SameSite=Lax` in production over HTTPS.
- CORS: restrict `allow_origins` to your exact frontend origin.
- CSRF: if you add non-API form posts, include CSRF tokens; for API JSON only, strict CORS + cookie policy is typically sufficient.
- Rate limit: add basic rate limiting (e.g., via reverse proxy or a middleware) to protect APIs.

Monitoring & Logs
- Enable structured logging on backend (JSON), retain access logs.
- Add metrics (response times, error rates) and alerts.
- Optional: Sentry for error monitoring on frontend and backend.

Serverless Option
- Backend requires maintaining a persistent `httpx.AsyncClient` and cookies, but can still run on serverless containers:
  - Cloud Run or Fly.io are good fits.
  - Fully serverless functions (AWS Lambda/Vercel Functions) can work, but cold starts and maintaining the `httpx` client may reduce efficiency; use per-request clients if needed.

Launch Strategy
- Web-first, desktop browsers (Chrome, Edge, Firefox, Safari) with HTTPS.
- Mobile is limited by Spotify SDK support and autoplay restrictions; start with desktop and expand later.

Operational Checklist
- [ ] Frontend deployed with `VITE_BACKEND_URL` pointing to backend.
- [ ] Backend deployed with `FRONTEND_URL` set to frontend origin.
- [ ] Redis provisioned and `REDIS_URL` configured (or accept in-memory fallback).
- [ ] Spotify developer app configured with prod redirect URL and domain.
- [ ] HTTPS on both domains.
- [ ] Cookies secured and CORS restricted.
- [ ] Session persistence strategy chosen (cookie-only / Redis / DB).
- [ ] Monitoring and logging configured.
- [ ] Backups for config and any stateful components.