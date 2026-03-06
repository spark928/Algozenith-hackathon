// popup.js - Antigravity

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const studyTimeEl = document.getElementById('studyTime');
    const resetTimerBtn = document.getElementById('resetTimer');
    const focusToggle = document.getElementById('focusToggle');
    const noteText = document.getElementById('noteText');
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    const notesList = document.getElementById('notesList');
    const learningBadge = document.getElementById('learningStatus');

    // Sidebar Elements
    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggleSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const sidebarGroups = document.getElementById('sidebarGroups');

    // Load Initial State
    loadStudyTime();
    loadNotes();

    chrome.storage.local.get(['focusModeEnabled'], (res) => {
        focusToggle.checked = !!res.focusModeEnabled;
    });

    setInterval(loadStudyTime, 5000);

    // Initial check for script activity
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "ping" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log("[Antigravity] Content script not active on this page.");
                } else {
                    console.log("[Antigravity] Connection established.");
                    checkLearningStatus(tabs[0]);
                }
            });
        }
    });

    // Sidebar Logic
    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.add('active');
    });

    closeSidebarBtn.addEventListener('click', () => {
        sidebar.classList.remove('active');
    });

    // Focus Mode Toggle
    focusToggle.addEventListener('change', () => {
        const enabled = focusToggle.checked;
        chrome.storage.local.set({ focusModeEnabled: enabled });
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { action: "toggleFocusMode", enabled: enabled }, (res) => {
                    if (chrome.runtime.lastError) { }
                });
            });
        });
    });

    // Save Manual Note
    saveNoteBtn.addEventListener('click', () => {
        const text = noteText.value.trim();
        if (!text) return;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];

            chrome.tabs.sendMessage(tab.id, { action: "scanPage" }, (response) => {
                const now = Date.now();
                let timestamp = null;
                let noteType = "note";

                if (response && response.video && response.video.exists) {
                    timestamp = response.video.currentTime;
                    noteType = "video-note";
                }

                const newNote = {
                    id: now,
                    pageTitle: (response && response.title) || tab.title,
                    url: tab.url,
                    note: text,
                    timestamp: timestamp,
                    createdAt: now,
                    type: noteType
                };

                chrome.runtime.sendMessage({ action: "saveNote", note: newNote }, (res) => {
                    noteText.value = '';
                    setTimeout(loadNotes, 500);
                });
            });
        });
    });

    resetTimerBtn.addEventListener('click', () => {
        chrome.storage.local.set({ studyTimeToday: 0 }, loadStudyTime);
    });

    function loadStudyTime() {
        chrome.storage.local.get(['studyTimeToday'], (res) => {
            const seconds = res.studyTimeToday || 0;
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            studyTimeEl.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        });
    }

    function checkLearningStatus(tab) {
        const url = tab.url;
        const educationDomains = ['youtube.com', 'coursera.org', 'khanacademy.org', 'stackoverflow.com', 'wikipedia.org'];
        if (educationDomains.some(d => url.includes(d))) {
            learningBadge.classList.remove('hidden');
        }
    }

    function loadNotes() {
        chrome.storage.local.get({ notes: [] }, (result) => {
            const notes = result.notes;
            notesList.innerHTML = '';
            sidebarGroups.innerHTML = '';

            if (notes.length === 0) {
                notesList.innerHTML = '<div class="empty-state">Scan a learning page to start collecting insights and map your journey.</div>';
                sidebarGroups.innerHTML = '<div class="empty-state" style="font-size: 11px; padding: 10px;">No groups identified.</div>';
                return;
            }

            const groups = {};
            notes.forEach(note => {
                const cat = note.category || "General Learning";
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(note);
            });

            const sortedCategories = Object.keys(groups).sort();

            sortedCategories.forEach(category => {
                const groupNotes = groups[category];

                // 1. Render in Main Timeline
                const catEl = document.createElement('div');
                catEl.className = 'category-group';
                catEl.id = `group-${category.replace(/\s+/g, '-')}`;

                const header = document.createElement('div');
                header.className = 'category-header collapsed';
                header.innerHTML = `<span>📂 ${escapeHtml(category)}</span> <span class="badge">${groupNotes.length}</span>`;

                const itemsEl = document.createElement('div');
                itemsEl.className = 'items-container hidden';

                header.onclick = () => {
                    itemsEl.classList.toggle('hidden');
                    header.classList.toggle('collapsed');
                };

                groupNotes.forEach(note => {
                    const noteEl = document.createElement('div');
                    noteEl.className = 'note-item';
                    const typeIcon = note.type === 'video-note' ? '▶' : (note.type === 'auto-note' ? '🤖' : '📄');

                    let timestampStr = "";
                    if (note.timestamp !== null && note.timestamp !== undefined) {
                        timestampStr = `<span class="time-link" data-time="${note.timestamp}">[${formatTime(note.timestamp)}]</span> `;
                    }

                    noteEl.innerHTML = `
                        <div class="note-row">
                            <div class="note-content">
                                <span class="note-type-icon">${typeIcon}</span> 
                                <div class="note-body">
                                    <a href="${note.url}" target="_blank" class="note-link">${timestampStr}${escapeHtml(note.note)}</a>
                                </div>
                            </div>
                            <button class="delete-note-btn" data-id="${note.id}" title="Remove Observation">🗑️</button>
                        </div>
                        <div class="note-meta">
                            <span class="page-title">${escapeHtml(note.pageTitle)}</span>
                        </div>
                    `;

                    // Maintain Video Sync (Seek)
                    const timeLink = noteEl.querySelector('.time-link');
                    if (timeLink) {
                        timeLink.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                                if (tabs[0] && tabs[0].url === note.url) {
                                    chrome.tabs.sendMessage(tabs[0].id, {
                                        action: "seekTo",
                                        timestamp: parseFloat(timeLink.dataset.time)
                                    }, (res) => {
                                        if (chrome.runtime.lastError) { }
                                    });
                                }
                            });
                        };
                    }

                    // Delete Handler
                    const deleteBtn = noteEl.querySelector('.delete-note-btn');
                    deleteBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteNote(note.id);
                    };

                    itemsEl.appendChild(noteEl);
                });

                catEl.appendChild(header);
                catEl.appendChild(itemsEl);
                notesList.appendChild(catEl);

                // 2. Render in Sidebar
                const sideLink = document.createElement('button');
                sideLink.className = 'sidebar-group-link';
                sideLink.innerHTML = `<span>📂 ${escapeHtml(category)}</span> <span class="count">${groupNotes.length}</span>`;
                sideLink.onclick = () => {
                    // Close sidebar and scroll to group in timeline
                    sidebar.classList.remove('active');
                    const target = document.getElementById(`group-${category.replace(/\s+/g, '-')}`);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                        // Optionally auto-expand
                        const items = target.querySelector('.items-container');
                        const header = target.querySelector('.category-header');
                        if (items.classList.contains('hidden')) {
                            items.classList.remove('hidden');
                            header.classList.remove('collapsed');
                        }
                    }
                };
                sidebarGroups.appendChild(sideLink);
            });
        });
    }

    function deleteNote(noteId) {
        chrome.storage.local.get({ notes: [] }, (result) => {
            const updatedNotes = result.notes.filter(n => n.id !== noteId);
            chrome.storage.local.set({ notes: updatedNotes }, () => {
                loadNotes();
            });
        });
    }

    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
    }
});
