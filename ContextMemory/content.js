// content.js - LearnDock v2.0

// ============================================================
// 1. MESSAGE LISTENER
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
    let focusStyle = document.getElementById('ld-focus-style');
    if (enabled) {
        if (!focusStyle) {
            focusStyle = document.createElement('style');
            focusStyle.id = 'ld-focus-style';
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
    if (document.getElementById('learndock-sidebar')) return;

    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'learndock-toggle';
    toggleBtn.innerHTML = '⚓';
    toggleBtn.title = 'Open LearnDock';
    document.body.appendChild(toggleBtn);

    // Sidebar
    const sidebar = document.createElement('div');
    sidebar.id = 'learndock-sidebar';
    sidebar.innerHTML = `
        <div id="ld-header">
            <h2>⚓ LearnDock</h2>
            <span id="ld-badge">🎓 Learning</span>
            <button class="ld-icon-btn" id="ld-theme-btn" title="Toggle Theme">🌙</button>
            <button class="ld-icon-btn" id="ld-close-btn" title="Close">✕</button>
        </div>
        <div id="ld-controls">
            <input type="text" id="ld-note-input" placeholder="Add a note..." autocomplete="off"/>
            <button id="ld-save-btn">Save</button>
        </div>
        <div id="ld-timer-bar">
            <span id="ld-timer-label">Study Time Today</span>
            <span id="ld-study-time">00:00:00</span>
        </div>
        <div id="ld-notes-list"></div>
    `;
    document.body.appendChild(sidebar);

    // Load persisted theme
    chrome.storage.local.get(['ldTheme'], (res) => {
        const theme = res.ldTheme || 'light';
        applyTheme(theme);
    });

    // Theme toggle
    document.getElementById('ld-theme-btn').addEventListener('click', () => {
        const isDark = sidebar.classList.contains('ld-dark');
        const newTheme = isDark ? 'light' : 'dark';
        applyTheme(newTheme);
        chrome.storage.local.set({ ldTheme: newTheme });
    });

    function applyTheme(theme) {
        const btn = document.getElementById('ld-theme-btn');
        if (theme === 'dark') {
            sidebar.classList.add('ld-dark');
            if (btn) btn.textContent = '☀️';
        } else {
            sidebar.classList.remove('ld-dark');
            if (btn) btn.textContent = '🌙';
        }
    }

    // Toggle sidebar open/close
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('ld-open');
        if (sidebar.classList.contains('ld-open')) renderNotes();
    });

    document.getElementById('ld-close-btn').addEventListener('click', () => {
        sidebar.classList.remove('ld-open');
    });

    // Save note
    document.getElementById('ld-save-btn').addEventListener('click', saveManualNote);
    document.getElementById('ld-note-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveManualNote();
    });

    // Live storage listener
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.notes && sidebar.classList.contains('ld-open')) {
            renderNotes();
        }
        if (changes.studyTimeToday) {
            updateTimer(changes.studyTimeToday.newValue || 0);
        }
    });

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
    const el = document.getElementById('ld-study-time');
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
    const input = document.getElementById('ld-note-input');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    const video = document.querySelector("video");
    const timestamp = video ? video.currentTime : null;
    const now = Date.now();

    const newNote = {
        id: now,
        pageTitle: getYouTubeTitle() || document.title,
        url: window.location.href,
        note: text,
        timestamp: timestamp,
        createdAt: now,
        type: video ? "video-note" : "note"
    };

    chrome.runtime.sendMessage({ action: "saveNote", note: newNote }, () => {
        if (chrome.runtime.lastError) { }
        if (input) input.value = '';
    });
}

// ============================================================
// 7. NOTE RENDERING — Sidebar (Drag & Drop + Group Rename)
// ============================================================

// Drag state — tracks which note is currently being dragged
let _dragNoteId = null;

function renderNotes() {
    const container = document.getElementById('ld-notes-list');
    if (!container) return;

    chrome.storage.local.get({ notes: [] }, (result) => {
        const notes = result.notes;
        container.innerHTML = '';

        if (notes.length === 0) {
            container.innerHTML = `<div class="ld-empty">No notes yet.<br>Navigate to a learning page — LearnDock will start capturing insights automatically.</div>`;
            return;
        }

        // ── Group notes by category ─────────────────────────
        const groups = {};
        notes.forEach(note => {
            const cat = note.category || "General Learning";
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(note);
        });

        Object.keys(groups).sort().forEach(category => {
            const groupNotes = groups[category];
            const groupEl = document.createElement('div');
            groupEl.className = 'ld-group';
            groupEl.dataset.category = category;

            // ── Drop target: highlight on hover, move note on drop ──
            groupEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                groupEl.classList.add('ld-drag-over');
            });
            groupEl.addEventListener('dragleave', (e) => {
                // Avoid flicker when cursor moves over child elements
                if (!groupEl.contains(e.relatedTarget)) {
                    groupEl.classList.remove('ld-drag-over');
                }
            });
            groupEl.addEventListener('drop', (e) => {
                e.preventDefault();
                groupEl.classList.remove('ld-drag-over');
                const targetCat = groupEl.dataset.category;

                // ── Persistence: STEP 2 (Read ID from dataTransfer) ──
                // Using "noteId" key to match popup.js logic for cross-interface consistency.
                const noteId = parseInt(e.dataTransfer.getData("noteId"), 10);
                if (!noteId || targetCat === category) return;

                // ── Persistence: STEP 3 (Update Storage) ────────────
                // We update storage directly here. The storage.onChanged listener
                // will automatically trigger renderNotes() for STEP 4 (Re-render).
                chrome.storage.local.get({ notes: [] }, (res) => {
                    const updatedNotes = res.notes.map(n =>
                        n.id === noteId ? { ...n, category: targetCat } : n
                    );
                    chrome.storage.local.set({ notes: updatedNotes });
                });

                _dragNoteId = null;
            });

            // ── Group header with collapse toggle + rename ───
            const headerBtn = document.createElement('button');
            headerBtn.className = 'ld-group-header';

            // Title span (replaced by input during rename)
            const titleSpan = document.createElement('span');
            titleSpan.className = 'ld-group-title';
            titleSpan.textContent = `📂 ${category}`;

            // Note count badge
            const badge = document.createElement('span');
            badge.className = 'ld-group-badge';
            badge.textContent = groupNotes.length;

            // ✏️ Rename button — appears on header hover
            const renameBtn = document.createElement('button');
            renameBtn.className = 'ld-rename-btn';
            renameBtn.title = 'Rename group';
            renameBtn.textContent = '✏️';
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // don't trigger collapse
                _startSidebarRename(category, titleSpan, groupEl);
            });

            // Append elements to header
            headerBtn.appendChild(titleSpan);
            headerBtn.appendChild(badge);
            headerBtn.appendChild(renameBtn);

            // Items container (collapsed by default)
            const itemsEl = document.createElement('div');
            itemsEl.className = 'ld-group-items';

            // Click header (not rename btn) to toggle collapse
            headerBtn.onclick = (e) => {
                if (e.target === renameBtn) return;
                itemsEl.classList.toggle('open');
            };

            // ── Build note items ─────────────────────────────
            groupNotes.forEach(note => {
                const noteEl = document.createElement('div');
                noteEl.className = 'ld-note';

                // Make note draggable
                noteEl.draggable = true;
                noteEl.dataset.noteId = note.id;

                const typeIcon = note.type === 'video-note' ? '▶' :
                    (note.type === 'auto-note' ? '🤖' : '📄');

                let tsHtml = '';
                if (note.timestamp !== null && note.timestamp !== undefined) {
                    tsHtml = `<span class="ld-timestamp" data-time="${note.timestamp}">[${formatTime(note.timestamp)}]</span>`;
                }

                noteEl.innerHTML = `
                    <span class="ld-note-icon">${typeIcon}</span>
                    <div class="ld-note-body">
                        <a href="${note.url}" target="_blank" class="ld-note-link">${tsHtml}${escapeHtml(note.note)}</a>
                        <div class="ld-note-meta">${escapeHtml(note.pageTitle)}</div>
                    </div>
                    <button class="ld-delete-btn" title="Remove">🗑️</button>
                `;

                // ── Persistence: STEP 1 (Store ID on Drag Start) ────
                // We use "noteId" to serialize the note's identity during the drag.
                noteEl.addEventListener('dragstart', (e) => {
                    _dragNoteId = note.id;

                    // Encode ID in dataTransfer so the drop handler can read it reliably
                    e.dataTransfer.setData("noteId", String(note.id));
                    e.dataTransfer.effectAllowed = 'move';
                    noteEl.classList.add('ld-dragging');

                    // Collapse the source group so other groups become visible while dragging.
                    // Using setTimeout(..., 0) ensures this happens AFTER the drag is fully initiated,
                    // preventing the group from collapsing during a simple press-and-hold (mousedown).
                    setTimeout(() => {
                        const sourceGroup = noteEl.closest('.ld-group');
                        if (sourceGroup) {
                            const srcItems = sourceGroup.querySelector('.ld-group-items');
                            if (srcItems && srcItems.classList.contains('open')) {
                                srcItems.classList.remove('open');
                            }
                        }
                    }, 0);
                });
                noteEl.addEventListener('dragend', () => {
                    _dragNoteId = null;
                    noteEl.classList.remove('ld-dragging');
                    // Clean up any stray drag-over highlights
                    document.querySelectorAll('.ld-drag-over')
                        .forEach(el => el.classList.remove('ld-drag-over'));
                });

                // Timestamp seek on click
                const tsEl = noteEl.querySelector('.ld-timestamp');
                if (tsEl) {
                    tsEl.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const video = document.querySelector("video");
                        if (video) {
                            video.currentTime = parseFloat(tsEl.dataset.time);
                            video.play();
                        }
                    });
                }

                // Delete note
                noteEl.querySelector('.ld-delete-btn').addEventListener('click', (e) => {
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

/**
 * Inline rename for a sidebar group:
 * Replaces the title span with an <input>, persists on Enter/blur.
 * Sends renameGroup message to background.js on confirm.
 */
function _startSidebarRename(oldName, titleSpan, groupEl) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldName;
    input.className = 'ld-rename-input';
    input.onclick = (e) => e.stopPropagation();

    titleSpan.replaceWith(input);
    input.focus();
    input.select();

    function applyRename() {
        const newName = input.value.trim();
        if (!newName || newName === oldName) {
            input.replaceWith(titleSpan); // cancelled — restore original
            return;
        }

        // Optimistic UI update
        titleSpan.textContent = `📂 ${newName}`;
        input.replaceWith(titleSpan);
        groupEl.dataset.category = newName;

        // Persist: rename all notes in this group
        chrome.runtime.sendMessage(
            { action: "renameGroup", oldName, newName },
            () => {
                if (chrome.runtime.lastError) {
                    // Fallback: update storage directly
                    chrome.storage.local.get({ notes: [] }, (res) => {
                        const updated = res.notes.map(n =>
                            n.category === oldName ? { ...n, category: newName } : n
                        );
                        chrome.storage.local.set({ notes: updated });
                    });
                }
            }
        );
    }

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyRename();
        if (e.key === 'Escape') input.replaceWith(titleSpan);
    });
    input.addEventListener('blur', applyRename);
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
    const badge = document.getElementById('ld-badge');
    if (badge) badge.classList.add('visible');

    if (document.getElementById('ld-page-badge')) return;
    const el = document.createElement('div');
    el.id = 'ld-page-badge';
    el.innerText = "⚓ LearnDock Active";
    Object.assign(el.style, {
        position: 'fixed', bottom: '24px', left: '24px',
        background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        color: '#fff', padding: '10px 18px', borderRadius: '20px',
        boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
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

    chrome.runtime.sendMessage({ action: "autoSaveNote", note: autoNote }, () => {
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

setTimeout(init, 800);
setTimeout(runAutoFlow, 2500);

// YouTube SPA
if (window.location.hostname.includes('youtube.com')) {
    window.addEventListener('yt-navigate-finish', () => {
        setTimeout(() => {
            renderNotes();
            runAutoFlow();
        }, 3000);
    });
}