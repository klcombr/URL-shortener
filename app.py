"""URL shortener — FastAPI + SQLite + JWT. Single module, no ORM, no magic."""
import os
import sqlite3
import secrets
import time
from contextlib import closing
from pathlib import Path

import bcrypt
import jwt
from fastapi import FastAPI, HTTPException, Request, Depends, Header
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl

DB_PATH = Path(os.environ.get("DB_PATH", "links.db"))
SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
REDIRECT_BASE = os.environ.get("REDIRECT_BASE", "")
PUBLIC_DIR = Path(__file__).parent / "public"

app = FastAPI(title="URL Shortener")


# --- storage -----------------------------------------------------------------
def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with closing(db()) as conn, conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                pw_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS links (
                slug TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS clicks (
                id INTEGER PRIMARY KEY,
                slug TEXT NOT NULL REFERENCES links(slug) ON DELETE CASCADE,
                ts INTEGER NOT NULL,
                referer TEXT,
                ua TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_clicks_slug ON clicks(slug);
            """
        )


init_db()


# --- auth --------------------------------------------------------------------
class Credentials(BaseModel):
    email: str
    password: str


def make_token(user_id: int) -> str:
    # PyJWT >=2.10 validates `sub` as a string
    return jwt.encode({"sub": str(user_id), "iat": int(time.time())}, SECRET, algorithm="HS256")


def current_user(authorization: str = Header(default="")) -> int:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing token")
    try:
        payload = jwt.decode(authorization[7:], SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "invalid token")
    return int(payload["sub"])


@app.post("/api/register")
def register(creds: Credentials):
    if len(creds.password) < 8:
        raise HTTPException(400, "password must be at least 8 characters")
    with closing(db()) as conn, conn:
        pw_hash = bcrypt.hashpw(creds.password.encode(), bcrypt.gensalt()).decode()
        try:
            cur = conn.execute(
                "INSERT INTO users (email, pw_hash, created_at) VALUES (?, ?, ?)",
                (creds.email.lower(), pw_hash, int(time.time())),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(409, "email already registered")
        user_id = cur.lastrowid
    return {"token": make_token(user_id)}


@app.post("/api/login")
def login(creds: Credentials):
    with closing(db()) as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (creds.email.lower(),)).fetchone()
    if not row or not bcrypt.checkpw(creds.password.encode(), row["pw_hash"].encode()):
        raise HTTPException(401, "invalid credentials")
    return {"token": make_token(row["id"])}


# --- links -------------------------------------------------------------------
class NewLink(BaseModel):
    url: HttpUrl
    slug: str | None = None


SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"  # no look-alike chars


def random_slug(n: int = 7) -> str:
    return "".join(secrets.choice(SLUG_ALPHABET) for _ in range(n))


@app.post("/api/links")
def create_link(body: NewLink, user_id: int = Depends(current_user)):
    slug = body.slug or random_slug()
    if not slug.isalnum() or len(slug) > 32:
        raise HTTPException(400, "slug must be alphanumeric, max 32 chars")
    with closing(db()) as conn, conn:
        try:
            conn.execute(
                "INSERT INTO links (slug, url, user_id, created_at) VALUES (?, ?, ?, ?)",
                (slug, str(body.url), user_id, int(time.time())),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(409, "slug already taken")
    return {"slug": slug, "short": f"{REDIRECT_BASE}/{slug}", "url": str(body.url)}


@app.get("/api/links")
def list_links(user_id: int = Depends(current_user)):
    with closing(db()) as conn:
        rows = conn.execute(
            """
            SELECT l.slug, l.url, l.created_at, COUNT(c.id) AS clicks,
                   MAX(c.ts) AS last_click
            FROM links l LEFT JOIN clicks c ON c.slug = l.slug
            WHERE l.user_id = ?
            GROUP BY l.slug ORDER BY l.created_at DESC
            """,
            (user_id,),
        ).fetchall()
        out = []
        for r in rows:
            daily = conn.execute(
                "SELECT date(ts, 'unixepoch') d, COUNT(*) n FROM clicks WHERE slug = ? GROUP BY d ORDER BY d",
                (r["slug"],),
            ).fetchall()
            out.append({**dict(r), "daily": [dict(d) for d in daily]})
    return out


@app.delete("/api/links/{slug}")
def delete_link(slug: str, user_id: int = Depends(current_user)):
    with closing(db()) as conn, conn:
        cur = conn.execute("DELETE FROM links WHERE slug = ? AND user_id = ?", (slug, user_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "link not found")
    return {"deleted": slug}


@app.get("/{slug}")
def follow(slug: str, request: Request):
    with closing(db()) as conn, conn:
        row = conn.execute("SELECT url FROM links WHERE slug = ?", (slug,)).fetchone()
        if not row:
            raise HTTPException(404, "unknown link")
        conn.execute(
            "INSERT INTO clicks (slug, ts, referer, ua) VALUES (?, ?, ?, ?)",
            (slug, int(time.time()), request.headers.get("referer"), request.headers.get("user-agent")),
        )
    return RedirectResponse(row["url"], status_code=302)


@app.get("/")
def index():
    return FileResponse(PUBLIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=PUBLIC_DIR), name="static")
