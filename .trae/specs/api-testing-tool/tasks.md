# API Testing Tool - Implementation Plan

## Task 1: Scaffold Django project structure, dependencies, .env, .gitignore
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Create Django project `api_testing_tool` with root `manage.py` and project config folder.
  - Create three Django apps: `accounts` (auth/templates), `core` (models), `proxy` (API execution endpoints).
  - Create `requirements.txt` with Django, djangorestframework, psycopg2-binary, python-dotenv, dj-database-url, requests.
  - Add `.env.example` (DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DJANGO_SECRET_KEY, DJANGO_DEBUG, PROXY_TIMEOUT). Actual `.env` in `.gitignore`.
  - `.gitignore` covering `.env`, `__pycache__`, `*.pyc`, `db.sqlite3`, `venv/`, `.idea/`, `.vscode/`, `*.log`.
  - Configure `settings.py` to load env via `python-dotenv`; set `DATABASES` via env vars (PostgreSQL); add `rest_framework` and the three apps to INSTALLED_APPS; enable sessions; add templates directory; set STATIC_URL.
- **Acceptance Criteria Addressed**: AC-1, AC-13, NFR-1, NFR-2
- **Test Requirements**:
  - `rule` TR-1.1: `python -c "import django; import rest_framework; import requests"` succeeds in the project venv.
  - `rule` TR-1.2: `python manage.py check` exits with code 0 (System check identified no issues).
  - `rule` TR-1.3: `.gitignore` contains `.env`; `.env.example` exists with non-empty template; no secrets hard-coded in `settings.py` (grep for `secret`/`password` in settings returns only env reads).
  - `rubric` TR-1.4: Modularity; scale 1-5; anchors 1=monolithic, 3=apps exist but boundaries fuzzy, 5=accounts/core/proxy separation clean and settings reads DRY; threshold >= 4; evidence: file tree and settings code inspection.
- **Notes**: Use `django-admin startproject` + `startapp`; settings refactor to use env variables cleanly.

## Task 2: Configure PostgreSQL, create models, generate initial migrations
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - In `core/models.py`:
    - `Collection`: user (FK User), name (CharField), created_at, updated_at. `__str__` returns name.
    - `SavedRequest`: user (FK User), collection (FK Collection, nullable/SET_NULL), name (CharField), method (CharField choices GET/POST/PUT/PATCH/DELETE), url (TextField), headers_json (JSONField default dict), params_json (JSONField default dict), body_json (TextField or JSONField nullable), auth_type (CharField choices: none/bearer/api_key/basic), auth_config_json (JSONField default dict), created_at, updated_at.
    - `RequestHistory`: user (FK User), method, url, headers_json, params_json, body_json, auth_type, auth_config_json, status_code (IntegerField nullable), response_time_ms (IntegerField nullable), executed_at (DateTimeField auto_now_add).
  - Add indexes on `(user_id, -created_at)` for history and saved requests.
  - Register models in `core/admin.py` for Django admin.
  - Run `makemigrations` and verify `migrate` succeeds against configured PostgreSQL.
- **Acceptance Criteria Addressed**: AC-2, AC-8, AC-9, NFR-2
- **Test Requirements**:
  - `rule` TR-2.1: `python manage.py makemigrations core` creates migration files with models Collection, SavedRequest, RequestHistory.
  - `rule` TR-2.2: `python manage.py migrate` exits with code 0.
  - `rule` TR-2.3: No raw SQL in models.py / admin.py (grep for `raw(`/`execute` returns none).
  - `rubric` TR-2.4: Model design quality; scale 1-5; anchors 1=missing fields/bad types, 3=fields present but no indexes/constraints, 5=correct field types, JSONField for flexible dicts, indexes for common queries, cascade behavior sensible (CASCADE delete with user); threshold >= 4; evidence: models.py code review and `\d` descriptions in psql (or Django `sqlmigrate` output).

## Task 3: Django authentication (register, login, logout) pages + session gates
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - In `accounts` app:
    - Create templates `registration/login.html`, `accounts/register.html` with Bootstrap styling.
    - Create `RegisterView` using Django's UserCreationForm (or custom form with email).
    - Wire URLs: `/accounts/login/` (Django built-in LoginView), `/accounts/register/`, `/accounts/logout/` (LogoutView).
    - `LOGIN_REDIRECT_URL = '/'`, `LOGOUT_REDIRECT_URL = '/accounts/login/'`.
  - Protect app-level views/API with `@login_required` or `IsAuthenticated` permission class so anonymous users can't hit the proxy or history/saved endpoints; redirect to login.
  - Create base template with navbar showing logged-in user and logout link.
- **Acceptance Criteria Addressed**: AC-2, NFR-1
- **Test Requirements**:
  - `rule` TR-3.1: Register flow: POST to `/accounts/register/` with valid user/pass → redirects to login or homepage; `User.objects.filter(username=...)` returns row.
  - `rule` TR-3.2: Logged-out GET `/` redirects (302) to login page.
  - `rule` TR-3.3: Two users A and B: A creates a SavedRequest row via shell; B's list endpoint filtered by `request.user` returns empty (no leak).
  - `rubric` TR-3.4: UX quality of auth pages; scale 1-5; anchors 1=ugly/broken forms, 3=functional but no bootstrap, 5=clean Bootstrap forms with error messages, responsive, link between login/register; threshold >= 4; evidence: screenshots of login/register pages.

## Task 4: Main UI skeleton (sidebar + request builder + response area) with Bootstrap
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - Django template `core/templates/core/index.html` (or proxy/index.html) with the layout:
    - Left sidebar: "New Request" button, collapsible sections "Collections", "Saved Requests", "History" (populated from JS after we add API endpoints later).
    - Top bar: method `<select>`, URL `<input>`, "Send" `<button>`.
    - Tab panel: "Params", "Headers", "Body", "Auth" tabs (Bootstrap nav-tabs).
      - Params tab: empty state + "Add Row" button, each row has checkbox (enable), key, value, remove icon.
      - Headers tab: same row template as params; preset row suggestion `Content-Type: application/json`.
      - Body tab: textarea/`<pre>` styled editor for JSON, hidden for GET/DELETE (or disabled and note). "Validate JSON" button.
      - Auth tab: type selector (None/Bearer/API Key/Basic Auth) with conditional inputs: Bearer token text; API Key key + value + add-to (header/query); Basic username + password.
    - Response area below: status pill (colored green/red/yellow), response time chip, tabs "Body" and "Headers". Body has JSON pretty area; Headers key-value table.
  - Use Bootstrap CDN (CSS + JS bundle) and a small `static/app.css` + `static/app.js` served via Django `{% static %}`.
  - Responsive: sidebar collapses on narrow screens via Bootstrap offcanvas or similar.
- **Acceptance Criteria Addressed**: AC-1, AC-12, FR-4, FR-16
- **Test Requirements**:
  - `rule` TR-4.1: GET `/` returns 200 and rendered HTML contains IDs: method selector, url input, send button, tabs, response area status element.
  - `rule` TR-4.2: Tabs switch content via Bootstrap without JS errors (browser console clean).
  - `rubric` TR-4.3: Layout and responsiveness; scale 1-5; anchors as in AC-12; threshold >= 4; evidence: DOM snapshot and screenshots at desktop/mobile widths.

## Task 5: Proxy backend endpoint and GET request flow (frontend→Django→external→frontend)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4
- **Description**:
  - In `proxy/services.py`: implement `execute_request(method, url, params, headers, body, auth, timeout)` using `requests.request()`; capture response time; return dict with `status_code`, `response_time_ms`, `headers` (dict), `body_text`, `content_type`. Wrap all exceptions and convert to structured error dict (no reraise).
  - In `proxy/serializers.py`: `ProxyExecuteRequestSerializer` with fields: method, url, params (list of dicts or dict), headers (list/dict), body (str, optional), auth_type, auth_config (dict). Validate: method in allowed list; url is http/https; body is valid JSON when present (use `json.loads` fallback to raw string if JSON fails but accept raw strings for body too; return structured error if user claims JSON but invalid).
  - In `proxy/views.py`: DRF APIView `ProxyExecuteView` (POST, `IsAuthenticated`). Calls serializer.validated_data → calls service → returns Response with the result envelope. Always returns HTTP 200 envelope `{ok: true/false, ...}` unless client validation fails (HTTP 400).
  - Frontend `app.js`: on Send click, collect method/url/params/headers/body/auth; POST to `/api/proxy/execute/` (with CSRF token from cookie); on response, populate status, time, headers tab, pretty JSON body tab (use `JSON.stringify(parsed, null, 2)`).
- **Acceptance Criteria Addressed**: AC-1, AC-3, FR-5, FR-9, NFR-3, NFR-4
- **Test Requirements**:
  - `rule` TR-5.1: curl `POST /api/proxy/execute/` JSON body `{method:"GET",url:"https://httpbin.org/get"}` → returns envelope with `status_code=200`, `response_time_ms>0`, and body containing httpbin echoed origin.
  - `rule` TR-5.2: Invalid method `TRACE` rejected by serializer with HTTP 400.
  - `rule` TR-5.3: `requests.Session` timeout respected: mock or test timeout scenario returns structured `ok:false` with `error_type:"timeout"`.
  - `rubric` TR-5.4: Proxy service modularity; scale 1-5; anchors 1=logic in view, 3=some helper functions, 5=clean `services.py` layer with pure function, DRF serializer validation separate, view thin; threshold >= 4; evidence: code review of proxy files.

## Task 6: Query params builder integration (enable/disable, URL construction, round-trip)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 5
- **Description**:
  - Frontend: render params rows into a JS array; disabled rows excluded. "Final URL" preview input updates live. Encode keys/values properly.
  - Backend: in `proxy/services.py`, accept params as dict (after enable filtering); use `requests`'s `params=` argument (it handles URL encoding and merges with existing query string).
  - Test round-trip with httpbin `/anything` that echoes args.
- **Acceptance Criteria Addressed**: AC-5, FR-8
- **Test Requirements**:
  - `rule` TR-6.1: UI builds final URL correctly for `foo=bar` + disabled `skip=1`: preview equals base with `?foo=bar` (ordering may vary).
  - `rule` TR-6.2: Proxy request against httpbin echoes only enabled params in `args`.
  - `rubric` TR-6.3: UX of params editor; scale 1-5; anchors 1=add/remove broken, 3=works but no enable checkbox, 5=enable checkbox, add/remove buttons, URL preview auto-updates, handle empty/duplicate keys gracefully; threshold >= 4; evidence: UI walkthrough screenshot.

## Task 7: Headers editor integration + POST JSON body with server/client JSON validation
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 6
- **Description**:
  - Frontend headers rows: same as params; default Content-Type row; when user sends JSON body, ensure `Content-Type: application/json` is auto-added (toggleable).
  - Body tab: when method is POST/PUT/PATCH and user sets JSON mode, run `try { JSON.parse }` on Send; show inline error if invalid.
  - Backend serializer: if `body` is provided and `Content-Type` header includes `application/json`, validate that `body` is JSON parseable; else 400.
  - Round-trip test with httpbin: custom `X-Custom: foo` header echoed, JSON body echoed in `json`.
- **Acceptance Criteria Addressed**: AC-4, AC-6, FR-6, FR-7
- **Test Requirements**:
  - `rule` TR-7.1: Client-side invalid JSON → no proxy request made, error shown.
  - `rule` TR-7.2: Server-side bypass (curl with invalid JSON + Content-Type JSON header) → HTTP 400 structured error.
  - `rule` TR-7.3: Valid JSON POST + X-Custom header → httpbin echoes both in response.

## Task 8: PUT/PATCH/DELETE support and response viewer polish
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 7
- **Description**:
  - Enable PUT/PATCH/DELETE in method select.
  - For PUT/PATCH: show Body tab; for DELETE: hide body or allow optional.
  - Response viewer polish: status code colored (2xx green, 3xx blue, 4xx orange, 5xx red); response headers rendered as `<table>`; pretty-JSON renderer; if response isn't JSON, show raw text with note "Not valid JSON, showing raw body".
  - Test each method against httpbin `/put`, `/patch`, `/delete`.
- **Acceptance Criteria Addressed**: AC-7, FR-9, FR-10
- **Test Requirements**:
  - `rule` TR-8.1: PUT, PATCH, DELETE each echoed method matches.
  - `rule` TR-8.2: 404 status shows orange pill; 500 shows red pill (use httpbin `/status/404`, `/status/500`).
  - `rubric` TR-8.3: Response view readability; scale 1-5; anchors 1=unreadable raw dump, 3=raw JSON no syntax highlight, 5=colored status, readable tabs, pretty JSON with indent, headers table readable, raw fallback handled; threshold >= 4; evidence: screenshots of 200/404/500 responses.

## Task 9: Request history API and UI integration
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 8
- **Description**:
  - After a successful proxy execution (or even failed ones — store attempted), create a `RequestHistory` row in the proxy view: `RequestHistory.objects.create(user=request.user, ...)`.
  - Add history endpoints in `core/api.py` or `proxy` app:
    - `GET /api/history/` → paginated list of last N rows (e.g. 50) for current user, ordered `-executed_at`. Serializer returns id, method, url, status_code, response_time_ms, executed_at plus full request details for reload.
    - `GET /api/history/{id}/` → single detail to populate editor.
    - `DELETE /api/history/` → clear all history for current user.
  - Frontend: on page load, populate "History" sidebar list with method pill, url, status, time, ago; on click → fetch detail and fill method/url/params/headers/body/auth in editor; "Clear History" button + confirm.
- **Acceptance Criteria Addressed**: AC-8, FR-11
- **Test Requirements**:
  - `rule` TR-9.1: Execute 3 proxy calls; GET `/api/history/` returns 3 entries, correctly ordered.
  - `rule` TR-9.2: Click history item → editor form values match saved values (verify via DOM).
  - `rule` TR-9.3: After DELETE `/api/history/`, GET list returns empty array.

## Task 10: Saved Requests + Collections CRUD API and UI
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 9
- **Description**:
  - Collections endpoints:
    - `GET /api/collections/` list for user; `POST /api/collections/` create; `PUT /api/collections/{id}/` rename; `DELETE /api/collections/{id}/` delete (cascade saved requests to collection=null or delete, pick safe default).
  - Saved requests endpoints:
    - `GET /api/saved-requests/` list; `POST /api/saved-requests/` save current editor state with name and (optional) collection_id; `GET /api/saved-requests/{id}/` detail; `PUT /api/saved-requests/{id}/` edit; `DELETE /api/saved-requests/{id}/` delete.
  - UI:
    - "Save" button in request builder opens modal: name input + collection dropdown select + "Save" submit.
    - Sidebar "Collections" section: expandable tree showing collection → saved requests inside; "Saved Requests" flat list of all.
    - Click a saved request → populate editor.
    - Edit/Delete icons per item.
- **Acceptance Criteria Addressed**: AC-9, FR-12, FR-13
- **Test Requirements**:
  - `rule` TR-10.1: Full CRUD lifecycle on Collection and SavedRequest via API (POST→GET→PUT→DELETE) returns 200/201/204 as appropriate.
  - `rule` TR-10.2: Saved request reload populates editor correctly (method, URL, params, headers, body, auth_type, auth_config).
  - `rule` TR-10.3: User B cannot read/write user A's collections/requests via API direct id calls (404 or filtered out).

## Task 11: Per-request authentication options (None/Bearer/API Key/Basic) proxy injection
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 10
- **Description**:
  - Define `auth_type` enum values: `none`, `bearer`, `api_key`, `basic`.
  - `auth_config` schema:
    - bearer: `{token}`
    - api_key: `{key, value, in: "header"|"query"}`
    - basic: `{username, password}`
  - In `proxy/services.py`, before calling `requests.request()`, mutate params/headers accordingly:
    - bearer → headers `Authorization: Bearer <token>`.
    - api_key header → headers[`key`] = `value`; query → params[`key`] = `value`.
    - basic → use `requests.auth.HTTPBasicAuth(username, password)`.
  - If user also manually defines same header in Headers tab, decide precedence (auth injection wins or append duplicate; doc that auth injection is applied last, overwriting manual header with same name).
  - Frontend auth tab: conditional form per type; save values into the send payload under `auth_type` + `auth_config`.
- **Acceptance Criteria Addressed**: AC-10, FR-14
- **Test Requirements**:
  - `rule` TR-11.1: Bearer auth → echoed `Authorization` header equals `Bearer <token>`.
  - `rule` TR-11.2: API Key `in=header` key `X-Api-Key` → echoed header matches; `in=query` → echoed args has key/value.
  - `rule` TR-11.3: Basic auth with user `u` pass `p` → echoed header equals `Basic <base64(u:p)>`.

## Task 12: Error handling improvements + timeout + UI error display
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 11
- **Description**:
  - Structured error types in `proxy/services.py`:
    - `invalid_url`: URL parse error or scheme not http/https.
    - `invalid_json_body`: declared JSON but unparseable.
    - `connection_error`: DNS fail / connection refused.
    - `timeout`: exceeded timeout seconds.
    - `too_many_redirects`: 31x max redirects.
    - `ssl_error`: TLS verification.
    - `http_error`: response 4xx/5xx (still return body, but ok=true with status_code, not error; separate concern).
  - Proxy view maps exceptions to `{ok:false, error_type, message}`.
  - Frontend: render error card with type + message + suggestion; never dump raw traceback.
  - Ensure Django `DEBUG=False` produces no debug HTML; test 401 & 500 scenarios via httpbin `/status/401`, `/status/500`.
- **Acceptance Criteria Addressed**: AC-11, FR-15, NFR-1, NFR-3
- **Test Requirements**:
  - `rule` TR-12.1: Each of 5 failure modes (invalid URL, connection error, timeout, 401, 500) returns structured JSON envelope (error_type/message) or ok=true with status_code for 4xx/5xx HTTP.
  - `rule` TR-12.2: `settings.DEBUG=False` mode returns no debug HTML on proxy errors (content-type JSON; no `'django/views/debug.py'` strings in body).
  - `rule` TR-12.3: UI renders friendly error box instead of empty body when ok=false.

## Task 13: UI refinements, admin polish, final smoke tests
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 12
- **Description**:
  - Final responsive pass on common widths.
  - Empty states in sidebar (no saved/history yet).
  - Loading spinner during Send.
  - Admin: `list_display` for history/saved/collection with `user`, `method`, `url`, `created_at`; filter by user.
  - README-like inline docs: write an `INSTALLATION.md`? Not required by spec, but a short README template acceptable only if user asked; skip README to respect anti-doc rule. We'll add setup instructions in a PR description/comments only.
  - Full smoke run: register → send GET → send POST JSON → save to collection → reload from history → reload from saved → clear history → logout → login → verify history empty (after clear) and saved still present → errors test cases.
- **Acceptance Criteria Addressed**: AC-12, AC-13
- **Test Requirements**:
  - `rule` TR-13.1: End-to-end smoke checklist passes (document output log).
  - `rubric` TR-13.2: Codebase architecture (ORM usage, modularity, beginner-friendliness); scale 1-5; anchors from AC-13; threshold >= 4; evidence: full codebase review.
  - `rubric` TR-13.3: UI polish and edge cases; scale 1-5; anchors 1=broken edge states, 3=happy path works, 5=empty states, loading, confirm dialogs, and mobile responsive all handled; threshold >= 4; evidence: screenshots + smoke log.
