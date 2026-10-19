# Encurtador — links curtos com analytics

API + interface web para encurtar URLs, com slugs personalizados, autenticação
JWT e analytics de cliques por dia. FastAPI + SQLite, sem ORM e sem frontend framework.

## Rodar

```bash
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app:app --reload
```

Abre em `http://localhost:8000`. Crie uma conta, cole a URL, ganhe o link curto.

Variáveis de ambiente:

| Variável | Padrão | Uso |
| --- | --- | --- |
| `JWT_SECRET` | aleatório a cada boot | assinatura dos tokens — defina em produção |
| `DB_PATH` | `links.db` | caminho do SQLite |
| `REDIRECT_BASE` | vazio | base usada no `short` retornado pela API |

## Testes

```bash
.venv/bin/python -m pytest test_api.py -q
```

7 testes de integração cobrindo registro, login, autorização, colisão de slug,
contagem de cliques e isolamento entre usuários (um usuário não apaga link de outro).

## API

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| `POST` | `/api/register` | — | cria conta, retorna `{token}` |
| `POST` | `/api/login` | — | autentica, retorna `{token}` |
| `POST` | `/api/links` | Bearer | cria link; `slug` opcional |
| `GET` | `/api/links` | Bearer | lista links do usuário com cliques e breakdown diário |
| `DELETE` | `/api/links/{slug}` | Bearer | remove um link do usuário |
| `GET` | `/{slug}` | — | registra o clique e redireciona (302) |

Decisões que valem citar: slug gerado a partir de um alfabeto sem caracteres
ambíguos (`0/O`, `1/l`), `bcrypt` para senha, `PRAGMA foreign_keys` ligado para o
`ON DELETE CASCADE` funcionar de fato, e limite de tamanho/formato no slug.

## Licença

MIT
