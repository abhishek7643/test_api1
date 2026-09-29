# API Testing Tool

A lightweight, browser-based API testing platform built with Django, Django REST Framework, and vanilla JavaScript. Send HTTP requests, inspect responses, organize them into collections, and keep a full history of every call — all from a single clean UI.

---

## ✨ Features

- **HTTP Request Builder** — Send `GET`, `POST`, `PUT`, `PATCH`, `DELETE` requests with custom headers, query params, and JSON body
- **Response Inspector** — Pretty-printed JSON body, status badges, response timing, and full header inspection
- **Authentication Support** — No Auth, Bearer Token, API Key (header/query), and Basic Auth
- **Collections** — Organize saved requests into user-specific, named folders
- **Request History** — Auto-log every executed request with status, time, and full replay support
- **Smart URL Cleaning** — Auto-strips method prefixes, quotes, whitespace, and invisible characters from pasted URLs
- **User Authentication** — Django-powered login/register with `next`-aware redirects
- **Django Admin Panel** — Manage users, collections, saved requests, and history
- **Database Fallback** — PostgreSQL by default with an automatic SQLite fallback for local development

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10+, Django 5.x |
| API | Django REST Framework 3.x |
| Frontend | Vanilla JavaScript + Bootstrap (CSS via CDN) |
| Database | PostgreSQL (primary) · SQLite (automatic fallback) |
| Proxy Engine | `requests` library (server-side proxy avoids CORS) |
| Environment | `python-dotenv` · `dj-database-url` |

---

## 📁 Project Structure

```
sih25/
├── manage.py                     # Django CLI entrypoint
├── api_testing_tool/             # Project config
│   ├── settings.py               # DB, apps, auth, proxy timeout
│   ├── urls.py                   # Root URL routing
│   └── wsgi.py / asgi.py
├── accounts/                     # Django auth (login / register)
│   ├── views.py                  # RegisterView with next-param redirect
│   ├── urls.py
│   └── templates/accounts/register.html
├── core/                         # Domain models + main UI
│   ├── models.py                 # Collection · SavedRequest · RequestHistory
│   ├── serializers.py            # Shared URL cleaner + SavedRequestSerializer
│   ├── api_urls.py               # REST routes: /api/collections/, /api/saved-requests/, /api/history/
│   ├── views.py                  # Index page + API ViewSets
│   ├── urls.py
│   └── templates/core/index.html
├── proxy/                        # Request execution engine
│   ├── serializers.py            # ProxyExecuteRequestSerializer
│   ├── services.py               # execute_request() — server-side HTTP proxy
│   ├── views.py                  # POST /api/proxy/execute/
│   └── urls.py
├── static/
│   ├── app.js                    # Frontend state, UI rendering, API calls
│   └── app.css                   # Custom styles (sidebar, tabs, status badges)
├── templates/
│   ├── base.html                 # Global navbar + 3-dot user menu
│   └── registration/login.html
├── .env.example                  # Environment variable template
├── requirements.txt
├── db.sqlite3                    # Local dev DB (auto-created)
└── test_url_issue.py             # Quick URL validation smoke test
```

---

## 🚀 Quick Start

### 1. Clone & install dependencies

```bash
# If not already in the project folder
cd sih25

python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux

pip install -r requirements.txt
```

### 2. Configure environment (optional)

Copy the example and tweak if you want PostgreSQL or a custom secret:

```bash
copy .env.example .env
# edit .env with your DB credentials and DJANGO_SECRET_KEY
```

If PostgreSQL isn't reachable, the app **automatically falls back to SQLite** (`db.sqlite3`), so you can skip this step entirely for local development.

### 3. Apply migrations

```bash
python manage.py migrate
```

### 4. Create an admin superuser

```bash
python manage.py createsuperuser
# Or use the non-interactive one-liner:
python -c "import os; os.environ.setdefault('DJANGO_SETTINGS_MODULE','api_testing_tool.settings'); import django; django.setup(); from django.contrib.auth import get_user_model; u=get_user_model().objects.get_or_create(username='admin',defaults={'is_superuser':True,'is_staff':True,'email':'a@a.com'})[0]; u.set_password('admin123'); u.save()"
```

Default local credentials (if you used the one-liner above):

| Account | Username | Password |
|---|---|---|
| Superuser / Admin | `admin` | `admin123` |
| Regular test user (optional) | `testuser` | `testpass123` |

### 5. Run the dev server

```bash
python manage.py runserver 127.0.0.1:8000
```

Then open:

- **App:** 👉 http://127.0.0.1:8000/
- **Admin Panel:** 👉 http://127.0.0.1:8000/admin/

---

## 🧑‍💻 Usage

### Sending a Request
1. Register / log in.
2. Pick a **method** (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) from the dropdown.
3. Paste the **URL** (e.g. `https://jsonplaceholder.typicode.com/users`).
4. Add **Params**, **Headers**, **Body** (JSON), or **Auth** via the tabs.
5. Click **Send**. The response (status, time, headers, pretty-printed body) appears in the bottom pane.

### Smart URL Handling
The URL input and backend cooperate to clean messy pasted input — these all work:

```
https://jsonplaceholder.typicode.com/users
 https://jsonplaceholder.typicode.com/users   (spaces)
GET https://jsonplaceholder.typicode.com/users   (method prefix)
"https://jsonplaceholder.typicode.com/users"   (quoted)
HTTPS://example.com   (uppercase protocol)
```

### Saving a Request
1. Fill in the request builder.
2. Click **Save** → name it, optionally pick a **Collection** (or create new).
3. Saved requests appear in the left sidebar, grouped by collection.

### History
Every sent request is logged automatically. Click any history entry to reload its full state into the editor and re-send.

---

## 🔌 API Endpoints

All REST endpoints require session authentication (login first).

| Method | Route | Purpose |
|---|---|---|
| `GET /` | Main UI | Loads the API tester page |
| `POST /api/proxy/execute/` | Proxy | Executes an HTTP request server-side and returns the response envelope |
| `GET /api/collections/` | Collections | List current user's collections |
| `POST /api/collections/` | Collections | Create a new collection |
| `GET /api/saved-requests/` | Saved Requests | List current user's saved requests |
| `POST /api/saved-requests/` | Saved Requests | Save a new request (use `collection` = integer PK or `null`) |
| `GET /api/history/` | History | List current user's request history |
| `DELETE /api/history/` | History | Clear all history for the current user |
| `GET /accounts/login/` | Auth | Login page |
| `GET /accounts/register/` | Auth | Register page |
| `GET /accounts/logout/` | Auth | Logout |
| `GET /admin/` | Admin | Django admin panel |

### Proxy execute payload example

```json
{
  "method": "GET",
  "url": "https://jsonplaceholder.typicode.com/users",
  "params": {},
  "headers": {},
  "body": "",
  "auth_type": "none",
  "auth_config": {}
}
```

Auth config shapes:

| `auth_type` | `auth_config` |
|---|---|
| `bearer` | `{ "token": "your-token" }` |
| `api_key` | `{ "key": "X-API-Key", "value": "abc", "in": "header" \| "query" }` |
| `basic` | `{ "username": "alice", "password": "secret" }` |

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DJANGO_SECRET_KEY` | insecure fallback | Secret key for signing sessions |
| `DJANGO_DEBUG` | `True` | Django debug mode |
| `DJANGO_ALLOWED_HOSTS` | `127.0.0.1,localhost` | Comma-separated allowed hosts |
| `DB_NAME` | `api_testing_tool` | PostgreSQL database name |
| `DB_USER` | `postgres` | PostgreSQL user |
| `DB_PASSWORD` | *(empty)* | PostgreSQL password |
| `DB_HOST` | `127.0.0.1` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DATABASE_URL` | *(optional)* | Override full DB via URL (e.g. for Heroku/Railway) |
| `PROXY_TIMEOUT` | `30` | Seconds before a proxied request times out |

---

## 🧪 Running Tests

```bash
# Django built-in tests
python manage.py test

# Smoke test the URL cleaning + proxy execute (requires running server + testuser)
python test_url_issue.py
```

---

## 📝 Notes

- All proxy requests go through `execute_request()` in `proxy/services.py` to avoid browser CORS restrictions and measure accurate server-side timing.
- JSON bodies are parsed via `json.loads()` before being forwarded — this prevents double-serialization.
- Saved requests, collections, and history are strictly user-scoped; cross-user access is blocked at the ViewSet layer.
- The navbar 3-dot kebab menu shows Login/Register to guests and Logout/User info to authenticated users on every page.
- Login/Register redirects preserve the `?next=` query parameter to take users back where they started.

---

## 🛡️ Security

- CSRF tokens are required on every `POST` and fetched from the `csrftoken` cookie.
- DRF defaults to `IsAuthenticated`, so anonymous users cannot hit the REST API directly.
- Auth credentials are never logged to request history or saved requests unless explicitly part of the saved request state (e.g. in `auth_config_json` for that request).
- Django's built-in password validators enforce minimum strength on registration.

---

Built for SIH-2025 prototyping. 🚀
