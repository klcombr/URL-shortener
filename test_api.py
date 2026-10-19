"""Integration tests — run against a throwaway DB, no network."""
import os
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["JWT_SECRET"] = "test-secret"

from fastapi.testclient import TestClient  # noqa: E402
import app as app_module  # noqa: E402

client = TestClient(app_module.app)


def auth(email="a@b.com", password="supersecret"):
    r = client.post("/api/register", json={"email": email, "password": password})
    if r.status_code == 409:
        r = client.post("/api/login", json={"email": email, "password": password})
    return {"authorization": f"Bearer {r.json()['token']}"}


def test_register_rejects_short_password():
    assert client.post("/api/register", json={"email": "x@y.com", "password": "123"}).status_code == 400


def test_login_rejects_wrong_password():
    auth("dup@b.com")
    assert client.post("/api/login", json={"email": "dup@b.com", "password": "nope-not-it"}).status_code == 401


def test_create_link_requires_token():
    assert client.post("/api/links", json={"url": "https://example.com"}).status_code == 401


def test_create_and_resolve_link():
    h = auth("owner@b.com")
    r = client.post("/api/links", json={"url": "https://example.com", "slug": "abc1234"}, headers=h)
    assert r.status_code == 200, r.text

    # custom slugs are unique
    assert client.post("/api/links", json={"url": "https://other.com", "slug": "abc1234"}, headers=h).status_code == 409

    redirect = client.get("/abc1234", follow_redirects=False)
    assert redirect.status_code == 302
    assert redirect.headers["location"] == "https://example.com/"


def test_clicks_are_counted():
    h = auth("clicks@b.com")
    client.post("/api/links", json={"url": "https://example.com", "slug": "counted"}, headers=h)
    for _ in range(3):
        client.get("/counted", follow_redirects=False)
    links = client.get("/api/links", headers=h).json()
    assert links[0]["clicks"] == 3
    assert links[0]["daily"], "daily breakdown should not be empty"


def test_users_cannot_delete_other_users_links():
    owner = auth("owner2@b.com")
    client.post("/api/links", json={"url": "https://example.com", "slug": "mine"}, headers=owner)
    other = auth("intruder@b.com")
    assert client.delete("/api/links/mine", headers=other).status_code == 404
    assert client.delete("/api/links/mine", headers=owner).status_code == 200


def test_unknown_slug_is_404():
    assert client.get("/does-not-exist", follow_redirects=False).status_code == 404
