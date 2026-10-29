import test from "node:test";
import assert from "node:assert/strict";
import {
  filename,
  formatTime,
  normalizeLibrary,
  reduceLibrary,
  selectTracks,
  validUrl,
} from "../js/model.js";

test("migrates v1 URLs, dropping canceled prompts, invalid protocols and duplicates", () => {
  const library = normalizeLibrary(null, [
    null,
    "",
    "https://example.com/A%20Song.mp3?token=123",
    "https://example.com/A%20Song.mp3?token=123",
    "javascript:alert(1)",
    "blob:https://example.com/1",
  ]);
  assert.equal(library.tracks.length, 1);
  assert.equal(library.tracks[0].title, "A Song");
  assert.equal(library.tracks[0].metadataState, "pending");
});
test("names and times tolerate malformed URLs and missing duration", () => {
  assert.equal(filename("https://a.test/bad%name.mp3"), "bad%name");
  assert.equal(
    filename("https://a.test/hello_world.flac?token=1"),
    "hello world",
  );
  assert.equal(validUrl("file:///music.mp3"), null);
  assert.equal(validUrl(null), null);
  assert.equal(formatTime(NaN), "0:00");
  assert.equal(formatTime(65), "1:05");
  assert.equal(formatTime(3665), "1:01:05");
});
const base = () =>
  normalizeLibrary({
    tracks: [
      {
        id: "a",
        url: "https://a.test/a.mp3",
        title: "Dawn",
        artist: "Tycho",
        album: "Dive",
        addedAt: 1,
      },
      {
        id: "b",
        url: "https://a.test/b.mp3",
        title: "Awake",
        artist: "Tycho",
        album: "Awake",
        addedAt: 2,
        favorite: true,
      },
      {
        id: "c",
        url: "https://a.test/c.mp3",
        title: "Kerala",
        artist: "Bonobo",
        album: "Migration",
        addedAt: 3,
      },
    ],
  });
test("reordering preserves IDs and other tracks, before and after in both directions", () => {
  const library = base();
  assert.deepEqual(
    reduceLibrary(library, {
      type: "move",
      id: "a",
      targetId: "c",
      after: true,
    }).tracks.map((t) => t.id),
    ["b", "c", "a"],
  );
  assert.deepEqual(
    reduceLibrary(library, { type: "move", id: "c", targetId: "a" }).tracks.map(
      (t) => t.id,
    ),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    reduceLibrary(library, { type: "move", id: "a", targetId: "missing" }),
    library,
  );
  assert.deepEqual(
    library.tracks.map((t) => t.id),
    ["a", "b", "c"],
  );
});
test("search matches words across title, artist and album without mutating playlist order", () => {
  const { tracks } = base();
  assert.deepEqual(
    selectTracks(tracks, { query: "TYCHO dive" }).map((t) => t.id),
    ["a"],
  );
  assert.deepEqual(
    selectTracks(tracks, { view: "favorites" }).map((t) => t.id),
    ["b"],
  );
  assert.deepEqual(
    selectTracks(tracks, { sort: "title" }).map((t) => t.id),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    selectTracks(tracks, { view: "recent" }).map((t) => t.id),
    ["c", "b", "a"],
  );
  assert.deepEqual(
    tracks.map((t) => t.id),
    ["a", "b", "c"],
  );
});
test("metadata updates cannot overwrite edits or change source and identity", () => {
  let library = reduceLibrary(base(), {
    type: "patch",
    id: "a",
    patch: {
      title: "My title",
      metadataState: "edited",
      url: "https://bad.test",
      id: "bad",
    },
  });
  library = reduceLibrary(library, {
    type: "patch",
    id: "a",
    automatic: true,
    patch: { title: "Fetched title", duration: 12, metadataState: "ready" },
  });
  assert.equal(library.tracks[0].title, "My title");
  assert.equal(library.tracks[0].duration, 12);
  assert.equal(library.tracks[0].url, "https://a.test/a.mp3");
});
test("adds deduplicate, favorites persist, removal and settings are bounded", () => {
  let library = reduceLibrary(base(), {
    type: "add",
    tracks: [
      null,
      { url: "https://a.test/a.mp3" },
      { url: "https://a.test/new.mp3" },
    ],
  });
  assert.equal(library.tracks.length, 4);
  library = reduceLibrary(library, { type: "favorite", id: "a" });
  assert.ok(library.tracks[0].favorite);
  library = reduceLibrary(library, { type: "remove", id: "b" });
  assert.ok(!library.tracks.some((t) => t.id === "b"));
  library = reduceLibrary(library, {
    type: "settings",
    settings: { volume: 50, repeat: "invalid", theme: "light" },
  });
  assert.equal(library.settings.volume, 1);
  assert.equal(library.settings.repeat, "off");
  assert.equal(library.settings.theme, "light");
});
