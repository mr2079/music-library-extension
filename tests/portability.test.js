import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLibrary, reduceLibrary } from "../js/model.js";
import { exportLibrary, importLibrary } from "../js/portability.js";

test("portable library round-trips order, metadata and favorites across fresh browser IDs", () => {
  const source = normalizeLibrary({
    tracks: [
      {
        id: "old-b",
        url: "https://music.test/b.mp3?token=one",
        title: "B",
        artist: "Artist",
        album: "Album",
        duration: 180,
        favorite: true,
        addedAt: 100,
      },
      { id: "old-a", url: "https://music.test/a.mp3", title: "A", addedAt: 90 },
    ],
  });
  const result = importLibrary(JSON.stringify(exportLibrary(source)));
  assert.deepEqual(
    result.map((track) => track.url),
    source.tracks.map((track) => track.url),
  );
  assert.equal(result[0].artist, "Artist");
  assert.equal(result[0].favorite, true);
  assert.equal(result[0].duration, 180);
  assert.equal(result[0].addedAt, 100);
  assert.notEqual(result[0].id, source.tracks[0].id);
});
test("imports merge non-destructively, deduplicate, and support a plain URL array", () => {
  const source = normalizeLibrary(null, ["https://music.test/a.mp3"]);
  const tracks = importLibrary(
    JSON.stringify([
      "https://music.test/a.mp3",
      "https://music.test/b.mp3",
      "https://music.test/b.mp3",
    ]),
  );
  assert.equal(tracks.length, 2);
  const updated = reduceLibrary(source, { type: "add", tracks });
  assert.equal(updated.tracks.length, 2);
  assert.equal(updated.tracks[0].id, source.tracks[0].id);
});
test("exports omit device-local files and imports reject corrupt or unsafe documents atomically", () => {
  const source = normalizeLibrary({
    tracks: [{ id: "local-id", url: "local:local-id", title: "Local file" }],
  });
  assert.deepEqual(exportLibrary(source).tracks, []);
  assert.throws(() => importLibrary("{bad"), /valid JSON/);
  assert.throws(() => importLibrary('{"version":9}'), /Music Library JSON/);
  assert.throws(
    () => importLibrary('["https://music.test/a.mp3",null]'),
    /invalid link/,
  );
  assert.throws(() => importLibrary('["javascript:alert(1)"]'), /invalid link/);
  assert.throws(() => importLibrary('["local:missing-file"]'), /invalid link/);
});
