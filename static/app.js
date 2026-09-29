(function () {
    'use strict';

    const editor = {
        method: 'GET',
        url: '',
        params: [],
        headers: [],
        body: '',
        auth_type: 'none',
        auth_config: {}
    };

    const response = {
        ok: false,
        status_code: null,
        time: null,
        headers: {},
        body: '',
        error: null
    };

    const sidebarData = {
        collections: [],
        saved: [],
        history: []
    };

    let currentlyExpandedCollection = null;

    function getCsrfToken() {
        const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    }

    function cleanUrl(raw) {
        if (raw == null) return '';
        let v = String(raw);
        v = v.replace(/[\x00-\x1f\x7f]/g, '').trim();
        v = v.replace(/^["']|["']$/g, '').trim();
        v = v.replace(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+/i, '').trim();
        return v;
    }

    function buildQueryFromRows(rows) {
        const obj = {};
        rows.forEach(function (row) {
            if (row.enabled && row.key) {
                obj[row.key] = row.value || '';
            }
        });
        return obj;
    }

    function buildPreviewUrl(url, rows) {
        if (!url) return '';
        try {
            const u = new URL(url);
            const params = buildQueryFromRows(rows);
            Object.keys(params).forEach(function (k) {
                u.searchParams.set(k, params[k]);
            });
            return u.toString();
        } catch (e) {
            return url;
        }
    }

    function prettyFormatBody(text) {
        if (!text || !text.trim()) return '';
        try {
            const obj = JSON.parse(text);
            return JSON.stringify(obj, null, 2);
        } catch (e) {
            return text;
        }
    }

    function statusClass(code) {
        if (!code) return 'status-pill s-none';
        if (code >= 200 && code < 300) return 'status-pill s-ok';
        if (code >= 300 && code < 400) return 'status-pill s-warn';
        if (code >= 400 && code < 500) return 'status-pill s-warn';
        if (code >= 500) return 'status-pill s-error';
        return 'status-pill s-none';
    }

    function methodClass(method) {
        return 'method-' + method;
    }

    function applyMethodSelectClass() {
        const sel = document.getElementById('methodSelect');
        if (!sel) return;
        sel.classList.remove('m-get', 'm-post', 'm-put', 'm-patch', 'm-delete');
        const v = (editor.method || 'GET').toLowerCase();
        if (v === 'get') sel.classList.add('m-get');
        else if (v === 'post') sel.classList.add('m-post');
        else if (v === 'put') sel.classList.add('m-put');
        else if (v === 'patch') sel.classList.add('m-patch');
        else if (v === 'delete') sel.classList.add('m-delete');
    }

    function ensureDefaultRows() {
        if (editor.params.length === 0) {
            editor.params.push({ enabled: true, key: '', value: '' });
        }
        if (editor.headers.length === 0) {
            editor.headers.push({ enabled: true, key: 'Content-Type', value: 'application/json' });
        }
    }

    function renderParamsRows() {
        const tbody = document.getElementById('paramsBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        editor.params.forEach(function (row, idx) {
            const tr = document.createElement('tr');
            tr.dataset.idx = idx;
            tr.innerHTML =
                '<td><input class="form-check-input param-enabled" type="checkbox" ' + (row.enabled ? 'checked' : '') + '></td>' +
                '<td><input type="text" class="form-control form-control-sm param-key" value="' + escapeHtml(row.key) + '" placeholder="Key"></td>' +
                '<td><input type="text" class="form-control form-control-sm param-value" value="' + escapeHtml(row.value) + '" placeholder="Value"></td>' +
                '<td><button type="button" class="btn btn-outline-danger btn-sm btn-sm-icon remove-param">&times;</button></td>';
            tbody.appendChild(tr);
        });
    }

    function renderHeadersRows() {
        const tbody = document.getElementById('headersBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        editor.headers.forEach(function (row, idx) {
            const tr = document.createElement('tr');
            tr.dataset.idx = idx;
            tr.innerHTML =
                '<td><input class="form-check-input header-enabled" type="checkbox" ' + (row.enabled ? 'checked' : '') + '></td>' +
                '<td><input type="text" class="form-control form-control-sm header-key" value="' + escapeHtml(row.key) + '" placeholder="Key"></td>' +
                '<td><input type="text" class="form-control form-control-sm header-value" value="' + escapeHtml(row.value) + '" placeholder="Value"></td>' +
                '<td><button type="button" class="btn btn-outline-danger btn-sm btn-sm-icon remove-header">&times;</button></td>';
            tbody.appendChild(tr);
        });
    }

    function escapeHtml(s) {
        const div = document.createElement('div');
        div.textContent = s == null ? '' : String(s);
        return div.innerHTML;
    }

    function renderPreviewUrl() {
        const input = document.getElementById('urlPreview');
        if (input) {
            input.value = buildPreviewUrl(editor.url, editor.params);
        }
    }

    function renderFormFromState() {
        const methodSel = document.getElementById('methodSelect');
        if (methodSel) methodSel.value = editor.method;
        applyMethodSelectClass();
        const urlInp = document.getElementById('urlInput');
        if (urlInp) urlInp.value = editor.url || '';
        const bodyTa = document.getElementById('bodyTextarea');
        if (bodyTa) bodyTa.value = editor.body || '';
        applyBodyDisabledState();
        document.querySelectorAll('input[name="authType"]').forEach(function (rb) {
            rb.checked = (rb.value === editor.auth_type);
        });
        renderAuthConfig();
        populateAuthConfigFromState();
        renderParamsRows();
        renderHeadersRows();
        renderPreviewUrl();
    }

    function applyBodyDisabledState() {
        const bodyTa = document.getElementById('bodyTextarea');
        const note = document.getElementById('bodyDisabledNote');
        if (!bodyTa) return;
        const disabled = (editor.method === 'GET' || editor.method === 'DELETE');
        bodyTa.disabled = disabled;
        if (note) note.style.display = disabled ? 'inline-block' : 'none';
    }

    function renderAuthConfig() {
        ['None', 'Bearer', 'ApiKey', 'Basic'].forEach(function (t) {
            const el = document.getElementById('authConfig' + t);
            if (el) el.style.display = 'none';
        });
        const map = { none: 'None', bearer: 'Bearer', api_key: 'ApiKey', basic: 'Basic' };
        const target = document.getElementById('authConfig' + (map[editor.auth_type] || 'None'));
        if (target) target.style.display = 'block';
    }

    function populateAuthConfigFromState() {
        const cfg = editor.auth_config || {};
        const bearer = document.getElementById('bearerToken');
        if (bearer) bearer.value = cfg.token || '';
        const akn = document.getElementById('apiKeyName');
        if (akn) akn.value = cfg.key || '';
        const akv = document.getElementById('apiKeyValue');
        if (akv) akv.value = cfg.value || '';
        const akto = document.getElementById('apiKeyAddTo');
        if (akto) akto.value = cfg['in'] || 'header';
        const bu = document.getElementById('basicUsername');
        if (bu) bu.value = cfg.username || '';
        const bp = document.getElementById('basicPassword');
        if (bp) bp.value = cfg.password || '';
    }

    function readAuthConfigFromDom() {
        const cfg = {};
        if (editor.auth_type === 'bearer') {
            cfg.token = document.getElementById('bearerToken').value;
        } else if (editor.auth_type === 'api_key') {
            cfg.key = document.getElementById('apiKeyName').value;
            cfg.value = document.getElementById('apiKeyValue').value;
            cfg['in'] = document.getElementById('apiKeyAddTo').value;
        } else if (editor.auth_type === 'basic') {
            cfg.username = document.getElementById('basicUsername').value;
            cfg.password = document.getElementById('basicPassword').value;
        }
        editor.auth_config = cfg;
    }

    function renderResponse() {
        const statusEl = document.getElementById('statusPill');
        const timeEl = document.getElementById('timeChip');
        const bodyEl = document.getElementById('responseBody');
        const errEl = document.getElementById('responseError');
        const headersBody = document.getElementById('responseHeadersBody');

        if (statusEl) {
            if (response.status_code) {
                statusEl.textContent = response.status_code + ' ' + (response.ok ? 'OK' : 'Error');
                statusEl.className = statusClass(response.status_code);
            } else {
                statusEl.textContent = 'No Response';
                statusEl.className = 'status-pill s-none';
            }
        }

        if (timeEl) {
            if (response.time != null) {
                timeEl.style.display = 'inline-flex';
                const timeVal = document.getElementById('timeChipValue');
                if (timeVal) timeVal.textContent = response.time;
            } else {
                timeEl.style.display = 'none';
            }
        }

        if (errEl) {
            if (response.error && !response.ok) {
                errEl.style.display = 'block';
                let html = '';
                if (response.error.error_type) html += '<strong>' + escapeHtml(response.error.error_type) + ':</strong> ';
                html += escapeHtml(response.error.message || 'Unknown error');
                if (response.error.suggestion) {
                    html += '<div class="small mt-1 text-muted">Suggestion: ' + escapeHtml(response.error.suggestion) + '</div>';
                }
                errEl.innerHTML = html;
            } else {
                errEl.style.display = 'none';
                errEl.innerHTML = '';
            }
        }

        if (bodyEl) {
            if (response.error && !response.ok) {
                bodyEl.innerHTML = '<span class="text-muted">No response body.</span>';
            } else if (response.body) {
                const pretty = prettyFormatBody(response.body);
                bodyEl.textContent = pretty;
            } else {
                bodyEl.innerHTML = '<span class="text-muted">No response body.</span>';
            }
        }

        if (headersBody) {
            headersBody.innerHTML = '';
            const keys = response.headers ? Object.keys(response.headers) : [];
            if (keys.length === 0) {
                headersBody.innerHTML = '<tr><td colspan="2" class="text-muted text-center">No headers.</td></tr>';
            } else {
                keys.forEach(function (k) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = '<td class="fw-semibold">' + escapeHtml(k) + '</td><td class="monospace-font">' + escapeHtml(response.headers[k]) + '</td>';
                    headersBody.appendChild(tr);
                });
            }
        }
    }

    function renderSidebar() {
        renderCollections();
        renderSaved();
        renderHistory();
        renderMobileSidebar();
        updateCollectionOptions();
    }

    function renderCollections() {
        const list = document.getElementById('collectionsList');
        if (!list) return;
        document.getElementById('collectionsCount').textContent = sidebarData.collections.length;
        list.innerHTML = '';
        sidebarData.collections.forEach(function (c) {
            const wrap = document.createElement('div');
            wrap.className = 'collection-row';
            const isExpanded = (currentlyExpandedCollection === c.id);
            wrap.innerHTML =
                '<div class="collection-head ' + (isExpanded ? '' : 'collapsed') + '" data-collection-id="' + c.id + '">' +
                    '<span class="ch-left">' +
                        '<span class="chev">▼</span>' +
                        '<span class="ch-name">' + escapeHtml(c.name) + ' <span class="count-chip" style="min-width:18px;height:18px;padding:0 0.4rem;font-size:0.65rem;">' + (c.requests ? c.requests.length : 0) + '</span></span>' +
                    '</span>' +
                    '<span class="ch-actions">' +
                        '<button class="mini-btn edit-collection" data-id="' + c.id + '" title="Edit">✎</button>' +
                        '<button class="mini-btn danger delete-collection" data-id="' + c.id + '" title="Delete">×</button>' +
                    '</span>' +
                '</div>' +
                '<div class="collection-items" style="display:' + (isExpanded ? 'block' : 'none') + '"></div>';
            list.appendChild(wrap);

            if (isExpanded && c.requests && c.requests.length) {
                const itemsWrap = wrap.querySelector('.collection-items');
                c.requests.forEach(function (r) {
                    itemsWrap.appendChild(buildSavedItem(r));
                });
            }
        });
    }

    function renderSaved() {
        const list = document.getElementById('savedList');
        if (!list) return;
        document.getElementById('savedCount').textContent = sidebarData.saved.length;
        list.innerHTML = '';
        sidebarData.saved.forEach(function (r) {
            list.appendChild(buildSavedItem(r));
        });
    }

    function buildSavedItem(r) {
        const div = document.createElement('div');
        div.className = 'sidebar-item';
        div.title = r.url ? r.url : '';
        div.dataset.type = 'saved';
        div.dataset.id = r.id;
        const urlFrag = r.url ? (r.url.length > 35 ? r.url.substring(0, 35) + '…' : r.url) : '';
        div.innerHTML =
            '<span class="method-tag ' + methodClass(r.method || 'GET') + '">' + (r.method || 'GET') + '</span>' +
            '<div class="si-meta">' +
                '<p class="si-title">' + escapeHtml(r.name || '(unnamed)') + '</p>' +
                '<p class="si-sub">' + escapeHtml(urlFrag) + '</p>' +
            '</div>' +
            '<div class="si-actions">' +
                '<button class="mini-btn edit-saved" data-id="' + r.id + '" title="Edit">✎</button>' +
                '<button class="mini-btn danger delete-saved" data-id="' + r.id + '" title="Delete">×</button>' +
            '</div>';
        return div;
    }

    function renderHistory() {
        const list = document.getElementById('historyList');
        if (!list) return;
        document.getElementById('historyCount').textContent = sidebarData.history.length;
        list.innerHTML = '';
        sidebarData.history.forEach(function (h) {
            const div = document.createElement('div');
            div.className = 'sidebar-item';
            const ts = h.executed_at || h.timestamp;
            div.title = ts ? new Date(ts).toLocaleString() : '';
            div.dataset.type = 'history';
            div.dataset.id = h.id;
            const urlFrag = h.url ? (h.url.length > 35 ? h.url.substring(0, 35) + '…' : h.url) : '';
            const timeText = ts ? new Date(ts).toLocaleTimeString() : '';
            div.innerHTML =
                '<span class="method-tag ' + methodClass(h.method || 'GET') + '">' + (h.method || 'GET') + '</span>' +
                '<div class="si-meta">' +
                    '<p class="si-title">' + escapeHtml(urlFrag || '(no url)') + '</p>' +
                    '<p class="si-sub">' + escapeHtml(timeText) + (h.status_code ? ' · ' + h.status_code : '') + '</p>' +
                '</div>';
            list.appendChild(div);
        });
    }

    function renderMobileSidebar() {
        const wrap = document.getElementById('mobileSidebarContent');
        if (!wrap) return;
        wrap.innerHTML = '';
        const cloneSource = document.querySelector('.sidebar-inner');
        if (cloneSource) {
            const clone = cloneSource.cloneNode(true);
            wrap.appendChild(clone);
        } else {
            const collEl = document.querySelector('.panel-group');
            if (collEl) wrap.appendChild(collEl.cloneNode(true));
        }
    }

    function updateCollectionOptions() {
        const sel = document.getElementById('saveCollectionSelect');
        if (!sel) return;
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">-- Select Collection --</option><option value="__new__">(new collection)</option>';
        sidebarData.collections.forEach(function (c) {
            const o = document.createElement('option');
            o.value = c.id;
            o.textContent = c.name;
            sel.appendChild(o);
        });
        if (currentVal) sel.value = currentVal;

        const editSel = document.getElementById('editSavedCollection');
        if (editSel) {
            const cur = editSel.value;
            editSel.innerHTML = '<option value="">-- None --</option>';
            sidebarData.collections.forEach(function (c) {
                const o = document.createElement('option');
                o.value = c.id;
                o.textContent = c.name;
                editSel.appendChild(o);
            });
            if (cur) editSel.value = cur;
        }
    }

    async function loadCollections() {
        try {
            const r = await fetch('/api/collections/', {
                headers: { 'X-CSRFToken': getCsrfToken() }
            });
            if (r.ok) {
                sidebarData.collections = await r.json() || [];
            }
        } catch (e) { /* noop */ }
    }

    async function loadSaved() {
        try {
            const r = await fetch('/api/saved-requests/', {
                headers: { 'X-CSRFToken': getCsrfToken() }
            });
            if (r.ok) {
                sidebarData.saved = await r.json() || [];
            }
        } catch (e) { /* noop */ }
    }

    async function loadHistory() {
        try {
            const r = await fetch('/api/history/', {
                headers: { 'X-CSRFToken': getCsrfToken() }
            });
            if (r.ok) {
                sidebarData.history = await r.json() || [];
            }
        } catch (e) { /* noop */ }
    }

    async function reloadSidebarAll() {
        await Promise.all([loadCollections(), loadSaved(), loadHistory()]);
        sidebarData.collections.forEach(function (c) {
            c.requests = sidebarData.saved.filter(function (r) {
                return r.collection === c.id || r.collection_id === c.id;
            });
        });
        renderSidebar();
    }

    function resetEditor() {
        editor.method = 'GET';
        editor.url = '';
        editor.params = [{ enabled: true, key: '', value: '' }];
        editor.headers = [{ enabled: true, key: 'Content-Type', value: 'application/json' }];
        editor.body = '';
        editor.auth_type = 'none';
        editor.auth_config = {};
        response.ok = false;
        response.status_code = null;
        response.time = null;
        response.headers = {};
        response.body = '';
        response.error = null;
        renderFormFromState();
        renderResponse();
    }

    function populateEditorFromPayload(payload) {
        if (!payload) return;
        editor.method = payload.method || 'GET';
        editor.url = cleanUrl(payload.url || '');
        const paramsSrc = payload.params_json || payload.params;
        if (Array.isArray(paramsSrc)) {
            editor.params = paramsSrc.slice();
        } else if (paramsSrc && typeof paramsSrc === 'object') {
            editor.params = Object.keys(paramsSrc).map(function (k) {
                return { enabled: true, key: k, value: paramsSrc[k] };
            });
        } else {
            editor.params = [];
        }
        const headersSrc = payload.headers_json || payload.headers;
        if (Array.isArray(headersSrc)) {
            editor.headers = headersSrc.slice();
        } else if (headersSrc && typeof headersSrc === 'object') {
            editor.headers = Object.keys(headersSrc).map(function (k) {
                return { enabled: true, key: k, value: headersSrc[k] };
            });
        } else {
            editor.headers = [];
        }
        editor.body = payload.body_json || payload.body || '';
        editor.auth_type = payload.auth_type || 'none';
        editor.auth_config = payload.auth_config_json || payload.auth_config || {};
        ensureDefaultRows();
    }

    async function loadSavedIntoForm(id) {
        try {
            const r = await fetch('/api/saved-requests/' + id + '/', {
                headers: { 'X-CSRFToken': getCsrfToken() }
            });
            if (r.ok) {
                const data = await r.json();
                populateEditorFromPayload(data);
                renderFormFromState();
            }
        } catch (e) { /* noop */ }
    }

    async function loadHistoryIntoForm(id) {
        try {
            const r = await fetch('/api/history/' + id + '/', {
                headers: { 'X-CSRFToken': getCsrfToken() }
            });
            if (r.ok) {
                const data = await r.json();
                populateEditorFromPayload(data);
                renderFormFromState();
            }
        } catch (e) { /* noop */ }
    }

    async function sendRequest() {
        const jsonValidateMsg = document.getElementById('jsonValidateMsg');
        if (jsonValidateMsg) jsonValidateMsg.textContent = '';
        readAuthConfigFromDom();

        // Validate URL
        if (!editor.url || !editor.url.trim()) {
            if (jsonValidateMsg) {
                jsonValidateMsg.innerHTML = '<span class="text-danger">Please enter a URL before sending.</span>';
            }
            const urlInp = document.getElementById('urlInput');
            if (urlInp) { urlInp.focus(); urlInp.classList.add('is-invalid'); }
            return;
        }
        const urlInp2 = document.getElementById('urlInput');
        if (urlInp2) urlInp2.classList.remove('is-invalid');

        const methodsWithBody = ['POST', 'PUT', 'PATCH'];
        if (methodsWithBody.indexOf(editor.method) !== -1 && editor.body && editor.body.trim()) {
            try {
                JSON.parse(editor.body);
            } catch (e) {
                if (jsonValidateMsg) {
                    jsonValidateMsg.innerHTML = '<span class="text-danger">Invalid JSON: ' + escapeHtml(e.message) + '</span>';
                }
                return;
            }
        }

        // Show loading state
        const sendBtn = document.getElementById('sendBtn');
        const origBtnText = sendBtn ? sendBtn.textContent : 'Send';
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Sending…';
        }

        const payload = {
            method: editor.method,
            url: cleanUrl(editor.url),
            params: buildQueryFromRows(editor.params),
            headers: buildQueryFromRows(editor.headers),
            body: methodsWithBody.indexOf(editor.method) !== -1 ? editor.body : '',
            auth_type: editor.auth_type,
            auth_config: editor.auth_config
        };

        try {
            const r = await fetch('/api/proxy/execute/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify(payload)
            });
            let data = {};
            try {
                data = await r.json();
            } catch (jsonErr) {
                data = {};
            }
            response.ok = !!data.ok && r.ok;
            response.status_code = (data.status_code != null) ? data.status_code : r.status;
            response.time = data.response_time_ms != null ? data.response_time_ms : null;
            response.headers = data.headers || {};
            response.body = data.body_text != null ? data.body_text : '';
            if (!r.ok || !data.ok) {
                response.ok = false;
                let errMsg = data.error_message || data.message || data.detail || '';
                if (r.status === 403) {
                    errMsg = errMsg || 'Authentication required. Please log in again.';
                } else if (r.status >= 500) {
                    errMsg = errMsg || 'Server error occurred.';
                } else if (data.errors && typeof data.errors === 'object') {
                    const parts = [];
                    for (const k in data.errors) {
                        const v = data.errors[k];
                        if (Array.isArray(v)) parts.push(k + ': ' + v.join(', '));
                        else if (typeof v === 'string') parts.push(k + ': ' + v);
                    }
                    if (parts.length && !errMsg) errMsg = parts.join('; ');
                }
                response.error = {
                    error_type: data.error_type || ('HTTP_' + r.status),
                    message: errMsg || ('Request failed (HTTP ' + r.status + ')')
                };
            } else {
                response.error = null;
            }
        } catch (e) {
            response.ok = false;
            response.status_code = null;
            response.time = null;
            response.headers = {};
            response.body = '';
            response.error = { error_type: 'NetworkError', message: e.message, suggestion: 'Check that the backend is running and CORS is properly configured.' };
        } finally {
            // Restore button state
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = origBtnText;
            }
        }
        renderResponse();
        await loadHistory();
        renderHistory();
        renderMobileSidebar();
    }

    async function clearHistory() {
        if (!confirm('Clear all history?')) return;
        try {
            await fetch('/api/history/', {
                method: 'DELETE',
                headers: { 'X-CSRFToken': getCsrfToken() }
            });
        } catch (e) { /* noop */ }
        sidebarData.history = [];
        renderHistory();
        renderMobileSidebar();
    }

    async function deleteSaved(id) {
        if (!confirm('Delete this saved request?')) return;
        try {
            await fetch('/api/saved-requests/' + id + '/', {
                method: 'DELETE',
                headers: { 'X-CSRFToken': getCsrfToken() }
            });
        } catch (e) { /* noop */ }
        await reloadSidebarAll();
    }

    async function deleteCollection(id) {
        if (!confirm('Delete this collection and its saved requests?')) return;
        try {
            await fetch('/api/collections/' + id + '/', {
                method: 'DELETE',
                headers: { 'X-CSRFToken': getCsrfToken() }
            });
        } catch (e) { /* noop */ }
        await reloadSidebarAll();
    }

    async function saveRequest() {
        const nameInp = document.getElementById('saveRequestName');
        const colSel = document.getElementById('saveCollectionSelect');
        const newColInp = document.getElementById('newCollectionName');
        if (!nameInp || !colSel) return;
        const name = nameInp.value.trim();
        if (!name) {
            alert('Please enter a request name');
            return;
        }
        let collectionId = colSel.value;
        readAuthConfigFromDom();

        if (collectionId === '__new__') {
            const newName = (newColInp.value || '').trim();
            if (!newName) {
                alert('Please enter a new collection name');
                return;
            }
            try {
                const r = await fetch('/api/collections/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify({ name: newName })
                });
                if (r.ok) {
                    const c = await r.json();
                    collectionId = c.id ? String(c.id) : '';
                } else {
                    alert('Failed to create collection. Please try again.');
                    return;
                }
            } catch (e) {
                alert('Network error while creating collection.');
                return;
            }
        }

        const parsedCollId = collectionId && collectionId !== '__new__' ? parseInt(collectionId, 10) : null;
        const payload = {
            name: name,
            collection: !isNaN(parsedCollId) ? parsedCollId : null,
            method: editor.method,
            url: cleanUrl(editor.url),
            params_json: buildQueryFromRows(editor.params),
            headers_json: buildQueryFromRows(editor.headers),
            body_json: editor.body,
            auth_type: editor.auth_type,
            auth_config_json: editor.auth_config
        };

        try {
            const r = await fetch('/api/saved-requests/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify(payload)
            });
            if (r.ok) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('saveModal'));
                if (modal) modal.hide();
                nameInp.value = '';
                colSel.value = '';
                if (newColInp) newColInp.value = '';
                document.getElementById('newCollectionGroup').style.display = 'none';
                await reloadSidebarAll();
            }
        } catch (e) { /* noop */ }
    }

    async function openEditSaved(id) {
        let saved = sidebarData.saved.find(function (x) { return x.id == id; });
        if (!saved) {
            for (const c of sidebarData.collections) {
                const s = (c.requests || []).find(function (x) { return x.id == id; });
                if (s) { saved = Object.assign({}, s); break; }
            }
        }
        if (!saved) return;
        document.getElementById('editSavedId').value = saved.id;
        document.getElementById('editSavedName').value = saved.name || '';
        updateCollectionOptions();
        document.getElementById('editSavedCollection').value = saved.collection || '';
        const modal = new bootstrap.Modal(document.getElementById('editSavedModal'));
        modal.show();
    }

    async function submitEditSaved() {
        const id = document.getElementById('editSavedId').value;
        const name = document.getElementById('editSavedName').value.trim();
        const collection = document.getElementById('editSavedCollection').value || null;
        if (!name) {
            alert('Please enter a name');
            return;
        }
        try {
            const r = await fetch('/api/saved-requests/' + id + '/', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify({ name: name, collection: collection ? parseInt(collection, 10) : null })
            });
            if (r.ok) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('editSavedModal'));
                if (modal) modal.hide();
                await reloadSidebarAll();
            } else {
                const err = await r.json().catch(() => ({}));
                alert('Update failed: ' + (err.detail || JSON.stringify(err)));
            }
        } catch (e) {
            alert('Network error while updating saved request.');
        }
    }

    async function openEditCollection(id) {
        const col = sidebarData.collections.find(function (c) { return c.id == id; });
        if (!col) return;
        document.getElementById('editCollectionId').value = col.id;
        document.getElementById('editCollectionName').value = col.name || '';
        const modal = new bootstrap.Modal(document.getElementById('editCollectionModal'));
        modal.show();
    }

    async function submitEditCollection() {
        const id = document.getElementById('editCollectionId').value;
        const name = document.getElementById('editCollectionName').value.trim();
        if (!name) {
            alert('Please enter a name');
            return;
        }
        try {
            const r = await fetch('/api/collections/' + id + '/', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify({ name: name })
            });
            if (r.ok) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('editCollectionModal'));
                if (modal) modal.hide();
                await reloadSidebarAll();
            } else {
                const err = await r.json().catch(() => ({}));
                alert('Update failed: ' + (err.detail || JSON.stringify(err)));
            }
        } catch (e) {
            alert('Network error while updating collection.');
        }
    }

    async function addCollectionQuick() {
        const name = prompt('Enter new collection name:');
        if (!name || !name.trim()) return;
        try {
            const r = await fetch('/api/collections/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify({ name: name.trim() })
            });
            if (r.ok) {
                await reloadSidebarAll();
            }
        } catch (e) { /* noop */ }
    }

    function validateJsonInline() {
        const bodyTa = document.getElementById('bodyTextarea');
        const msg = document.getElementById('jsonValidateMsg');
        if (!bodyTa || !msg) return;
        const text = bodyTa.value;
        if (!text || !text.trim()) {
            msg.innerHTML = '<span class="text-muted">Empty</span>';
            return;
        }
        try {
            JSON.parse(text);
            msg.innerHTML = '<span class="text-success">Valid JSON ✓</span>';
        } catch (e) {
            msg.innerHTML = '<span class="text-danger">Invalid: ' + escapeHtml(e.message) + '</span>';
        }
    }

    function attachEvents() {
        document.addEventListener('change', function (e) {
            const t = e.target;
            if (t.id === 'methodSelect') {
                editor.method = t.value;
                applyMethodSelectClass();
                applyBodyDisabledState();
                renderPreviewUrl();
            } else if (t.classList.contains('param-enabled')) {
                const idx = parseInt(t.closest('tr').dataset.idx, 10);
                editor.params[idx].enabled = t.checked;
                renderPreviewUrl();
            } else if (t.classList.contains('header-enabled')) {
                const idx = parseInt(t.closest('tr').dataset.idx, 10);
                editor.headers[idx].enabled = t.checked;
            } else if (t.name === 'authType') {
                editor.auth_type = t.value;
                readAuthConfigFromDom();
                renderAuthConfig();
            } else if (t.id === 'saveCollectionSelect') {
                const ng = document.getElementById('newCollectionGroup');
                if (ng) ng.style.display = (t.value === '__new__') ? 'block' : 'none';
            }
        });

        document.addEventListener('input', function (e) {
            const t = e.target;
            if (t.id === 'urlInput') {
                editor.url = cleanUrl(t.value);
                renderPreviewUrl();
            } else if (t.id === 'bodyTextarea') {
                editor.body = t.value;
            } else if (t.classList.contains('param-key')) {
                const idx = parseInt(t.closest('tr').dataset.idx, 10);
                editor.params[idx].key = t.value;
                renderPreviewUrl();
            } else if (t.classList.contains('param-value')) {
                const idx = parseInt(t.closest('tr').dataset.idx, 10);
                editor.params[idx].value = t.value;
                renderPreviewUrl();
            } else if (t.classList.contains('header-key')) {
                const idx = parseInt(t.closest('tr').dataset.idx, 10);
                editor.headers[idx].key = t.value;
            } else if (t.classList.contains('header-value')) {
                const idx = parseInt(t.closest('tr').dataset.idx, 10);
                editor.headers[idx].value = t.value;
            } else if (['bearerToken', 'apiKeyName', 'apiKeyValue', 'apiKeyAddTo', 'basicUsername', 'basicPassword'].indexOf(t.id) !== -1) {
                readAuthConfigFromDom();
            }
        });

        document.addEventListener('click', function (e) {
            const t = e.target;
            if (t.id === 'sendBtn') {
                e.preventDefault();
                sendRequest();
            } else if (t.id === 'newRequestBtn' || t.id === 'newRequestBtnMobile') {
                resetEditor();
            } else if (t.id === 'addParamBtn') {
                editor.params.push({ enabled: true, key: '', value: '' });
                renderParamsRows();
            } else if (t.id === 'addHeaderBtn') {
                editor.headers.push({ enabled: true, key: '', value: '' });
                renderHeadersRows();
            } else if (t.classList.contains('remove-param')) {
                const idx = parseInt(t.closest('tr').dataset.idx, 10);
                editor.params.splice(idx, 1);
                if (editor.params.length === 0) editor.params.push({ enabled: true, key: '', value: '' });
                renderParamsRows();
                renderPreviewUrl();
            } else if (t.classList.contains('remove-header')) {
                const idx = parseInt(t.closest('tr').dataset.idx, 10);
                editor.headers.splice(idx, 1);
                renderHeadersRows();
            } else if (t.id === 'validateJsonBtn') {
                validateJsonInline();
            } else if (t.id === 'saveConfirmBtn') {
                saveRequest();
            } else if (t.id === 'clearHistoryBtn') {
                clearHistory();
            } else if (t.id === 'addCollectionBtn') {
                addCollectionQuick();
            } else if (t.classList.contains('delete-saved')) {
                e.stopPropagation();
                deleteSaved(t.dataset.id);
            } else if (t.classList.contains('delete-collection')) {
                e.stopPropagation();
                deleteCollection(t.dataset.id);
            } else if (t.classList.contains('edit-saved')) {
                e.stopPropagation();
                openEditSaved(t.dataset.id);
            } else if (t.classList.contains('edit-collection')) {
                e.stopPropagation();
                openEditCollection(t.dataset.id);
            } else if (t.id === 'editSavedConfirmBtn') {
                submitEditSaved();
            } else if (t.id === 'editCollectionConfirmBtn') {
                submitEditCollection();
            } else {
                const sidebarItem = t.closest('.sidebar-item');
                if (sidebarItem && !t.closest('.si-actions') && !t.closest('.ch-actions')) {
                    const type = sidebarItem.dataset.type;
                    const id = sidebarItem.dataset.id;
                    if (type === 'saved') loadSavedIntoForm(id);
                    else if (type === 'history') loadHistoryIntoForm(id);
                    return;
                }
                const collHeader = t.closest('.collection-head');
                if (collHeader && !t.closest('.si-actions') && !t.closest('.ch-actions')) {
                    const id = collHeader.dataset.collectionId;
                    currentlyExpandedCollection = (currentlyExpandedCollection === id) ? null : id;
                    renderCollections();
                    renderMobileSidebar();
                }
            }
        });
    }

    function init() {
        ensureDefaultRows();
        renderFormFromState();
        renderResponse();
        attachEvents();
        reloadSidebarAll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
