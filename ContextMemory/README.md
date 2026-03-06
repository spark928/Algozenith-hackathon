# Context Memory – AI Learning History Tracker

A Chrome Extension that automatically records a student's learning journey across the web, tracking pages visited and saving highlighted notes for context.

## Installation Instructions (Developer Mode)

1. Open Google Chrome.
2. In the URL bar, go to `chrome://extensions/`.
3. In the top right corner, toggle the **"Developer mode"** switch to ON.
4. Click the **"Load unpacked"** button in the top left corner.
5. Select the `ContextMemory` folder (where this code is located).
6. The extension is now installed! You should see the Context Memory icon in your extensions toolbar.

## Features

- **Context Tracking:** Automatically tracks visits to specific learning domains (YouTube, StackOverflow, GeeksForGeeks, Medium, MDN, LeetCode).
- **Save Highlights:** Highlight text on any page, right-click, and select "Save to Context Memory".
- **Dashboard:** Click the extension icon to view your timeline of saved context.
- **Search:** Quickly search your history by page title, website, or saved highlights.

## Included Files

- `manifest.json`: Configuration and permissions (Manifest V3).
- `background.js`: Service worker handling context menus and storage tracking.
- `content.js`: Injected script on learning domains to track visits.
- `popup.html`: The UI for the extension dashboard.
- `styles.css`: Styling for the popup UI.
- `popup.js`: Logic for displaying and searching context.

## How to Test

1. Pin the extension to your toolbar.
2. Visit a learning site like `developer.mozilla.org` or `stackoverflow.com`. Give it a few seconds to load.
3. Highlight some text on the page, right-click, and choose "Save to Context Memory".
4. Open the extension popup. You should see your visit and highlight recorded in your Learning Timeline!
