// content.js - Antigravity v2.0

// ============================================================
// 1. MESSAGE LISTENER (Focus Mode, Seek, Ping, Scan)
// ============================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scanPage") {
        const video = document.querySelector("video");
        const videoData = video ? {
            exists: true,
            currentTime: video.currentTime,
            duration: video.duration
        } : { exists: false };
        sendResponse({
            title: getYouTubeTitle() || document.title,
            url: window.location.href,
            video: videoData
        });
    } else if (request.action === "seekTo") {
        const video = document.querySelector("video");
        if (video) {
            video.currentTime = request.timestamp;
            video.play();
            sendResponse({ status: "skipped" });
        } else {
            sendResponse({ status: "no-video" });
        }
    } else if (request.action === "toggleFocusMode") {
        toggleFocusMode(request.enabled);
        sendResponse({ status: "applied" });
    } else if (request.action === "ping") {
        sendResponse({ status: "pong" });
    }
    return true;
});

// ============================================================
// 2. FOCUS MODE
// ============================================================
function toggleFocusMode(enabled) {
    let focusStyle = document.getElementById('ag-focus-style');
    if (enabled) {
        if (!focusStyle) {
            focusStyle = document.createElement('style');
            focusStyle.id = 'ag-focus-style';
            focusStyle.textContent = `
                #related, #comments, #secondary,
                ytd-watch-next-secondary-results-renderer,
                #end-screen, .ytp-endscreen-content { display: none !important; }
            `;
            document.head.appendChild(focusStyle);
        }
    } else if (focusStyle) {
        focusStyle.remove();
    }
}

// ============================================================
// 3. HELPERS
// ============================================================
function getYouTubeTitle() {
    if (!window.location.hostname.includes('youtube.com')) return null;
    const el = document.querySelector("h1.title yt-formatted-string") ||
        document.querySelector("yt-formatted-string.ytd-video-primary-info-renderer") ||
        document.querySelector("h1.ytd-watch-metadata");
    return el ? el.innerText.trim() : null;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ============================================================
// 4. SIDEBAR INJECTION
// ============================================================
function injectSidebar() {
    if (document.getElementById('antigravity-sidebar')) return; // Already injected

    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'antigravity-toggle';
    toggleBtn.innerHTML = '✦';
    toggleBtn.title = 'Open Antigravity';
    document.body.appendChild(toggleBtn);

    // Sidebar shell
    const sidebar = document.createElement('div');
    sidebar.id = 'antigravity-sidebar';
    sidebar.innerHTML = `
        <div id="ag-sidebar-header">
            <h2>✦ Antigravity</h2>
            <span id="ag-badge">🎓 Learning</span>
            <button id="ag-close-btn" title="Close">✕</button>
        </div>
        <div id="ag-controls">
            <input type="text" id="ag-note-input" placeholder="Add a note..." autocomplete="off"/>
            <button id="ag-save-btn">Save</button>
        </div>
        <div id="ag-timer-bar">
            <span id="ag-timer-label">Study Time</span>
            <span id="ag-study-time">00:00:00</span>
        </div>
        <div id="ag-notes-list"></div>
    `;
    document.body.appendChild(sidebar);

    // Toggle logic
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('ag-open');
        if (sidebar.classList.contains('ag-open')) renderNotes();
    });

    document.getElementById('ag-close-btn').addEventListener('click', () => {
        sidebar.classList.remove('ag-open');
    });

    // Save note
    document.getElementById('ag-save-btn').addEventListener('click', saveManualNote);
    document.getElementById('ag-note-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveManualNote();
    });

    // Live storage listener — refreshes sidebar when any note is added/deleted
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.notes && sidebar.classList.contains('ag-open')) {
            renderNotes();
        }
        if (changes.studyTimeToday) {
            updateTimer(changes.studyTimeToday.newValue || 0);
        }
    });

    // Initial data load
    renderNotes();
    loadTimer();
}

// ============================================================
// 5. TIMER
// ============================================================
function loadTimer() {
    chrome.storage.local.get(['studyTimeToday'], (res) => {
        updateTimer(res.studyTimeToday || 0);
    });
}

function updateTimer(seconds) {
    const el = document.getElementById('ag-study-time');
    if (!el) return;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ============================================================
// 6. SAVE MANUAL NOTE
// ============================================================
function saveManualNote() {
    const input = document.getElementById('ag-note-input');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    const video = document.querySelector("video");
    const timestamp = video ? video.currentTime : null;
    const noteType = video ? "video-note" : "note";
    const now = Date.now();

    const newNote = {
        id: now,
        pageTitle: getYouTubeTitle() || document.title,
        url: window.location.href,
        note: text,
        timestamp: timestamp,
        createdAt: now,
        type: noteType
    };

    chrome.runtime.sendMessage({ action: "saveNote", note: newNote }, (res) => {
        if (chrome.runtime.lastError) { /* suppress */ }
        if (input) input.value = '';
    });
}

// ============================================================
// 7. NOTE RENDERING
// ============================================================
function renderNotes() {
    const container = document.getElementById('ag-notes-list');
    if (!container) return;

    chrome.storage.local.get({ notes: [] }, (result) => {
        const notes = result.notes;
        container.innerHTML = '';

        if (notes.length === 0) {
            container.innerHTML = `<div class="ag-empty">No notes yet.<br>Navigate to a learning page and Antigravity will start capturing insights automatically.</div>`;
            return;
        }

        // Group by category
        const groups = {};
        notes.forEach(note => {
            const cat = note.category || "General Learning";
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(note);
        });

        Object.keys(groups).sort().forEach(category => {
            const groupNotes = groups[category];
            const groupEl = document.createElement('div');
            groupEl.className = 'ag-group';

            const headerBtn = document.createElement('button');
            headerBtn.className = 'ag-group-header';
            headerBtn.innerHTML = `<span>📂 ${escapeHtml(category)}</span> <span class="ag-group-badge">${groupNotes.length}</span>`;

            const itemsEl = document.createElement('div');
            itemsEl.className = 'ag-group-items'; // collapsed by default

            headerBtn.onclick = () => {
                itemsEl.classList.toggle('open');
            };

            groupNotes.forEach(note => {
                const noteEl = document.createElement('div');
                noteEl.className = 'ag-note';

                const typeIcon = note.type === 'video-note' ? '▶' : (note.type === 'auto-note' ? '🤖' : '📄');

                let tsHtml = '';
                if (note.timestamp !== null && note.timestamp !== undefined) {
                    tsHtml = `<span class="ag-timestamp" data-time="${note.timestamp}">[${formatTime(note.timestamp)}]</span>`;
                }

                noteEl.innerHTML = `
                    <span class="ag-note-icon">${typeIcon}</span>
                    <div class="ag-note-body">
                        <a href="${note.url}" target="_blank" class="ag-note-link">${tsHtml}${escapeHtml(note.note)}</a>
                        <div class="ag-note-meta">${escapeHtml(note.pageTitle)}</div>
                    </div>
                    <button class="ag-delete-btn" data-id="${note.id}" title="Remove">🗑️</button>
                `;

                // Timestamp click handler (seek)
                const tsEl = noteEl.querySelector('.ag-timestamp');
                if (tsEl) {
                    tsEl.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const video = document.querySelector("video");
                        if (video && window.location.href === note.url) {
                            video.currentTime = parseFloat(tsEl.dataset.time);
                            video.play();
                        }
                    });
                }

                // Delete handler
                noteEl.querySelector('.ag-delete-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    chrome.storage.local.get({ notes: [] }, (res) => {
                        const updated = res.notes.filter(n => n.id !== note.id);
                        chrome.storage.local.set({ notes: updated });
                    });
                });

                itemsEl.appendChild(noteEl);
            });

            groupEl.appendChild(headerBtn);
            groupEl.appendChild(itemsEl);
            container.appendChild(groupEl);
        });
    });
}

// ============================================================
// 8. LEARNING DETECTION + AUTO-FLOW
// ============================================================
function isLearningPage() {
    const learningKeywords = ['tutorial', 'lesson', 'course', 'lecture', 'guide', 'study', 'how to', 'introduction', 'explanation', 'documentation', 'learn', 'article'];
    const learningDomains = ['youtube.com', 'coursera.org', 'khanacademy.org', 'udemy.com', 'edx.org', 'stackoverflow.com', 'wikipedia.org', 'medium.com', 'github.com'];
    const title = (getYouTubeTitle() || document.title).toLowerCase();
    const url = window.location.href.toLowerCase();

    let score = 0;
    if (learningDomains.some(d => url.includes(d))) score += 2;
    if (learningKeywords.some(kw => title.includes(kw) || url.includes(kw))) score += 3;
    if (document.querySelector('video')) score += 2;
    if (document.querySelector('article')) score += 2;
    if (document.querySelectorAll('h1, h2, h3').length >= 4) score += 1;
    if (document.querySelectorAll('pre, code').length > 1) score += 2;

    const isLearning = score >= 4;
    chrome.runtime.sendMessage({ action: "pageStatus", isLearning }, () => {
        if (chrome.runtime.lastError) { }
    });
    return isLearning;
}

function autoExtractContent() {
    const paragraphs = Array.from(document.querySelectorAll('p, li'))
        .map(el => el.innerText.trim())
        .filter(text => text.length > 40 && text.length < 500);
    const definitions = paragraphs.filter(p => /is a|refers to|means|is defined as|concept of/i.test(p));
    if (definitions.length > 0) return definitions[0];
    if (paragraphs.length > 0) return paragraphs[0];
    return "Learning context identified.";
}

function showDetectionBadge() {
    const badge = document.getElementById('ag-badge');
    if (badge) badge.classList.add('visible');

    // Floating badge on page
    if (document.getElementById('ag-page-badge')) return;
    const el = document.createElement('div');
    el.id = 'ag-page-badge';
    el.innerText = "🎓 Antigravity Active";
    Object.assign(el.style, {
        position: 'fixed', bottom: '24px', left: '24px',
        background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
        color: '#fff', padding: '10px 18px', borderRadius: '20px',
        boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)',
        zIndex: '2147483640', fontFamily: 'sans-serif',
        fontWeight: '700', fontSize: '13px', transition: 'opacity 0.6s'
    });
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 600); }, 3000);
}

function runAutoFlow() {
    if (!isLearningPage()) return;
    showDetectionBadge();

    const content = autoExtractContent();
    const autoNote = {
        id: Date.now(),
        pageTitle: getYouTubeTitle() || document.title,
        url: window.location.href,
        note: content,
        timestamp: null,
        createdAt: Date.now(),
        type: "auto-note"
    };

    chrome.runtime.sendMessage({ action: "autoSaveNote", note: autoNote }, (res) => {
        if (chrome.runtime.lastError) { }
    });
}

// ============================================================
// 9. INIT
// ============================================================
function init() {
    injectSidebar();
    chrome.storage.local.get(['focusModeEnabled'], (res) => {
        if (res.focusModeEnabled) toggleFocusMode(true);
    });
}

// Delay init to not block page load
setTimeout(init, 800);
setTimeout(runAutoFlow, 2500);

// YouTube SPA support
if (window.location.hostname.includes('youtube.com')) {
    window.addEventListener('yt-navigate-finish', () => {
        setTimeout(() => {
            renderNotes(); // Refresh sidebar notes
            runAutoFlow();
        }, 3000);
    });
}
