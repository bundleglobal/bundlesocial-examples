# bundle.social Python example (community-style)

A small Python project showing how to call the [bundle.social](https://bundle.social) REST API from Python.

> [!IMPORTANT]
> bundle.social only ships an **official Node SDK**. There is no `bundlesocial` package on PyPI. This example uses raw HTTP via [`httpx`](https://www.python-httpx.org/) and is community-style — it is intentionally tiny and not feature-complete. For production Node.js use, install [`bundlesocial`](https://www.npmjs.com/package/bundlesocial). For full API reference, see [docs.bundle.social](https://docs.bundle.social).

## What this example does

- Wraps the ~8 most useful endpoints in a small synchronous `BundleSocialClient` class (`bundlesocial/client.py`).
- Auto-resolves the team id from the organization when there's exactly one team.
- Raises a typed `BundleSocialApiError` with the parsed JSON envelope on non-2xx responses.
- Ships three runnable examples in `examples/`.

## What this example does NOT do

- **No official SDK.** This is hand-written; the Node SDK is generated from the OpenAPI spec and is the source of truth.
- **No webhook signature verification.** The Node SDK exposes `webhooks.constructEvent`; if you need it in Python, port the HMAC-SHA256 check from [`bundlesocial-node/src/index.ts`](https://github.com/bundlesocial/bundlesocial-node).
- **No async client.** `httpx.AsyncClient` is a one-line swap if you want it.
- **No typed response models.** Returns are `dict[str, Any]`; reach for `pydantic` if you want validation.
- **No retries / pagination helpers.** Add `httpx.HTTPTransport(retries=...)` and a simple loop over `offset`/`limit` if you need them.

## Setup

Python 3.10+ required.

```bash
cd python
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# or, with uv:
# uv venv && source .venv/bin/activate && uv pip install -r requirements.txt
```

## Environment

```bash
export BUNDLESOCIAL_API_KEY=sk_...
# Optional: pin a team id (otherwise auto-resolved from the org if there's exactly one team)
export BUNDLESOCIAL_TEAM_ID=...
```

See `.env.example`.

## Run the examples

```bash
python examples/01_health_and_org.py
python examples/02_post_to_x_and_bluesky.py
python examples/03_list_recent_posts.py
```

`02_post_to_x_and_bluesky.py` will create a real scheduled post — the team must have **TWITTER** and **BLUESKY** social accounts connected.

## API surface

`BundleSocialClient` exposes:

| Method                                                                          | Endpoint                          |
| ------------------------------------------------------------------------------- | --------------------------------- |
| `health()`                                                                      | `GET /api/v1/`                    |
| `get_organization()`                                                            | `GET /api/v1/organization/`       |
| `get_team(team_id)`                                                             | `GET /api/v1/team/{id}`           |
| `list_teams(offset=, limit=, search=)`                                          | `GET /api/v1/team/`               |
| `list_posts(team_id=None, **filters)`                                           | `GET /api/v1/post/`               |
| `get_post(post_id)`                                                             | `GET /api/v1/post/{id}`           |
| `upload_from_url(team_id=None, url=...)`                                        | `POST /api/v1/upload/from-url`    |
| `create_post(team_id=None, title=..., post_date=..., status=..., social_account_types=..., data=...)` | `POST /api/v1/post/` |
| `list_integrations(team_id=None)`                                               | wraps `GET /api/v1/team/{id}`     |

### The `data` shape on `create_post`

Per the [platform parameters docs](https://docs.bundle.social/api-reference/platform-parameters), `data` is keyed by platform enum:

```python
data = {
    "TWITTER": {"text": "Hello", "uploadIds": ["<upload-id>"]},
    "BLUESKY": {"text": "Hello", "uploadIds": ["<upload-id>"]},
}
```

Each platform has additional optional fields (e.g. `INSTAGRAM.type`, `PINTEREST.boardName`); cross-check with [`openapi.json`](https://github.com/bundlesocial/bundlesocial-node/blob/main/openapi/openapi.json).

## Future work

- Async variant using `httpx.AsyncClient`.
- Webhook signature verification (`HMAC-SHA256` over the raw body, compared to `x-signature`).
- A `pydantic` model layer generated from the OpenAPI schema.
- Multipart upload (`POST /api/v1/upload/`) and large-file upload (`/upload/init` + `/upload/finalize`).
