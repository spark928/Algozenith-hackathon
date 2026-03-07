// popup.js - LearnDock v2.1
// Features: Note groups, manual save, drag-and-drop between groups,
//           inline group rename, "Add Current Page" button

document.addEventListener('DOMContentLoaded', () => {

    // ── Elements ────────────────────────────────────────────────
    const studyTimeEl = document.getElementById('studyTime');
    const resetTimerBtn = document.getElementById('resetTimer');
    const focusToggle = document.getElementById('focusToggle');
    const noteText = document.getElementById('noteText');
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    const addPageBtn = document.getElementById('addPageBtn');
    const notesList = document.getElementById('notesList');
    const learningBadge = document.getElementById('learningStatus');
    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggleSidebar');
    const closeSidebarBtn = document.getElementById('closeSidebar');
    const sidebarGroups = document.getElementById('sidebarGroups');

    // ── Drag-and-Drop state ─────────────────────────────────────
    // Tracks which note element is being dragged
    let draggedNoteId = null;
    let draggedNoteEl = null;

    // ── Init ────────────────────────────────────────────────────
    loadStudyTime();
    loadNotes();

    chrome.storage.local.get(['focusModeEnabled'], (res) => {
        focusToggle.checked = !!res.focusModeEnabled;
    });

    setInterval(loadStudyTime, 5000);

    // Ping content script to confirm it's alive
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "ping" }, () => {
                if (chrome.runtime.lastError) return;
                checkLearningStatus(tabs[0]);
            });
        }
    });

    // ── Sidebar navigation ──────────────────────────────────────
    toggleSidebarBtn.addEventListener('click', () => sidebar.classList.add('active'));
    closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('active'));

    // ── Focus Mode ──────────────────────────────────────────────
    focusToggle.addEventListener('change', () => {
        const enabled = focusToggle.checked;
        chrome.storage.local.set({ focusModeEnabled: enabled });
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { action: "toggleFocusMode", enabled }, () => {
                    if (chrome.runtime.lastError) { }
                });
            });
        });
    });

    // ── Save Manual Note (typed) ────────────────────────────────
    saveNoteBtn.addEventListener('click', saveTypedNote);

    function saveTypedNote() {
        const text = noteText.value.trim();
        if (!text) return;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
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

    // ── Add Current Page (manual, no auto-detect required) ─────
    // Saves the page as a note regardless of learning detection score.
    addPageBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            chrome.tabs.sendMessage(tab.id, { action: "scanPage" }, (response) => {
                const now = Date.now();
                const text = noteText.value.trim() || `📄 Page saved: ${tab.title}`;
                const hasVideo = response && response.video && response.video.exists;

                const newNote = {
                    id: now,
                    pageTitle: (response && response.title) || tab.title,
                    url: tab.url,
                    note: text,
                    timestamp: hasVideo ? response.video.currentTime : null,
                    createdAt: now,
                    type: hasVideo ? "video-note" : "note",
                    manualPage: true       // flag so background can bypass duplicate check
                };

                chrome.runtime.sendMessage({ action: "saveNote", note: newNote }, () => {
                    if (chrome.runtime.lastError) { }
                    noteText.value = '';
                    // Brief visual feedback
                    addPageBtn.textContent = '✓ Added!';
                    addPageBtn.style.background = '#22c55e';
                    setTimeout(() => {
                        addPageBtn.textContent = '+ Add This Page';
                        addPageBtn.style.background = '';
                    }, 1500);
                    setTimeout(loadNotes, 400);
                });
            });
        });
    });

    // ── Timer ───────────────────────────────────────────────────
    resetTimerBtn.addEventListener('click', () => {
        chrome.storage.local.set({ studyTimeToday: 0 }, loadStudyTime);
    });

    function loadStudyTime() {
        chrome.storage.local.get(['studyTimeToday'], (res) => {
            const s = res.studyTimeToday || 0;
            const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
            studyTimeEl.textContent =
                `${pad(h)}:${pad(m)}:${pad(sec)}`;
        });
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    // ── Learning Badge ──────────────────────────────────────────
    function checkLearningStatus(tab) {
        const domains = ['youtube.com', 'coursera.org', 'khanacademy.org', 'stackoverflow.com', 'wikipedia.org'];
        if (domains.some(d => tab.url.includes(d))) learningBadge.classList.remove('hidden');
    }

    // ── Load + Render Notes ─────────────────────────────────────
    function loadNotes() {
        chrome.storage.local.get({ notes: [] }, ({ notes }) => {
            notesList.innerHTML = '';
            sidebarGroups.innerHTML = '';

            if (notes.length === 0) {
                notesList.innerHTML = '<div class="empty-state">Scan a learning page to start collecting insights.</div>';
                sidebarGroups.innerHTML = '<div class="empty-state" style="font-size:11px;padding:10px;">No groups yet.</div>';
                return;
            }

            // Group notes by category
            const groups = {};
            notes.forEach(note => {
                const cat = note.category || "General Learning";
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(note);
            });

            Object.keys(groups).sort().forEach(category => {
                const groupNotes = groups[category];

                // ── Build Main Timeline Group ─────────────────
                const catEl = document.createElement('div');
                catEl.className = 'category-group';
                catEl.dataset.category = category;
                catEl.id = `group-${category.replace(/\s+/g, '-')}`;

                // ── Drop target: each group accepts dragged notes ──────
                catEl.addEventListener('dragover', (e) => {
                    // Must call preventDefault to allow dropping
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    catEl.classList.add('drag-over');
                });
                catEl.addEventListener('dragleave', (e) => {
                    // Only remove highlight when leaving the group itself, not a child
                    if (!catEl.contains(e.relatedTarget)) {
                        catEl.classList.remove('drag-over');
                    }
                });
                catEl.addEventListener('drop', (e) => {
                    e.preventDefault();
                    catEl.classList.remove('drag-over');
                    const targetCategory = catEl.dataset.category;

                    // ── Persistence: STEP 2 (Read ID from dataTransfer) ──
                    const noteId = parseInt(e.dataTransfer.getData("noteId"), 10);
                    if (!noteId || targetCategory === category) return;

                    // ── Persistence: STEP 3 (Update Storage) ────────────
                    chrome.storage.local.get({ notes: [] }, (res) => {
                        const updatedNotes = res.notes.map(n =>
                            n.id === noteId ? { ...n, category: targetCategory } : n
                        );

                        chrome.storage.local.set({ notes: updatedNotes }, () => {
                            // ── Persistence: STEP 4 (Re-render UI) ──────
                            loadNotes();
                        });
                    });

                    draggedNoteId = null;
                });

                // Group Header with collapsing + rename icon
                const header = buildGroupHeader(category, catEl);

                // Items container (collapsed by default)
                const itemsEl = document.createElement('div');
                itemsEl.className = 'items-container hidden';

                groupNotes.forEach(note => {
                    itemsEl.appendChild(buildNoteEl(note));
                });

                catEl.appendChild(header);
                catEl.appendChild(itemsEl);
                notesList.appendChild(catEl);

                // ── Sidebar Link ──────────────────────────────
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
                        if (items.classList.contains('hidden')) {
                            items.classList.remove('hidden');
                            hdr.classList.remove('collapsed');
                        }
                    }
                };
                sidebarGroups.appendChild(sideLink);
            });
        });
    }

    // ── Build Group Header (with rename support) ────────────────
    /**
     * Creates a category header with:
     *  - collapse/expand toggle
     *  - edit (rename) icon that switches the title to an input
     */
    function buildGroupHeader(category, catEl) {
        const header = document.createElement('div');
        header.className = 'category-header collapsed';

        // Title span
        const titleSpan = document.createElement('span');
        titleSpan.className = 'group-title';
        titleSpan.textContent = `📂 ${category}`;

        // Badge
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = catEl.querySelectorAll('.note-item').length || '…';

        // Edit / rename button
        const editBtn = document.createElement('button');
        editBtn.className = 'rename-btn';
        editBtn.title = 'Rename group';
        editBtn.textContent = '✏️';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startRename(category, titleSpan, catEl);
        });

        header.appendChild(titleSpan);
        header.appendChild(badge);
        header.appendChild(editBtn);

        // Click anywhere else on header to expand/collapse
        header.addEventListener('click', (e) => {
            if (e.target === editBtn) return;
            const items = catEl.querySelector('.items-container');
            items.classList.toggle('hidden');
            header.classList.toggle('collapsed');
            // Update badge now that items may have changed
            badge.textContent = catEl.querySelectorAll('.note-item').length;
        });

        return header;
    }

    /**
     * Inline rename: replaces group title with an <input>,
     * confirms on Enter or blur, then sends renameGroup to background.
     */
    function startRename(oldName, titleSpan, catEl) {
        const currentText = oldName;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'rename-input';
        input.onclick = (e) => e.stopPropagation();

        titleSpan.replaceWith(input);
        input.focus();
        input.select();

        function applyRename() {
            const newName = input.value.trim();
            if (!newName || newName === currentText) {
                input.replaceWith(titleSpan); // cancel
                return;
            }
            // Optimistic UI update
            titleSpan.textContent = `📂 ${newName}`;
            input.replaceWith(titleSpan);
            catEl.dataset.category = newName;
            catEl.id = `group-${newName.replace(/\s+/g, '-')}`;

            // Persist in background
            chrome.runtime.sendMessage(
                { action: "renameGroup", oldName, newName },
                () => setTimeout(loadNotes, 200)
            );
        }

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') applyRename();
            if (e.key === 'Escape') input.replaceWith(titleSpan);
        });
        input.addEventListener('blur', applyRename);
    }

    // ── Build Individual Note Element ───────────────────────────
    /**
     * Creates a draggable note card.
     * Drag start captures the note ID; drop on a group header triggers moveNote.
     */
    function buildNoteEl(note) {
        const noteEl = document.createElement('div');
        noteEl.className = 'note-item';
        noteEl.draggable = true;    // Make note draggable
        noteEl.dataset.noteId = note.id;

        const typeIcon = note.type === 'video-note' ? '▶' : note.type === 'auto-note' ? '🤖' : '📄';
        let tsHtml = '';
        if (note.timestamp !== null && note.timestamp !== undefined) {
            tsHtml = `<span class="time-link" data-time="${note.timestamp}">[${formatTime(note.timestamp)}]</span> `;
        }

        noteEl.innerHTML = `
            <div class="note-row">
                <div class="note-content">
                    <span class="note-type-icon">${typeIcon}</span>
                    <div class="note-body">
                        <a href="${note.url}" target="_blank" class="note-link">${tsHtml}${esc(note.note)}</a>
                    </div>
                </div>
                <button class="delete-note-btn" title="Remove">🗑️</button>
            </div>
            <div class="note-meta"><span class="page-title">${esc(note.pageTitle)}</span></div>
        `;

        // ── Persistence: STEP 1 (Store ID on Drag Start) ────
        // We use a custom "noteId" key for clarity. 
        noteEl.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData("noteId", String(note.id));
            e.dataTransfer.effectAllowed = 'move';
            noteEl.classList.add('dragging');

            // Collapse the source group so other groups are visible while dragging.
            // Using setTimeout(..., 0) ensures this happens AFTER the drag is fully initiated,
            // preventing the group from collapsing during a simple press-and-hold (mousedown).
            setTimeout(() => {
                const sourceGroup = noteEl.closest('.category-group');
                if (sourceGroup) {
                    const sourceItems = sourceGroup.querySelector('.items-container');
                    const sourceHeader = sourceGroup.querySelector('.category-header');
                    if (sourceItems && !sourceItems.classList.contains('hidden')) {
                        sourceItems.classList.add('hidden');
                        if (sourceHeader) sourceHeader.classList.add('collapsed');
                    }
                }
            }, 0);
        });
        noteEl.addEventListener('dragend', () => {
            draggedNoteId = null;
            draggedNoteEl = null;
            noteEl.classList.remove('dragging');
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });

        // Video timestamp seek
        const timeLink = noteEl.querySelector('.time-link');
        if (timeLink) {
            timeLink.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0] && tabs[0].url === note.url) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: "seekTo",
                            timestamp: parseFloat(timeLink.dataset.time)
                        }, () => { if (chrome.runtime.lastError) { } });
                    }
                });
            };
        }

        // Delete
        noteEl.querySelector('.delete-note-btn').onclick = (e) => {
            e.stopPropagation();
            deleteNote(note.id);
        };

        return noteEl;
    }

    // ── Delete ──────────────────────────────────────────────────
    function deleteNote(noteId) {
        chrome.storage.local.get({ notes: [] }, ({ notes }) => {
            chrome.storage.local.set({ notes: notes.filter(n => n.id !== noteId) }, loadNotes);
        });
    }

    // ── Utilities ───────────────────────────────────────────────
    function formatTime(secs) {
        const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
        if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
        return `${pad(m)}:${pad(s)}`;
    }

    function esc(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, m =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])
        );
    }
});