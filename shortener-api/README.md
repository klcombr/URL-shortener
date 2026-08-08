# Encurtador de Links — API (Flask)

Backend do encurtador de URLs: autenticação (JWT), cadastro de URLs,
contagem de cliques e redirecionamento.

## Dependências

Python 3.11+. Instale as dependências:

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Variáveis de ambiente

| Variável | Obrigatória | Default | Descrição |
|----------|-------------|---------|-----------|
| `SECRET_KEY` | Sim (produção) | gerado aleatório em dev | Chave de assinatura dos tokens. Em produção o app **aborta** se ausente. |
| `DATABASE_URL` | Não | `sqlite:///urlshortener.db` | URI do banco (SQLAlchemy). |
| `CORS_ORIGIN` | Não | `*` | Origem permitida no CORS. Configure com a origem do frontend em produção. |
| `BASE_URL` | Não | `https://url-shortener-ifay.onrender.com` | Base usada para montar a `short_url`. |
| `APP_ENV` | Não | `development` | `production` ativa exigências de produção (ex.: `SECRET_KEY` obrigatória). |

Gere uma chave segura com:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Como rodar

Desenvolvimento (Flask):

```bash
export SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
flask run --port 8000
```

Produção (gunicorn):

```bash
SECRET_KEY=... CORS_ORIGIN=https://seu-frontend pip install gunicorn
gunicorn --bind 0.0.0.0:8000 app.main:app
```

## Docker

```bash
docker build -t url-shortener-api .
docker run -p 8000:8000 \
  -e SECRET_KEY=... \
  -e CORS_ORIGIN=... \
  -e DATABASE_URL=... \
  url-shortener-api
```

## Endpoints

- `POST /api/v1/auth/register` — cadastro
- `POST /api/v1/auth/login` — login, retorna `access_token`
- `POST /api/v1/urls/` — encurta uma URL (auth, aceita apenas `http`/`https`)
- `GET /api/v1/urls/` — lista URLs do usuário (auth)
- `DELETE /api/v1/urls/<id>` — remove URL do usuário (auth)
- `GET /<short_code>` — redireciona para a URL original
