// content.js - LearnDock

// ============================================================
// 1. STATE & OBSERVERS
// ============================================================
let _focusObserver = null;
let _blockTimerInterval = null;
let _exceptionInterval = null;
const _hiddenByFocus = [];

const DISTRACTION_SELECTORS = [
    'ytd-watch-next-secondary-results-renderer',
    '#secondary', '#related', '#comments', 'ytd-comments',
    '.ytp-endscreen-content', '.ytp-ce-element',
    'ytd-rich-shelf-renderer[is-shorts]',
    'ytd-reel-shelf-renderer'
];

// ============================================================
// 2. MESSAGE LISTENER
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
// 3. FOCUS MODE BLOCKING
// ============================================================
function hideDistractions() {
    DISTRACTION_SELECTORS.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            if (el.style.display !== 'none') {
                el.dataset.ldOrigDisplay = el.style.display || '';
                el.style.display = 'none';
                _hiddenByFocus.push(el);
            }
        });
    });
}

function toggleFocusMode(enabled) {
    let focusStyle = document.getElementById('ld-focus-style');

    if (enabled) {
        // Inject CSS backup
        if (!focusStyle) {
            focusStyle = document.createElement('style');
            focusStyle.id = 'ld-focus-style';
            focusStyle.textContent = DISTRACTION_SELECTORS
                .join(',') + ' { display: none !important; }';
            document.head.appendChild(focusStyle);
        }
        // Hide elements already on page
        hideDistractions();
        // Watch for lazily loaded elements
        if (!_focusObserver) {
            _focusObserver = new MutationObserver(() => {
                hideDistractions();
            });
            _focusObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
        // Check blocked sites
        checkBlockedSite();

    } else {
        // Remove CSS
        if (focusStyle) focusStyle.remove();
        // Restore hidden elements
        _hiddenByFocus.forEach(el => {
            el.style.display = el.dataset.ldOrigDisplay || '';
            delete el.dataset.ldOrigDisplay;
        });
        _hiddenByFocus.length = 0;
        // Disconnect observer
        if (_focusObserver) {
            _focusObserver.disconnect();
            _focusObserver = null;
        }
        // Remove all UI elements
        const blockPage = document.getElementById('ld-block-page');
        if (blockPage) blockPage.remove();
        const banner = document.getElementById('ld-exception-banner');
        if (banner) banner.remove();

        if (_blockTimerInterval) {
            clearInterval(_blockTimerInterval);
            _blockTimerInterval = null;
        }
        if (_exceptionInterval) {
            clearInterval(_exceptionInterval);
            _exceptionInterval = null;
        }
    }
}

function checkBlockedSite() {
    const url = window.location.href;
    if (url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://')) return;

    chrome.storage.local.get(
        ['blockedSites', 'focusModeEnabled',
            'exceptionActive', 'exceptionExpiry'],
        (res) => {
            if (!res.focusModeEnabled) return;
            const domain = window.location.hostname
                .replace('www.', '');
            const blocked = (res.blockedSites || [
                'twitter.com', 'x.com', 'instagram.com',
                'reddit.com', 'facebook.com',
                'tiktok.com', 'netflix.com'
            ]).some(d => domain.includes(d));

            if (!blocked) return;

            // Check if exception is active
            if (res.exceptionActive &&
                res.exceptionExpiry > Date.now()) {
                showExceptionBanner(res.exceptionExpiry);
                return;
            }

            showBlockPage(domain);
        }
    );
}

function showBlockPage(domain) {
    if (document.getElementById('ld-block-page')) return;

    const quotes = [
        "Deep work is the superpower of the 21st century.",
        "The successful warrior is the average man, laser-focused.",
        "Your future self is watching you right now through memories.",
        "Discipline is choosing what you want most over what you want now.",
        "Focus is not saying yes — it is saying no to distractions."
    ];
    const quote = quotes[Math.floor(Math.random() * quotes.length)];

    const el = document.createElement('div');
    el.id = 'ld-block-page';
    Object.assign(el.style, {
        position: 'fixed', top: '0', left: '0',
        width: '100vw', height: '100vh',
        background: '#0f172a', color: 'white',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        zIndex: '2147483647', fontFamily: 'sans-serif',
        textAlign: 'center', padding: '40px',
        boxSizing: 'border-box'
    });

    el.innerHTML = `
    <div style="color:#3b82f6;font-size:22px;
                font-weight:800;margin-bottom:16px;">
      ⚓ LearnDock
    </div>
    <div style="font-size:52px;margin-bottom:16px;">🔒</div>
    <div style="font-size:20px;font-weight:700;
                margin-bottom:8px;">
      ${domain} is blocked
    </div>
    <div style="font-size:13px;color:#94a3b8;
                margin-bottom:24px;">
      during your Focus Session
    </div>
    <div style="font-size:13px;color:#94a3b8;
                margin-bottom:24px;" id="ld-block-timer">
      Loading session time...
    </div>
    <button id="ld-exception-btn"
            style="background:#f59e0b;color:white;
                   border:none;padding:12px 28px;
                   border-radius:8px;font-size:14px;
                   font-weight:700;cursor:pointer;
                   margin-bottom:10px;">
      I need 5 minutes
    </button>
    <div id="ld-exception-status"
         style="font-size:11px;color:#64748b;
                margin-bottom:32px;">
      Loading...
    </div>
    <div style="font-size:12px;color:#475569;
                font-style:italic;max-width:300px;">
      "${quote}"
    </div>
  `;

    document.body.appendChild(el);

    // Update pomodoro countdown on block page
    function updateBlockTimer() {
        chrome.runtime.sendMessage(
            { action: "getPomodoroStatus" },
            (res) => {
                const timerEl =
                    document.getElementById('ld-block-timer');
                if (!timerEl) return;
                if (res && res.running && res.remaining > 0) {
                    const m = Math.floor(res.remaining / 60);
                    const s = res.remaining % 60;
                    timerEl.textContent =
                        'Focus session: ' +
                        String(m).padStart(2, '0') + ':' +
                        String(s).padStart(2, '0') + ' remaining';
                } else {
                    timerEl.textContent = 'Session complete';
                }
            }
        );
    }
    updateBlockTimer();
    _blockTimerInterval = setInterval(updateBlockTimer, 1000);

    // Update exception status
    function updateExceptionStatus() {
        chrome.storage.local.get(
            ['exceptionCount', 'lastExceptionTime'], (res) => {
                const statusEl =
                    document.getElementById('ld-exception-status');
                if (!statusEl) return;
                const count = res.exceptionCount || 0;
                const last = res.lastExceptionTime;
                const minsSince = last
                    ? Math.floor((Date.now() - last) / 60000) : 999;
                const nextIn = Math.max(0, 60 - minsSince);

                if (count >= 4) {
                    statusEl.textContent =
                        'Maximum exceptions (4) used this session';
                    document.getElementById('ld-exception-btn')
                        .disabled = true;
                    document.getElementById('ld-exception-btn')
                        .style.opacity = '0.4';
                } else if (minsSince < 60 && last) {
                    statusEl.textContent =
                        count + ' of 4 used • Next available in '
                        + nextIn + 'm';
                } else {
                    statusEl.textContent =
                        count + ' of 4 exceptions used this session';
                }
            });
    }
    updateExceptionStatus();

    // Exception button click
    document.getElementById('ld-exception-btn')
        .addEventListener('click', () => {
            chrome.runtime.sendMessage(
                { action: "startException" },
                (res) => {
                    if (res && res.allowed) {
                        el.remove();
                        showExceptionBanner(
                            Date.now() + (5 * 60 * 1000)
                        );
                    } else if (res && res.reason === 'max_reached') {
                        document.getElementById('ld-exception-status')
                            .textContent =
                            'Maximum exceptions (4) used this session';
                    } else if (res && res.reason === 'too_soon') {
                        document.getElementById('ld-exception-status')
                            .textContent =
                            'Next exception available in '
                            + res.remaining + ' minutes';
                    }
                }
            );
        });
}

function showExceptionBanner(expiry) {
    if (document.getElementById('ld-exception-banner'))
        return;
    const banner = document.createElement('div');
    banner.id = 'ld-exception-banner';
    Object.assign(banner.style, {
        position: 'fixed', top: '0', left: '0',
        width: '100%', background: '#f59e0b',
        color: 'white', textAlign: 'center',
        padding: '10px', zIndex: '2147483647',
        fontFamily: 'sans-serif', fontWeight: '700',
        fontSize: '13px'
    });
    document.body.appendChild(banner);

    _exceptionInterval = setInterval(() => {
        const remaining = Math.max(0,
            Math.floor((expiry - Date.now()) / 1000));
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        banner.textContent = '⏱ Exception: ' +
            String(m).padStart(2, '0') + ':' +
            String(s).padStart(2, '0') +
            ' remaining — site will be blocked again';
        if (remaining <= 0) {
            clearInterval(_exceptionInterval);
            _exceptionInterval = null;
            banner.remove();
            chrome.storage.local.set({ exceptionActive: false });
            checkBlockedSite();
        }
    }, 1000);
}

// ============================================================
// 4. HELPERS
// ============================================================
function getYouTubeTitle() {
    if (!window.location.hostname.includes('youtube.com')) return null;
    const el = document.querySelector("h1.title yt-formatted-string") ||
        document.querySelector("yt-formatted-string.ytd-video-primary-info-renderer") ||
        document.querySelector("h1.ytd-watch-metadata yt-formatted-string");
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
// 5. SMARTER LEARNING PAGE DETECTION
// ============================================================
function isLearningPage() {

    const learningDomains = [
        'youtube.com', 'coursera.org', 'khanacademy.org', 'udemy.com',
        'edx.org', 'stackoverflow.com', 'wikipedia.org', 'medium.com',
        'github.com', 'dev.to', 'freecodecamp.org', 'w3schools.com',
        'geeksforgeeks.org', 'leetcode.com', 'hackerrank.com',
        'codecademy.org', 'towardsdatascience.com', 'arxiv.org',
        'developer.mozilla.org', 'docs.microsoft.com',
        'researchgate.net', 'docs.python.org'
    ];

    const learningKeywords = [
        'tutorial', 'lesson', 'course', 'lecture', 'guide', 'study',
        'how to', 'howto', 'introduction', 'explanation',
        'documentation', 'learn', 'article', 'explained', 'beginner',
        'advanced', 'complete guide', 'step by step', 'crash course',
        'deep dive', 'fundamentals', 'basics', 'overview',
        'walkthrough', 'cheatsheet', 'reference', 'manual'
    ];

    const title = (getYouTubeTitle() || document.title).toLowerCase();
    const url = window.location.href.toLowerCase();

    // skip chrome pages and extension pages
    if (url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://')) return false;

    let score = 0;

    // SIGNAL 1: Known learning domain (strong)
    if (learningDomains.some(d => url.includes(d))) score += 4;

    // SIGNAL 2: Learning keyword in title or URL (strong)
    if (learningKeywords.some(kw =>
        title.includes(kw) || url.includes(kw))) score += 3;

    // SIGNAL 3: Page has structured headings
    const headings = document.querySelectorAll('h1,h2,h3,h4');
    if (headings.length >= 3) score += 2;
    if (headings.length >= 6) score += 1;

    // SIGNAL 4: Page has code blocks
    const codeBlocks = document.querySelectorAll(
        'pre,code,[class*="language-"],[class*="hljs"],' +
        '[class*="syntax"],[class*="highlight"]'
    );
    if (codeBlocks.length >= 1) score += 2;
    if (codeBlocks.length >= 3) score += 1;

    // SIGNAL 5: Page has substantial text content
    const paragraphs = Array.from(document.querySelectorAll('p'))
        .map(p => p.innerText.trim())
        .filter(t => t.length > 0);
    const longParagraphs = paragraphs.filter(t => t.length > 100);
    const totalWords = paragraphs.join(' ').split(/\s+/).length;
    if (totalWords > 300) score += 2;
    if (totalWords > 1000) score += 1;
    if (longParagraphs.length >= 3) score += 1;

    // SIGNAL 6: Page has article/main content container
    if (document.querySelector(
        'article,main,[role="main"],' +
        '[class*="article"],[class*="post-content"],' +
        '[class*="blog-content"],[class*="entry-content"],' +
        '[class*="lesson"],[class*="tutorial"],' +
        '[class*="doc-content"],[class*="documentation"]'
    )) score += 2;

    // SIGNAL 7: Table of contents (very strong learning signal)
    if (document.querySelector(
        '[class*="table-of-contents"],[class*="toc"],' +
        '[id*="toc"],[id*="table-of-contents"]'
    )) score += 3;

    // SIGNAL 8: Educational writing phrases in text
    const pageText = (document.body
        ? document.body.innerText : '').toLowerCase().slice(0, 3000);
    const eduPhrases = [
        'is defined as', 'refers to', 'in this tutorial',
        'in this article', 'in this guide', 'you will learn',
        'we will learn', 'step 1', 'step 2', 'by the end of',
        'for example', 'for instance', 'note that', 'important:',
        'key concept', 'what is', 'how does', 'why is',
        'in simple terms', 'to summarize', 'prerequisites'
    ];
    const phraseMatches = eduPhrases.filter(p =>
        pageText.includes(p)
    ).length;
    if (phraseMatches >= 2) score += 2;
    if (phraseMatches >= 5) score += 2;

    // SIGNAL 9: Has video (YouTube etc)
    if (document.querySelector('video')) score += 1;

    // SIGNAL 10: Lists suggest structured content
    const lists = document.querySelectorAll('ul,ol');
    if (lists.length >= 2) score += 1;

    // SIGNAL 11: Math/science content
    if (document.querySelector(
        '.math,.katex,.mathjax,[class*="equation"],' +
        '[class*="formula"]'
    )) score += 2;

    // PENALTY: Signs this is NOT a learning page
    if (document.querySelector(
        '[class*="feed"],[class*="timeline"],' +
        '[class*="newsfeed"],[class*="stories"]'
    )) score -= 3;
    if (title.includes('login') ||
        title.includes('sign up') ||
        title.includes('sign in')) score -= 4;
    if (totalWords < 100 &&
        !document.querySelector('video')) score -= 3;

    const isLearning = score >= 3;

    chrome.runtime.sendMessage(
        { action: "pageStatus", isLearning },
        () => { if (chrome.runtime.lastError) { } }
    );

    return isLearning;
}

// ============================================================
// 6. SMARTER CONTENT EXTRACTION
// ============================================================
function autoExtractContent() {

    // PRIORITY 1: Explicit definition sentences
    const allElements = Array.from(document.querySelectorAll(
        'p,li,dd,blockquote,' +
        '[class*="definition"],[class*="description"],' +
        '[class*="summary"],[class*="intro"],[class*="overview"]'
    )).map(el => el.innerText.trim())
        .filter(t => t.length > 40 && t.length < 600);

    const defPatterns = [
        /is defined as/i, /refers to/i, /is a type of/i,
        /means that/i, /is known as/i, /is called/i,
        /is used to/i, /in simple terms/i, /simply put/i,
        /to summarize/i, /in other words/i, /concept of/i
    ];
    const definition = allElements.find(t =>
        defPatterns.some(p => p.test(t))
    );
    if (definition) return definition;

    // PRIORITY 2: First paragraph inside article or main content
    const articlePara = Array.from(document.querySelectorAll(
        'article p, main p, [role="main"] p,' +
        '[class*="content"] p,[class*="article"] p,' +
        '[class*="post"] p,[class*="entry"] p'
    )).map(el => el.innerText.trim())
        .find(t => t.length > 60 && t.length < 600);
    if (articlePara) return articlePara;

    // PRIORITY 3: Meta description
    const meta = document.querySelector('meta[name="description"]');
    if (meta && meta.content && meta.content.length > 40) {
        return meta.content;
    }

    // PRIORITY 4: First heading + its next paragraph
    const firstHeading = document.querySelector('h2,h3');
    if (firstHeading) {
        const next = firstHeading.nextElementSibling;
        if (next && next.innerText && next.innerText.length > 40) {
            return firstHeading.innerText.trim() + ': ' +
                next.innerText.trim().slice(0, 300);
        }
    }

    // PRIORITY 5: Any decent length paragraph
    if (allElements.length > 0) return allElements[0];

    return document.title + ' — captured by LearnDock';
}

// ============================================================
// 7. AUTO-FLOW
// ============================================================
function showDetectionBadge() {
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
    if (!isLearningPage()) return false;
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
    chrome.runtime.sendMessage(
        { action: "autoSaveNote", note: autoNote },
        () => { if (chrome.runtime.lastError) { } }
    );
    return true;
}

function tryAutoFlow() {
    const detected = runAutoFlow();
    if (!detected) setTimeout(runAutoFlow, 3000);
}

// ============================================================
// 8. SIDEBAR INJECTION & RENDERING
// ============================================================
// [Existing sidebar injection and rendering logic... keeping working functionality as requested]
// [Detailed implementation of injectSidebar and renderNotes goes here, updated for rebranding]

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
            <button class="ld-icon-btn" id="ld-theme-btn" title="Toggle Theme">🌙</button>
            <button class="ld-icon-btn" id="ld-close-btn" title="Close">✕</button>
        </div>
        <div id="ld-controls">
            <input type="text" id="ld-note-input" placeholder="Add a note..." autocomplete="off"/>
            <button id="ld-save-btn">Save</button>
        </div>
        <div id="ld-notes-list"></div>
    `;
    document.body.appendChild(sidebar);

    chrome.storage.local.get(['ldTheme'], (res) => {
        applyTheme(res.ldTheme || 'light');
    });

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

    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('ld-open');
        if (sidebar.classList.contains('ld-open')) renderNotes();
    });

    document.getElementById('ld-close-btn').addEventListener('click', () => {
        sidebar.classList.remove('ld-open');
    });

    document.getElementById('ld-save-btn').addEventListener('click', saveManualNote);
    document.getElementById('ld-note-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveManualNote();
    });

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.notes && sidebar.classList.contains('ld-open')) renderNotes();
    });

    renderNotes();
}

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
        if (input) input.value = '';
    });
}

function renderNotes() {
    const container = document.getElementById('ld-notes-list');
    if (!container) return;

    chrome.storage.local.get({ notes: [] }, (result) => {
        const notes = result.notes;
        container.innerHTML = '';

        if (notes.length === 0) {
            container.innerHTML = `<div class="ld-empty">No notes yet. Capture some insights!</div>`;
            return;
        }

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

            const headerBtn = document.createElement('button');
            headerBtn.className = 'ld-group-header';
            headerBtn.innerHTML = `<span class="ld-group-title">📂 ${category}</span><span class="ld-group-badge">${groupNotes.length}</span>`;

            const itemsEl = document.createElement('div');
            itemsEl.className = 'ld-group-items';

            headerBtn.onclick = () => itemsEl.classList.toggle('open');

            groupNotes.forEach(note => {
                const noteEl = document.createElement('div');
                noteEl.className = 'ld-note';
                const typeIcon = note.type === 'video-note' ? '▶' : (note.type === 'auto-note' ? '🤖' : '📄');
                let tsHtml = note.timestamp !== null ? `<span class="ld-timestamp">[${formatTime(note.timestamp)}]</span>` : '';

                noteEl.innerHTML = `
                    <span class="ld-note-icon">${typeIcon}</span>
                    <div class="ld-note-body">
                        <a href="${note.url}" target="_blank" class="ld-note-link">${tsHtml}${escapeHtml(note.note)}</a>
                        <div class="ld-note-meta">${escapeHtml(note.pageTitle)}</div>
                    </div>
                    <button class="ld-delete-btn">🗑️</button>
                `;

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
setTimeout(tryAutoFlow, 2500);

// YouTube SPA
if (window.location.hostname.includes('youtube.com')) {
    window.addEventListener('yt-navigate-finish', () => {
        setTimeout(() => {
            renderNotes();
            tryAutoFlow();
        }, 3000);
    });
}