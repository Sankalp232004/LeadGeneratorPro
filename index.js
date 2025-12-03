document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('lead-form');
    const nameInput = document.getElementById('lead-name');
    const urlInput = document.getElementById('lead-url');
    const stageSelect = document.getElementById('lead-stage');
    const tagsInput = document.getElementById('lead-tags');
    const noteInput = document.getElementById('lead-note');
    const tabBtn = document.getElementById('tab-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const leadList = document.getElementById('lead-list');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const filterBar = document.getElementById('stage-filters');
    const toast = document.getElementById('toast');
    const metricTotal = document.getElementById('metric-total');
    const metricStarred = document.getElementById('metric-starred');
    const metricWeek = document.getElementById('metric-week');

    const isChromeExtension = typeof chrome !== 'undefined' && chrome.storage;
    const storageKey = 'myLeads';
    let leads = [];
    let activeStage = 'all';
    let searchTerm = '';
    let toastTimer;

    if (!isChromeExtension) {
        tabBtn.style.display = 'none';
    }

    form.addEventListener('submit', event => {
        event.preventDefault();
        addLead();
    });

    searchInput.addEventListener('input', event => {
        searchTerm = event.target.value.toLowerCase().trim();
        renderLeads();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchTerm = '';
        searchInput.value = '';
        renderLeads();
    });

    filterBar.addEventListener('click', event => {
        if (!event.target.matches('.chip')) {
            return;
        }
        activeStage = event.target.dataset.stage;
        document.querySelectorAll('#stage-filters .chip').forEach(chip => {
            chip.classList.toggle('active', chip === event.target);
        });
        renderLeads();
    });

    deleteBtn.addEventListener('click', () => {
        if (!leads.length) {
            return;
        }
        if (confirm('Clear all saved leads?')) {
            leads = [];
            persistLeads();
            renderLeads();
            showToast('Lead vault cleared');
        }
    });

    if (isChromeExtension) {
        tabBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
                const tab = tabs[0];
                if (!tab || !tab.url) {
                    showToast('Unable to read tab');
                    return;
                }
                const lead = buildLead({
                    name: tab.title || extractDomain(tab.url),
                    url: tab.url,
                    stage: 'prospect',
                    tags: [],
                    note: ''
                });
                leads.unshift(lead);
                persistLeads();
                renderLeads();
                showToast('Current tab saved');
            });
        });
    }

    leadList.addEventListener('click', event => {
        const action = event.target.dataset.action;
        if (!action) {
            return;
        }
        const card = event.target.closest('.lead-card');
        if (!card) {
            return;
        }
        const leadId = card.dataset.id;
        const targetLead = leads.find(item => item.id === leadId);
        if (!targetLead) {
            return;
        }
        if (action === 'open') {
            window.open(targetLead.url, '_blank');
            return;
        }
        if (action === 'copy') {
            copyToClipboard(targetLead.url);
            showToast('Link copied');
            return;
        }
        if (action === 'star') {
            targetLead.starred = !targetLead.starred;
            persistLeads();
            renderLeads();
            showToast(targetLead.starred ? 'Lead highlighted' : 'Lead unstarred');
            return;
        }
        if (action === 'delete') {
            if (confirm('Remove this lead?')) {
                leads = leads.filter(item => item.id !== leadId);
                persistLeads();
                renderLeads();
                showToast('Lead removed');
            }
        }
    });

    loadLeads();

    function addLead() {
        const name = nameInput.value.trim();
        const rawUrl = urlInput.value.trim();
        if (!name || !rawUrl) {
            showToast('Name and link are required');
            return;
        }
        const lead = buildLead({
            name,
            url: normalizeUrl(rawUrl),
            stage: stageSelect.value,
            tags: parseTags(tagsInput.value),
            note: noteInput.value.trim()
        });
        leads.unshift(lead);
        persistLeads();
        renderLeads();
        form.reset();
        stageSelect.value = 'prospect';
        nameInput.focus();
        showToast('Lead captured');
    }

    function buildLead(input) {
        return {
            id: createId(),
            name: input.name || deriveTitle(input.url),
            url: input.url,
            stage: input.stage || 'prospect',
            tags: Array.isArray(input.tags) ? input.tags : [],
            note: input.note || '',
            starred: Boolean(input.starred),
            createdAt: input.createdAt || Date.now()
        };
    }

    function loadLeads() {
        const hydrate = payload => {
            const collection = Array.isArray(payload) ? payload : [];
            leads = collection.map(item => normalizeLead(item)).filter(Boolean);
            renderLeads();
        };
        if (isChromeExtension) {
            chrome.storage.local.get([storageKey], result => {
                if (result && result[storageKey]) {
                    hydrate(result[storageKey]);
                } else {
                    hydrate([]);
                }
            });
        } else {
            const stored = localStorage.getItem(storageKey);
            hydrate(stored ? JSON.parse(stored) : []);
        }
    }

    function normalizeLead(entry) {
        if (!entry) {
            return null;
        }
        if (typeof entry === 'string') {
            return buildLead({
                name: deriveTitle(entry),
                url: normalizeUrl(entry)
            });
        }
        return buildLead({
            id: entry.id,
            name: entry.name,
            url: normalizeUrl(entry.url || ''),
            stage: entry.stage,
            tags: Array.isArray(entry.tags) ? entry.tags : parseTags(entry.tags || ''),
            note: entry.note,
            starred: entry.starred,
            createdAt: entry.createdAt
        });
    }

    function persistLeads() {
        const payload = leads.map(item => ({ ...item }));
        if (isChromeExtension) {
            chrome.storage.local.set({ [storageKey]: payload });
        } else {
            localStorage.setItem(storageKey, JSON.stringify(payload));
        }
    }

    function renderLeads() {
        const filtered = leads.filter(item => {
            if (activeStage === 'starred' && !item.starred) {
                return false;
            }
            if (activeStage !== 'starred' && activeStage !== 'all' && item.stage !== activeStage) {
                return false;
            }
            if (!searchTerm) {
                return true;
            }
            const haystack = `${item.name} ${item.url} ${item.tags.join(' ')}`.toLowerCase();
            return haystack.includes(searchTerm);
        });
        leadList.innerHTML = filtered.map(renderLead).join('');
        emptyState.style.display = filtered.length ? 'none' : 'block';
        updateMetrics();
    }

    function renderLead(lead) {
        const tagsMarkup = lead.tags.length ? `<div class="tag-list">${lead.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : '';
        const noteMarkup = lead.note ? `<p class="lead-note">${escapeHtml(lead.note)}</p>` : '';
        const stageLabel = stageLabelMap()[lead.stage] || 'Prospect';
        const relative = formatRelative(lead.createdAt);
        const domain = extractDomain(lead.url);
        const safeName = escapeHtml(lead.name);
        const safeUrl = escapeAttribute(lead.url);
        const starClass = lead.starred ? 'starred' : '';
        const starLabel = lead.starred ? 'Starred' : 'Star';
        return `
            <li class="lead-card" data-id="${lead.id}" data-stage="${lead.stage}" data-starred="${lead.starred}">
                <div class="lead-head">
                    <div>
                        <h3>${safeName}</h3>
                        <div class="lead-meta">
                            <span><strong>${stageLabel}</strong></span>
                            <span>${domain}</span>
                            <span>${relative}</span>
                        </div>
                    </div>
                    <div class="lead-actions">
                        <button type="button" class="primary-action" data-action="open">Open</button>
                        <button type="button" data-action="copy">Copy link</button>
                        <button type="button" data-action="star" class="${starClass}">${starLabel}</button>
                        <button type="button" data-action="delete">Remove</button>
                    </div>
                </div>
                <a class="lead-link" href="${safeUrl}" target="_blank" rel="noopener">${safeUrl}</a>
                ${tagsMarkup}
                ${noteMarkup}
            </li>
        `;
    }

    function updateMetrics() {
        metricTotal.textContent = leads.length;
        metricStarred.textContent = leads.filter(item => item.starred).length;
        const weekThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
        metricWeek.textContent = leads.filter(item => item.createdAt >= weekThreshold).length;
    }

    function parseTags(value) {
        return value
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean)
            .map(tag => tag.toLowerCase());
    }

    function normalizeUrl(value) {
        if (!value) {
            return '';
        }
        return /^https?:\/\//i.test(value) ? value : `https://${value}`;
    }

    function deriveTitle(link) {
        if (!link) {
            return 'Untitled lead';
        }
        const domain = extractDomain(link);
        return domain || 'Untitled lead';
    }

    function extractDomain(link) {
        if (!link) {
            return '';
        }
        try {
            const hostname = new URL(link).hostname;
            return hostname.replace(/^www\./, '');
        } catch (e) {
            return link.replace(/^https?:\/\//, '');
        }
    }

    function stageLabelMap() {
        return {
            prospect: 'Prospect',
            contacted: 'Contacted',
            'in-progress': 'In progress',
            won: 'Won'
        };
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttribute(value) {
        return escapeHtml(value).replace(/"/g, '&quot;');
    }

    function createId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function showToast(message) {
        if (!toast) {
            return;
        }
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2200);
    }

    function copyToClipboard(value) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(value);
            return;
        }
        const temp = document.createElement('textarea');
        temp.value = value;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
    }

    function formatRelative(timestamp) {
        const now = Date.now();
        const diff = timestamp - now;
        const units = [
            { unit: 'day', ms: 24 * 60 * 60 * 1000 },
            { unit: 'hour', ms: 60 * 60 * 1000 },
            { unit: 'minute', ms: 60 * 1000 }
        ];
        const rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;
        for (const { unit, ms } of units) {
            if (Math.abs(diff) >= ms || unit === 'minute') {
                const value = Math.round(diff / ms);
                if (rtf) {
                    return rtf.format(value, unit);
                }
                const suffix = value > 0 ? 'from now' : 'ago';
                return `${Math.abs(value)} ${unit}${Math.abs(value) !== 1 ? 's' : ''} ${suffix}`;
            }
        }
        return 'Just now';
    }
});
