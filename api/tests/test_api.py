import json
from fastapi.testclient import TestClient

try:
    # Running tests from the repo root: import via package path
    from api.main import app
except Exception:
    # Running tests from within the api dir
    from main import app  # type: ignore


client = TestClient(app)


def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "ok"


def test_auth_status_unauthenticated():
    resp = client.get("/api/auth/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("authenticated") is False


def test_get_songs_fallback_without_auth():
    resp = client.get("/api/songs")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    # Fallback stub returns 3 sample songs
    assert len(data) == 3
    assert {"title", "artist", "duration"}.issubset(set(data[0].keys()))


def test_volume_requires_auth():
    resp = client.put("/api/spotify/volume", json={"volume_percent": 50})
    # Without session/token, backend responds 401
    assert resp.status_code == 401


def test_transfer_requires_auth():
    resp = client.put("/api/spotify/transfer", json={"device_id": "dummy", "play": True})
    assert resp.status_code == 401