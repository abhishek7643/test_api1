# API Testing Tool - Product Requirements Document

## Overview
- **Summary**: A web-based API testing application similar to a basic Postman clone. Users can construct HTTP requests (GET, POST, PUT, PATCH, DELETE) with query parameters, headers, authentication, and JSON bodies, send them through a Django backend proxy, and view formatted responses. The app includes user accounts, per-user request history, saved request collections, and authentication method management.
- **Purpose**: Provide developers with a simple, self-hosted alternative to commercial API testing tools, with local data ownership via PostgreSQL and no reliance on external cloud services for core functionality.
- **Target Users**: Software developers, QA engineers, and API integrators who need to test REST APIs during development and debugging.

## Goals
- Provide a clean, developer-focused UI for constructing and sending HTTP requests.
- Support all core REST methods (GET, POST, PUT, PATCH, DELETE) with query params, headers, JSON body, and common auth schemes.
- Persist per-user request history and saved/collected requests in PostgreSQL via Django ORM.
- Deliver pretty-printed JSON responses with status code, timing, and headers.
- Secure user data via Django authentication (register/login/logout, per-user isolation).
- Handle common errors (invalid URL, invalid JSON, network/timeout, auth, 4xx, 5xx) with clear messages.

## Non-Goals
- Automated API test scripts, CI/CD integration, scheduled runs, or assertions engine.
- GraphQL, WebSocket, gRPC, or SOAP protocol support.
- Team collaboration, sharing, comments, role-based access beyond single-user accounts.
- Environment variables, file uploads, form-data body types in v1.
- OAuth2 flows, SSO, or third-party identity providers beyond local Django auth.

## Background & Context
- The project is a greenfield build in an empty workspace at `c:\Users\HP\Desktop\sih25`.
- Technology is mandated: Django + DRF backend, PostgreSQL, HTML/CSS/JS + Bootstrap frontend.
- Database credentials and Django secret key must come from environment variables via `.env` (never hard-coded).
- Frontend communicates with the Django backend; actual external API calls are made from the Django server (acting as a proxy) to avoid CORS issues and measure accurate server-side response time.

## Functional Requirements

- **FR-1 Django Project Setup**: Django project initialized with a main app and DRF installed; `manage.py runserver` serves the site; `.env` + `.gitignore` in place.
- **FR-2 PostgreSQL Connection**: Django configured via `dj-database-url` or env vars (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`) to connect to PostgreSQL; migrations run cleanly.
- **FR-3 User Authentication**: Django auth views/endpoints for register, login, logout; authenticated users get a session; unauthenticated users cannot access history/saved requests; login page present.
- **FR-4 Basic Request UI**: Main page shows method dropdown (GET/POST/PUT/PATCH/DELETE), URL input, Send button, and tabbed panels for Params/Headers/Body/Auth.
- **FR-5 GET Request**: Send GET request to an arbitrary URL through the Django proxy; response displayed in the Response Area.
- **FR-6 POST Request with JSON Body**: Body tab provides a JSON textarea for POST/PUT/PATCH; Django validates JSON client-side and server-side before sending.
- **FR-7 Headers**: Users add/remove arbitrary key-value headers rows (with enable/disable checkbox); headers are forwarded by the proxy.
- **FR-8 Query Parameters**: Users add/remove key-value query param rows (with enable/disable checkbox); the final URL is auto-constructed with query string (URL-encoded).
- **FR-9 Response Viewer**: Displays HTTP status code (colored), response time in ms, response headers (tab), pretty-formatted JSON body (tab).
- **FR-10 PUT/PATCH/DELETE**: Methods PUT, PATCH, DELETE fully supported (body applicable as appropriate).
- **FR-11 Request History**: Every executed request is saved to `RequestHistory` (method, url, headers, body, status code, timestamp) for the logged-in user; history sidebar shows recent items; clicking reloads the request into the editor; Clear History button exists.
- **FR-12 Saved Requests**: User can save current request with a name; saved requests listed per user in sidebar; edit/delete operations; reloads into editor.
- **FR-13 Collections**: User creates Collections; each SavedRequest belongs to one Collection (optional or default); sidebar shows collections tree; CRUD on collections.
- **FR-14 Authentication Options**: Per-request auth selector with None / Bearer Token / API Key (header or query) / Basic Auth; auth values are injected into the outgoing request by the proxy.
- **FR-15 Error Handling**: Handle invalid URL, invalid JSON body, network errors, timeouts, HTTP auth errors (401/403), 4xx, 5xx; display structured error info in the Response Area; log on server, do not leak stack traces to client.
- **FR-16 UI Layout & Responsiveness**: Left sidebar (New Request / Collections / Saved / History) + Main request builder + Response area; Bootstrap responsive; no unnecessary animations.

## Non-Functional Requirements

- **NFR-1 Security**: No hard-coded secrets; CSRF protection on Django; session-based auth; password hashing via Django defaults; per-user DB isolation enforced at query level (filter by `request.user`).
- **NFR-2 Code Quality**: Django ORM (no raw SQL for core models); modular code (separate serializers, views, services for proxy logic); beginner-friendly structure; models, views, serializers, templates in standard locations.
- **NFR-3 Reliability**: Proxy requests use a configurable timeout (default 30s); retries not performed; all exceptions caught and returned as structured JSON errors.
- **NFR-4 Maintainability**: Django migrations checked in; requirements.txt; clear separation: `core` app for models/auth, `api_proxy` app for request execution endpoints, `frontend` or templates served by Django.

## Constraints
- **Technical**: Python + Django + DRF + PostgreSQL; Bootstrap (CDN acceptable) + vanilla JS on frontend; no frontend build tools required (pure HTML/CSS/JS in Django templates).
- **Business**: Single-tenant local deployment; no team/sharing features in v1.
- **Dependencies**: `Django`, `djangorestframework`, `psycopg2-binary`, `python-dotenv`, `dj-database-url`, `requests` (for proxy), `django-cors-headers` (if needed; templates rendered by Django so likely not needed).

## Assumptions
- PostgreSQL server is available locally or via env vars; user will provide credentials.
- Django will serve both templates and the DRF API under the same origin (avoids CORS).
- External API calls are made server-side using the `requests` library; client never makes direct cross-origin calls to third-party APIs.
- Bearer token = `Authorization: Bearer <token>` header. API Key supports either a custom header or query param. Basic Auth = RFC 7617 `Authorization: Basic <base64(user:pass)>`.

## Acceptance Criteria

### AC-1: Django project boots and serves the main page
- **Type**: `rule`
- **Given**: Python environment with dependencies installed; `.env` configured; PostgreSQL reachable; migrations applied
- **When**: Developer runs `python manage.py runserver` and navigates to `/`
- **Then**: The API testing tool UI loads (layout with sidebar, method dropdown, URL input, Send button, response area)
- **Pass Condition**: HTTP 200 on `/`, HTML contains `#methodSelect`, `#urlInput`, `#sendBtn`, `#responseArea` selectors (or equivalent)
- **Evidence**: `curl -I http://127.0.0.1:8000/` returns 200; screenshot or saved HTML output shows elements

### AC-2: User registration, login, and logout work with per-user isolation
- **Type**: `rule`
- **Given**: Django auth tables migrated
- **When**: User registers account A, saves a request; logs out, registers account B
- **Then**: Account B cannot see or access A's saved requests or history (API endpoints return 404/empty)
- **Pass Condition**: E2E: register two users; create saved_request as user1; GET saved_requests list as user2 → empty; logout/login flows return appropriate redirects or 200
- **Evidence**: HTTP request logs showing 200 on login, 200 on saved list for user1, 0-length list for user2; 302/200 on logout

### AC-3: GET request executes through proxy and shows status + JSON body
- **Type**: `rule`
- **Given**: Public test endpoint (e.g., `https://httpbin.org/get`) reachable from Django server
- **When**: User selects GET, enters URL, clicks Send
- **Then**: Response area shows HTTP status (200), response time (number, ms), and pretty-printed JSON body containing the echoed args/headers
- **Pass Condition**: Django proxy endpoint (e.g., `POST /api/proxy/execute/`) returns 200 with `{status, response_time_ms, headers, body}`; frontend renders status 200, time > 0, formatted JSON body
- **Evidence**: Saved JSON response from proxy endpoint showing httpbin payload; UI rendering (snapshot or DOM assertion) showing `200 OK`, numeric time, formatted JSON

### AC-4: POST with JSON body + custom headers round-trips correctly
- **Type**: `rule`
- **Given**: `https://httpbin.org/post` available
- **When**: User selects POST; Body tab has valid JSON `{"hello":"world"}`; Headers tab adds `X-Custom: foo`; clicks Send
- **Then**: Response JSON (as echoed by httpbin) contains `json.hello === "world"` and `headers.X-Custom === "foo"`
- **Pass Condition**: Proxy response body includes echoed json and header matching inputs
- **Evidence**: Proxy response JSON with echoed values; frontend DOM shows same

### AC-5: Query params builder constructs URL correctly
- **Type**: `rule`
- **Given**: Base URL `https://httpbin.org/get`
- **When**: User adds enabled params `foo=bar` and `baz=qux` (and one disabled `skip=1`)
- **Then**: Final URL sent by proxy becomes `https://httpbin.org/get?foo=bar&baz=qux` (disabled excluded); httpbin echoes `args.foo` and `args.baz` correctly
- **Pass Condition**: Echoed `args` contain foo and baz, not skip
- **Evidence**: Proxy request/response showing correct args; frontend shows computed URL preview

### AC-6: JSON validation prevents sending invalid body
- **Type**: `rule`
- **Given**: POST selected, Body tab contains `{invalid json`
- **When**: User clicks Send
- **Then**: Request is NOT sent; user sees inline "Invalid JSON" error; proxy endpoint receives no call (or server also rejects with 400 and structured error)
- **Pass Condition**: Frontend shows validation error before any network call (visible in UI); server proxy also rejects invalid JSON with HTTP 400 `{error: "Invalid JSON body"}`
- **Evidence**: Browser console/network tab showing no proxy call on invalid input; curl to proxy with invalid body returns 400 structured error

### AC-7: PUT, PATCH, DELETE methods work
- **Type**: `rule`
- **Given**: `https://httpbin.org/put`, `/patch`, `/delete` available
- **When**: Send each method with appropriate headers/body
- **Then**: Each returns 200 with the echoed method name in response data
- **Pass Condition**: Echoed response from httpbin confirms correct method for each of PUT/PATCH/DELETE
- **Evidence**: Three separate proxy calls showing echoed method matches

### AC-8: Request history records and reloads previous requests
- **Type**: `rule`
- **Given**: Logged-in user
- **When**: User sends 3 different requests; then clicks the 2nd history entry; then clicks Clear History
- **Then**: History sidebar lists 3 items with method, URL, status, timestamp; clicking 2nd populates the editor with its method/url/headers/body; after Clear History the list becomes empty
- **Pass Condition**: `GET /api/history/` returns 3 entries with correct fields; `DELETE /api/history/` empties; reload endpoint populates editor
- **Evidence**: DB query showing 3 RequestHistory rows for user; API list response; after clear, 0 rows

### AC-9: Saved Requests with Collections CRUD work per user
- **Type**: `rule`
- **Given**: Logged-in user; no saved requests yet
- **When**: Create collection "C1"; save request "R1" into "C1"; edit "R1" name; delete "R1"; delete "C1"
- **Then**: Each operation succeeds; collection list reflects changes; another user cannot see "C1"
- **Pass Condition**: CRUD endpoints return 200/204; other user's list empty
- **Evidence**: API responses for each CRUD step; DB rows filtered by user_id

### AC-10: Auth options (Bearer, API Key, Basic) inject correctly
- **Type**: `rule`
- **Given**: httpbin endpoints `/headers` and `/anything`
- **When**: For each auth type (Bearer, API Key as header `X-Api-Key=mykey`, Basic user:pass), send request
- **Then**: Echoed headers contain `Authorization: Bearer ...` / `X-Api-Key: mykey` / `Authorization: Basic <b64>` respectively
- **Pass Condition**: Echoed headers match expected for each auth type
- **Evidence**: Proxy response bodies containing the correct echoed headers

### AC-11: Errors handled with structured messages (no 500 leaks)
- **Type**: `rule`
- **Given**: Various failure scenarios
- **When**: (a) invalid URL like `not-a-url`, (b) unreachable host, (c) 5s timeout against slow endpoint, (d) 401 endpoint, (e) 500 endpoint
- **Then**: In each case, Django proxy returns HTTP 200 envelope with `{ok:false, error_type, message}` (or HTTP 400 for client errors, envelope still structured); frontend shows a friendly error card; Django logs contain traceback but client never sees HTML error page / debug stack trace
- **Pass Condition**: All 5 scenarios return structured JSON (never raw Django debug HTML); UI renders readable error
- **Evidence**: Saved JSON error responses for each scenario; Django DEBUG page never leaked (test with DEBUG=False config)

### AC-12: UI layout fidelity (sidebar + main + response, responsive)
- **Type**: `rubric`
- **Dimension**: Developer UI structure and responsive behavior
- **Scale**: 1-5
- **Anchors**: 1 = missing sections / broken layout; 3 = all sections present on desktop but break on narrow screens; 5 = sidebar/request builder/response all present, clear tab switching (Params/Headers/Body/Auth), Bootstrap responsive works at mobile widths, no visual jank
- **Pass Threshold**: >= 4
- **Evidence**: Screenshots at 1440px and 420px widths; manual walkthrough of tabs

### AC-13: Code modularity and ORM usage
- **Type**: `rubric`
- **Dimension**: Architecture quality (ORM, modularity, beginner-friendliness)
- **Scale**: 1-5
- **Anchors**: 1 = raw SQL, single 1k-line views.py; 3 = ORM used but some raw SQL, folders organized but mixed concerns; 5 = zero raw SQL (except migrations), models in models.py, proxy logic in service module, serializers/separate viewsets per resource, readable comments/structure for a beginner
- **Pass Threshold**: >= 4
- **Evidence**: Code review of `models.py`, `views.py`, `services.py`, absence of `cursor.execute` / `raw()` outside migrations

## Open Questions
- [ ] Will PostgreSQL be installed locally and available on default port, or should we include a Docker Compose option? (Assumption: user manages PostgreSQL; we provide env vars template.)
- [ ] Preferred Django admin exposure? (Assumption: yes, enable admin for models so users can inspect rows.)
- [ ] Save request body size cap? (Assumption: 1MB max via Django limits.)
