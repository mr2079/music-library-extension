import test from "node:test";
import assert from "node:assert/strict";
import { LIBRARY_KEY } from "../js/model.js";
let listener,
  saved = {};
let session = {},
  sentControl = null,
  closedTab = false;
globalThis.chrome = {
  runtime: {
    id: "test-extension",
    getURL: (path) => `chrome-extension://test-extension/${path}`,
    onMessage: {
      addListener(fn) {
        listener = fn;
      },
    },
  },
  storage: {
    session: {
      async get() {
        return structuredClone(session);
      },
      async set(value) {
        Object.assign(session, structuredClone(value));
      },
      async remove(key) {
        delete session[key];
      },
    },
    local: {
      async get() {
        await new Promise((resolve) => setTimeout(resolve, 2));
        return structuredClone(saved);
      },
      async set(value) {
        await new Promise((resolve) => setTimeout(resolve, 2));
        Object.assign(saved, structuredClone(value));
      },
    },
  },
  action: { onClicked: { addListener() {} } },
  tabs: {
    create() {},
    async sendMessage(tabId, message) {
      if (closedTab) throw new Error("Tab closed");
      sentControl = { tabId, ...message };
      return { state: session.player.state };
    },
  },
};
await import("../js/background.js");
function message(action, url = "chrome-extension://test-extension/index.html") {
  return new Promise((resolve) =>
    listener(
      { channel: "music-library", action },
      { id: "test-extension", url },
      resolve,
    ),
  );
}
test("serializes concurrent additions from separate tabs and migrates legacy data", async () => {
  saved = { audio_playlists: ["https://music.test/legacy.mp3", null] };
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      message({
        type: "add",
        tracks: [{ url: `https://music.test/${i}.mp3` }],
      }),
    ),
  );
  assert.ok(results.every((result) => result.library));
  assert.equal(saved[LIBRARY_KEY].tracks.length, 11);
  assert.equal(saved.audio_playlists.length, 2);
});
test("content scripts may submit remote links but cannot mutate existing tracks or inject local files", async () => {
  const before = saved[LIBRARY_KEY].tracks.length;
  const result = await message(
    { type: "remove", id: saved[LIBRARY_KEY].tracks[0].id },
    "https://music.test",
  );
  assert.ok(result.error);
  await message(
    {
      type: "add",
      tracks: [
        { url: "local:bad" },
        {
          url: "https://music.test/real.mp3",
          favorite: true,
          title: "Injected",
        },
      ],
    },
    "https://music.test",
  );
  assert.equal(saved[LIBRARY_KEY].tracks.length, before + 1);
  const track = saved[LIBRARY_KEY].tracks.at(-1);
  assert.equal(track.title, "real");
  assert.equal(track.favorite, false);
});

function playerMessage(body, page = "popup.html", tabId = 1) {
  return new Promise((resolve) =>
    listener(
      body,
      {
        id: "test-extension",
        url: chrome.runtime.getURL(page),
        tab: { id: tabId },
      },
      resolve,
    ),
  );
}
test("popup controls the registered player tab and rejects website control requests", async () => {
  await playerMessage(
    { channel: "music-library-status", state: { trackId: "a", playing: true } },
    "index.html",
    42,
  );
  const result = await playerMessage({
    channel: "music-library-control",
    action: "next",
  });
  assert.equal(sentControl.tabId, 42);
  assert.equal(sentControl.action, "next");
  assert.ok(result.state.playing);
  const denied = await playerMessage(
    { channel: "music-library-control", action: "next" },
    "not-popup.html",
  );
  assert.ok(denied.error);
  await playerMessage(
    {
      channel: "music-library-status",
      state: { trackId: null, playing: false },
    },
    "index.html",
    99,
  );
  assert.equal(session.player.tabId, 42);
});
test("stale popup player references are cleared when a tab is closed", async () => {
  closedTab = true;
  assert.deepEqual(
    await playerMessage({ channel: "music-library-control", action: "state" }),
    { state: null },
  );
  assert.equal(session.player, undefined);
});
