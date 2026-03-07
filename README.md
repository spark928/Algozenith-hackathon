# ⚓ LearnDock

**Your on-page learning dock — capture notes, block distractions, and track focus time across the web.**

LearnDock is a Chrome Extension (Manifest V3) that injects a persistent sidebar into every page, automatically detects learning content, saves notes with full context, and enforces distraction blocking during timed focus sessions.

---

## Installation (Developer Mode)

1. Open Google Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the `LearnDock` folder containing all extension files
5. The ⚓ LearnDock icon will appear in your Chrome toolbar

---

## Features

### 📝 Note Capture

LearnDock provides three ways to save notes:

- **Popup note entry** — Type a note directly in the extension popup and click **Save Note**
- **Add This Page** — Click **+ Add This Page** in the popup to save the current page's title and URL as a note
- **Sidebar note entry** — Type in the sidebar input (injected on every page) and press Enter or click **Save**
- **Right-click highlight** — Select any text on a page, right-click, and choose **Save to LearnDock** to save the highlighted passage with the page title and URL
- **Auto-capture** — On detected learning pages, LearnDock automatically extracts the most meaningful snippet (definition sentence, article paragraph, or meta description) and saves it silently as an `auto-note`

All notes are stored locally via `chrome.storage.local`. Duplicate notes (same URL and same text) are automatically discarded.

---

### 🤖 Automatic Learning Page Detection

LearnDock uses a multi-signal scoring system to detect whether a page is a learning resource before attempting auto-capture. Signals include:

- Matching a known learning domain (YouTube, Coursera, Udemy, Khan Academy, edX, MDN, StackOverflow, Wikipedia, GitHub, Medium, freeCodeCamp, W3Schools, GeeksForGeeks, LeetCode, HackerRank, Codecademy, Towards Data Science, arXiv, docs.python.org, docs.microsoft.com, ResearchGate)
- Learning keywords in the page title or URL (e.g. "tutorial", "guide", "crash course", "documentation", "explained")
- Presence of multiple headings, code blocks, or math/equation elements
- Substantial paragraph text (300+ words)
- An `article`, `main`, or `[role="main"]` content container
- A table of contents element
- Educational writing phrases in page text (e.g. "in this tutorial", "you will learn", "step 1", "is defined as")
- Penalties applied for social media feed layouts, login/sign-up pages, and very short pages without video

A page must reach a minimum score of 3 to be considered a learning page.

---

### 🗂️ Automatic Note Categorisation

Every saved note is automatically assigned a category based on keywords extracted from the page title. LearnDock strips stop words, then checks if any keywords match existing category names in your note library. If a strong match is found (at least 1 keyword overlap), the note joins that category. Otherwise a new category is created from the top 1–2 keywords of the title. Notes with no meaningful keywords are placed in **General Learning**.

---

### 📚 Notes Library (Popup)

All saved notes appear in the popup under **Learning Timeline**, grouped by category. Each group shows a note count badge and can be expanded or collapsed. Within each group you can:

- Click a note's text to open the original source URL in a new tab
- Click a video timestamp (shown as `[MM:SS]` or `[H:MM:SS]`) to jump to that moment in the video on the source tab
- Delete any note with the 🗑 button

The sidebar (injected on-page) shows the same grouped note list and updates live whenever notes change.

---

### 🗺️ Knowledge Map (Sidebar Navigation)

Clicking ☰ in the popup header opens the **Knowledge Map** sidebar, listing all your note categories. Clicking a category name scrolls the main notes list to that group.

---

### ⏱ Focus Timer (Pomodoro)

Start a timed focus session from the popup:

1. Select a preset duration — **25 min**, **45 min**, **60 min**, or **90 min** — or enter a custom value (1–180 minutes)
2. A large preview clock shows your selected goal
3. Click **🎯 Start Focus Session**

While a session is running:

- A live countdown and progress bar are shown in the popup
- A **Focus Mode** toggle (on by default) enables distraction blocking across all tabs
- Clicking the timer area (or toggling focus mode off) opens a confirmation dialog asking whether to end the session early or keep focusing
- When the timer expires naturally, a desktop notification appears and focus mode is disabled automatically

Session state (end timestamp, duration, focus mode flag) is persisted in `chrome.storage.local` so the timer survives popup close/reopen. A background alarm checks for timer expiry every minute.

---

### 🚫 Site Blocking (Focus Mode)

When a focus session is active, LearnDock blocks access to sites on your blocked list. Blocked by default:

`twitter.com`, `x.com`, `instagram.com`, `reddit.com`, `facebook.com`, `tiktok.com`, `netflix.com`

You can manage the list from the popup under **🚫 Blocked Sites** (click to expand):

- Existing sites are shown as removable pills — click **✕** on any pill to remove it
- Type a domain into the input field and click **Add** to add a new site

**When you visit a blocked site during a session**, the full page is replaced with a block screen showing:

- The domain name and a session countdown
- Your remaining exception count
- A randomly selected motivational quote
- An **"I need 5 minutes"** button (see Exceptions below)

LearnDock also hides YouTube distractions (recommended videos, comments, Shorts shelves, end-screen cards) on all pages during a session, using both CSS injection and a MutationObserver to handle lazily loaded elements.

---

### ⏳ Focus Exceptions

If you genuinely need to visit a blocked site during a session, you can request a **5-minute exception**:

- Click **"I need 5 minutes"** on the block screen
- You are allowed up to **4 exceptions per focus session**
- Each exception has a **60-minute cooldown** before you can request another
- A yellow countdown banner appears at the top of the page during the exception window, reminding you when the site will be blocked again
- The exception count and last-used time are tracked in storage and reset when a new session starts

---

### 🎨 In-Page Sidebar

An ⚓ toggle button is injected on the right edge of every page. Clicking it opens the LearnDock sidebar, which includes:

- A note input field (Enter key or Save button)
- Your full notes library grouped by category, with expand/collapse per group
- Delete buttons on each note (visible on hover)
- Video timestamp links that seek the on-page video when clicked
- A **dark/light theme toggle** (🌙 / ☀️) — preference saved to storage
- A live note count badge in the header

The sidebar re-renders automatically whenever notes change. On YouTube, it also re-renders after SPA navigation events (`yt-navigate-finish`).

---

### 🔔 Notifications

LearnDock sends desktop notifications (via `chrome.notifications`) in these situations:

- A note is saved manually or via right-click highlight — **"Saved to LearnDock"**
- A focus session completes naturally — **"Focus session complete! Great work 🎉"**

Auto-captured notes do not trigger a notification.

---

## Permissions

| Permission | Purpose |
|---|---|
| `storage` | Persisting notes, settings, blocked sites, timer state, and theme preference |
| `activeTab` | Scanning the current tab's page title, URL, and video state |
| `contextMenus` | Right-click "Save to LearnDock" on selected text |
| `scripting` | Sending messages to content scripts across tabs |
| `notifications` | Desktop alerts for save confirmations and session completion |
| `alarms` | Background timer check every minute for Pomodoro expiry |
| `host_permissions: <all_urls>` | Injecting the sidebar and focus blocking on all pages |

---

## File Structure

```
LearnDock/
├── manifest.json       # Extension configuration (Manifest V3)
├── background.js       # Service worker: timer logic, storage, context menu, alarms
├── content.js          # Injected on all pages: sidebar, focus mode, auto-detection
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic: timer, notes, blocked sites, navigation
├── popup.css           # Popup styles
├── sidebar.css         # Injected sidebar styles (light & dark mode)
├── icon16.png          # Extension icon (16×16)
├── icon48.png          # Extension icon (48×48)
└── icon128.png         # Extension icon (128×128)
```

---

## 📸 Screenshots

### 🎯 Focus Session Setup
<p align="center">
  <img src="screenshots/focus-session-setup.png" width="45%">
</p>

### ⏱️ Focus Session Running
<p align="center">
  <img src="screenshots/focus-session-running.png" width="45%">
</p>

### 🚫 Blocked Sites Manager
<p align="center">
  <img src="screenshots/blocked-sites-manager.png" width="45%">
</p>

### 📝 Notes List (Popup)
<p align="center">
  <img src="screenshots/notes-list-popup.png" width="45%">
</p>

### 🗺️ Knowledge Map Sidebar
<p align="center">
  <img src="screenshots/knowledge-map-sidebar.png" width="45%">
</p>

### 🌙 Sidebar — Dark Mode
<p align="center">
  <img src="screenshots/sidebar-dark-mode.png" width="45%">
</p>

### ☀️ Sidebar — Light Mode
<p align="center">
  <img src="screenshots/sidebar-light-mode.png" width="45%">
</p>

### 📚 In-Page Sidebar Notes
<p align="center">
  <img src="screenshots/in-page-sidebar-notes.png" width="45%">
</p>

### 🌐 LearnDock Active on Wikipedia
<p align="center">
  <img src="screenshots/wikipedia-active-badge.png" width="80%">
</p>

## Data & Privacy

All data is stored **locally** on your device using `chrome.storage.local`. Nothing is sent to any server. Clearing the extension's storage (via `chrome://extensions/` → Details → Clear data, or uninstalling the extension) removes all saved notes and settings.

---

## Notes

- The extension requires Chrome (or a Chromium-based browser supporting Manifest V3)
- Timer state survives popup close but not browser restart (alarm-based, not a persistent background process)
- The sidebar and block page are injected at `document_idle`, so they may appear a moment after a page loads
- On YouTube, the extension listens for `yt-navigate-finish` to handle single-page-app navigation between videos
