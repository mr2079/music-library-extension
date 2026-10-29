import test from "node:test";
import assert from "node:assert/strict";
import { Player } from "../js/player.js";
import { normalizeLibrary } from "../js/model.js";
class FakeAudio extends EventTarget {
  paused = true;
  currentTime = 0;
  duration = 90;
  volume = 0.7;
  play() {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
  load() {}
  removeAttribute() {}
}
const library = () =>
  normalizeLibrary({
    tracks: ["a", "b", "c"].map((id) => ({
      id,
      url: `https://music.test/${id}.mp3`,
    })),
  });
test("playback follows a selected queue and keeps the current song after reordering", async () => {
  const audio = new FakeAudio(),
    player = new Player(audio);
  player.update(library());
  player.setQueue(player.tracks);
  await player.play("b");
  assert.equal(player.currentId, "b");
  assert.equal(audio.paused, false);
  const reordered = library();
  reordered.tracks.reverse();
  player.update(reordered);
  assert.equal(player.currentId, "b");
  assert.equal(audio.paused, false);
  player.advance(1);
  assert.equal(player.currentId, "c");
  player.toggle();
  assert.ok(audio.paused);
});
test("seeking clamps safely, repeat-one restarts, removing current track clears playback", async () => {
  const audio = new FakeAudio(),
    player = new Player(audio);
  const state = library();
  state.settings.repeat = "one";
  player.update(state);
  await player.play("a");
  player.seekBy(200);
  assert.equal(audio.currentTime, 90);
  player.seek(-5);
  assert.equal(audio.currentTime, 0);
  audio.currentTime = 90;
  audio.dispatchEvent(new Event("ended"));
  assert.equal(player.currentId, "a");
  assert.equal(audio.currentTime, 0);
  player.update({ ...state, tracks: state.tracks.slice(1) });
  assert.equal(player.currentId, null);
  assert.ok(audio.paused);
});
test("repeat-all wraps and invalid audio errors remain recoverable", async () => {
  const audio = new FakeAudio(),
    player = new Player(audio);
  const state = library();
  state.settings.repeat = "all";
  player.update(state);
  await player.play("c");
  player.advance(1);
  assert.equal(player.currentId, "a");
  audio.dispatchEvent(new Event("error"));
  assert.match(player.status, /Unable to play/);
  player.clear();
  assert.equal(player.status, "");
});

test("shuffle visits each queued song before stopping when repeat is off", async () => {
  const audio = new FakeAudio(),
    player = new Player(audio),
    state = library();
  state.settings.shuffle = true;
  player.update(state);
  player.setQueue(player.tracks);
  await player.play("a");
  const played = new Set(["a"]);
  await player.advance(1, true);
  played.add(player.currentId);
  await player.advance(1, true);
  played.add(player.currentId);
  assert.equal(played.size, 3);
  const last = player.currentId;
  await player.advance(1, true);
  assert.equal(player.currentId, last);
});
