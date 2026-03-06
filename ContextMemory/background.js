// background.js - Antigravity

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-notes",
    title: "Save to Context Memory",
    contexts: ["selection"]
  });

  chrome.storage.local.get(['studyTimeToday'], (res) => {
    if (!res.studyTimeToday) chrome.storage.local.set({ studyTimeToday: 0 });
  });

  chrome.alarms.create("studyTimer", { periodInMinutes: 1 });
});

let isCurrentPageLearning = false;

// Unified message listener for robust communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "pageStatus") {
    isCurrentPageLearning = request.isLearning;
    sendResponse({ status: "received" });
  }

  else if (request.action === "saveNote" || request.action === "autoSaveNote") {
    saveToStorage(request.note, (savedNote) => {
      sendResponse({ status: "saved", note: savedNote });
    });
    return true; // Keep port open for async saveToStorage
  }

  else if (request.action === "ping") {
    sendResponse({ status: "pong" });
  }

  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "studyTimer" && isCurrentPageLearning) {
    chrome.storage.local.get(['studyTimeToday'], (res) => {
      const newTime = (res.studyTimeToday || 0) + 60;
      chrome.storage.local.set({ studyTimeToday: newTime });
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
      type: "highlight-note" // Corrected type
    };
    saveToStorage(highlightNote);
  }
});

/**
 * Categorization Engine: Matches notes based on shared significant keywords.
 */
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
    clean(noteTitle).split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w)).forEach(w => catMap[cat].add(w));
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

    // Check for duplicates
    const isDuplicate = notes.some(n => n.url === newNote.url && (n.note === newNote.note || (n.type === "auto-note" && newNote.type === "auto-note")));
    if (isDuplicate && newNote.type === "auto-note") {
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
          title: "Antigravity",
          message: "Saved to Context Memory"
        });
      }
      if (callback) callback(newNote);
    });
  });
}
