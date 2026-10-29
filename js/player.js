import { fileStore } from "./store.js";

export class Player extends EventTarget {
  constructor(audio) {
    super();
    this.audio = audio;
    this.tracks = [];
    this.queue = [];
    this.currentId = null;
    this.settings = {};
    this.history = [];
    this.shufflePlayed = new Set();
    this.generation = 0;
    this.objectUrl = null;
    this.status = "";
    for (const event of [
      "play",
      "pause",
      "timeupdate",
      "durationchange",
      "volumechange",
    ])
      audio.addEventListener(event, () => this.emit());
    for (const event of ["play", "pause"])
      audio.addEventListener(event, () => this.syncMedia());
    audio.addEventListener("waiting", () => {
      this.status = "Buffering…";
      this.emit();
    });
    audio.addEventListener("playing", () => {
      this.status = "";
      this.emit();
    });
    audio.addEventListener("canplay", () => {
      this.status = "";
      this.emit();
    });
    audio.addEventListener("error", () => {
      if (this.currentId) {
        this.status = "Unable to play. Check the source or try another track.";
        this.emit();
      }
    });
    audio.addEventListener("ended", () => this.advance(1, true));
    if ("mediaSession" in navigator) {
      const actions = {
        play: () => this.resume(),
        pause: () => audio.pause(),
        previoustrack: () => this.advance(-1),
        nexttrack: () => this.advance(1),
        seekbackward: (details) => this.seekBy(-(details.seekOffset || 5)),
        seekforward: (details) => this.seekBy(details.seekOffset || 5),
        seekto: (details) => this.seek(details.seekTime),
      };
      for (const [action, handler] of Object.entries(actions)) {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch {
          /* Some browsers support fewer media keys. */
        }
      }
    }
  }
  emit() {
    this.dispatchEvent(new Event("change"));
  }
  get track() {
    return this.tracks.find((track) => track.id === this.currentId);
  }
  update(library) {
    this.tracks = library.tracks;
    if (this.settings.shuffle !== library.settings.shuffle)
      this.shufflePlayed = new Set(this.currentId ? [this.currentId] : []);
    if (this.settings.volume !== library.settings.volume)
      this.audio.volume = library.settings.volume;
    this.settings = library.settings;
    this.queue = this.queue.filter((id) =>
      this.tracks.some((track) => track.id === id),
    );
    if (this.currentId && !this.track) this.clear();
    this.syncMedia();
    this.emit();
  }
  syncMedia() {
    if (!("mediaSession" in navigator) || !this.track) return;
    const track = this.track;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist || "Unknown artist",
      album: track.album || "",
      artwork: track.cover ? [{ src: track.cover }] : [],
    });
    navigator.mediaSession.playbackState = this.audio.paused
      ? "paused"
      : "playing";
  }
  setQueue(tracks) {
    this.queue = tracks.map((track) => track.id);
    this.shufflePlayed = new Set(this.currentId ? [this.currentId] : []);
  }
  async play(id) {
    const track = this.tracks.find((track) => track.id === id);
    if (!track) return;
    const generation = ++this.generation;
    this.audio.pause();
    if (this.currentId && this.currentId !== id)
      this.history.push(this.currentId);
    this.currentId = id;
    if (this.settings.shuffle) this.shufflePlayed.add(id);
    this.status = "Loading…";
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.audio.removeAttribute("src");
    this.audio.load();
    this.emit();
    try {
      let source = track.url;
      if (source.startsWith("local:")) {
        const file = await fileStore("get", track.id);
        if (generation !== this.generation) return;
        if (!file)
          throw new Error(
            "Local file missing. Remove this track and import it again.",
          );
        source = this.objectUrl = URL.createObjectURL(file);
      }
      if (generation !== this.generation) return;
      this.audio.src = source;
      this.audio.load();
      this.syncMedia();
      await this.audio.play();
      if (generation === this.generation) {
        this.status = "";
        this.emit();
      }
    } catch (error) {
      if (generation !== this.generation) return;
      this.status =
        error.name === "NotAllowedError"
          ? "Press play to start listening."
          : error.name === "AbortError"
            ? ""
            : "Unable to play. Check the source or import the audio file.";
      this.emit();
    }
  }
  async resume() {
    if (!this.track) return this.play(this.queue[0] || this.tracks[0]?.id);
    if (this.audio.error) return this.play(this.currentId);
    try {
      await this.audio.play();
      this.status = "";
    } catch {
      this.status = "Unable to play. Check the source or try another track.";
    }
    this.emit();
  }
  toggle() {
    if (this.audio.paused) return this.resume();
    else {
      this.audio.pause();
      this.syncMedia();
    }
  }
  advance(direction, ended = false) {
    const ids = this.queue.length
      ? this.queue
      : this.tracks.map((track) => track.id);
    if (!ids.length) return;
    if (!this.currentId) return this.play(ids[0]);
    if (ended && this.settings.repeat === "one") {
      this.seek(0);
      return this.resume();
    }
    if (direction < 0 && this.audio.currentTime > 3) {
      this.seek(0);
      return;
    }
    if (direction < 0 && this.settings.shuffle && this.history.length) {
      const id = this.history.pop();
      this.currentId = null;
      return this.play(id);
    }
    if (this.settings.shuffle && direction > 0) {
      let candidates = ids.filter(
        (id) => id !== this.currentId && !this.shufflePlayed.has(id),
      );
      if (!candidates.length && this.settings.repeat === "all") {
        this.shufflePlayed = new Set([this.currentId]);
        candidates = ids.filter((id) => id !== this.currentId);
      }
      if (candidates.length)
        return this.play(
          candidates[Math.floor(Math.random() * candidates.length)],
        );
      if (this.settings.repeat === "all") return this.play(ids[0]);
      return;
    }
    let index = ids.indexOf(this.currentId) + direction;
    if (index < 0 || index >= ids.length) {
      if (this.settings.repeat !== "all") {
        this.syncMedia();
        this.emit();
        return;
      }
      index = (index + ids.length) % ids.length;
    }
    return this.play(ids[index]);
  }
  seek(seconds) {
    if (Number.isFinite(seconds) && Number.isFinite(this.audio.duration))
      this.audio.currentTime = Math.max(
        0,
        Math.min(this.audio.duration, seconds),
      );
  }
  seekBy(seconds) {
    this.seek(this.audio.currentTime + seconds);
  }
  clear() {
    this.generation++;
    this.audio.pause();
    this.currentId = null;
    this.history = [];
    this.status = "";
    this.audio.removeAttribute("src");
    this.audio.load();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
    }
    this.emit();
  }
}
