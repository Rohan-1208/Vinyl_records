Testing Guide

Overview
- Frontend unit tests run with Vitest + Testing Library (jsdom).
- Backend tests run with Pytest and FastAPI TestClient.

Frontend
1) Install deps: `npm install`
2) Run tests: `npm run test`
3) Where to add tests: `frontend/tests/*.test.tsx`
   - Example included: `progressBar.test.tsx` ensures click triggers `onSeekRatio`.

Backend
1) Create virtualenv and install: `pip install -r api/requirements.txt`
2) Run tests from repo root or `api/` directory: `pytest`
3) Where to add tests: `api/tests/test_*.py`
   - Included tests validate health, auth status, fallback songs, and that control endpoints require auth.

Extending Tests
- Frontend: test keyboard shortcuts, device selector rendering, media session integration (mocking browser APIs).
- Backend: mock Spotify API endpoints using `respx` or `httpx` mocking to test play/transfer/search flows without real tokens.
- E2E: add Cypress or Playwright to automate login and basic playback flows.