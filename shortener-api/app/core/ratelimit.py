import time
from collections import defaultdict
from functools import wraps

from flask import jsonify, request

RATE_LIMIT_MAX = 10
RATE_LIMIT_WINDOW = 60

_failed_attempts = defaultdict(list)

def _cleanup(now: int, key: str) -> None:
    window_start = now - RATE_LIMIT_WINDOW
    attempts = _failed_attempts[key]
    _failed_attempts[key] = [ts for ts in attempts if ts > window_start]

def is_rate_limited(key: str, limit: int = RATE_LIMIT_MAX, window: int = RATE_LIMIT_WINDOW) -> bool:
    now = int(time.time())
    _cleanup(now, key)
    return len(_failed_attempts[key]) >= limit

def record_failure(key: str) -> None:
    now = int(time.time())
    _cleanup(now, key)
    _failed_attempts[key].append(now)

def clear_failures(key: str) -> None:
    _failed_attempts.pop(key, None)

def rate_limit(limit: int = RATE_LIMIT_MAX, window: int = RATE_LIMIT_WINDOW):
    """Limita tentativas por IP: enquanto o IP exceder o limite, responde 429."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            key = request.remote_addr or "unknown"
            if is_rate_limited(key, limit=limit, window=window):
                return jsonify({"error": "Muitas tentativas. Tente novamente em 1 minuto."}), 429
            return fn(*args, **kwargs)
        return wrapper
    return decorator
