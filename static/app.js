/**
 * TEST API — Master Application Frontend Architecture
 * Modern API development & testing SaaS client logic
 */

(function () {
    'use strict';

    // ============================================================
    // STATE MANAGEMENT
    // ============================================================
    const state = {
        tabs: [],
        activeTabId: null,
        tabCounter: 1,

        collections: [],
        savedRequests: [],
        history: [],
        environments: [],
        activeEnvironmentId: null,

        expandedCollections: new Set(),
        activeSidebarTab: 'tabCollections',

        clerkUser: null,
        clerkToken: null
    };

    function getCsrfToken() {
        const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    }

    async function getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        };
        if (window.Clerk && window.Clerk.session) {
            try {
                const token = await window.Clerk.session.getToken();
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
            } catch (e) {
                console.warn('Could not fetch Clerk token:', e);
            }
        }
        return headers;
    }

    // ============================================================
    // TOAST NOTIFICATIONS (Replaces browser alerts)
    // ============================================================
    function showToast(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `app-toast toast-${type}`;

        let iconSvg = '';
        if (type === 'success') {
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#10B981" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>';
        } else if (type === 'error') {
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#EF4444" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/></svg>';
        } else {
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#F97316" viewBox="0 0 16 16"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>';
        }

        toast.innerHTML = `
            <div style="flex-shrink:0;">${iconSvg}</div>
            <div style="flex:1;">${escapeHtml(message)}</div>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards';
            setTimeout(() => toast.remove(), 220);
        }, duration);
    }

    function escapeHtml(s) {
        if (s == null) return '';
        const div = document.createElement('div');
        div.textContent = String(s);
        return div.innerHTML;
    }

    // ============================================================
    // ENVIRONMENT VARIABLE SUBSTITUTION ENGINE
    // ============================================================
    function getActiveEnvironment() {
        if (!state.activeEnvironmentId) return null;
        return state.environments.find(e => String(e.id) === String(state.activeEnvironmentId)) || null;
    }

    function substituteVariables(rawText) {
        if (!rawText || typeof rawText !== 'string') return rawText || '';
        const env = getActiveEnvironment();
        if (!env || !env.variables || !env.variables.length) return rawText;

        let result = rawText;
        env.variables.forEach(v => {
            if (v.key) {
                const pattern = new RegExp(`{{\\s*${v.key}\\s*}}`, 'g');
                result = result.replace(pattern, v.value || '');
            }
        });
        return result;
    }

    // ============================================================
    // TABS MANAGEMENT
    // ============================================================
    function createTab(initial = {}) {
        const id = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const newTab = {
            id: id,
            name: initial.name || `Request ${state.tabCounter++}`,
            method: (initial.method || 'GET').toUpperCase(),
            url: initial.url || '',
            params: Array.isArray(initial.params) ? initial.params : (initial.params_json ? objectToKv(initial.params_json) : []),
            headers: Array.isArray(initial.headers) ? initial.headers : (initial.headers_json ? objectToKv(initial.headers_json) : [{ enabled: true, key: 'Content-Type', value: 'application/json' }]),
            body: initial.body || initial.body_json || '',
            bodyType: initial.bodyType || 'json',
            authType: initial.auth_type || initial.authType || 'none',
            authConfig: initial.auth_config_json || initial.authConfig || {},
            isDirty: false,
            savedRequestId: initial.id || null,
            response: null
        };

        if (newTab.params.length === 0) {
            newTab.params.push({ enabled: true, key: '', value: '' });
        }
        if (newTab.headers.length === 0) {
            newTab.headers.push({ enabled: true, key: 'Content-Type', value: 'application/json' });
        }

        state.tabs.push(newTab);
        state.activeTabId = id;
        renderTabsStrip();
        loadTabIntoUI(newTab);
        return newTab;
    }

    function getActiveTab() {
        return state.tabs.find(t => t.id === state.activeTabId) || null;
    }

    function switchTab(id) {
        saveUIToActiveTab();
        state.activeTabId = id;
        renderTabsStrip();
        const tab = getActiveTab();
        if (tab) loadTabIntoUI(tab);
    }

    function closeTab(id, e) {
        if (e) e.stopPropagation();
        if (state.tabs.length <= 1) {
            // Keep at least one tab open
            state.tabs = [];
            createTab();
            return;
        }

        const idx = state.tabs.findIndex(t => t.id === id);
        if (idx !== -1) {
            state.tabs.splice(idx, 1);
            if (state.activeTabId === id) {
                const nextIdx = Math.max(0, idx - 1);
                state.activeTabId = state.tabs[nextIdx].id;
            }
            renderTabsStrip();
            const active = getActiveTab();
            if (active) loadTabIntoUI(active);
        }
    }

    function renderTabsStrip() {
        const container = document.getElementById('requestTabsContainer');
        const addBtn = document.getElementById('addNewTabBtn');
        if (!container || !addBtn) return;

        // Remove old tabs but keep add button
        const oldTabs = container.querySelectorAll('.req-tab');
        oldTabs.forEach(el => el.remove());

        state.tabs.forEach(tab => {
            const tabEl = document.createElement('div');
            tabEl.className = `req-tab ${tab.id === state.activeTabId ? 'active' : ''}`;
            tabEl.dataset.tabId = tab.id;

            tabEl.innerHTML = `
                <span class="method-badge method-${tab.method}">${tab.method}</span>
                <span class="req-tab-title">${escapeHtml(tab.name || 'Untitled')}</span>
                ${tab.isDirty ? '<span class="req-tab-dirty"></span>' : ''}
                <span class="req-tab-close" data-close-tab="${tab.id}">&times;</span>
            `;

            tabEl.addEventListener('click', (e) => {
                if (e.target.dataset.closeTab) {
                    closeTab(e.target.dataset.closeTab, e);
                } else {
                    switchTab(tab.id);
                }
            });

            container.insertBefore(tabEl, addBtn);
        });
    }

    function objectToKv(obj) {
        if (!obj || typeof obj !== 'object') return [];
        return Object.keys(obj).map(k => ({ enabled: true, key: k, value: obj[k] }));
    }

    function kvToObject(rows) {
        const obj = {};
        if (!Array.isArray(rows)) return obj;
        rows.forEach(r => {
            if (r.enabled && r.key && r.key.trim()) {
                obj[r.key.trim()] = r.value || '';
            }
        });
        return obj;
    }

    // ============================================================
    // UI SYNC: ACTIVE TAB <-> DOM
    // ============================================================
    function saveUIToActiveTab() {
        const tab = getActiveTab();
        if (!tab) return;

        const methodEl = document.getElementById('reqMethodSelect');
        const urlEl = document.getElementById('reqUrlInput');
        const bodyEl = document.getElementById('reqBodyTextarea');

        if (methodEl) tab.method = methodEl.value;
        if (urlEl) tab.url = urlEl.value.trim();
        if (bodyEl) tab.body = bodyEl.value;

        // Params
        tab.params = [];
        document.querySelectorAll('#paramsTableBody tr').forEach(tr => {
            const enabled = tr.querySelector('.kv-param-enabled')?.checked ?? true;
            const key = tr.querySelector('.kv-param-key')?.value ?? '';
            const value = tr.querySelector('.kv-param-value')?.value ?? '';
            if (key || value) tab.params.push({ enabled, key, value });
        });

        // Headers
        tab.headers = [];
        document.querySelectorAll('#headersTableBody tr').forEach(tr => {
            const enabled = tr.querySelector('.kv-header-enabled')?.checked ?? true;
            const key = tr.querySelector('.kv-header-key')?.value ?? '';
            const value = tr.querySelector('.kv-header-value')?.value ?? '';
            if (key || value) tab.headers.push({ enabled, key, value });
        });

        // Auth
        readAuthFromDom(tab);
    }

    function loadTabIntoUI(tab) {
        const methodEl = document.getElementById('reqMethodSelect');
        const urlEl = document.getElementById('reqUrlInput');
        const bodyEl = document.getElementById('reqBodyTextarea');

        if (methodEl) methodEl.value = tab.method;
        if (urlEl) urlEl.value = tab.url;
        if (bodyEl) bodyEl.value = tab.body;

        // Render params table
        renderParamsTable(tab.params);
        // Render headers table
        renderHeadersTable(tab.headers);
        // Render auth
        setAuthInUI(tab.authType, tab.authConfig);
        // Render response
        renderResponse(tab.response);
        // Update URL preview
        updateUrlPreview();
    }

    function renderParamsTable(params) {
        const tbody = document.getElementById('paramsTableBody');
        const countBadge = document.getElementById('paramsCountBadge');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!params || params.length === 0) {
            params = [{ enabled: true, key: '', value: '' }];
        }

        const activeCount = params.filter(p => p.enabled && p.key).length;
        if (countBadge) countBadge.textContent = activeCount;

        params.forEach((p, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center"><input type="checkbox" class="kv-checkbox kv-param-enabled" ${p.enabled ? 'checked' : ''}></td>
                <td><input type="text" class="kv-input kv-param-key" placeholder="Key" value="${escapeHtml(p.key)}"></td>
                <td><input type="text" class="kv-input kv-param-value" placeholder="Value" value="${escapeHtml(p.value)}"></td>
                <td class="text-center"><button type="button" class="mini-icon-btn danger delete-param-row" data-idx="${idx}">&times;</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderHeadersTable(headers) {
        const tbody = document.getElementById('headersTableBody');
        const countBadge = document.getElementById('headersCountBadge');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!headers || headers.length === 0) {
            headers = [{ enabled: true, key: '', value: '' }];
        }

        const activeCount = headers.filter(h => h.enabled && h.key).length;
        if (countBadge) countBadge.textContent = activeCount;

        headers.forEach((h, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center"><input type="checkbox" class="kv-checkbox kv-header-enabled" ${h.enabled ? 'checked' : ''}></td>
                <td><input type="text" class="kv-input kv-header-key" placeholder="Header name" value="${escapeHtml(h.key)}"></td>
                <td><input type="text" class="kv-input kv-header-value" placeholder="Value" value="${escapeHtml(h.value)}"></td>
                <td class="text-center"><button type="button" class="mini-icon-btn danger delete-header-row" data-idx="${idx}">&times;</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    function setAuthInUI(authType, authConfig = {}) {
        document.querySelectorAll('.auth-type-pill').forEach(pill => {
            pill.classList.toggle('active', pill.dataset.auth === authType);
        });

        const sections = ['none', 'bearer', 'api_key', 'basic', 'oauth2'];
        sections.forEach(s => {
            const el = document.getElementById('authSec' + s.charAt(0).toUpperCase() + s.slice(1).replace('_', ''));
            if (el) el.style.display = (s === authType) ? 'block' : 'none';
        });

        if (authType === 'bearer') {
            document.getElementById('authBearerToken').value = authConfig.token || '';
        } else if (authType === 'api_key') {
            document.getElementById('authApiKeyName').value = authConfig.key || '';
            document.getElementById('authApiKeyValue').value = authConfig.value || '';
            document.getElementById('authApiKeyLocation').value = authConfig['in'] || 'header';
        } else if (authType === 'basic') {
            document.getElementById('authBasicUser').value = authConfig.username || '';
            document.getElementById('authBasicPass').value = authConfig.password || '';
        } else if (authType === 'oauth2') {
            document.getElementById('authOAuth2Token').value = authConfig.access_token || authConfig.token || '';
        }
    }

    function readAuthFromDom(tab) {
        const activePill = document.querySelector('.auth-type-pill.active');
        const authType = activePill ? activePill.dataset.auth : 'none';
        tab.authType = authType;

        const cfg = {};
        if (authType === 'bearer') {
            cfg.token = document.getElementById('authBearerToken')?.value || '';
        } else if (authType === 'api_key') {
            cfg.key = document.getElementById('authApiKeyName')?.value || '';
            cfg.value = document.getElementById('authApiKeyValue')?.value || '';
            cfg['in'] = document.getElementById('authApiKeyLocation')?.value || 'header';
        } else if (authType === 'basic') {
            cfg.username = document.getElementById('authBasicUser')?.value || '';
            cfg.password = document.getElementById('authBasicPass')?.value || '';
        } else if (authType === 'oauth2') {
            cfg.access_token = document.getElementById('authOAuth2Token')?.value || '';
        }
        tab.authConfig = cfg;
    }

    function updateUrlPreview() {
        const tab = getActiveTab();
        const previewEl = document.getElementById('resolvedUrlPreview');
        if (!previewEl) return;

        let rawUrl = (document.getElementById('reqUrlInput')?.value || '').trim();
        if (!rawUrl) {
            previewEl.textContent = 'Enter an API endpoint URL above';
            return;
        }

        // Apply variable substitution
        let resolved = substituteVariables(rawUrl);

        // Apply enabled query params
        const params = [];
        document.querySelectorAll('#paramsTableBody tr').forEach(tr => {
            const enabled = tr.querySelector('.kv-param-enabled')?.checked;
            const k = tr.querySelector('.kv-param-key')?.value?.trim();
            const v = tr.querySelector('.kv-param-value')?.value || '';
            if (enabled && k) {
                params.push(`${encodeURIComponent(substituteVariables(k))}=${encodeURIComponent(substituteVariables(v))}`);
            }
        });

        if (params.length > 0) {
            const sep = resolved.includes('?') ? '&' : '?';
            resolved += sep + params.join('&');
        }

        previewEl.textContent = resolved;
    }

    // ============================================================
    // RESPONSE VIEWER RENDERING
    // ============================================================
    function renderResponse(res) {
        const statusBadge = document.getElementById('respStatusBadge');
        const timeChip = document.getElementById('respTimeChip');
        const timeVal = document.getElementById('respTimeValue');
        const sizeChip = document.getElementById('respSizeChip');
        const sizeVal = document.getElementById('respSizeValue');
        const errorBanner = document.getElementById('respErrorBanner');
        const bodyPre = document.getElementById('responseBodyPre');
        const headersCount = document.getElementById('respHeadersCount');
        const headersBody = document.getElementById('responseHeadersBody');
        const cookiesCount = document.getElementById('respCookiesCount');
        const cookiesBody = document.getElementById('responseCookiesBody');
        const testsCount = document.getElementById('respTestsCount');
        const testsContainer = document.getElementById('responseTestsContainer');

        if (!res) {
            if (statusBadge) {
                statusBadge.className = 'status-badge s-none';
                statusBadge.textContent = 'No Response';
            }
            if (timeChip) timeChip.style.display = 'none';
            if (sizeChip) sizeChip.style.display = 'none';
            if (errorBanner) errorBanner.style.display = 'none';
            if (bodyPre) bodyPre.innerHTML = '<span class="text-muted">Send a request to inspect the response.</span>';
            if (headersCount) headersCount.textContent = '0';
            if (headersBody) headersBody.innerHTML = '<tr><td colspan="2" class="text-muted text-center p-3">No headers.</td></tr>';
            if (cookiesCount) cookiesCount.textContent = '0';
            if (cookiesBody) cookiesBody.innerHTML = '<tr><td colspan="5" class="text-muted text-center p-3">No cookies.</td></tr>';
            if (testsCount) testsCount.textContent = '0';
            if (testsContainer) testsContainer.innerHTML = '<span class="text-muted small">Run a request to see test results.</span>';
            return;
        }

        // Status code & text
        if (statusBadge) {
            const code = res.status_code;
            const text = res.status_text || (res.ok ? 'OK' : 'Error');
            let sClass = 's-none';
            if (code >= 200 && code < 300) sClass = 's-2xx';
            else if (code >= 300 && code < 400) sClass = 's-3xx';
            else if (code >= 400 && code < 500) sClass = 's-4xx';
            else if (code >= 500) sClass = 's-5xx';

            statusBadge.className = `status-badge ${sClass}`;
            statusBadge.textContent = code ? `${code} ${text}` : (res.error_type || 'Error');
        }

        // Latency
        if (timeChip && timeVal) {
            if (res.response_time_ms != null) {
                timeChip.style.display = 'inline-flex';
                timeVal.textContent = res.response_time_ms;
            } else {
                timeChip.style.display = 'none';
            }
        }

        // Size
        if (sizeChip && sizeVal) {
            if (res.response_size_bytes != null) {
                sizeChip.style.display = 'inline-flex';
                const bytes = res.response_size_bytes;
                if (bytes < 1024) sizeVal.textContent = `${bytes} B`;
                else if (bytes < 1024 * 1024) sizeVal.textContent = `${(bytes / 1024).toFixed(1)} KB`;
                else sizeVal.textContent = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
            } else {
                sizeChip.style.display = 'none';
            }
        }

        // Errors
        if (errorBanner) {
            if (res.error_message || !res.ok) {
                errorBanner.style.display = 'flex';
                errorBanner.innerHTML = `
                    <div class="fw-bold">${escapeHtml(res.error_type || 'Error')}</div>
                    <div>${escapeHtml(res.error_message || 'Request failed')}</div>
                `;
            } else {
                errorBanner.style.display = 'none';
            }
        }

        // Body formatting
        if (bodyPre) {
            if (res.body_text) {
                try {
                    const parsed = JSON.parse(res.body_text);
                    bodyPre.textContent = JSON.stringify(parsed, null, 2);
                } catch (e) {
                    bodyPre.textContent = res.body_text;
                }
            } else {
                bodyPre.innerHTML = '<span class="text-muted">No response body received.</span>';
            }
        }

        // Headers
        const headers = res.headers || {};
        const headerKeys = Object.keys(headers);
        if (headersCount) headersCount.textContent = headerKeys.length;
        if (headersBody) {
            if (headerKeys.length === 0) {
                headersBody.innerHTML = '<tr><td colspan="2" class="text-muted text-center p-3">No headers received.</td></tr>';
            } else {
                headersBody.innerHTML = headerKeys.map(k => `
                    <tr>
                        <td class="fw-semibold text-secondary mono-font">${escapeHtml(k)}</td>
                        <td class="mono-font">${escapeHtml(headers[k])}</td>
                    </tr>
                `).join('');
            }
        }

        // Cookies
        const cookies = res.cookies || [];
        if (cookiesCount) cookiesCount.textContent = cookies.length;
        if (cookiesBody) {
            if (cookies.length === 0) {
                cookiesBody.innerHTML = '<tr><td colspan="5" class="text-muted text-center p-3">No cookies set by this response.</td></tr>';
            } else {
                cookiesBody.innerHTML = cookies.map(c => `
                    <tr>
                        <td class="fw-semibold mono-font">${escapeHtml(c.name)}</td>
                        <td class="mono-font text-truncate" style="max-width:180px;">${escapeHtml(c.value)}</td>
                        <td class="text-muted small">${escapeHtml(c.domain || '-')}</td>
                        <td class="text-muted small">${escapeHtml(c.path || '/')}</td>
                        <td>${c.secure ? '<span class="badge bg-success">Secure</span>' : '<span class="badge bg-secondary">No</span>'}</td>
                    </tr>
                `).join('');
            }
        }

        // Test Assertions Evaluation
        runTestAssertions(res);
    }

    function runTestAssertions(res) {
        const testsContainer = document.getElementById('responseTestsContainer');
        const testsCount = document.getElementById('respTestsCount');
        if (!testsContainer) return;

        const assertions = [];

        // 1. Status 200 check
        const assert200 = document.getElementById('testAssertStatus200')?.checked;
        if (assert200) {
            const passed = res.status_code === 200;
            assertions.push({
                name: 'Status code is 200 OK',
                passed: passed,
                details: `Expected: 200 | Received: ${res.status_code || 'None'}`
            });
        }

        // 2. Response time < 1000ms
        const assertTime = document.getElementById('testAssertTimeFast')?.checked;
        if (assertTime) {
            const passed = res.response_time_ms != null && res.response_time_ms < 1000;
            assertions.push({
                name: 'Response time is under 1000ms',
                passed: passed,
                details: `Expected: < 1000ms | Received: ${res.response_time_ms != null ? res.response_time_ms + 'ms' : 'N/A'}`
            });
        }

        // 3. Valid JSON
        const assertJson = document.getElementById('testAssertJsonValid')?.checked;
        if (assertJson) {
            let passed = false;
            try {
                if (res.body_text) { JSON.parse(res.body_text); passed = true; }
            } catch (e) { }
            assertions.push({
                name: 'Response body is valid JSON',
                passed: passed,
                details: passed ? 'Body successfully parsed as JSON' : 'Response body is not valid JSON'
            });
        }

        if (testsCount) testsCount.textContent = assertions.length;

        if (assertions.length === 0) {
            testsContainer.innerHTML = '<span class="text-muted small">No test assertions enabled.</span>';
            return;
        }

        testsContainer.innerHTML = assertions.map(a => `
            <div class="test-result-row ${a.passed ? 'passed' : 'failed'}">
                <span>${a.passed ? '✓' : '✕'}</span>
                <span class="fw-semibold">${escapeHtml(a.name)}</span>
                <span class="text-muted small ms-auto">${escapeHtml(a.details)}</span>
            </div>
        `).join('');
    }

    // ============================================================
    // REQUEST EXECUTION ENGINE
    // ============================================================
    async function sendRequest() {
        const tab = getActiveTab();
        if (!tab) return;
        saveUIToActiveTab();

        let rawUrl = tab.url;
        if (!rawUrl || !rawUrl.trim()) {
            showToast('Please enter an API URL before sending.', 'warning');
            document.getElementById('reqUrlInput')?.focus();
            return;
        }

        // Substitute variables
        const resolvedUrl = substituteVariables(rawUrl);

        // Parameters with variable substitution
        const paramsObj = {};
        tab.params.forEach(p => {
            if (p.enabled && p.key && p.key.trim()) {
                paramsObj[substituteVariables(p.key.trim())] = substituteVariables(p.value || '');
            }
        });

        // Headers with variable substitution
        const headersObj = {};
        tab.headers.forEach(h => {
            if (h.enabled && h.key && h.key.trim()) {
                headersObj[substituteVariables(h.key.trim())] = substituteVariables(h.value || '');
            }
        });

        // Body with variable substitution
        let bodyPayload = tab.body ? substituteVariables(tab.body) : '';

        // Validate JSON if method uses body and content-type is json
        const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE'];
        if (methodsWithBody.includes(tab.method) && bodyPayload && bodyPayload.trim()) {
            try {
                JSON.parse(bodyPayload);
            } catch (e) {
                showToast('Invalid JSON in request body: ' + e.message, 'error');
                return;
            }
        }

        // Show sending state
        const sendBtn = document.getElementById('reqSendBtn');
        const sendBtnText = document.getElementById('sendBtnText');
        const sendBtnIcon = document.getElementById('sendBtnIcon');
        if (sendBtn) {
            sendBtn.disabled = true;
            if (sendBtnText) sendBtnText.textContent = 'Sending...';
            if (sendBtnIcon) {
                sendBtnIcon.outerHTML = '<span id="sendBtnIcon" class="spinner-border spinner-border-sm me-1" role="status"></span>';
            }
        }

        const payload = {
            method: tab.method,
            url: resolvedUrl,
            params: paramsObj,
            headers: headersObj,
            body: methodsWithBody.includes(tab.method) ? bodyPayload : '',
            auth_type: tab.authType,
            auth_config: tab.authConfig
        };

        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch('/api/proxy/execute/', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify(payload)
            });

            let data = {};
            try {
                data = await res.json();
            } catch (err) {
                data = { ok: false, status_code: res.status, error_message: 'Malformed server response' };
            }

            tab.response = data;
            renderResponse(data);
            showToast(`Request complete: ${data.status_code || ''} ${data.status_text || ''}`, data.ok ? 'success' : 'error');

            // Refresh history
            await loadHistory();
        } catch (e) {
            const errRes = {
                ok: false,
                status_code: null,
                error_type: 'NetworkError',
                error_message: 'Failed to communicate with proxy backend: ' + e.message
            };
            tab.response = errRes;
            renderResponse(errRes);
            showToast('Request failed: ' + e.message, 'error');
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
                const iconEl = document.getElementById('sendBtnIcon');
                if (iconEl) {
                    iconEl.outerHTML = '<svg id="sendBtnIcon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.86L.117 6.86a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11zM6.636 10.07l2.762 4.225L14.094 1.41 6.636 10.07zM1.4 5.829l4.86 3.174L13.19 2.13 1.4 5.83z"/></svg>';
                }
                const textEl = document.getElementById('sendBtnText');
                if (textEl) textEl.textContent = 'Send';
            }
        }
    }

    // ============================================================
    // DATA LOADERS & SIDEBAR RENDERING
    // ============================================================
    async function loadCollections() {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/collections/', { headers });
            if (res.ok) {
                state.collections = await res.json() || [];
                renderCollectionsSidebar();
                updateCollectionDropdowns();
            }
        } catch (e) {
            console.error('Failed to load collections:', e);
        }
    }

    async function loadSavedRequests() {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/saved-requests/', { headers });
            if (res.ok) {
                state.savedRequests = await res.json() || [];
                renderSavedRequestsSidebar();
                renderCollectionsSidebar();
            }
        } catch (e) {
            console.error('Failed to load saved requests:', e);
        }
    }

    async function loadHistory() {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/history/', { headers });
            if (res.ok) {
                state.history = await res.json() || [];
                renderHistorySidebar();
            }
        } catch (e) {
            console.error('Failed to load history:', e);
        }
    }

    async function loadEnvironments() {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/environments/', { headers });
            if (res.ok) {
                state.environments = await res.json() || [];
                renderEnvironmentsHeaderSelect();
                renderEnvironmentsSidebar();
            }
        } catch (e) {
            console.error('Failed to load environments:', e);
        }
    }

    function renderCollectionsSidebar() {
        const container = document.getElementById('collectionsListContainer');
        const countSpan = document.getElementById('collectionsTotalCount');
        if (!container) return;

        if (countSpan) countSpan.textContent = state.collections.length;

        if (state.collections.length === 0) {
            container.innerHTML = `
                <div class="empty-state-box">
                    <svg class="empty-state-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <div class="empty-state-title">No Collections</div>
                    <div class="empty-state-desc">Group requests together to test and document your APIs.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        state.collections.forEach(col => {
            const isExpanded = state.expandedCollections.has(String(col.id));
            const colRequests = state.savedRequests.filter(r => String(r.collection) === String(col.id));

            const folderEl = document.createElement('div');
            folderEl.className = `coll-folder ${isExpanded ? 'expanded' : ''}`;
            folderEl.dataset.colId = col.id;

            folderEl.innerHTML = `
                <div class="coll-folder-header">
                    <div class="coll-folder-left">
                        <span class="coll-chevron">▶</span>
                        <span class="coll-name">${escapeHtml(col.name)}</span>
                        <span class="coll-count-chip">${colRequests.length}</span>
                    </div>
                    <div class="coll-folder-actions">
                        <button type="button" class="mini-icon-btn edit-col-btn" title="Edit Collection" data-col-id="${col.id}">✎</button>
                        <button type="button" class="mini-icon-btn danger delete-col-btn" title="Delete Collection" data-col-id="${col.id}">&times;</button>
                    </div>
                </div>
                <div class="coll-items-container">
                    ${colRequests.length === 0 ? '<div class="text-muted small p-2">Empty collection</div>' : ''}
                </div>
            `;

            const itemsContainer = folderEl.querySelector('.coll-items-container');
            colRequests.forEach(req => {
                itemsContainer.appendChild(createSavedItemElement(req));
            });

            folderEl.querySelector('.coll-folder-header').addEventListener('click', (e) => {
                if (e.target.closest('.coll-folder-actions')) return;
                const cId = String(col.id);
                if (state.expandedCollections.has(cId)) {
                    state.expandedCollections.delete(cId);
                    folderEl.classList.remove('expanded');
                } else {
                    state.expandedCollections.add(cId);
                    folderEl.classList.add('expanded');
                }
            });

            container.appendChild(folderEl);
        });
    }

    function createSavedItemElement(req) {
        const item = document.createElement('div');
        item.className = 'sidebar-req-item';
        item.dataset.reqId = req.id;

        item.innerHTML = `
            <span class="method-badge method-${req.method}">${req.method}</span>
            <div class="s-item-text">
                <span class="s-item-title">${escapeHtml(req.name)}</span>
                <span class="s-item-sub">${escapeHtml(req.url)}</span>
            </div>
            <div class="s-item-actions">
                <button type="button" class="mini-icon-btn danger delete-saved-btn" title="Delete" data-id="${req.id}">&times;</button>
            </div>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.closest('.s-item-actions')) return;
            // Open saved request in current tab or create new
            openRequestInWorkspace(req);
        });

        return item;
    }

    function renderSavedRequestsSidebar() {
        const container = document.getElementById('savedListContainer');
        const countSpan = document.getElementById('savedTotalCount');
        if (!container) return;

        // Root saved requests (no collection)
        const rootRequests = state.savedRequests.filter(r => !r.collection);
        if (countSpan) countSpan.textContent = rootRequests.length;

        if (rootRequests.length === 0) {
            container.innerHTML = `
                <div class="empty-state-box">
                    <svg class="empty-state-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    <div class="empty-state-title">No Unorganized Requests</div>
                    <div class="empty-state-desc">Requests saved without a collection will appear here.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        rootRequests.forEach(req => {
            container.appendChild(createSavedItemElement(req));
        });
    }

    function renderHistorySidebar() {
        const container = document.getElementById('historyListContainer');
        const filterInput = document.getElementById('historySearchInput');
        if (!container) return;

        const filter = (filterInput?.value || '').trim().toLowerCase();
        let filtered = state.history;
        if (filter) {
            filtered = state.history.filter(h =>
                (h.url && h.url.toLowerCase().includes(filter)) ||
                (h.method && h.method.toLowerCase().includes(filter)) ||
                (h.status_code && String(h.status_code).includes(filter))
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state-box">
                    <svg class="empty-state-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div class="empty-state-title">${filter ? 'No Matches Found' : 'No History Yet'}</div>
                    <div class="empty-state-desc">${filter ? 'Try a different filter term.' : 'Sent requests will automatically appear here.'}</div>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        filtered.forEach(h => {
            const item = document.createElement('div');
            item.className = 'sidebar-req-item';
            item.dataset.historyId = h.id;

            const timeStr = h.executed_at ? new Date(h.executed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const statusClass = (h.status_code >= 200 && h.status_code < 300) ? 's-2xx' : (h.status_code >= 400 ? 's-4xx' : 's-none');

            item.innerHTML = `
                <span class="method-badge method-${h.method}">${h.method}</span>
                <div class="s-item-text">
                    <span class="s-item-title">${escapeHtml(h.url || '(no URL)')}</span>
                    <span class="s-item-sub">${timeStr} &middot; <span class="status-badge ${statusClass}" style="padding:0.05rem 0.35rem;font-size:0.65rem;">${h.status_code || 'ERR'}</span> ${h.response_time_ms != null ? h.response_time_ms + 'ms' : ''}</span>
                </div>
            `;

            item.addEventListener('click', () => {
                openHistoryInWorkspace(h);
            });

            container.appendChild(item);
        });
    }

    function renderEnvironmentsHeaderSelect() {
        const select = document.getElementById('globalEnvSelect');
        if (!select) return;

        const currentVal = state.activeEnvironmentId;
        select.innerHTML = '<option value="">No Environment</option>';

        state.environments.forEach(env => {
            const opt = document.createElement('option');
            opt.value = env.id;
            opt.textContent = env.name;
            select.appendChild(opt);
        });

        if (currentVal && state.environments.some(e => String(e.id) === String(currentVal))) {
            select.value = currentVal;
        } else {
            select.value = '';
            state.activeEnvironmentId = null;
        }
    }

    function renderEnvironmentsSidebar() {
        const container = document.getElementById('environmentsListContainer');
        if (!container) return;

        if (state.environments.length === 0) {
            container.innerHTML = `
                <div class="empty-state-box">
                    <div class="empty-state-title">No Environments</div>
                    <div class="empty-state-desc">Create environments like Dev, Staging, or Prod to manage variables.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = state.environments.map(env => `
            <div class="sidebar-req-item d-flex align-items-center justify-content-between p-2">
                <div>
                    <span class="fw-semibold">${escapeHtml(env.name)}</span>
                    <div class="text-muted small">${(env.variables || []).length} variables</div>
                </div>
                <div class="d-flex gap-1">
                    <button type="button" class="mini-icon-btn edit-env-btn" data-env-id="${env.id}" title="Edit Variables">✎</button>
                    <button type="button" class="mini-icon-btn danger delete-env-btn" data-env-id="${env.id}" title="Delete">&times;</button>
                </div>
            </div>
        `).join('');
    }

    function updateCollectionDropdowns() {
        const select = document.getElementById('saveModalCollectionSelect');
        if (!select) return;

        select.innerHTML = `
            <option value="">(No collection - Save to root)</option>
            <option value="__new__">+ Create New Collection...</option>
        `;

        state.collections.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            select.appendChild(opt);
        });
    }

    function openRequestInWorkspace(req) {
        createTab({
            id: req.id,
            name: req.name,
            method: req.method,
            url: req.url,
            params_json: req.params_json,
            headers_json: req.headers_json,
            body: req.body_json,
            auth_type: req.auth_type,
            auth_config_json: req.auth_config_json
        });
        showToast(`Loaded "${req.name}"`, 'info');
    }

    function openHistoryInWorkspace(h) {
        createTab({
            name: `${h.method} ${h.url.substring(0, 30)}...`,
            method: h.method,
            url: h.url,
            params_json: h.params_json,
            headers_json: h.headers_json,
            body: h.body_json,
            auth_type: h.auth_type,
            auth_config_json: h.auth_config_json
        });
        showToast('History item loaded into new tab', 'info');
    }

    // ============================================================
    // MODALS: SAVE REQUEST, COLLECTION & ENVIRONMENT
    // ============================================================
    async function saveCurrentRequest() {
        const tab = getActiveTab();
        if (!tab) return;
        saveUIToActiveTab();

        const nameInput = document.getElementById('saveModalReqName');
        const colSelect = document.getElementById('saveModalCollectionSelect');
        const newColGroup = document.getElementById('saveModalNewCollectionGroup');
        const newColName = document.getElementById('saveModalNewCollectionName');

        if (nameInput) nameInput.value = tab.name || '';
        if (colSelect) colSelect.value = '';
        if (newColGroup) newColGroup.style.display = 'none';
        if (newColName) newColName.value = '';

        const modal = new bootstrap.Modal(document.getElementById('saveRequestModal'));
        modal.show();
    }

    async function handleConfirmSaveRequest() {
        const tab = getActiveTab();
        if (!tab) return;

        const name = (document.getElementById('saveModalReqName')?.value || '').trim();
        if (!name) {
            showToast('Please enter a request name.', 'warning');
            return;
        }

        let colId = document.getElementById('saveModalCollectionSelect')?.value || '';
        if (colId === '__new__') {
            const newName = (document.getElementById('saveModalNewCollectionName')?.value || '').trim();
            if (!newName) {
                showToast('Please enter a name for the new collection.', 'warning');
                return;
            }
            try {
                const headers = await getAuthHeaders();
                const res = await fetch('/api/collections/', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: newName })
                });
                if (res.ok) {
                    const createdCol = await res.json();
                    colId = createdCol.id;
                    await loadCollections();
                } else {
                    showToast('Failed to create collection.', 'error');
                    return;
                }
            } catch (e) {
                showToast('Network error creating collection: ' + e.message, 'error');
                return;
            }
        }

        const payload = {
            name: name,
            collection: colId ? parseInt(colId, 10) : null,
            method: tab.method,
            url: tab.url,
            params_json: kvToObject(tab.params),
            headers_json: kvToObject(tab.headers),
            body_json: tab.body,
            auth_type: tab.authType,
            auth_config_json: tab.authConfig
        };

        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/saved-requests/', {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const saved = await res.json();
                tab.savedRequestId = saved.id;
                tab.name = name;
                tab.isDirty = false;
                renderTabsStrip();

                const modal = bootstrap.Modal.getInstance(document.getElementById('saveRequestModal'));
                if (modal) modal.hide();

                showToast(`Request "${name}" saved!`, 'success');
                await loadSavedRequests();
            } else {
                const err = await res.json().catch(() => ({}));
                showToast('Failed to save request: ' + (err.detail || JSON.stringify(err)), 'error');
            }
        } catch (e) {
            showToast('Network error saving request: ' + e.message, 'error');
        }
    }

    async function handleConfirmSaveCollection() {
        const id = document.getElementById('collectionModalId')?.value;
        const name = (document.getElementById('collectionModalName')?.value || '').trim();
        const desc = (document.getElementById('collectionModalDesc')?.value || '').trim();

        if (!name) {
            showToast('Please enter a collection name.', 'warning');
            return;
        }

        const method = id ? 'PATCH' : 'POST';
        const url = id ? `/api/collections/${id}/` : '/api/collections/';

        try {
            const headers = await getAuthHeaders();
            const res = await fetch(url, {
                method,
                headers,
                body: JSON.stringify({ name, description: desc })
            });
            if (res.ok) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('collectionModal'));
                if (modal) modal.hide();

                showToast(`Collection ${id ? 'updated' : 'created'}!`, 'success');
                await loadCollections();
            } else {
                showToast('Failed to save collection.', 'error');
            }
        } catch (e) {
            showToast('Network error: ' + e.message, 'error');
        }
    }

    function openEnvManagerModal(targetEnvId = null) {
        const modal = new bootstrap.Modal(document.getElementById('environmentManagerModal'));
        modal.show();
        renderEnvModalList(targetEnvId || state.activeEnvironmentId);
    }

    function renderEnvModalList(selectedId = null) {
        const list = document.getElementById('modalEnvList');
        if (!list) return;

        if (state.environments.length === 0) {
            list.innerHTML = '<div class="text-muted small p-2">No environments</div>';
            renderEnvModalVariables(null);
            return;
        }

        const currentActive = selectedId ? state.environments.find(e => String(e.id) === String(selectedId)) : state.environments[0];

        list.innerHTML = state.environments.map(env => `
            <div class="sidebar-req-item d-flex align-items-center justify-content-between p-2 ${currentActive && currentActive.id === env.id ? 'active' : ''}" data-env-modal-select="${env.id}">
                <span class="fw-semibold">${escapeHtml(env.name)}</span>
                <span class="badge bg-secondary" style="font-size:0.65rem;">${(env.variables || []).length}</span>
            </div>
        `).join('');

        renderEnvModalVariables(currentActive);
    }

    function renderEnvModalVariables(env) {
        const titleEl = document.getElementById('modalActiveEnvName');
        const tbody = document.getElementById('modalEnvVariablesBody');
        if (!tbody) return;

        if (!env) {
            if (titleEl) titleEl.textContent = 'None';
            tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center p-3">Select or create an environment.</td></tr>';
            return;
        }

        if (titleEl) titleEl.textContent = env.name;
        const vars = env.variables || [];

        if (vars.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center p-3">No variables yet. Click "+ Add Variable" above.</td></tr>';
            return;
        }

        tbody.innerHTML = vars.map(v => `
            <tr data-var-id="${v.id}" data-env-id="${env.id}">
                <td><input type="text" class="kv-input var-key-input" value="${escapeHtml(v.key)}"></td>
                <td><input type="${v.is_secret ? 'password' : 'text'}" class="kv-input var-val-input" value="${escapeHtml(v.value)}"></td>
                <td class="text-center"><input type="checkbox" class="kv-checkbox var-secret-check" ${v.is_secret ? 'checked' : ''}></td>
                <td class="text-center"><button type="button" class="mini-icon-btn danger delete-var-btn" data-var-id="${v.id}">&times;</button></td>
            </tr>
        `).join('');
    }

    // ============================================================
    // COMMAND PALETTE & SEARCH
    // ============================================================
    const commandList = [
        { title: 'Send Request', shortcut: 'Ctrl + Enter', action: sendRequest },
        { title: 'New Request Tab', shortcut: 'Ctrl + T', action: () => createTab() },
        { title: 'Save Request', shortcut: 'Ctrl + S', action: saveCurrentRequest },
        { title: 'Manage Environments', shortcut: '', action: () => openEnvManagerModal() },
        { title: 'Toggle Theme (Dark / Light)', shortcut: '', action: () => document.getElementById('themeToggleBtn')?.click() },
        { title: 'Clear Request History', shortcut: '', action: () => document.getElementById('clearHistoryBtn')?.click() },
        { title: 'Open Collections', shortcut: '', action: () => document.querySelector('.s-nav-tab[data-tab-target="tabCollections"]')?.click() },
        { title: 'Open History', shortcut: '', action: () => document.querySelector('.s-nav-tab[data-tab-target="tabHistory"]')?.click() }
    ];

    function openCommandPalette() {
        const modalEl = document.getElementById('commandPaletteModal');
        const input = document.getElementById('commandPaletteInput');
        if (!modalEl || !input) return;

        const modal = new bootstrap.Modal(modalEl);
        modal.show();
        setTimeout(() => input.focus(), 150);
        renderCommandPaletteResults('');
    }

    function renderCommandPaletteResults(filter) {
        const resultsEl = document.getElementById('commandPaletteResults');
        if (!resultsEl) return;

        const filtered = commandList.filter(c => c.title.toLowerCase().includes(filter.toLowerCase()));
        if (filtered.length === 0) {
            resultsEl.innerHTML = '<div class="text-center text-muted p-3 small">No matching commands.</div>';
            return;
        }

        resultsEl.innerHTML = filtered.map((c, i) => `
            <div class="cmd-item ${i === 0 ? 'selected' : ''}" data-cmd-index="${i}">
                <span>${escapeHtml(c.title)}</span>
                ${c.shortcut ? `<kbd style="font-size:0.7rem;background:var(--bg-input);padding:0.15rem 0.4rem;border-radius:4px;">${c.shortcut}</kbd>` : ''}
            </div>
        `).join('');
    }

    function openQuickSearch() {
        const modalEl = document.getElementById('quickSearchModal');
        const input = document.getElementById('quickSearchInput');
        if (!modalEl || !input) return;

        const modal = new bootstrap.Modal(modalEl);
        modal.show();
        setTimeout(() => input.focus(), 150);
        renderQuickSearchResults('');
    }

    function renderQuickSearchResults(query) {
        const resultsEl = document.getElementById('quickSearchResults');
        if (!resultsEl) return;

        query = query.trim().toLowerCase();
        if (!query) {
            resultsEl.innerHTML = '<div class="text-center text-muted p-3 small">Type to search collections, requests, or history...</div>';
            return;
        }

        const hits = [];

        // Search collections
        state.collections.forEach(c => {
            if (c.name.toLowerCase().includes(query)) {
                hits.push({
                    type: 'Collection', title: c.name, sub: 'Collection', action: () => {
                        document.querySelector('.s-nav-tab[data-tab-target="tabCollections"]')?.click();
                    }
                });
            }
        });

        // Search saved requests
        state.savedRequests.forEach(r => {
            if (r.name.toLowerCase().includes(query) || (r.url && r.url.toLowerCase().includes(query))) {
                hits.push({ type: 'Saved Request', title: `${r.method} ${r.name}`, sub: r.url, action: () => openRequestInWorkspace(r) });
            }
        });

        // Search history
        state.history.forEach(h => {
            if (h.url && h.url.toLowerCase().includes(query)) {
                hits.push({ type: 'History', title: `${h.method} ${h.url}`, sub: `Status: ${h.status_code || 'ERR'} · ${h.response_time_ms}ms`, action: () => openHistoryInWorkspace(h) });
            }
        });

        if (hits.length === 0) {
            resultsEl.innerHTML = '<div class="text-center text-muted p-3 small">No matching results found.</div>';
            return;
        }

        resultsEl.innerHTML = hits.slice(0, 15).map((h, i) => `
            <div class="cmd-item" data-search-hit-index="${i}">
                <div>
                    <span class="badge bg-secondary me-2" style="font-size:0.65rem;">${h.type}</span>
                    <span class="fw-semibold">${escapeHtml(h.title)}</span>
                    <div class="text-muted small" style="font-size:0.7rem;">${escapeHtml(h.sub)}</div>
                </div>
            </div>
        `).join('');

        resultsEl.querySelectorAll('.cmd-item').forEach((el, i) => {
            el.addEventListener('click', () => {
                const modal = bootstrap.Modal.getInstance(document.getElementById('quickSearchModal'));
                if (modal) modal.hide();
                hits[i].action();
            });
        });
    }

    // ============================================================
    // CLERK AUTHENTICATION INITIALIZATION
    // ============================================================
    function initClerk() {
        if (!window.Clerk) {
            console.log('Clerk.js not loaded. Operating in standard session mode.');
            return;
        }

        window.Clerk.load().then(() => {
            const clerkContainer = document.getElementById('clerkUserButton');
            const djangoDropdown = document.getElementById('djangoUserDropdown');

            if (window.Clerk.user) {
                state.clerkUser = window.Clerk.user;
                if (clerkContainer) {
                    window.Clerk.mountUserButton(clerkContainer);
                }
                if (djangoDropdown) {
                    djangoDropdown.style.display = 'none';
                }
            }
        }).catch(err => {
            console.error('Clerk load error:', err);
        });
    }

    // ============================================================
    // EVENT LISTENERS & DELEGATION
    // ============================================================
    function attachEventListeners() {
        // Global Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl + Enter: Send Request
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                sendRequest();
            }
            // Ctrl + S: Save Request
            else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                saveCurrentRequest();
            }
            // Ctrl + K: Quick Search
            else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                openQuickSearch();
            }
            // Ctrl + Shift + P: Command Palette
            else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                openCommandPalette();
            }
        });

        // Top bar buttons
        document.getElementById('openSearchBtn')?.addEventListener('click', openQuickSearch);
        document.getElementById('openCommandPaletteBtn')?.addEventListener('click', openCommandPalette);
        document.getElementById('openEnvManagerBtn')?.addEventListener('click', () => openEnvManagerModal());

        document.getElementById('globalEnvSelect')?.addEventListener('change', (e) => {
            state.activeEnvironmentId = e.target.value || null;
            updateUrlPreview();
            showToast(`Environment changed to ${getActiveEnvironment()?.name || 'None'}`, 'info');
        });

        // New Tab Buttons
        document.getElementById('newTabBtn')?.addEventListener('click', () => createTab());
        document.getElementById('addNewTabBtn')?.addEventListener('click', () => createTab());

        // Sidebar Navigation Tabs Switcher
        document.querySelectorAll('.s-nav-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.s-nav-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const targetId = btn.dataset.tabTarget;
                document.querySelectorAll('.sidebar-content-area').forEach(area => {
                    area.style.display = (area.id === targetId) ? 'flex' : 'none';
                });
            });
        });

        // Send & Save buttons
        document.getElementById('reqSendBtn')?.addEventListener('click', sendRequest);
        document.getElementById('reqSaveBtn')?.addEventListener('click', saveCurrentRequest);
        document.getElementById('confirmSaveRequestBtn')?.addEventListener('click', handleConfirmSaveRequest);

        // URL input typing updates live preview
        document.getElementById('reqUrlInput')?.addEventListener('input', () => {
            const tab = getActiveTab();
            if (tab) {
                tab.url = document.getElementById('reqUrlInput').value;
                tab.isDirty = true;
            }
            updateUrlPreview();
        });

        // Method selector
        document.getElementById('reqMethodSelect')?.addEventListener('change', (e) => {
            const tab = getActiveTab();
            if (tab) {
                tab.method = e.target.value;
                tab.isDirty = true;
                renderTabsStrip();
            }
        });

        // Builder Tab switching (Params, Headers, Body, Auth, Tests)
        document.querySelectorAll('.builder-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.builder-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const target = btn.dataset.target;
                document.querySelectorAll('.builder-tab-pane').forEach(pane => {
                    pane.classList.toggle('active', pane.id === target);
                });
            });
        });

        // Response Tab switching (Body, Headers, Cookies, Tests)
        document.querySelectorAll('.resp-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.resp-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const target = btn.dataset.respTarget;
                document.querySelectorAll('.resp-content-pane').forEach(pane => {
                    pane.classList.toggle('active', pane.id === target);
                });
            });
        });

        // Copy response body
        document.getElementById('copyResponseBodyBtn')?.addEventListener('click', () => {
            const bodyText = document.getElementById('responseBodyPre')?.textContent;
            if (bodyText) {
                navigator.clipboard.writeText(bodyText).then(() => {
                    showToast('Response body copied to clipboard!', 'success');
                }).catch(() => {
                    showToast('Could not copy to clipboard.', 'error');
                });
            }
        });

        // Add param row
        document.getElementById('addParamRowBtn')?.addEventListener('click', () => {
            const tab = getActiveTab();
            if (!tab) return;
            tab.params.push({ enabled: true, key: '', value: '' });
            renderParamsTable(tab.params);
        });

        // Add header row
        document.getElementById('addHeaderRowBtn')?.addEventListener('click', () => {
            const tab = getActiveTab();
            if (!tab) return;
            tab.headers.push({ enabled: true, key: '', value: '' });
            renderHeadersTable(tab.headers);
        });

        // Param/Header row deletions & inputs delegation
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-param-row')) {
                const idx = parseInt(e.target.dataset.idx, 10);
                const tab = getActiveTab();
                if (tab && tab.params[idx]) {
                    tab.params.splice(idx, 1);
                    renderParamsTable(tab.params);
                    updateUrlPreview();
                }
            } else if (e.target.classList.contains('delete-header-row')) {
                const idx = parseInt(e.target.dataset.idx, 10);
                const tab = getActiveTab();
                if (tab && tab.headers[idx]) {
                    tab.headers.splice(idx, 1);
                    renderHeadersTable(tab.headers);
                }
            }
        });

        // Input changes inside Params/Headers tables
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('kv-param-key') || e.target.classList.contains('kv-param-value')) {
                updateUrlPreview();
            }
        });
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('kv-param-enabled')) {
                updateUrlPreview();
            }
        });

        // Auth type pill selection
        document.querySelectorAll('.auth-type-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const tab = getActiveTab();
                if (!tab) return;
                setAuthInUI(pill.dataset.auth, tab.authConfig);
                readAuthFromDom(tab);
            });
        });

        // Body formatting tools (Prettify, Minify, Validate)
        document.getElementById('formatJsonBtn')?.addEventListener('click', () => {
            const el = document.getElementById('reqBodyTextarea');
            if (!el || !el.value.trim()) return;
            try {
                const parsed = JSON.parse(el.value);
                el.value = JSON.stringify(parsed, null, 2);
                showToast('JSON formatted successfully', 'success');
            } catch (err) {
                showToast('Invalid JSON: ' + err.message, 'error');
            }
        });

        document.getElementById('minifyJsonBtn')?.addEventListener('click', () => {
            const el = document.getElementById('reqBodyTextarea');
            if (!el || !el.value.trim()) return;
            try {
                const parsed = JSON.parse(el.value);
                el.value = JSON.stringify(parsed);
                showToast('JSON minified', 'success');
            } catch (err) {
                showToast('Invalid JSON: ' + err.message, 'error');
            }
        });

        document.getElementById('validateJsonBtn')?.addEventListener('click', () => {
            const el = document.getElementById('reqBodyTextarea');
            if (!el || !el.value.trim()) {
                showToast('Body is empty', 'info');
                return;
            }
            try {
                JSON.parse(el.value);
                showToast('Valid JSON ✓', 'success');
            } catch (err) {
                showToast('Invalid JSON: ' + err.message, 'error');
            }
        });

        document.getElementById('clearBodyBtn')?.addEventListener('click', () => {
            const el = document.getElementById('reqBodyTextarea');
            if (el) el.value = '';
        });

        // Create Collection Dialog
        document.getElementById('createCollectionBtn')?.addEventListener('click', () => {
            document.getElementById('collectionModalId').value = '';
            document.getElementById('collectionModalName').value = '';
            document.getElementById('collectionModalDesc').value = '';
            document.getElementById('collectionModalTitle').textContent = 'Create Collection';
            const modal = new bootstrap.Modal(document.getElementById('collectionModal'));
            modal.show();
        });

        document.getElementById('confirmCollectionSaveBtn')?.addEventListener('click', handleConfirmSaveCollection);

        // Edit/Delete Collection Delegation
        document.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.edit-col-btn');
            if (editBtn) {
                e.stopPropagation();
                const colId = editBtn.dataset.colId;
                const col = state.collections.find(c => String(c.id) === String(colId));
                if (col) {
                    document.getElementById('collectionModalId').value = col.id;
                    document.getElementById('collectionModalName').value = col.name;
                    document.getElementById('collectionModalDesc').value = col.description || '';
                    document.getElementById('collectionModalTitle').textContent = 'Edit Collection';
                    const modal = new bootstrap.Modal(document.getElementById('collectionModal'));
                    modal.show();
                }
                return;
            }

            const delBtn = e.target.closest('.delete-col-btn');
            if (delBtn) {
                e.stopPropagation();
                const colId = delBtn.dataset.colId;
                if (confirm('Delete this collection and all of its requests?')) {
                    try {
                        const headers = await getAuthHeaders();
                        const res = await fetch(`/api/collections/${colId}/`, { method: 'DELETE', headers });
                        if (res.ok) {
                            showToast('Collection deleted', 'info');
                            await loadCollections();
                            await loadSavedRequests();
                        }
                    } catch (err) {
                        showToast('Error deleting collection: ' + err.message, 'error');
                    }
                }
                return;
            }

            const delSavedBtn = e.target.closest('.delete-saved-btn');
            if (delSavedBtn) {
                e.stopPropagation();
                const reqId = delSavedBtn.dataset.id;
                if (confirm('Delete this saved request?')) {
                    try {
                        const headers = await getAuthHeaders();
                        const res = await fetch(`/api/saved-requests/${reqId}/`, { method: 'DELETE', headers });
                        if (res.ok) {
                            showToast('Saved request deleted', 'info');
                            await loadSavedRequests();
                        }
                    } catch (err) {
                        showToast('Error deleting request: ' + err.message, 'error');
                    }
                }
                return;
            }
        });

        // History Clear & Search
        document.getElementById('clearHistoryBtn')?.addEventListener('click', async () => {
            if (!confirm('Clear all request history?')) return;
            try {
                const headers = await getAuthHeaders();
                const res = await fetch('/api/history/', { method: 'DELETE', headers });
                if (res.ok) {
                    state.history = [];
                    renderHistorySidebar();
                    showToast('History cleared', 'info');
                }
            } catch (err) {
                showToast('Error clearing history: ' + err.message, 'error');
            }
        });

        document.getElementById('historySearchInput')?.addEventListener('input', renderHistorySidebar);

        // Environment Modal Handlers
        let selectedModalEnvId = null;

        document.getElementById('modalAddEnvBtn')?.addEventListener('click', async () => {
            const name = prompt('Enter new environment name (e.g. Development, Production):');
            if (!name || !name.trim()) return;
            try {
                const headers = await getAuthHeaders();
                const res = await fetch('/api/environments/', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: name.trim() })
                });
                if (res.ok) {
                    const created = await res.json();
                    showToast(`Environment "${created.name}" created!`, 'success');
                    await loadEnvironments();
                    renderEnvModalList(created.id);
                } else {
                    showToast('Failed to create environment', 'error');
                }
            } catch (err) {
                showToast('Network error: ' + err.message, 'error');
            }
        });

        document.getElementById('createEnvSidebarBtn')?.addEventListener('click', () => {
            openEnvManagerModal();
            document.getElementById('modalAddEnvBtn')?.click();
        });

        // Delegate clicks in Environment Modal
        document.addEventListener('click', async (e) => {
            // Select environment in modal
            const envRow = e.target.closest('[data-env-modal-select]');
            if (envRow) {
                selectedModalEnvId = envRow.dataset.envModalSelect;
                renderEnvModalList(selectedModalEnvId);
                return;
            }

            // Edit environment button in sidebar
            const editEnvSidebar = e.target.closest('.edit-env-btn');
            if (editEnvSidebar) {
                const envId = editEnvSidebar.dataset.envId;
                openEnvManagerModal(envId);
                return;
            }

            // Delete environment button in sidebar
            const delEnvSidebar = e.target.closest('.delete-env-btn');
            if (delEnvSidebar) {
                const envId = delEnvSidebar.dataset.envId;
                if (confirm('Delete this environment and all its variables?')) {
                    try {
                        const headers = await getAuthHeaders();
                        const res = await fetch(`/api/environments/${envId}/`, { method: 'DELETE', headers });
                        if (res.ok) {
                            showToast('Environment deleted', 'info');
                            await loadEnvironments();
                        }
                    } catch (err) {
                        showToast('Error deleting environment: ' + err.message, 'error');
                    }
                }
                return;
            }

            // Delete variable button in modal
            const delVarBtn = e.target.closest('.delete-var-btn');
            if (delVarBtn) {
                const varId = delVarBtn.dataset.varId;
                try {
                    const headers = await getAuthHeaders();
                    const res = await fetch(`/api/environment-variables/${varId}/`, { method: 'DELETE', headers });
                    if (res.ok) {
                        showToast('Variable deleted', 'info');
                        await loadEnvironments();
                        const currentEnv = state.environments.find(env => (env.variables || []).some(v => String(v.id) === String(varId)));
                        renderEnvModalList(currentEnv ? currentEnv.id : null);
                    }
                } catch (err) {
                    showToast('Error deleting variable: ' + err.message, 'error');
                }
                return;
            }
        });

        // Add variable button in modal
        document.getElementById('modalAddVarRowBtn')?.addEventListener('click', async () => {
            const currentActiveEnv = selectedModalEnvId
                ? state.environments.find(e => String(e.id) === String(selectedModalEnvId))
                : (state.activeEnvironmentId ? state.environments.find(e => String(e.id) === String(state.activeEnvironmentId)) : state.environments[0]);

            if (!currentActiveEnv) {
                showToast('Please select or create an environment first.', 'warning');
                return;
            }

            try {
                const headers = await getAuthHeaders();
                const res = await fetch('/api/environment-variables/', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        environment: currentActiveEnv.id,
                        key: 'NEW_VAR',
                        value: '',
                        is_secret: false
                    })
                });
                if (res.ok) {
                    await loadEnvironments();
                    renderEnvModalList(currentActiveEnv.id);
                }
            } catch (err) {
                showToast('Failed to add variable: ' + err.message, 'error');
            }
        });

        // Edit variable key/value/secret changes
        document.addEventListener('change', async (e) => {
            const tr = e.target.closest('tr[data-var-id]');
            if (!tr) return;

            const varId = tr.dataset.varId;
            const envId = tr.dataset.envId;
            const key = tr.querySelector('.var-key-input')?.value || '';
            const value = tr.querySelector('.var-val-input')?.value || '';
            const isSecret = tr.querySelector('.var-secret-check')?.checked || false;

            try {
                const headers = await getAuthHeaders();
                await fetch(`/api/environment-variables/${varId}/`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ key, value, is_secret: isSecret })
                });
                await loadEnvironments();
                updateUrlPreview();
            } catch (err) {
                console.error('Error updating variable:', err);
            }
        });
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================
    async function init() {
        // Initialize Clerk if present
        initClerk();

        // Create default first tab
        createTab({
            name: 'Get Users',
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/users'
        });

        // Attach all global & DOM event listeners
        attachEventListeners();

        // Load all data from REST APIs
        await Promise.all([
            loadCollections(),
            loadSavedRequests(),
            loadHistory(),
            loadEnvironments()
        ]);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
