# 🎵 Enhanced Audio New Tab Extension

A custom Chrome extension that transforms your new tab into a minimalist audio player and smart search hub. Manage playlists, play local or online audio, and search Google with real-time suggestions — all from your new tab.

---

## ✨ Features

- 🔊 Audio player with playlist support
- 📂 Persistent audio storage via Chrome local storage
- ⏩ Playback controls: play, pause, next, previous, seek, mute
- 🗂️ Remove tracks from playlist
- 🔍 Google search bar with:
  - Keyboard shortcut to focus (`/`)
  - Autocomplete suggestions
- 🌙 Sleek dark theme with responsive layout
- ⚙️ Modal to detect and add audio elements from pages

---

## 🚀 Installation

1. Clone this repository or [download as ZIP](https://github.com/mr2079/music-library-extension/archive/refs/heads/main.zip).
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer Mode** (top-right).
4. Click **Load unpacked** and select the project directory.

---

## 🔧 Development

### Local Suggestion Server (optional)

To enable Google autocomplete suggestions:

1. Install dependencies and run the Express server:

   ```bash
   cd proxy-server
   npm install
   npm start
   ```
2. The extension will call this local server to fetch suggestions as you type.
