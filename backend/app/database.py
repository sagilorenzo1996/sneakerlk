import json
import sqlite3
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent.parent / "config" / "app.db"


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                email           TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS profiles (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name             TEXT NOT NULL,
                url              TEXT NOT NULL,
                contact_number   TEXT DEFAULT '',
                email            TEXT DEFAULT '',
                description      TEXT DEFAULT '',
                gemini_api_key   TEXT DEFAULT '',
                composio_api_key TEXT DEFAULT '',
                ig_user_id       TEXT DEFAULT '',
                gemini_model     TEXT DEFAULT 'gemini-2.5-flash',
                image_model      TEXT DEFAULT 'imagen-4.0-generate-001',
                created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS pipelines (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id          INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                name                TEXT NOT NULL,
                platforms           TEXT NOT NULL DEFAULT '[]',
                languages           TEXT NOT NULL DEFAULT '["English"]',
                schedule            TEXT NOT NULL DEFAULT 'manual',
                post_time           TEXT NOT NULL DEFAULT '09:00',
                status              TEXT NOT NULL DEFAULT 'active',
                workflow_configured INTEGER NOT NULL DEFAULT 0,
                workflow_type       TEXT NOT NULL DEFAULT 'ai_full',
                posts_per_run       INTEGER NOT NULL DEFAULT 1,
                caption_prompt      TEXT NOT NULL DEFAULT '',
                image_prompt        TEXT NOT NULL DEFAULT '',
                reference_images    TEXT NOT NULL DEFAULT '[]',
                created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS posts (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id          INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                pipeline_id         INTEGER REFERENCES pipelines(id) ON DELETE SET NULL,
                product_name        TEXT DEFAULT '',
                product_url         TEXT DEFAULT '',
                product_description TEXT DEFAULT '',
                image_filename      TEXT DEFAULT '',
                image_url           TEXT DEFAULT '',
                caption             TEXT DEFAULT '',
                platforms           TEXT NOT NULL DEFAULT '[]',
                status              TEXT NOT NULL DEFAULT 'pending',
                caption_prompt_used TEXT DEFAULT '',
                image_prompt_used   TEXT DEFAULT '',
                posted_at           TIMESTAMP,
                created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS api_usage (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                service    TEXT NOT NULL,
                action     TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tracked_products (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id  INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                name        TEXT NOT NULL,
                product_url TEXT NOT NULL,
                image_url   TEXT DEFAULT '',
                description TEXT DEFAULT '',
                enabled     INTEGER NOT NULL DEFAULT 1,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(profile_id, product_url)
            );
        """)
        conn.commit()


# ── Settings ──────────────────────────────────────────────────────────────────

def get_setting(key: str) -> str:
    with _connect() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row[0] if row else ""


def save_setting(key: str, value: str) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
        conn.commit()


# ── Users ─────────────────────────────────────────────────────────────────────

def create_user(email: str, hashed_password: str) -> dict:
    with _connect() as conn:
        cursor = conn.execute(
            "INSERT INTO users (email, hashed_password) VALUES (?, ?)",
            (email, hashed_password),
        )
        conn.commit()
        return {"id": cursor.lastrowid, "email": email}


def get_users() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute("SELECT id, email FROM users").fetchall()
    return [dict(r) for r in rows]


def get_user_by_email(email: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, email, hashed_password FROM users WHERE email = ?", (email,)
        ).fetchone()
    return dict(row) if row else None


# ── Profiles ──────────────────────────────────────────────────────────────────

def create_profile(user_id: int, name: str, url: str, contact_number: str = "",
                   email: str = "", description: str = "",
                   gemini_api_key: str = "", composio_api_key: str = "",
                   gemini_model: str = "gemini-2.5-flash",
                   image_model: str = "imagen-4.0-generate-001",
                   ig_user_id: str = "",
                   currency: str = "",
                   facebook_page_id: str = "") -> dict:
    with _connect() as conn:
        cursor = conn.execute(
            """INSERT INTO profiles
               (user_id, name, url, contact_number, email, description,
                gemini_api_key, composio_api_key, gemini_model, image_model, ig_user_id, currency, facebook_page_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, name, url, contact_number, email, description,
             gemini_api_key, composio_api_key, gemini_model, image_model, ig_user_id, currency, facebook_page_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM profiles WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(row)


def get_profiles_by_user(user_id: int) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM profiles WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def get_profile(profile_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
    return dict(row) if row else None


def update_profile(profile_id: int, **kwargs) -> dict | None:
    allowed = {"name", "url", "contact_number", "email", "description",
               "gemini_api_key", "composio_api_key", "gemini_model", "image_model", "ig_user_id",
               "currency", "facebook_page_id"}
    fields = {k: v for k, v in kwargs.items() if k in allowed}
    if not fields:
        return get_profile(profile_id)
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    with _connect() as conn:
        conn.execute(
            f"UPDATE profiles SET {set_clause} WHERE id = ?",
            (*fields.values(), profile_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
    return dict(row) if row else None


def delete_profile(profile_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
        conn.commit()


# ── Pipelines ─────────────────────────────────────────────────────────────────

def create_pipeline(profile_id: int, name: str, platforms: list,
                    languages: list, schedule: str = "manual",
                    post_time: str = "09:00",
                    workflow_type: str = "ai_full") -> dict:
    with _connect() as conn:
        cursor = conn.execute(
            "INSERT INTO pipelines (profile_id, name, platforms, languages, schedule, post_time, workflow_type) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (profile_id, name, json.dumps(platforms), json.dumps(languages), schedule, post_time, workflow_type),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM pipelines WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return _deserialize_pipeline(dict(row))


def get_pipelines_by_profile(profile_id: int) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM pipelines WHERE profile_id = ? ORDER BY created_at DESC",
            (profile_id,)
        ).fetchall()
    return [_deserialize_pipeline(dict(r)) for r in rows]


def get_pipeline(pipeline_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM pipelines WHERE id = ?", (pipeline_id,)).fetchone()
    return _deserialize_pipeline(dict(row)) if row else None


def update_pipeline(pipeline_id: int, **kwargs) -> dict | None:
    allowed = {"name", "platforms", "languages", "schedule", "post_time",
               "status", "workflow_configured", "workflow_type", "posts_per_run",
               "caption_prompt", "image_prompt", "reference_images"}
    fields = {}
    for k, v in kwargs.items():
        if k not in allowed:
            continue
        fields[k] = json.dumps(v) if k in ("platforms", "languages") else v
    if not fields:
        return get_pipeline(pipeline_id)
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    with _connect() as conn:
        conn.execute(
            f"UPDATE pipelines SET {set_clause} WHERE id = ?",
            (*fields.values(), pipeline_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM pipelines WHERE id = ?", (pipeline_id,)).fetchone()
    return _deserialize_pipeline(dict(row)) if row else None


def delete_pipeline(pipeline_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM pipelines WHERE id = ?", (pipeline_id,))
        conn.commit()


def _deserialize_pipeline(p: dict) -> dict:
    p["platforms"]        = json.loads(p["platforms"])        if isinstance(p["platforms"], str)        else p["platforms"]
    p["languages"]        = json.loads(p["languages"])        if isinstance(p["languages"], str)        else p["languages"]
    p["reference_images"] = json.loads(p["reference_images"]) if isinstance(p.get("reference_images"), str) else (p.get("reference_images") or [])
    return p


# ── Posts ─────────────────────────────────────────────────────────────────────

def create_post(profile_id: int, pipeline_id: Optional[int],
                product_name: str, product_url: str,
                image_filename: str, image_url: str,
                caption: str, platforms: list,
                status: str = "pending",
                product_description: str = "",
                caption_prompt_used: str = "",
                image_prompt_used: str = "") -> dict:
    with _connect() as conn:
        cursor = conn.execute(
            """INSERT INTO posts
               (profile_id, pipeline_id, product_name, product_url,
                image_filename, image_url, caption, platforms,
                status, product_description, caption_prompt_used, image_prompt_used)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (profile_id, pipeline_id, product_name, product_url,
             image_filename, image_url, caption, json.dumps(platforms),
             status, product_description, caption_prompt_used, image_prompt_used),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM posts WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return _deserialize_post(dict(row))


def get_posts_by_profile(profile_id: int, status: Optional[str] = None) -> list[dict]:
    with _connect() as conn:
        if status:
            rows = conn.execute(
                "SELECT * FROM posts WHERE profile_id = ? AND status = ? ORDER BY created_at DESC",
                (profile_id, status)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM posts WHERE profile_id = ? ORDER BY created_at DESC",
                (profile_id,)
            ).fetchall()
    return [_deserialize_post(dict(r)) for r in rows]


def get_post(post_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    return _deserialize_post(dict(row)) if row else None


def update_post_status(post_id: int, status: str, posted_at: Optional[str] = None) -> dict | None:
    with _connect() as conn:
        if posted_at:
            conn.execute(
                "UPDATE posts SET status = ?, posted_at = ? WHERE id = ?",
                (status, posted_at, post_id)
            )
        else:
            conn.execute("UPDATE posts SET status = ? WHERE id = ?", (status, post_id))
        conn.commit()
        row = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    return _deserialize_post(dict(row)) if row else None


def approve_post_transactional(post_id: int, posted_at: str,
                                profile_id: int, product_name: str,
                                product_url: str, image_url: str,
                                description: str) -> dict | None:
    """
    Atomically marks post as posted AND upserts the tracked product.
    Rolls back both if either write fails.
    """
    with _connect() as conn:
        conn.execute("BEGIN")
        try:
            conn.execute(
                "UPDATE posts SET status = 'posted', posted_at = ? WHERE id = ?",
                (posted_at, post_id),
            )
            conn.execute(
                """INSERT INTO tracked_products
                   (profile_id, name, product_url, image_url, description)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(profile_id, product_url) DO UPDATE SET
                     name=excluded.name,
                     image_url=excluded.image_url,
                     description=excluded.description""",
                (profile_id, product_name, product_url, image_url, description),
            )
            conn.execute(
                "INSERT INTO api_usage (profile_id, service, action) VALUES (?, 'composio', 'publish')",
                (profile_id,),
            )
            conn.commit()
        except Exception:
            conn.execute("ROLLBACK")
            raise
        row = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    return _deserialize_post(dict(row)) if row else None


def update_post_image(post_id: int, image_filename: str, image_url: str) -> dict | None:
    with _connect() as conn:
        conn.execute(
            "UPDATE posts SET image_filename = ?, image_url = ? WHERE id = ?",
            (image_filename, image_url, post_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    return _deserialize_post(dict(row)) if row else None


def delete_post(post_id: int) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        conn.commit()


def get_post_counts(profile_id: int) -> dict:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT status, COUNT(*) as cnt FROM posts WHERE profile_id = ? GROUP BY status",
            (profile_id,)
        ).fetchall()
    return {r["status"]: r["cnt"] for r in rows}


def _deserialize_post(p: dict) -> dict:
    p["platforms"] = json.loads(p["platforms"]) if isinstance(p["platforms"], str) else p["platforms"]
    return p


# ── Tracked Products ──────────────────────────────────────────────────────────

def upsert_tracked_product(profile_id: int, name: str, product_url: str,
                            image_url: str = "", description: str = "") -> dict:
    """Insert or update a tracked product. Does NOT change the enabled flag on update."""
    with _connect() as conn:
        conn.execute(
            """INSERT INTO tracked_products (profile_id, name, product_url, image_url, description)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(profile_id, product_url) DO UPDATE SET
                 name=excluded.name,
                 image_url=excluded.image_url,
                 description=excluded.description""",
            (profile_id, name, product_url, image_url, description),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM tracked_products WHERE profile_id = ? AND product_url = ?",
            (profile_id, product_url),
        ).fetchone()
        return dict(row)


def get_tracked_products(profile_id: int) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM tracked_products WHERE profile_id = ? ORDER BY created_at DESC",
            (profile_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def get_disabled_product_urls(profile_id: int) -> set[str]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT product_url FROM tracked_products WHERE profile_id = ? AND enabled = 0",
            (profile_id,)
        ).fetchall()
    return {r["product_url"] for r in rows}


def set_tracked_product_enabled(product_id: int, enabled: bool) -> dict | None:
    with _connect() as conn:
        conn.execute(
            "UPDATE tracked_products SET enabled = ? WHERE id = ?",
            (int(enabled), product_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM tracked_products WHERE id = ?", (product_id,)
        ).fetchone()
    return dict(row) if row else None


# ── API Usage ─────────────────────────────────────────────────────────────────

def record_usage(profile_id: int, service: str, action: str) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO api_usage (profile_id, service, action) VALUES (?, ?, ?)",
            (profile_id, service, action),
        )
        conn.commit()


def get_usage_counts(profile_id: int) -> dict:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT service, COUNT(*) as cnt FROM api_usage WHERE profile_id = ? GROUP BY service",
            (profile_id,)
        ).fetchall()
    return {r["service"]: r["cnt"] for r in rows}


def get_monthly_usage(profile_id: int) -> dict:
    with _connect() as conn:
        rows = conn.execute(
            """SELECT service, COUNT(*) as cnt FROM api_usage
               WHERE profile_id = ?
               AND created_at >= date('now', 'start of month')
               GROUP BY service""",
            (profile_id,)
        ).fetchall()
    return {r["service"]: r["cnt"] for r in rows}


def _migrate() -> None:
    """Add columns that were introduced after initial schema creation."""
    migrations = [
        ("profiles",  "gemini_model",        "TEXT DEFAULT 'gemini-2.5-flash'"),
        ("profiles",  "image_model",          "TEXT DEFAULT 'imagen-4.0-generate-001'"),
        ("profiles",  "ig_user_id",           "TEXT DEFAULT ''"),
        ("profiles",  "currency",             "TEXT DEFAULT ''"),
        ("profiles",  "facebook_page_id",     "TEXT DEFAULT ''"),
        ("pipelines", "post_time",            "TEXT NOT NULL DEFAULT '09:00'"),
        ("pipelines", "workflow_configured",  "INTEGER NOT NULL DEFAULT 0"),
        ("pipelines", "posts_per_run",        "INTEGER NOT NULL DEFAULT 1"),
        ("pipelines", "caption_prompt",       "TEXT NOT NULL DEFAULT ''"),
        ("pipelines", "image_prompt",         "TEXT NOT NULL DEFAULT ''"),
        ("pipelines", "workflow_type",        "TEXT NOT NULL DEFAULT 'ai_full'"),
        ("pipelines", "reference_images",     "TEXT NOT NULL DEFAULT '[]'"),
        ("posts",     "product_description",  "TEXT DEFAULT ''"),
        ("posts",     "caption_prompt_used",  "TEXT DEFAULT ''"),
        ("posts",     "image_prompt_used",    "TEXT DEFAULT ''"),
    ]
    with _connect() as conn:
        for table, column, definition in migrations:
            try:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
                conn.commit()
            except Exception:
                pass  # column already exists


# Ensure DB and tables exist on import.
init_db()
_migrate()
