# Music Library v2

A self-contained Chrome new-tab extension for your own music. Plain JavaScript modules, local SVG icons and fonts, a Spotify-green interface, and dark/light themes. No account, build step, proxy, or production server.

## Install or update

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this project directory. If already installed from this directory, use **Reload** on the extension card.
3. Open a new tab. Refresh existing tabs after an extension update.

The extension automatically migrates the v1 `audio_playlists` URL array. Invalid entries and duplicates are skipped. The original v1 key is retained.

## Your library

- **Add music:** paste direct HTTP/HTTPS audio links, one per line, or select/drop audio files. Local files stay in IndexedDB after restarting the browser.
- **Collect from websites:** when audio or direct download links are found, **Save music** appears. Its isolated dialog follows the library theme. Dynamic sources and query strings are supported.
- **Search:** filter by title, artist, or album; combine words across fields. Filter favorites or recently added tracks. Sort by title, artist, date, or custom order.
- **Song information:** title, artist, album, artwork, duration, and added date appear where space allows. Tags load in the background. Use a track's three-dot button to edit missing information.
- **Reorder:** drag a track's grip in **Custom order** (All tracks or Favorites). Touch dragging, keyboard reordering, and Move up/down in Track information are also available.
- **Playback:** play/pause, previous/next, seek, volume/mute, shuffle, repeat all/one, and supported OS media keys. Closing the player tab stops playback.
- **Toolbar popup:** search the collection, pick a track, control an open library player, change theme, or open the full library. Playback stays in the library tab when the popup closes.

## Persistent and portable links

Changes save automatically to `chrome.storage.local`. A background worker serializes writes from tabs and website collectors, and open library tabs receive updates.

The **Export library file** button (download SVG above the list) downloads readable, versioned JSON containing remote song links, title/artist/album, duration, favorites, added dates, and playlist order. Export always includes the full library regardless of search or filters. Keep this file as a backup or transfer it to another device.

**Import library file** (upload SVG) merges a saved file. Existing tracks keep their information and position. New URLs append in the imported order; duplicate links are skipped. Plain JSON arrays of HTTP/HTTPS URLs are accepted too. Invalid files are rejected before saving.

```json
{
  "format": "music-library",
  "version": 2,
  "tracks": [
    {
      "url": "https://example.com/song.mp3",
      "title": "A favorite song",
      "artist": "Artist",
      "album": "Album",
      "duration": 180,
      "favorite": true
    }
  ]
}
```

Exports contain links and text metadata, not audio binaries or artwork. Local audio files remain device-specific; import their original files on another device. Removing the extension clears local data; keep an export for a separate backup. Source URLs can include host access tokens, so treat library files as private when appropriate.

## Keyboard shortcuts

Shortcuts apply while the library tab is focused and do not interrupt typing.

| Key                  | Action                                 |
| -------------------- | -------------------------------------- |
| Space                | Play / pause                           |
| Shift + Left / Right | Previous / next track                  |
| Left / Right         | Seek backward / forward 5 seconds      |
| Up / Down            | Raise / lower volume                   |
| M                    | Mute / unmute                          |
| S                    | Toggle shuffle                         |
| R                    | Cycle repeat off / all / one           |
| /                    | Focus search                           |
| ?                    | Show shortcut reference                |
| Escape               | Close a dialog or clear focused search |
| Alt + Up / Down      | Move a track while its grip is focused |

## Mobile and accessibility

Responsive layouts support narrow screens with a compact fixed player, touch grips, visible focus, accessible controls, native dialogs, and reduced motion. Mobile Chrome does not normally load desktop extensions; use an extension-capable browser or the standalone preview for the responsive layout.

## Development

Node.js 22+ is sufficient. There are no application npm dependencies.

```sh
npm test          # model, migration, portability, playback, concurrent worker writes
npm run check    # syntax, manifest, assets, CSP compatibility and UI bindings
npm run preview  # optional static preview at http://localhost:4173
```

Preview uses localStorage rather than extension storage, so it has a separate library. Its fixture routes are development-only; no sample songs are installed into the extension.

| File                                  | Responsibility                                          |
| ------------------------------------- | ------------------------------------------------------- |
| `script.js`                           | Library rendering and interactions                      |
| `js/model.js`                         | Data model, migration, filtering, immutable actions     |
| `js/background.js`                    | Serialized storage and popup/player communication       |
| `js/store.js`                         | Extension/preview persistence and local audio IndexedDB |
| `js/player.js`                        | Playback, queues, media keys, audio lifecycle           |
| `js/metadata.js`                      | Bounded metadata extraction and artwork resizing        |
| `js/portability.js`                   | Versioned JSON import/export                            |
| `js/icons.js`                         | Local SVG icon system                                   |
| `vendor/jsmediatags.min.js`           | Packaged third-party audio tag reader                   |
| `content.js`                          | Website audio discovery and isolated collector          |
| `popup.html`, `popup.js`, `popup.css` | Extension toolbar popup                                 |
| `scripts/build-icons.ps1`             | Rebuild packaged PNGs matching `icons/logo.svg`         |

Manifest V3 loads only packaged scripts. There are no inline handlers, remote code, runtime CSS compiler, or eval. HTTP/HTTPS host access supports remote metadata and website audio discovery. `unlimitedStorage` supports local audio imports.

Playback depends on the source host and browser codecs. Expiring URLs, authenticated streams, DRM, and streaming-service page links may not play. Remote metadata times out and is limited to 20 MB; unavailable metadata never blocks playback. Missing information can be edited manually and duration updates from playback when available.
