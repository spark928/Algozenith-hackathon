// popup.js - LearnDock

document.addEventListener('DOMContentLoaded', () => {

    // ── Elements ────────────────────────────────────────────────
    const studyTimeEl = document.getElementById('studyTime');
    const progressFill = document.getElementById('progressFill');
    const timerSubtext = document.getElementById('timerSubtext');
    const focusToggle = document.getElementById('focusToggle');
    const noteText = document.getElementById('noteText');
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    const addPageBtn = document.getElementById('addPageBtn');
    const notesList = document.getElementById('notesList');
    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggleSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const sidebarGroups = document.getElementById('sidebarGroups');

    // Pomodoro Containers
    const pomodoroSetup = document.getElementById('pomodoroSetup');
    const pomodoroRunning = document.getElementById('pomodoroRunning');
    const pomodoroConfirm = document.getElementById('pomodoroConfirm');

    // Setup Elements
    const durationBtns = document.querySelectorAll('.duration-btn');
    const customDurationInput = document.getElementById('customDuration');
    const previewTime = document.getElementById('previewTime');
    const startFocusBtn = document.getElementById('startFocusBtn');
    const durationError = document.getElementById('durationError');

    // Confirm Elements
    const keepFocusingBtn = document.getElementById('keepFocusingBtn');
    const endSessionBtn = document.getElementById('endSessionBtn');
    const confirmRemaining = document.getElementById('confirmRemaining');

    // Blocked Sites Elements
    const toggleBlockedSites = document.getElementById('toggleBlockedSites');
    const blockedSitesPanel = document.getElementById('blockedSitesPanel');
    const blockedSitesList = document.getElementById('blockedSitesList');
    const newSiteInput = document.getElementById('newSiteInput');
    const addSiteBtn = document.getElementById('addSiteBtn');
    const blockedSitesArrow = document.getElementById('blockedSitesArrow');

    // ── Timer State ─────────────────────────────────────────────
    let selectedMins = 25;
    let timerPollInterval = null;

    // ── Init ────────────────────────────────────────────────────
    loadNotes();
    loadBlockedSites();
    refreshTimerUI();
    timerPollInterval = setInterval(refreshTimerUI, 1000);

    // ── Sidebar ─────────────────────────────────────────────────
    toggleSidebarBtn.addEventListener('click', () => sidebar.classList.add('active'));
    closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('active'));

    // ── Pomodoro Setup ──────────────────────────────────────────
    durationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            durationBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedMins = parseInt(btn.dataset.mins);
            customDurationInput.value = '';
            updatePreview();
        });
    });

    customDurationInput.addEventListener('input', () => {
        durationBtns.forEach(b => b.classList.remove('selected'));
        const val = parseInt(customDurationInput.value);
        if (val > 0 && val <= 180) {
            selectedMins = val;
            durationError.style.display = 'none';
        } else if (customDurationInput.value === '') {
            selectedMins = 0;
        } else {
            durationError.textContent = 'Please enter 1 to 180 minutes';
            durationError.style.display = 'block';
        }
        updatePreview();
    });

    function updatePreview() {
        previewTime.textContent =
            (selectedMins || 0) + ':00';
    }

    startFocusBtn.addEventListener('click', () => {
        if (selectedMins <= 0) {
            durationError.textContent = 'Please set a duration';
            durationError.style.display = 'block';
            return;
        }
        const durationSeconds = selectedMins * 60;
        chrome.runtime.sendMessage({
            action: "startPomodoro",
            duration: durationSeconds
        }, (res) => {
            if (res && res.ok) {
                refreshTimerUI();
            }
        });
    });

    function refreshTimerUI() {
        chrome.runtime.sendMessage({ action: "getPomodoroStatus" }, (res) => {
            if (res && res.running) {
                // Only switch back if we AREN'T in confirmation mode
                if (pomodoroConfirm.classList.contains('hidden')) {
                    pomodoroSetup.classList.add('hidden');
                    pomodoroRunning.classList.remove('hidden');
                }

                const rem = res.remaining;
                const total = res.total;
                const m = Math.floor(rem / 60);
                const s = rem % 60;
                studyTimeEl.textContent = `${pad(m)}:${pad(s)}`;

                const progress = ((total - rem) / total) * 100;
                progressFill.style.width = `${progress}%`;
                timerSubtext.textContent = `of ${Math.floor(total / 60)}:00 focus session`;

                chrome.storage.local.get(['focusModeEnabled'], (fs) => {
                    focusToggle.checked = !!fs.focusModeEnabled;
                });
            } else {
                // If not confirmed-stopping, show setup
                if (pomodoroConfirm.classList.contains('hidden')) {
                    pomodoroSetup.classList.remove('hidden');
                    pomodoroRunning.classList.add('hidden');
                }
            }
        });
    }

    // ── Focus Toggle (linked to timer) ───────────────────────────
    focusToggle.addEventListener('change', () => {
        if (!focusToggle.checked) {
            // Prepare confirmation
            chrome.runtime.sendMessage({ action: "getPomodoroStatus" }, (res) => {
                if (res && res.running) {
                    const m = Math.floor(res.remaining / 60);
                    const s = res.remaining % 60;
                    confirmRemaining.textContent =
                        `${pad(m)}:${pad(s)} remaining in your session`;

                    pomodoroRunning.classList.add('hidden');
                    pomodoroConfirm.classList.remove('hidden');
                    // Re-check because user hasn't confirmed yet
                    focusToggle.checked = true;
                } else {
                    // Not running anyway
                    chrome.storage.local.set({ focusModeEnabled: false });
                }
            });
        } else {
            chrome.storage.local.set({ focusModeEnabled: true });
        }
    });

    keepFocusingBtn.addEventListener('click', () => {
        pomodoroConfirm.classList.add('hidden');
        pomodoroRunning.classList.remove('hidden');
    });

    endSessionBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "stopPomodoro" }, () => {
            pomodoroConfirm.classList.add('hidden');
            pomodoroSetup.classList.remove('hidden');
            refreshTimerUI();
        });
    });

    // ── Blocked Sites Manager ───────────────────────────────────
    toggleBlockedSites.addEventListener('click', () => {
        blockedSitesPanel.classList.toggle('hidden');
        blockedSitesArrow.textContent =
            blockedSitesPanel.classList.contains('hidden') ? '▼' : '▲';
    });

    function loadBlockedSites() {
        chrome.storage.local.get(['blockedSites'], (res) => {
            const sites = res.blockedSites || [];
            blockedSitesList.innerHTML = '';
            sites.forEach(site => {
                const pill = document.createElement('div');
                pill.className = 'site-pill';
                pill.innerHTML = `
            <span>${site}</span>
            <span class="remove-site" data-site="${site}">✕</span>
          `;
                pill.querySelector('.remove-site').addEventListener('click', () => {
                    removeSite(site);
                });
                blockedSitesList.appendChild(pill);
            });
        });
    }

    addSiteBtn.addEventListener('click', () => {
        const site = newSiteInput.value.trim().toLowerCase()
            .replace(/https?:\/\//, '').split('/')[0];
        if (!site) return;
        chrome.storage.local.get(['blockedSites'], (res) => {
            const sites = res.blockedSites || [];
            if (!sites.includes(site)) {
                sites.push(site);
                chrome.storage.local.set({ blockedSites: sites }, () => {
                    newSiteInput.value = '';
                    loadBlockedSites();
                });
            }
        });
    });

    function removeSite(site) {
        chrome.storage.local.get(['blockedSites'], (res) => {
            const sites = (res.blockedSites || [])
                .filter(s => s !== site);
            chrome.storage.local.set({ blockedSites: sites }, loadBlockedSites);
        });
    }

    // ── Save Manual Note ────────────────────────────────────────
    saveNoteBtn.addEventListener('click', saveTypedNote);

    function saveTypedNote() {
        const text = noteText.value.trim();
        if (!text) return;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            const tab = tabs[0];
            chrome.tabs.sendMessage(tab.id, { action: "scanPage" }, (response) => {
                const now = Date.now();
                const hasVideo = response && response.video && response.video.exists;

                const newNote = {
                    id: now,
                    pageTitle: (response && response.title) || tab.title,
                    url: tab.url,
                    note: text,
                    timestamp: hasVideo ? response.video.currentTime : null,
                    createdAt: now,
                    type: hasVideo ? "video-note" : "note"
                };

                chrome.runtime.sendMessage({ action: "saveNote", note: newNote }, () => {
                    noteText.value = '';
                    setTimeout(loadNotes, 400);
                });
            });
        });
    }

    addPageBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            const tab = tabs[0];
            chrome.tabs.sendMessage(tab.id, { action: "scanPage" }, (response) => {
                const now = Date.now();
                const text = noteText.value.trim() || `📄 Page: ${tab.title}`;
                const hasVideo = response && response.video && response.video.exists;

                const newNote = {
                    id: now,
                    pageTitle: (response && response.title) || tab.title,
                    url: tab.url,
                    note: text,
                    timestamp: hasVideo ? response.video.currentTime : null,
                    createdAt: now,
                    type: hasVideo ? "video-note" : "note"
                };

                chrome.runtime.sendMessage({ action: "saveNote", note: newNote }, () => {
                    noteText.value = '';
                    addPageBtn.textContent = '✓ Added!';
                    setTimeout(() => { addPageBtn.textContent = '+ Add This Page'; }, 1500);
                    setTimeout(loadNotes, 400);
                });
            });
        });
    });

    // ── Load + Render Notes ─────────────────────────────────────
    function loadNotes() {
        chrome.storage.local.get({ notes: [] }, ({ notes }) => {
            notesList.innerHTML = '';
            sidebarGroups.innerHTML = '';

            if (notes.length === 0) {
                notesList.innerHTML = '<div class="empty-state">Scan a learning page to start collecting insights.</div>';
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
                const catEl = document.createElement('div');
                catEl.className = 'category-group';
                catEl.dataset.category = category;
                catEl.id = `group-${category.replace(/\s+/g, '-')}`;

                const header = document.createElement('div');
                header.className = 'category-header collapsed';
                header.innerHTML = `<span>📂 ${esc(category)}</span><span class="badge">${groupNotes.length}</span>`;

                const itemsEl = document.createElement('div');
                itemsEl.className = 'items-container hidden';

                header.onclick = () => {
                    itemsEl.classList.toggle('hidden');
                    header.classList.toggle('collapsed');
                };

                groupNotes.forEach(note => {
                    const noteEl = document.createElement('div');
                    noteEl.className = 'note-item';
                    const typeIcon = note.type === 'video-note' ? '▶' : note.type === 'auto-note' ? '🤖' : '📄';
                    let tsHtml = (note.timestamp !== null) ? `<span class="time-link" data-time="${note.timestamp}">[${formatTime(note.timestamp)}]</span> ` : '';

                    noteEl.innerHTML = `
                        <div class="note-row">
                            <div class="note-content">
                                <span class="note-type-icon">${typeIcon}</span>
                                <div class="note-body">
                                    <a href="${note.url}" target="_blank" class="note-link">${tsHtml}${esc(note.note)}</a>
                                </div>
                            </div>
                            <button class="delete-note-btn">🗑️</button>
                        </div>
                        <div class="note-meta">${esc(note.pageTitle)}</div>
                    `;

                    noteEl.querySelector('.delete-note-btn').onclick = (e) => {
                        e.stopPropagation();
                        chrome.storage.local.get({ notes: [] }, (res) => {
                            const updated = res.notes.filter(n => n.id !== note.id);
                            chrome.storage.local.set({ notes: updated }, loadNotes);
                        });
                    };

                    itemsEl.appendChild(noteEl);
                });

                catEl.appendChild(header);
                catEl.appendChild(itemsEl);
                notesList.appendChild(catEl);

                // Sidebar Link
                const sideLink = document.createElement('button');
                sideLink.className = 'sidebar-group-link';
                sideLink.innerHTML = `<span>📂 ${esc(category)}</span><span class="count">${groupNotes.length}</span>`;
                sideLink.onclick = () => {
                    sidebar.classList.remove('active');
                    const target = document.getElementById(`group-${category.replace(/\s+/g, '-')}`);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                        const items = target.querySelector('.items-container');
                        const hdr = target.querySelector('.category-header');
                        items.classList.remove('hidden');
                        hdr.classList.remove('collapsed');
                    }
                };
                sidebarGroups.appendChild(sideLink);
            });
        });
    }

    // ── Utilities ───────────────────────────────────────────────
    function pad(n) { return String(n).padStart(2, '0'); }
    function formatTime(secs) {
        const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    }
    function esc(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
    }
});