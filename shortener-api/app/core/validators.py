from urllib.parse import urlparse

ALLOWED_SCHEMES = {"http", "https"}

def is_valid_http_url(raw: str) -> bool:
    """Valida que o valor é uma URL http/https com host definido."""
    if not raw or not isinstance(raw, str):
        return False
    parsed = urlparse(raw.strip())
    return parsed.scheme in ALLOWED_SCHEMES and bool(parsed.netloc)
