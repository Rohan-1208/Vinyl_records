import os
import time
import secrets
import json
from typing import Dict, Any, List, Optional, Tuple
from urllib.parse import urlparse

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from dotenv import load_dotenv
import httpx
try:
    import redis.asyncio as redis  # redis>=4.x with asyncio support
except Exception:
    redis = None  # Fallback to in-memory if redis is unavailable

load_dotenv()
load_dotenv(".env.local")

# Session storage: Redis (preferred) with in-memory fallback
SESSIONS: Dict[str, Dict[str, Any]] = {}
OAUTH_STATE_TO_SID: Dict[str, str] = {}
REDIS_URL = os.getenv("REDIS_URL")
REDIS: Optional["redis.Redis"] = None

SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE = "https://api.spotify.com/v1"

app = FastAPI(title="Vinyl Records API")

# CORS: allow frontend origin from env for cross-origin cookie flows
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _cookie_settings(request: Request) -> Dict[str, Any]:
    """Return env-aware cookie flags for session cookies.
    - If FRONTEND_URL is https, use `secure=True`.
    - If frontend and backend are cross-site (different host), use `samesite='none'`.
    - Otherwise use `samesite='lax'` for same-site flows (dev localhost).
    """
    frontend = os.getenv("FRONTEND_URL", "http://localhost:3000")
    f = urlparse(frontend)
    is_https = f.scheme == "https"
    backend_host = request.url.hostname
    cross_site = (f.hostname != backend_host)
    return {
        "httponly": True,
        "samesite": "none" if cross_site else "lax",
        "secure": True if is_https else False,
    }


async def _get_session(sid: str) -> Dict[str, Any]:
    if REDIS:
        try:
            val = await REDIS.get(f"session:{sid}")
            return json.loads(val) if val else {}
        except Exception:
            pass
    return SESSIONS.get(sid, {})


async def _set_session(sid: str, data: Dict[str, Any]) -> None:
    if REDIS:
        try:
            await REDIS.set(f"session:{sid}", json.dumps(data))
            return
        except Exception:
            pass
    SESSIONS[sid] = data


async def _ensure_session(sid: str) -> None:
    if REDIS:
        try:
            exists = await REDIS.exists(f"session:{sid}")
            if not exists:
                await REDIS.set(f"session:{sid}", json.dumps({}))
            return
        except Exception:
            pass
    if sid not in SESSIONS:
        SESSIONS[sid] = {}


async def _delete_session(sid: str) -> None:
    if REDIS:
        try:
            await REDIS.delete(f"session:{sid}")
            return
        except Exception:
            pass
    SESSIONS.pop(sid, None)


async def _set_state_map(state: str, sid: str) -> None:
    if REDIS:
        try:
            # Keep short TTL for OAuth state mapping
            await REDIS.set(f"oauth_state:{state}", sid, ex=600)
            return
        except Exception:
            pass
    OAUTH_STATE_TO_SID[state] = sid


async def _get_state_sid(state: str) -> Optional[str]:
    if REDIS:
        try:
            val = await REDIS.get(f"oauth_state:{state}")
            return val if val else None
        except Exception:
            pass
    return OAUTH_STATE_TO_SID.get(state)


async def _get_or_create_session_id(request: Request, response: Response) -> str:
    sid = request.cookies.get("session_id")
    if not sid:
        sid = secrets.token_urlsafe(32)
        response.set_cookie(key="session_id", value=sid, **_cookie_settings(request))
    await _ensure_session(sid)
    return sid


def _get_spotify_env() -> Tuple[Optional[str], Optional[str], str]:
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    redirect_uri = os.getenv("SPOTIFY_REDIRECT_URI", "http://localhost:8000/auth/spotify/callback")
    return client_id, client_secret, redirect_uri


async def _ensure_access_token(request: Request) -> Tuple[str, str]:
    """Return (sid, access_token) or raise 401 if not authenticated."""
    sid = request.cookies.get("session_id")
    session = await _get_session(sid or "") if sid else {}
    if not sid or not session or "spotify_tokens" not in session:
        raise HTTPException(status_code=401, detail="Not authenticated with Spotify")

    tokens = session.get("spotify_tokens", {})
    access_token = tokens.get("access_token")
    expires_at = tokens.get("expires_at", 0)
    refresh_token = tokens.get("refresh_token")

    if access_token and time.time() < expires_at - 15:
        return sid, access_token

    # refresh
    client_id, client_secret, _ = _get_spotify_env()
    if not client_id or not client_secret or not refresh_token:
        raise HTTPException(status_code=401, detail="Missing credentials to refresh token")

    async with httpx.AsyncClient(timeout=15) as client:
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret,
        }
        resp = await client.post(SPOTIFY_TOKEN_URL, data=data)
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Failed to refresh Spotify token")
        body = resp.json()
        new_access = body["access_token"]
        expires_in = body.get("expires_in", 3600)
        # Spotify may or may not return a new refresh_token; keep old if absent
        new_refresh = body.get("refresh_token", refresh_token)
        # Save refreshed tokens
        session["spotify_tokens"] = {
            "access_token": new_access,
            "refresh_token": new_refresh,
            "expires_at": time.time() + int(expires_in) - 60,
        }
        await _set_session(sid, session)
        return sid, new_access


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"name": "Vinyl Records API"}


@app.get("/api/auth/status")
async def auth_status(request: Request):
    sid = request.cookies.get("session_id")
    session = await _get_session(sid or "") if sid else {}
    ok = bool(sid and session and "spotify_tokens" in session)
    return {"authenticated": ok}

@app.post("/api/auth/logout")
async def auth_logout(request: Request):
    response = JSONResponse({"status": "ok"})
    sid = request.cookies.get("session_id")
    if sid:
        await _delete_session(sid)
    # Clear session cookie
    try:
        response.delete_cookie("session_id")
    except Exception:
        pass
    return response

@app.get("/auth/spotify/login")
async def spotify_login(request: Request):
  client_id, _, redirect_uri = _get_spotify_env()
  # Include scopes required for Web Playback SDK (full-track playback)
  scopes = " ".join([
      "user-read-email",
      "user-library-read",
      "playlist-read-private",
      "streaming",
      "user-read-playback-state",
      "user-modify-playback-state",
  ])

  if not client_id:
      raise HTTPException(status_code=500, detail="SPOTIFY_CLIENT_ID not set")

  response = Response()
  sid = await _get_or_create_session_id(request, response)
  state = secrets.token_urlsafe(16)
  session = await _get_session(sid)
  session["spotify_oauth_state"] = state
  await _set_session(sid, session)
  await _set_state_map(state, sid)

  from urllib.parse import urlencode
  # Allow frontend to force the account chooser via ?show_dialog=true or ?force_new_login=true
  qs = dict(request.query_params)
  show_dialog = "true" if (qs.get("show_dialog") == "true" or qs.get("force_new_login") == "true") else "false"

  params = {
      "response_type": "code",
      "client_id": client_id,
      "scope": scopes,
      "redirect_uri": redirect_uri,
      "state": state,
      "show_dialog": show_dialog,
  }
  url = f"https://accounts.spotify.com/authorize?{urlencode(params)}"

  r = RedirectResponse(url)
  # propagate Set-Cookie for session_id
  for c in response.raw_headers:
      if c[0].lower() == b"set-cookie":
          r.raw_headers.append(c)
  return r


@app.get("/auth/spotify/callback")
async def spotify_callback(request: Request):
    client_id, client_secret, redirect_uri = _get_spotify_env()
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Spotify client credentials not configured")

    qs = dict(request.query_params)
    code = qs.get("code")
    state = qs.get("state")

    # Validate session/state
    response = Response()
    sid = await _get_or_create_session_id(request, response)
    session = await _get_session(sid)
    expected_state = session.get("spotify_oauth_state") if session else None
    if not code or not state:
        raise HTTPException(status_code=400, detail="Invalid Spotify OAuth state or code")
    if state != expected_state:
        fallback_sid = await _get_state_sid(state)
        if fallback_sid:
            fallback_session = await _get_session(fallback_sid)
            if fallback_session.get("spotify_oauth_state") == state:
                sid = fallback_sid
                response.set_cookie(key="session_id", value=sid, **_cookie_settings(request))
                session = fallback_session
                expected_state = state
        else:
            raise HTTPException(status_code=400, detail="Invalid Spotify OAuth state or code")

    # Exchange code for tokens
    async with httpx.AsyncClient(timeout=15) as client:
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": client_id,
            "client_secret": client_secret,
        }
        token_resp = await client.post(SPOTIFY_TOKEN_URL, data=data)
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to obtain Spotify tokens")
        body = token_resp.json()
        access_token = body["access_token"]
        refresh_token = body.get("refresh_token")
        expires_in = body.get("expires_in", 3600)

        session = session or {}
        session["spotify_tokens"] = {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": time.time() + int(expires_in) - 60,
        }
        await _set_session(sid, session)

    # Redirect back to frontend origin (supports ngrok/localhost)
    redirect_to = FRONTEND_URL or "/"
    r = RedirectResponse(redirect_to)
    for c in response.raw_headers:
        if c[0].lower() == b"set-cookie":
            r.raw_headers.append(c)
    return r


@app.get("/api/proxy/image")
async def proxy_image(src: str):
    """Proxy Spotify CDN album art to avoid browser CORS restrictions.
    - Only allows images from i.scdn.co
    - Returns bytes with original content-type and cache headers
    """
    try:
        u = urlparse(src)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image URL")
    if u.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Invalid image scheme")
    if (u.hostname or "").lower() != "i.scdn.co":
        raise HTTPException(status_code=400, detail="Image host not allowed")

    # Fetch image from Spotify CDN
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(src)
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to fetch image")
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Upstream image error")

    ct = resp.headers.get("content-type", "image/jpeg")
    r = Response(content=resp.content, media_type=ct)
    # Cache for one day; CDN images are immutable by hash
    r.headers["Cache-Control"] = "public, max-age=86400, immutable"
    return r

# Persistent HTTP client for Spotify API to reduce handshake latency
SPOTIFY_HTTP: Optional[httpx.AsyncClient] = None

@app.on_event("startup")
def _init_http_client():
    # http2 improves throughput/latency; enable if 'h2' is available; small timeout to fail fast
    global SPOTIFY_HTTP
    http2_supported = False
    try:
        import h2  # noqa: F401
        http2_supported = True
    except Exception:
        print("Warning: HTTP/2 not available (install 'httpx[http2]'). Falling back to HTTP/1.1.")
    SPOTIFY_HTTP = httpx.AsyncClient(timeout=10, http2=http2_supported)


@app.on_event("startup")
async def _init_redis():
    global REDIS
    if REDIS_URL and redis is not None:
        try:
            REDIS = redis.from_url(REDIS_URL, decode_responses=True)
            # Confirm connection (ignore errors to allow fallback)
            await REDIS.ping()
        except Exception:
            REDIS = None

@app.on_event("shutdown")
async def _close_http_client():
    global SPOTIFY_HTTP
    try:
      await SPOTIFY_HTTP.aclose()
    except Exception:
      pass

@app.on_event("shutdown")
async def _close_redis():
    global REDIS
    try:
      if REDIS:
        await REDIS.close()
    except Exception:
      pass

async def _spotify_get(access_token: str, path: str, params: Optional[dict] = None) -> httpx.Response:
    assert SPOTIFY_HTTP is not None, "HTTP client not initialized"
    return await SPOTIFY_HTTP.get(
        f"{SPOTIFY_API_BASE}{path}",
        headers={"Authorization": f"Bearer {access_token}"},
        params=params or {},
    )

async def _spotify_put(access_token: str, path: str, json: Optional[dict] = None, params: Optional[dict] = None) -> httpx.Response:
    assert SPOTIFY_HTTP is not None, "HTTP client not initialized"
    return await SPOTIFY_HTTP.put(
        f"{SPOTIFY_API_BASE}{path}",
        headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
        json=json or {},
        params=params or {},
    )

async def _spotify_post(access_token: str, path: str, params: Optional[dict] = None) -> httpx.Response:
    assert SPOTIFY_HTTP is not None, "HTTP client not initialized"
    return await SPOTIFY_HTTP.post(
        f"{SPOTIFY_API_BASE}{path}",
        headers={"Authorization": f"Bearer {access_token}"},
        params=params or {},
    )


@app.get("/api/spotify/me")
async def spotify_me(request: Request):
    _, token = await _ensure_access_token(request)
    resp = await _spotify_get(token, "/me")
    return JSONResponse(resp.json(), status_code=resp.status_code)

@app.get("/api/spotify/token")
async def spotify_token(request: Request):
    _, token = await _ensure_access_token(request)
    return JSONResponse({"access_token": token})

@app.get("/api/spotify/devices")
async def spotify_devices(request: Request):
    _, token = await _ensure_access_token(request)
    resp = await _spotify_get(token, "/me/player/devices")
    return JSONResponse(resp.json(), status_code=resp.status_code)

@app.put("/api/spotify/transfer")
async def spotify_transfer(request: Request):
    _, token = await _ensure_access_token(request)
    body = await request.json()
    device_id = body.get("device_id")
    play = bool(body.get("play", False))
    if not device_id:
        raise HTTPException(status_code=400, detail="device_id required")
    resp = await _spotify_put(token, "/me/player", json={"device_ids": [device_id], "play": play})
    status = resp.status_code
    if status in (200, 204):
        return JSONResponse({"status": "ok"}, status_code=200)
    try:
        return JSONResponse(resp.json(), status_code=status)
    except Exception:
        return JSONResponse({"status": "error", "message": resp.text}, status_code=status)

@app.put("/api/spotify/play")
async def spotify_play(request: Request):
    _, token = await _ensure_access_token(request)
    body = await request.json()
    device_id = body.get("device_id")
    uris = body.get("uris")
    context_uri = body.get("context_uri")
    offset = body.get("offset")

    params = {"device_id": device_id} if device_id else None
    json = {"uris": uris} if uris else {"context_uri": context_uri} if context_uri else {}
    if offset is not None:
        json["offset"] = offset

    resp = await _spotify_put(token, "/me/player/play", json=json, params=params)
    status = resp.status_code
    # Spotify returns 204 No Content on success
    if status == 204:
        return JSONResponse({"status": "ok"}, status_code=200)
    try:
        return JSONResponse(resp.json(), status_code=status)
    except Exception:
        return JSONResponse({"status": "error", "message": resp.text}, status_code=status)

@app.put("/api/spotify/pause")
async def spotify_pause(request: Request):
    _, token = await _ensure_access_token(request)
    body = await request.json()
    device_id = body.get("device_id")
    params = {"device_id": device_id} if device_id else None
    resp = await _spotify_put(token, "/me/player/pause", params=params)
    status = resp.status_code
    if status == 204:
        return JSONResponse({"status": "ok"}, status_code=200)
    try:
        return JSONResponse(resp.json(), status_code=status)
    except Exception:
        return JSONResponse({"status": "error", "message": resp.text}, status_code=status)

@app.put("/api/spotify/volume")
async def spotify_volume(request: Request):
    """Set volume for a Spotify device (0-100%)."""
    _, token = await _ensure_access_token(request)
    body = await request.json()
    device_id = body.get("device_id")
    vol = body.get("volume_percent")
    try:
        vol_int = int(vol)
    except Exception:
        vol_int = 50
    vol_int = max(0, min(100, vol_int))

    params = {"volume_percent": vol_int}
    if device_id:
        params["device_id"] = device_id

    resp = await _spotify_put(token, "/me/player/volume", params=params)
    status = resp.status_code
    if status in (200, 204):
        return JSONResponse({"status": "ok", "volume_percent": vol_int}, status_code=200)
    try:
        return JSONResponse(resp.json(), status_code=status)
    except Exception:
        return JSONResponse({"status": "error", "message": resp.text}, status_code=status)


@app.get("/api/spotify/me/tracks")
async def spotify_liked_tracks(request: Request, limit: int = 50):
    _, token = await _ensure_access_token(request)
    resp = await _spotify_get(token, "/me/tracks", params={"limit": min(limit, 50)})
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    data = resp.json()
    return JSONResponse(data)


@app.get("/api/spotify/playlists")
async def spotify_playlists(request: Request, limit: int = 50):
    _, token = await _ensure_access_token(request)
    resp = await _spotify_get(token, "/me/playlists", params={"limit": min(limit, 50)})
    return JSONResponse(resp.json(), status_code=resp.status_code)


@app.get("/api/spotify/playlists/{playlist_id}/tracks")
async def spotify_playlist_tracks(request: Request, playlist_id: str, limit: int = 100):
    _, token = await _ensure_access_token(request)
    resp = await _spotify_get(token, f"/playlists/{playlist_id}/tracks", params={"limit": min(limit, 100)})
    return JSONResponse(resp.json(), status_code=resp.status_code)


@app.get("/api/spotify/playlists/{playlist_id}/songs")
async def spotify_playlist_songs(request: Request, playlist_id: str, limit: int = 100):
    _, token = await _ensure_access_token(request)
    resp = await _spotify_get(token, f"/playlists/{playlist_id}/tracks", params={"limit": min(limit, 100)})
    if resp.status_code != 200:
        return JSONResponse(resp.json(), status_code=resp.status_code)
    body = resp.json()
    items: List[Dict[str, Any]] = body.get("items", [])
    songs = [_map_spotify_track_to_song(item, i) for i, item in enumerate(items)]
    return JSONResponse(songs)


# Map Spotify track to app Song shape

def _map_spotify_track_to_song(track: Dict[str, Any], idx: int) -> Dict[str, Any]:
    # Track object shape differs depending on endpoint; /me/tracks wraps inside item["track"]
    t = track.get("track") if "track" in track else track
    if not t:
        return {
            "id": idx + 1,
            "title": "Unknown",
            "artist": "Unknown",
            "album": "",
            "albumArt": "",
            "duration": 0,
            "audioUrl": None,
        }

    artists = ", ".join([a.get("name", "") for a in t.get("artists", []) if a])
    images = t.get("album", {}).get("images", []) or []
    art = images[0]["url"] if images else ""
    dur = int((t.get("duration_ms") or 0) / 1000)

    return {
        "id": idx + 1,
        "title": t.get("name", "Unknown"),
        "artist": artists or "Unknown",
        "album": t.get("album", {}).get("name", ""),
        "albumArt": art,
        "duration": dur,
        "audioUrl": t.get("preview_url"),  # 30s preview if available
        "spotifyUri": t.get("uri"),        # full-track playback via Web Playback SDK
    }


@app.get("/api/songs")
async def get_songs(request: Request):
    # If logged in, return liked tracks mapped to Song; otherwise return stub
    try:
        _, token = await _ensure_access_token(request)
        resp = await _spotify_get(token, "/me/tracks", params={"limit": 50})
        if resp.status_code == 200:
            body = resp.json()
            items: List[Dict[str, Any]] = body.get("items", [])
            songs = [_map_spotify_track_to_song(item, i) for i, item in enumerate(items)]
            return JSONResponse(songs)
    except HTTPException:
        pass

    # Fallback stub
    sample: List[Dict[str, Any]] = [
        {
            "id": 1,
            "title": "Midnight City",
            "artist": "M83",
            "album": "Hurry Up, We're Dreaming",
            "albumArt": "https://i.scdn.co/image/ab67616d0000b2733b3a8e6e1eb4d32ce2fa2041",
            "duration": 251,
            "audioUrl": None,
        },
        {
            "id": 2,
            "title": "Dreams",
            "artist": "Fleetwood Mac",
            "album": "Rumours",
            "albumArt": "https://i.scdn.co/image/ab67616d0000b2730c0f2a0053ca2e85b2e1fa89",
            "duration": 257,
            "audioUrl": None,
        },
        {
            "id": 3,
            "title": "Space Song",
            "artist": "Beach House",
            "album": "Depression Cherry",
            "albumArt": "https://i.scdn.co/image/ab67616d0000b273928c2623e6ca0558e7085ad7",
            "duration": 323,
            "audioUrl": None,
        },
    ]
    return JSONResponse(sample)


@app.get("/api/spotify/current")
async def spotify_current(request: Request):
    _, token = await _ensure_access_token(request)
    resp = await _spotify_get(token, "/me/player/currently-playing")
    # 204 means no content (nothing playing)
    if resp.status_code == 204:
        return JSONResponse({"isPlaying": False, "progressMs": 0, "durationMs": 0, "track": None}, status_code=200)
    # 403: Spotify Free accounts cannot access Connect playback state
    if resp.status_code == 403:
        return JSONResponse({"isPlaying": False, "progressMs": 0, "durationMs": 0, "track": None, "error": "premium_required"}, status_code=200)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    body = resp.json()
    item = body.get("item")
    is_playing = bool(body.get("is_playing", False))
    progress_ms = int(body.get("progress_ms", 0) or 0)
    duration_ms = int((item or {}).get("duration_ms", 0) or 0)
    song = _map_spotify_track_to_song(item or {}, 0) if item else None
    return JSONResponse({
        "isPlaying": is_playing,
        "progressMs": progress_ms,
        "durationMs": duration_ms,
        "track": song,
    })


    


# 30s TTL in-memory cache for spotify search
_spotify_search_cache: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}

@app.get("/api/spotify/search")
async def spotify_search(request: Request, q: str, limit: int = 20):
    """Search tracks on Spotify and return results mapped to Song shape with short-lived caching."""
    _, token = await _ensure_access_token(request)
    query = (q or "").strip()
    if not query:
        return JSONResponse([], status_code=200)

    # Serve cached response if fresh
    now = time.time()
    cache_key = f"{query}:{min(limit, 50)}"
    cached = _spotify_search_cache.get(cache_key)
    if cached and (now - cached[0]) < 30:
        return JSONResponse(cached[1])

    params = {"q": query, "type": "track", "limit": min(limit, 50)}
    resp = await _spotify_get(token, "/search", params=params)
    status = resp.status_code
    if status != 200:
        try:
            return JSONResponse(resp.json(), status_code=status)
        except Exception:
            return JSONResponse({"status": "error", "message": resp.text}, status_code=status)
    body = resp.json() or {}
    items = (body.get("tracks", {}) or {}).get("items", []) or []
    songs = [_map_spotify_track_to_song(t, i) for i, t in enumerate(items)]
    _spotify_search_cache[cache_key] = (now, songs)
    return JSONResponse(songs)

@app.get("/api/spotify/audio-features")
async def spotify_audio_features(request: Request, track_id: Optional[str] = None, uri: Optional[str] = None):
    _, token = await _ensure_access_token(request)
    tid = track_id
    if not tid and uri:
        parts = (uri or "").split(":")
        tid = parts[-1] if parts else None
    if not tid:
        raise HTTPException(status_code=400, detail="track_id or uri required")
    resp = await _spotify_get(token, f"/audio-features/{tid}")
    return JSONResponse(resp.json(), status_code=resp.status_code)