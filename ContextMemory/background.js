// background.js - LearnDock
// Handles focus timer end-timestamp and note storage logic.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-notes",
    title: "Save to LearnDock",
    contexts: ["selection"]
  });

  // Ensure default blocked sites on install
  chrome.storage.local.get(['blockedSites'], (res) => {
    if (!res.blockedSites) {
      chrome.storage.local.set({
        blockedSites: ["twitter.com", "x.com", "instagram.com", "reddit.com", "facebook.com", "tiktok.com", "netflix.com"]
      });
    }
  });
});

// Unified message listener for LearnDock logic
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveNote" || request.action === "autoSaveNote") {
    saveToStorage(request.note, (savedNote) => {
      sendResponse({ status: "saved", note: savedNote });
    });
    return true;
  }

  else if (request.action === "ping") {
    sendResponse({ status: "pong" });
  }

  // ── TIMER LOGIC ─────────────────────────────────────────────
  if (request.action === "startPomodoro") {
    const duration = request.duration; // seconds, from popup only
    chrome.storage.local.set({
      pomodoroEnd: Date.now() + (duration * 1000),
      pomodoroDuration: duration,
      focusModeEnabled: true,
      exceptionCount: 0,
      lastExceptionTime: null,
      exceptionActive: false
    }, () => {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: "toggleFocusMode", enabled: true }, () => {
            if (chrome.runtime.lastError) { }
          });
        });
      });
      sendResponse({ ok: true });
    });
    chrome.alarms.create("pomodoroCheck", { periodInMinutes: 1 });
    return true;
  }

  if (request.action === "getPomodoroStatus") {
    chrome.storage.local.get(
      ["pomodoroEnd", "pomodoroDuration", "focusModeEnabled"],
      (res) => {
        if (!res.pomodoroEnd) {
          sendResponse({ running: false, remaining: 0, total: 0 });
          return;
        }
        const remaining = Math.max(0,
          Math.floor((res.pomodoroEnd - Date.now()) / 1000));
        sendResponse({
          running: res.focusModeEnabled && remaining > 0,
          remaining: remaining,
          total: res.pomodoroDuration || 0
        });
      }
    );
    return true;
  }

  if (request.action === "stopPomodoro") {
    chrome.storage.local.set({
      pomodoroEnd: null,
      pomodoroDuration: null,
      focusModeEnabled: false,
      exceptionActive: false,
      exceptionCount: 0
    });
    chrome.alarms.clear("pomodoroCheck");
    // send toggleFocusMode disabled to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(
          tab.id,
          { action: "toggleFocusMode", enabled: false },
          () => { if (chrome.runtime.lastError) { } }
        );
      });
    });
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === "startException") {
    chrome.storage.local.get(
      ['exceptionCount', 'lastExceptionTime'], (res) => {
        const count = res.exceptionCount || 0;
        const last = res.lastExceptionTime;
        const minsSince = last
          ? Math.floor((Date.now() - last) / 60000) : 999;

        if (count >= 4) {
          sendResponse({ allowed: false, reason: 'max_reached' });
          return;
        }
        if (minsSince < 60 && last) {
          sendResponse({
            allowed: false,
            reason: 'too_soon',
            remaining: 60 - minsSince
          });
          return;
        }
        const expiry = Date.now() + (5 * 60 * 1000);
        chrome.storage.local.set({
          exceptionCount: count + 1,
          lastExceptionTime: Date.now(),
          exceptionActive: true,
          exceptionExpiry: expiry
        }, () => sendResponse({ allowed: true, expiry }));
      });
    return true;
  }

  // Group Management
  else if (request.action === "renameGroup") {
    const { oldName, newName } = request;
    chrome.storage.local.get({ notes: [] }, (res) => {
      const updated = res.notes.map(n =>
        n.category === oldName ? { ...n, category: newName } : n
      );
      chrome.storage.local.set({ notes: updated }, () => sendResponse({ ok: true }));
    });
    return true;
  }

  else if (request.action === "moveNote") {
    const { noteId, newCategory } = request;
    chrome.storage.local.get({ notes: [] }, (res) => {
      const updated = res.notes.map(n =>
        n.id === noteId ? { ...n, category: newCategory } : n
      );
      chrome.storage.local.set({ notes: updated }, () => sendResponse({ ok: true }));
    });
    return true;
  }

  return true;
});

// pomodoroCheck alarm handler
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pomodoroCheck") {
    chrome.storage.local.get(
      ["pomodoroEnd", "focusModeEnabled"], (res) => {
        if (!res.pomodoroEnd || !res.focusModeEnabled) return;
        if (Date.now() >= res.pomodoroEnd) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icon48.png",
            title: "LearnDock",
            message: "Focus session complete! Great work 🎉"
          });
          chrome.storage.local.set({
            focusModeEnabled: false,
            pomodoroEnd: null,
            pomodoroDuration: null,
            exceptionActive: false,
            exceptionCount: 0
          });
          chrome.alarms.clear("pomodoroCheck");
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
              chrome.tabs.sendMessage(
                tab.id,
                { action: "toggleFocusMode", enabled: false },
                () => { if (chrome.runtime.lastError) { } }
              );
            });
          });
        }
      });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-to-notes" && info.selectionText) {
    const highlightNote = {
      id: Date.now(),
      pageTitle: tab.title,
      url: tab.url,
      note: info.selectionText,
      timestamp: null,
      createdAt: Date.now(),
      type: "highlight-note"
    };
    saveToStorage(highlightNote);
  }
});

function determineCategory(title, existingNotes) {
  const stopWords = new Set(['how', 'what', 'guide', 'tutorial', 'introduction', 'explained', 'course', 'learn', 'video', 'best', 'to', 'the', 'a', 'in', 'of', 'and', 'for', 'with', 'on']);
  const clean = t => t.toLowerCase().replace(/[-\|].*$/, '').replace(/[^\w\s]/g, ' ').trim();
  const keywords = clean(title).split(/\s+/).filter(word => word.length > 3 && !stopWords.has(word));

  if (keywords.length === 0) return "General Learning";

  const catMap = {};
  existingNotes.forEach(note => {
    const cat = note.category;
    if (!cat || cat === "General Learning") return;
    if (!catMap[cat]) catMap[cat] = new Set();
    const noteTitle = note.pageTitle || note.title || "";
    const cleanedTitle = clean(noteTitle);
    cleanedTitle.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w)).forEach(w => catMap[cat].add(w));
  });

  let bestCat = null;
  let maxMatch = 0;
  for (const [name, kws] of Object.entries(catMap)) {
    let match = keywords.filter(k => kws.has(k)).length;
    if (match > maxMatch) { maxMatch = match; bestCat = name; }
  }

  if (bestCat && maxMatch >= 1) return bestCat;
  return keywords.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function saveToStorage(newNote, callback) {
  chrome.storage.local.get({ notes: [] }, (result) => {
    const notes = result.notes;

    // BUG A — Duplicate check Fix
    const isDuplicate = notes.some(n =>
      n.url === newNote.url &&
      n.note === newNote.note
    );
    if (isDuplicate) {
      if (callback) callback(null);
      return;
    }

    // Assign Category
    newNote.category = determineCategory(newNote.pageTitle || newNote.title, notes);

    notes.unshift(newNote);
    chrome.storage.local.set({ notes: notes }, () => {
      if (newNote.type !== "auto-note") {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAANSURBVBhXY3jP4PgfAAWgA3E9uWwOAAAAAElFTkSuQmCC",
          title: "LearnDock",
          message: "Saved to LearnDock"
        });
      }
      if (callback) callback(newNote);
    });
  });
}