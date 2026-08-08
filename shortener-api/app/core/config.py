import os
import secrets
import sys

class Settings:
    ENV: str = os.getenv("APP_ENV", os.getenv("FLASK_ENV", "development")).lower()
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///urlshortener.db")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    BASE_URL: str = os.getenv("BASE_URL", "https://url-shortener-ifay.onrender.com")
    CORS_ORIGIN: str = os.getenv("CORS_ORIGIN", "*")

    def __init__(self):
        secret = os.getenv("SECRET_KEY")
        if not secret:
            if self.ENV == "production":
                sys.exit(
                    "SECRET_KEY não definido. Defina a variável de ambiente "
                    "SECRET_KEY antes de iniciar o app em produção."
                )
            secret = secrets.token_urlsafe(32)
            print(
                "WARNING: SECRET_KEY não definido — gerando valor aleatório. "
                "Defina SECRET_KEY via ambiente (ex.: SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')).",
                file=sys.stderr,
            )
        self.SECRET_KEY = secret

settings = Settings()
