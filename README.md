# TEST API — Developer API Testing & Development Platform

[![Django](https://img.shields.io/badge/Django-5.x-092E20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Django REST Framework](https://img.shields.io/badge/DRF-3.x-red?logo=django&logoColor=white)](https://www.django-rest-framework.org/)
[![Clerk Auth](https://img.shields.io/badge/Auth-Clerk%20%7C%20Session-6C47FF?logo=clerk&logoColor=white)](https://clerk.com/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)](https://python.org/)
[![Database](https://img.shields.io/badge/Database-SQLite%20(Dev)%20%7C%20PostgreSQL%20(Prod)-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

**TEST API** is a modern, high-performance, browser-based API testing and development SaaS platform. Built with Python, Django, Django REST Framework, and a dark developer-first design system, it delivers a smooth desktop workspace experience for testing REST APIs, organizing request collections, inspecting responses, managing environments, and executing requests through a secure server-side proxy engine.

---

## 🌟 Key Features

### 💻 Developer Workspace & UI
- **Modern Dark Aesthetic** — Curated dark color system (`#0B0B0C` background, `#111113` sidebar, `#161618` cards, `#2A2A2D` borders, and vibrant `#F97316` orange accents) with theme toggling (Dark / Light).
- **Zero-Overlap Sidebar** — Fully fixed, stable flexbox layout for Collections, History, Saved Requests, and Environments with no layout jumps on refresh.
- **Multi-Tab Request Management** — Open, close, switch, and rename multiple request tabs concurrently with individual dirty/unsaved state tracking.
- **Quick Search (`Ctrl + K`)** — Instant global modal search across all saved requests, collections, history records, and environments.
- **Command Palette (`Ctrl + Shift + P`)** — Keyboard-driven command menu for quick navigation and actions.
- **Keyboard Shortcuts** — `Ctrl + Enter` to Send Request, `Ctrl + S` to Save Request, `Ctrl + K` to Search, `Ctrl + Shift + P` for Commands.
- **Toast Notification System** — Non-intrusive status toasts replace native browser alerts.

### 🚀 Request Builder & Proxy Engine
- **Supported HTTP Methods** — `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`.
- **Dynamic Variable Substitution** — Live evaluation of `{{VARIABLE}}` tokens in URLs, headers, query parameters, and request bodies.
- **Request Configuration Tabs**:
  - **Params** — Key/value table with enable/disable toggles and live URL preview.
  - **Headers** — Key/value headers editor with token masking and standard presets.
  - **Body** — JSON (syntax validation & formatting), Form Data, x-www-form-urlencoded, and Raw text.
  - **Auth** — No Auth, Bearer Token, API Key (Header or Query), Basic Auth, and OAuth 2.0.
  - **Tests** — Configurable assertions (Status 200 OK, Latency < 1000ms, text match).
- **Secure Server-Side Proxy**:
  - **Full SSRF Protection** — Blocks private RFC 1918 networks, loopback (`127.0.0.1`), link-local, and cloud metadata services (`169.254.169.254`, `metadata.google.internal`).
  - **Streaming Size Limiter** — Prevents memory exhaustion by terminating responses that exceed the configured threshold (default 5MB).
  - **Resilient Payload Handling** — Safely handles JSON, HTML, plain text, XML, binary, and empty bodies (`204 No Content`) without backend crashes.
  - **Structured Error Envelope** — Clear, informative error classification (`connection_error`, `timeout`, `ssl_error`, `invalid_url`, `ssrf_blocked`).

### 📊 Response Inspector
- **Status & Metrics** — Distinct status code badge (`200 OK`, `404 Not Found`, `500 Server Error`), latency meter (`...ms`), and byte size counter.
- **Formatted JSON Viewer** — Clean monospace syntax-highlighted viewer with one-click copy.
- **Headers Explorer** — Tabulated response headers with key/value search and copy support.
- **Cookie Inspector** — Dedicated table parsing cookies with domain, path, value, and secure flags.
- **Live Test Results** — Real-time assertion pass/fail indicators with detailed expectations vs. received values.

### 🌐 Environments & Variables
- **Named Environments** — Create environments such as `Development`, `Staging`, and `Production`.
- **Variable Storage** — Key/value pairs with secret flags for sensitive credentials.
- **Active Environment Switcher** — Global selector in the top bar with automatic variable interpolation across all active request tabs.

### 🔐 Authentication & User Isolation
- **Clerk Authentication** — Native Clerk frontend integration with backend JWT verification via JWKS caching.
- **User Data Isolation** — All collections, saved requests, history items, and environments are strictly partitioned by `clerk_user_id` and Django user ID.
- **Guest / Unauthenticated Testing** — Anyone can test public APIs immediately out-of-the-box; signing in activates cloud sync, saved requests, history, and environments.
- **Local Dev Fallback** — In development mode (`DEBUG=True`), the system provides an automatic dev fallback so everything works without requiring Clerk credentials.

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **Backend Framework** | Python 3.10+, Django 5.x |
| **API Framework** | Django REST Framework (DRF) 3.x |
| **Authentication** | Clerk (JWT RS256 / JWKS) + Django Session fallback |
| **Proxy Engine** | Python `requests` with SSRF socket validator & streaming limiter |
| **Database** | SQLite (development) · PostgreSQL (production-ready via `DATABASE_URL`) |
| **Frontend** | Vanilla JavaScript (ES6+ modular state) + Bootstrap 5.3 + Custom CSS System |
| **Fonts** | Inter & JetBrains Mono (Google Fonts) |
| **Static Assets** | WhiteNoise 6.x |

---

## 📁 Project Architecture

```
test_Api/
├── manage.py                          # Django CLI entrypoint
├── api_testing_tool/                  # Project configuration
│   ├── settings.py                    # Core settings (Clerk, DB, DRF, WhiteNoise)
│   ├── urls.py                        # Root URL routing
│   ├── wsgi.py / asgi.py
├── accounts/                          # Authentication module
│   ├── authentication.py              # ClerkAuthentication (JWT JWKS client + session fallback)
│   ├── context_processors.py          # Exposes safe CLERK_PUBLISHABLE_KEY to templates
│   ├── views.py                       # Login, Register, Logout views
│   └── urls.py
├── core/                              # Workspace, models & REST APIs
│   ├── models.py                      # Collection, SavedRequest, RequestHistory, Environment, EnvironmentVariable
│   ├── serializers.py                 # DRF serializers with smart URL sanitization
│   ├── api_urls.py                    # REST ViewSets (Collections, Saved, History, Environments)
│   ├── views.py                       # Workspace root view
│   ├── admin.py                       # Admin panel registrations with inlines
│   └── templates/core/index.html      # Main API workspace UI template
├── proxy/                             # Secure Server-Side Proxy
│   ├── services.py                    # execute_request(), SSRF validator, size limiter
│   ├── views.py                       # ProxyExecuteView (/api/proxy/execute/)
│   ├── serializers.py                 # Request validation serializer
│   └── tests.py                       # SSRF & proxy test suite
├── static/
│   ├── app.js                         # SPA state manager, tabs, proxy caller, modals
│   └── app.css                        # Complete custom dark SaaS design system
├── templates/
│   ├── base.html                      # App shell, top bar, modals (Search, Palette, Env)
│   └── registration/login.html        # Authentication UI
├── db.sqlite3                         # Local development SQLite database
├── requirements.txt                   # Project dependencies
└── .env.example                       # Environment configuration template
```

---

## 🚀 Quick Start Guide

### 1. Clone & Setup Virtual Environment

```powershell
# Navigate to project root
cd test_Api

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate           # Windows PowerShell / CMD
# source venv/bin/activate        # macOS / Linux
```

### 2. Install Dependencies

```powershell
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env`:

```powershell
copy .env.example .env
```

Default `.env` configuration (works out-of-the-box for local development):
```env
DJANGO_SECRET_KEY=django-insecure-local-dev-key-change-in-production
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost

# Database (Leave blank for automatic SQLite development)
DATABASE_URL=

# API Proxy settings
PROXY_TIMEOUT=30
ALLOW_LOCALHOST_PROXY=True

# Clerk Authentication (Optional for local development)
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_JWKS_URL=
```

### 4. Run Migrations

```powershell
python manage.py migrate
```

### 5. Collect Static Files

```powershell
python manage.py collectstatic --noinput
```

### 6. (Optional) Create Admin User

```powershell
python manage.py createsuperuser
```

### 7. Start the Development Server

```powershell
python manage.py runserver 127.0.0.1:8000
```

Open your browser and navigate to:
- **API Testing Workspace:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Django Admin Panel:** [http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/)

---

## 🧪 Testing the API Workspace

### Quick Verification Steps
1. Navigate to [http://127.0.0.1:8000/](http://127.0.0.1:8000/).
2. In the URL bar, enter `https://jsonplaceholder.typicode.com/users` and click **Send** (or press `Ctrl + Enter`).
3. Observe the response:
   - Status Badge: `200 OK`
   - Latency Chip: e.g. `~140ms`
   - Size Chip: `~5.6 KB`
   - Pretty-printed JSON response body.
4. Open the **Headers** tab to inspect response headers.
5. Click **+** on the request tab strip to open a second tab and test `POST https://jsonplaceholder.typicode.com/posts`.
6. Open the Environment Manager from the top bar, create an environment with `BASE = https://jsonplaceholder.typicode.com`, and test `{{BASE}}/todos/1`.
7. Press `Ctrl + Shift + P` to launch the **Command Palette**.
8. Press `Ctrl + K` to trigger **Quick Search**.

---

## 🔌 REST API Reference

All application endpoints are located under `/api/`:

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `POST` | `/api/proxy/execute/` | Execute an HTTP request through the proxy engine | Optional (links history if authenticated) |
| `GET` / `POST` | `/api/collections/` | List or create collections for authenticated user | Yes |
| `GET` / `PUT` / `DELETE` | `/api/collections/{id}/` | Retrieve, update, or delete a collection | Yes |
| `GET` / `POST` | `/api/saved-requests/` | List or save requests | Yes |
| `GET` / `PUT` / `DELETE` | `/api/saved-requests/{id}/` | Retrieve, update, or delete a saved request | Yes |
| `GET` / `DELETE` | `/api/history/` | View or clear request execution history | Yes |
| `DELETE` | `/api/history/{id}/` | Delete a single history record | Yes |
| `GET` / `POST` | `/api/environments/` | List or create user environments | Yes |
| `GET` / `PUT` / `DELETE` | `/api/environments/{id}/` | Retrieve, update, or delete an environment | Yes |
| `POST` | `/api/environments/{id}/variables/` | Bulk update variables for an environment | Yes |

### Proxy Execution Payload
```json
{
  "method": "GET",
  "url": "https://jsonplaceholder.typicode.com/users",
  "params": {
    "limit": "10"
  },
  "headers": {
    "Accept": "application/json"
  },
  "body": "",
  "auth_type": "bearer",
  "auth_config": {
    "token": "your-api-token"
  }
}
```

### Proxy Response Envelope
```json
{
  "ok": true,
  "status_code": 200,
  "status_text": "OK",
  "response_time_ms": 142,
  "response_size_bytes": 5645,
  "headers": {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "max-age=43200"
  },
  "cookies": [],
  "body_text": "[ ... ]",
  "content_type": "application/json; charset=utf-8",
  "error_type": null,
  "error_message": null,
  "is_truncated": false
}
```

---

## 🛡️ Security Architecture

1. **Server-Side Request Forgery (SSRF) Defense**:
   - Hostname and IP resolution checks verify that destinations do not point to internal private networks (RFC 1918), loopback, link-local, or cloud instance metadata services (`169.254.169.254`, `metadata.google.internal`).
2. **Streaming Response Protection**:
   - Outgoing proxy connections enforce a 5MB cutoff to prevent denial-of-service memory exhaustion.
3. **Clerk Authentication Verification**:
   - In production, JWTs passed via `Authorization: Bearer <token>` or `__session` cookies are cryptographically verified against Clerk JWKS public keys.
4. **User Data Isolation**:
   - Backend queries enforce strict ownership by user ID / `clerk_user_id`. Users cannot view or modify other users' collections, requests, or environments.
5. **No Secrets in Client Code**:
   - API testing secrets and Clerk secret keys remain strictly on the backend.

---

## 🧪 Automated Test Suite

Run the full Django test suite:

```powershell
python manage.py test
```

Run Django deployment checks:

```powershell
python manage.py check
```

Smoke test the proxy engine standalone:

```powershell
python test_url_issue.py
```

---

## 📦 Production Deployment

For production deployments (e.g., Docker, Render, Railway, AWS, DigitalOcean):

1. Set `DJANGO_DEBUG=False`.
2. Configure `DJANGO_ALLOWED_HOSTS` to your production domain.
3. Set `DJANGO_SECRET_KEY` to a cryptographically secure random string.
4. Provide `DATABASE_URL` pointing to your PostgreSQL instance.
5. Configure `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
6. Run `python manage.py collectstatic --noinput`.
7. Serve using a production WSGI/ASGI server like Gunicorn or Uvicorn:
   ```bash
   gunicorn api_testing_tool.wsgi:application --bind 0.0.0.0:8000
   ```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
