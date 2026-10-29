import {
  filename,
  formatTime,
  normalizeLibrary,
  selectTracks,
  validUrl,
} from "./js/model.js";
import { dispatch, fileStore, subscribe, isExtension } from "./js/store.js";
import { icon, hydrateIcons } from "./js/icons.js";
import { createMetadataQueue } from "./js/metadata.js";
import { Player } from "./js/player.js";
import { exportLibrary, importLibrary } from "./js/portability.js";

const $ = (selector) => document.querySelector(selector);
const audio = $("#audio-player");
const player = new Player(audio);
let library = normalizeLibrary(null);
let view = "all",
  query = "",
  sort = "custom",
  visible = [],
  infoId = null,
  selectedFiles = [];
let listSignature = "",
  drag = null,
  toastTimer,
  volumeTimer;
let publishedState = "";
const loadMetadata = createMetadataQueue((id, patch) =>
  mutate({ type: "patch", id, patch, automatic: true }),
);
hydrateIcons();

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 4200);
}
function guard(task) {
  return Promise.resolve()
    .then(task)
    .catch((error) =>
      toast(error.message || "Something went wrong. Please try again."),
    );
}
async function mutate(action) {
  const updated = await dispatch(action);
  receive(updated);
  return updated;
}
function settings(patch) {
  return guard(() => mutate({ type: "settings", settings: patch }));
}
function receive(updated) {
  library = updated;
  document.documentElement.dataset.theme = library.settings.theme;
  const light = library.settings.theme === "light";
  $("#theme-button").innerHTML = icon(light ? "moon" : "sun");
  $("#theme-button").setAttribute(
    "aria-label",
    `Switch to ${light ? "dark" : "light"} theme`,
  );
  player.update(library);
  renderLibrary();
  loadMetadata(library.tracks);
  if (infoId && !library.tracks.some((track) => track.id === infoId)) {
    $("#info-dialog").close();
    $("#remove-dialog").close();
    infoId = null;
  }
  updateOrderButtons();
}

function renderLibrary() {
  visible = selectTracks(library.tracks, { view, query, sort });
  const names = {
    all: "All tracks",
    favorites: "Favorites",
    recent: "Recently added",
  };
  $("#collection-name").textContent = query ? "Search results" : names[view];
  $("#visible-count").textContent = visible.length;
  $("#all-count").textContent = library.tracks.length;
  $("#favorite-count").textContent = library.tracks.filter(
    (track) => track.favorite,
  ).length;
  $("#collection-hint").textContent = query
    ? `Matching “${query}” in ${names[view].toLowerCase()}.`
    : library.tracks.length
      ? canReorder()
        ? "Drag the grip to make the order your own."
        : "Choose Custom order in All tracks to rearrange songs."
      : "Your next favorite is already out there.";
  $("#footer-count").textContent =
    `${library.tracks.length} TRACK${library.tracks.length === 1 ? "" : "S"} IN YOUR COLLECTION`;
  const duration = library.tracks.reduce(
    (total, track) => total + track.duration,
    0,
  );
  const albums = new Set(
    library.tracks.map((track) => track.album).filter(Boolean),
  ).size;
  $("#library-stats").textContent =
    `${library.tracks.length} track${library.tracks.length === 1 ? "" : "s"} · ${duration ? `${Math.ceil(duration / 60)} min of your music` : "Make room for your favorites"}${albums ? ` · ${albums} album${albums === 1 ? "" : "s"}` : ""}`;
  $("#play-all").disabled = $("#shuffle-all").disabled = !visible.length;
  for (const button of document.querySelectorAll("[data-view]")) {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  const empty = $("#empty-state");
  empty.hidden = !!visible.length;
  empty.querySelector("h3").textContent = query
    ? "No tracks found."
    : view === "favorites"
      ? "Keep your favorites close."
      : "Your soundtrack starts here.";
  empty.querySelector("p").textContent = query
    ? "Try another title, artist, or album."
    : view === "favorites"
      ? "Tap the heart on a track to save it here."
      : "Add a song link, import audio files, or collect music from the websites you visit.";
  $("#empty-add").hidden =
    !!query || (view === "favorites" && !!library.tracks.length);
  empty.querySelector("small").hidden = !!query || view === "favorites";
  const signature = JSON.stringify([visible, canReorder()]);
  if (signature === listSignature || drag) return;
  listSignature = signature;
  const focusId = document.activeElement?.closest(".track-row")?.dataset.id;
  const focusAction = document.activeElement?.dataset.action;
  const fragment = document.createDocumentFragment();
  visible.forEach((track, index) => fragment.append(createRow(track, index)));
  $("#track-list").replaceChildren(fragment);
  if (focusId && focusAction)
    $(
      `.track-row[data-id="${CSS.escape(focusId)}"] [data-action="${focusAction}"]`,
    )?.focus({ preventScroll: true });
  renderPlayer();
}

function createRow(track, index) {
  const row = document.createElement("article");
  row.className = "track-row";
  row.dataset.id = track.id;
  row.setAttribute("role", "listitem");
  row.innerHTML = `<div class="track-leading"><span class="track-number"></span><button class="icon-button drag-handle" data-action="drag" draggable="true">${icon("grip")}</button></div><div class="track-content"><button class="track-cover" data-action="play"><span class="cover-art">${icon("music")}</span><span class="cover-play">${icon("play")}</span></button><div class="track-copy"><button class="track-title" data-action="play"></button><span class="track-subtitle"></span></div></div><span class="track-album album-column"></span><time class="track-date date-column"></time><span class="track-duration"></span><div class="track-actions"><button class="icon-button favorite" data-action="favorite">${icon("heart")}</button><button class="icon-button" data-action="info">${icon("more")}</button></div>`;
  row.querySelector(".track-number").textContent = String(index + 1).padStart(
    2,
    "0",
  );
  const handle = row.querySelector(".drag-handle");
  handle.disabled = !canReorder();
  handle.setAttribute(
    "aria-label",
    `Reorder ${track.title}. Alt and arrow keys to move.`,
  );
  handle.title = canReorder()
    ? "Drag to reorder · Alt + ↑ / ↓"
    : "Choose Custom order to reorder";
  row.querySelector(".track-title").textContent = track.title;
  row.querySelector(".track-title").title = track.title;
  row.querySelector(".track-subtitle").textContent =
    track.artist ||
    (track.metadataState === "pending"
      ? "Reading song information…"
      : "Unknown artist");
  row.querySelector(".track-album").textContent = track.album || "—";
  const date = new Date(track.addedAt);
  row.querySelector(".track-date").textContent = date.toLocaleDateString(
    undefined,
    { month: "short", day: "numeric" },
  );
  row.querySelector(".track-date").dateTime = date.toISOString();
  row.querySelector(".track-duration").textContent = track.duration
    ? formatTime(track.duration)
    : "—";
  const favorite = row.querySelector(".favorite");
  favorite.classList.toggle("active", track.favorite);
  favorite.setAttribute("aria-pressed", String(track.favorite));
  favorite.setAttribute(
    "aria-label",
    `${track.favorite ? "Remove" : "Add"} ${track.title} ${track.favorite ? "from" : "to"} favorites`,
  );
  row
    .querySelector('[data-action="info"]')
    .setAttribute("aria-label", `Details and actions for ${track.title}`);
  row
    .querySelector(".track-cover")
    .setAttribute("aria-label", `Play ${track.title}`);
  const colors = [
    "#3e4931",
    "#49403c",
    "#393d50",
    "#4a3b4c",
    "#34504a",
    "#4d462d",
  ];
  row
    .querySelector(".track-cover")
    .style.setProperty("--cover-color", colors[index % colors.length]);
  if (track.cover) {
    const image = new Image();
    image.src = track.cover;
    image.alt = "";
    image.loading = "lazy";
    row.querySelector(".cover-art").replaceWith(image);
  }
  return row;
}

function renderPlayer() {
  const track = player.track,
    playing = !!track && !audio.paused;
  $("#player-title").textContent = track?.title || "Nothing playing yet";
  $("#player-artist").textContent = track
    ? track.artist || "Unknown artist"
    : "Find something you love.";
  $("#player-status").textContent = player.status;
  $("#play").innerHTML = icon(playing ? "pause" : "play");
  $("#play").setAttribute("aria-label", playing ? "Pause" : "Play");
  $("#play").disabled =
    $("#next").disabled =
    $("#previous").disabled =
      !library.tracks.length;
  $("#player-favorite").disabled = !track;
  $("#player-favorite").classList.toggle("active", !!track?.favorite);
  $("#player-favorite").setAttribute(
    "aria-label",
    track?.favorite
      ? "Remove current song from favorites"
      : "Add current song to favorites",
  );
  const cover = $("#player-cover");
  if (cover.dataset.track !== `${track?.id}:${track?.cover}`) {
    cover.dataset.track = `${track?.id}:${track?.cover}`;
    if (track?.cover) {
      const image = new Image();
      image.src = track.cover;
      image.alt = "";
      cover.replaceChildren(image);
    } else cover.innerHTML = icon("music");
  }
  $("#elapsed").textContent = formatTime(audio.currentTime);
  const duration = Number.isFinite(audio.duration)
    ? audio.duration
    : track?.duration || 0;
  $("#duration").textContent = formatTime(duration);
  const progress = duration
    ? Math.min(100, (audio.currentTime / duration) * 100)
    : 0;
  $("#seek").disabled = !Number.isFinite(audio.duration) || !audio.duration;
  $("#seek").value = String(progress);
  $("#seek").style.setProperty("--progress", `${progress}%`);
  $("#seek").setAttribute(
    "aria-valuetext",
    `${formatTime(audio.currentTime)} of ${formatTime(duration)}`,
  );
  $("#volume").value = String(audio.volume);
  $("#volume").style.setProperty(
    "--progress",
    `${audio.muted ? 0 : audio.volume * 100}%`,
  );
  $("#mute").innerHTML = icon(
    audio.muted || audio.volume === 0 ? "muted" : "volume",
  );
  $("#mute").setAttribute("aria-label", audio.muted ? "Unmute" : "Mute");
  $("#shuffle").classList.toggle("active", library.settings.shuffle);
  $("#shuffle").setAttribute("aria-pressed", String(library.settings.shuffle));
  $("#repeat").classList.toggle("active", library.settings.repeat !== "off");
  $("#repeat").innerHTML = icon(
    library.settings.repeat === "one" ? "repeatOne" : "repeat",
  );
  $("#repeat").setAttribute("aria-label", `Repeat ${library.settings.repeat}`);
  $("#repeat").title = `Repeat: ${library.settings.repeat} (R)`;
  for (const row of document.querySelectorAll(".track-row")) {
    const current = row.dataset.id === track?.id;
    row.classList.toggle("current", current);
    if (current) row.setAttribute("aria-current", "true");
    else row.removeAttribute("aria-current");
    const coverPlay = row.querySelector(".cover-play");
    const mode = current && playing ? "pause" : "play";
    if (coverPlay.dataset.mode !== mode) {
      coverPlay.innerHTML = icon(mode);
      coverPlay.dataset.mode = mode;
    }
  }
}
function popupState() {
  return {
    trackId: player.currentId,
    playing: !!player.track && !audio.paused,
  };
}
function publishPlayer() {
  if (!isExtension) return;
  const state = popupState(),
    signature = JSON.stringify(state);
  if (signature === publishedState) return;
  publishedState = signature;
  chrome.runtime
    .sendMessage({ channel: "music-library-status", state })
    .catch(() => {});
}
player.addEventListener("change", () => {
  renderPlayer();
  publishPlayer();
});
audio.addEventListener("loadedmetadata", () => {
  const track = player.track;
  if (
    track &&
    Number.isFinite(audio.duration) &&
    Math.abs(track.duration - audio.duration) > 1
  )
    guard(() =>
      mutate({
        type: "patch",
        id: track.id,
        patch: { duration: audio.duration },
        automatic: true,
      }),
    );
});

function openAdd() {
  $("#add-form").reset();
  selectedFiles = [];
  $("#file-selection").textContent = $("#add-error").textContent = "";
  $("#add-dialog").showModal();
}
for (const id of ["add-button", "empty-add"])
  $(`#${id}`).addEventListener("click", openAdd);
for (const button of document.querySelectorAll("[data-close]"))
  button.addEventListener("click", () => button.closest("dialog").close());
for (const dialog of document.querySelectorAll("dialog"))
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    }
  });
$("#shortcut-button").addEventListener("click", () =>
  $("#shortcuts-dialog").showModal(),
);
$("#theme-button").addEventListener("click", () =>
  settings({ theme: library.settings.theme === "dark" ? "light" : "dark" }),
);
$("#navigation").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (button) {
    view = button.dataset.view;
    renderLibrary();
  }
});
$("#search").addEventListener("input", (event) => {
  query = event.target.value;
  renderLibrary();
});
$("#sort").addEventListener("change", (event) => {
  sort = event.target.value;
  renderLibrary();
});
$("#export-library").addEventListener("click", () => {
  const document = exportLibrary(library);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(document, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `music-library-${new Date().toISOString().slice(0, 10)}.json`;
  window.document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  const local = library.tracks.length - document.tracks.length;
  toast(
    `Exported ${document.tracks.length} song links with their order and information.${local ? ` ${local} local audio file${local === 1 ? " is" : "s are"} stored only on this device.` : ""}`,
  );
});
$("#import-library").addEventListener("click", () =>
  $("#library-file").click(),
);
$("#library-file").addEventListener("change", (event) =>
  guard(async () => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024)
      throw new Error("Choose a library file smaller than 20 MB.");
    const tracks = importLibrary(await file.text());
    const before = new Set(library.tracks.map((track) => track.url));
    const updated = await mutate({ type: "add", tracks });
    const added = updated.tracks.filter(
      (track) => !before.has(track.url),
    ).length;
    toast(
      `${added} track${added === 1 ? "" : "s"} imported. Existing songs kept; duplicate links skipped.`,
    );
  }),
);
$("#track-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]"),
    row = button?.closest(".track-row");
  if (!row) return;
  const id = row.dataset.id;
  if (button.dataset.action === "play") {
    player.setQueue(visible);
    if (player.currentId === id) player.toggle();
    else player.play(id);
  }
  if (button.dataset.action === "favorite")
    guard(() => mutate({ type: "favorite", id }));
  if (button.dataset.action === "info") openInfo(id);
});
$("#play-all").addEventListener("click", () => {
  player.setQueue(visible);
  player.play(visible[0]?.id);
});
$("#shuffle-all").addEventListener("click", () => {
  player.setQueue(visible);
  settings({ shuffle: true });
  player.play(visible[Math.floor(Math.random() * visible.length)]?.id);
});
$("#play").addEventListener("click", () => {
  if (!player.currentId) player.setQueue(visible);
  player.toggle();
});
$("#previous").addEventListener("click", () => player.advance(-1));
$("#next").addEventListener("click", () => player.advance(1));
function toggleShuffle() {
  settings({ shuffle: !library.settings.shuffle });
}
function cycleRepeat() {
  const modes = ["off", "all", "one"];
  const repeat = modes[(modes.indexOf(library.settings.repeat) + 1) % 3];
  settings({ repeat });
  toast(`Repeat ${repeat}`);
}
$("#shuffle").addEventListener("click", toggleShuffle);
$("#repeat").addEventListener("click", cycleRepeat);
$("#player-favorite").addEventListener(
  "click",
  () =>
    player.currentId &&
    guard(() => mutate({ type: "favorite", id: player.currentId })),
);
$("#seek").addEventListener("input", (event) =>
  player.seek((Number(event.target.value) / 100) * audio.duration),
);
function setVolume(value) {
  audio.volume = Math.max(0, Math.min(1, value));
  audio.muted = false;
  clearTimeout(volumeTimer);
  volumeTimer = setTimeout(() => settings({ volume: audio.volume }), 250);
}
$("#volume").addEventListener("input", (event) =>
  setVolume(Number(event.target.value)),
);
function toggleMute() {
  audio.muted = !audio.muted;
}
$("#mute").addEventListener("click", toggleMute);

function chooseFiles(files) {
  const accepted = Array.from(files).filter(
    (file) =>
      file.type.startsWith("audio/") ||
      /\.(mp3|m4a|wav|ogg|flac|aac|opus|webm|wma)$/i.test(file.name),
  );
  selectedFiles = [...selectedFiles, ...accepted];
  $("#file-selection").textContent = selectedFiles.length
    ? `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} selected`
    : "Choose an audio file to continue.";
  if (accepted.length !== files.length)
    $("#add-error").textContent = "Only audio files can be imported.";
}
$("#audio-files").addEventListener("change", (event) =>
  chooseFiles(event.target.files),
);
$("#file-drop").addEventListener("dragover", (event) => {
  event.preventDefault();
  $("#file-drop").classList.add("drag-over");
});
$("#file-drop").addEventListener("dragleave", () =>
  $("#file-drop").classList.remove("drag-over"),
);
$("#file-drop").addEventListener("drop", (event) => {
  event.preventDefault();
  $("#file-drop").classList.remove("drag-over");
  chooseFiles(event.dataTransfer.files);
});
$("#add-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = $("#add-error");
  error.textContent = "";
  const urls = $("#song-urls")
    .value.split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (urls.some((url) => !validUrl(url))) {
    error.textContent =
      "Enter valid http:// or https:// audio links, one per line.";
    return;
  }
  if (!urls.length && !selectedFiles.length) {
    error.textContent = "Add an audio link or choose some audio files first.";
    return;
  }
  $("#add-submit").disabled = true;
  const storedIds = [];
  let committed = false;
  try {
    const tracks = urls.map((url) => ({ url: validUrl(url) }));
    for (const file of selectedFiles) {
      const id = crypto.randomUUID();
      await fileStore("put", id, file);
      storedIds.push(id);
      tracks.push({
        id,
        url: `local:${id}`,
        title: filename(
          `https://local.invalid/${encodeURIComponent(file.name)}`,
        ),
      });
    }
    const before = new Set(library.tracks.map((track) => track.id));
    const updated = await mutate({ type: "add", tracks });
    committed = true;
    const count = updated.tracks.filter(
      (track) => !before.has(track.id),
    ).length;
    $("#add-dialog").close();
    toast(
      count
        ? `${count} track${count === 1 ? "" : "s"} added. Make yourself at home.`
        : "Those tracks are already in your library.",
    );
  } catch (err) {
    if (!committed)
      await Promise.allSettled(storedIds.map((id) => fileStore("delete", id)));
    error.textContent = err.message || "Could not import these tracks.";
  } finally {
    $("#add-submit").disabled = false;
  }
});

function openInfo(id) {
  const track = library.tracks.find((track) => track.id === id);
  if (!track) return;
  infoId = id;
  $("#info-title").value = track.title;
  $("#info-artist").value = track.artist;
  $("#info-album").value = track.album;
  $("#info-source").textContent =
    `${track.duration ? `${formatTime(track.duration)} · ` : ""}${track.url.startsWith("local:") ? "Imported file · Stored on this device" : track.url}`;
  $("#info-error").textContent = "";
  updateOrderButtons();
  $("#info-dialog").showModal();
}
function updateOrderButtons() {
  const index = library.tracks.findIndex((track) => track.id === infoId);
  $("#move-up").disabled = index <= 0;
  $("#move-down").disabled = index < 0 || index === library.tracks.length - 1;
}
$("#info-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = $("#info-title").value.trim();
  if (!title) {
    $("#info-error").textContent = "Give this track a title.";
    return;
  }
  try {
    await mutate({
      type: "patch",
      id: infoId,
      patch: {
        title,
        artist: $("#info-artist").value.trim(),
        album: $("#info-album").value.trim(),
        metadataState: "edited",
      },
    });
    $("#info-dialog").close();
    toast("Track information updated.");
  } catch (error) {
    $("#info-error").textContent = error.message;
  }
});
$("#remove-track").addEventListener("click", () => {
  const track = library.tracks.find((track) => track.id === infoId);
  if (!track) return;
  $("#remove-description").textContent =
    `“${track.title}” will be removed from your library${track.url.startsWith("local:") ? " and its imported copy will be deleted. Your original file stays untouched." : "."}`;
  $("#info-dialog").close();
  $("#remove-dialog").showModal();
});
$("#confirm-remove").addEventListener("click", () =>
  guard(async () => {
    const track = library.tracks.find((track) => track.id === infoId);
    if (!track) return;
    await mutate({ type: "remove", id: track.id });
    if (track.url.startsWith("local:")) await fileStore("delete", track.id);
    $("#remove-dialog").close();
    toast("Track removed.");
  }),
);

function canReorder() {
  return sort === "custom" && view !== "recent";
}
async function moveRelative(id, delta, visibleOrder = false) {
  const tracks = visibleOrder ? visible : library.tracks;
  const index = tracks.findIndex((track) => track.id === id);
  const target = tracks[index + delta];
  if (!target) return;
  await reorder(id, target.id, delta > 0);
  $("#announcer").textContent =
    `Moved ${library.tracks.find((track) => track.id === id)?.title} ${delta > 0 ? "down" : "up"}.`;
}
async function reorder(id, targetId, after) {
  await mutate({ type: "move", id, targetId, after });
  const queued = new Set(player.queue);
  player.setQueue(library.tracks.filter((track) => queued.has(track.id)));
}
$("#move-up").addEventListener("click", () =>
  guard(() => moveRelative(infoId, -1)),
);
$("#move-down").addEventListener("click", () =>
  guard(() => moveRelative(infoId, 1)),
);
$("#track-list").addEventListener("keydown", (event) => {
  if (
    event.altKey &&
    ["ArrowUp", "ArrowDown"].includes(event.key) &&
    event.target.dataset.action === "drag" &&
    canReorder()
  ) {
    event.preventDefault();
    guard(() =>
      moveRelative(
        event.target.closest(".track-row").dataset.id,
        event.key === "ArrowUp" ? -1 : 1,
        true,
      ),
    );
  }
});
function clearDropMarks() {
  for (const row of document.querySelectorAll(".drop-before,.drop-after"))
    row.classList.remove("drop-before", "drop-after");
}
function dragOver(x, y) {
  clearDropMarks();
  const row = document.elementFromPoint(x, y)?.closest(".track-row");
  if (!row || row.dataset.id === drag?.id) {
    if (drag) drag.targetId = null;
    return;
  }
  const rect = row.getBoundingClientRect();
  drag.targetId = row.dataset.id;
  drag.after = y > rect.top + rect.height / 2;
  row.classList.add(drag.after ? "drop-after" : "drop-before");
  if (y > innerHeight - 200) window.scrollBy(0, 14);
  else if (y < 100) window.scrollBy(0, -14);
}
function startDrag(id) {
  if (!canReorder()) return;
  drag = { id, targetId: null, after: false };
  document.body.classList.add("is-dragging");
  $(`.track-row[data-id="${CSS.escape(id)}"]`)?.classList.add("dragging");
}
function finishDrag(commit = true) {
  if (!drag) return;
  const move = drag;
  drag = null;
  clearDropMarks();
  document.body.classList.remove("is-dragging");
  document.querySelector(".dragging")?.classList.remove("dragging");
  if (commit && move.targetId)
    guard(async () => {
      await reorder(move.id, move.targetId, move.after);
      $("#announcer").textContent = "Playlist order updated.";
    });
  listSignature = "";
  renderLibrary();
}
$("#track-list").addEventListener("dragstart", (event) => {
  const handle = event.target.closest('[data-action="drag"]');
  if (!handle || !canReorder()) {
    event.preventDefault();
    return;
  }
  startDrag(handle.closest(".track-row").dataset.id);
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", drag.id);
});
$("#track-list").addEventListener("dragover", (event) => {
  if (drag) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    dragOver(event.clientX, event.clientY);
  }
});
$("#track-list").addEventListener("drop", (event) => {
  if (drag) {
    event.preventDefault();
    finishDrag();
  }
});
$("#track-list").addEventListener("dragend", () => finishDrag(false));
$("#track-list").addEventListener("pointerdown", (event) => {
  const handle = event.target.closest('[data-action="drag"]');
  if (event.pointerType !== "touch" || !handle || !canReorder()) return;
  event.preventDefault();
  handle.setPointerCapture(event.pointerId);
  startDrag(handle.closest(".track-row").dataset.id);
});
$("#track-list").addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch" && drag) {
    event.preventDefault();
    dragOver(event.clientX, event.clientY);
  }
});
$("#track-list").addEventListener("pointerup", (event) => {
  if (event.pointerType === "touch") finishDrag();
});
$("#track-list").addEventListener("pointercancel", () => finishDrag(false));

document.addEventListener("keydown", (event) => {
  if (
    event.defaultPrevented ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.repeat ||
    event.isComposing
  )
    return;
  if (document.querySelector("dialog[open]")) return;
  const typing = event.target.closest(
    'input,textarea,select,[contenteditable="true"]',
  );
  if (typing) {
    if (event.key === "Escape" && event.target === $("#search")) {
      $("#search").value = query = "";
      renderLibrary();
      $("#search").blur();
    }
    return;
  }
  let handled = true;
  switch (event.key.toLowerCase()) {
    case " ":
      if (event.target.closest("button,a")) handled = false;
      else player.toggle();
      break;
    case "arrowright":
      if (event.shiftKey) player.advance(1);
      else player.seekBy(5);
      break;
    case "arrowleft":
      if (event.shiftKey) player.advance(-1);
      else player.seekBy(-5);
      break;
    case "arrowup":
      setVolume(audio.volume + 0.05);
      break;
    case "arrowdown":
      setVolume(audio.volume - 0.05);
      break;
    case "m":
      toggleMute();
      break;
    case "s":
      toggleShuffle();
      break;
    case "r":
      cycleRepeat();
      break;
    case "/":
      $("#search").focus();
      break;
    case "?":
      $("#shortcuts-dialog").showModal();
      break;
    default:
      handled = false;
  }
  if (handled) event.preventDefault();
});
subscribe(receive);
guard(async () => {
  receive(await dispatch());
  if (location.hash === "#add") openAdd();
  if (location.hash.startsWith("#play")) {
    player.setQueue(library.tracks);
    const id = location.hash.startsWith("#play=")
      ? decodeURIComponent(location.hash.slice(6))
      : library.tracks[0]?.id;
    player.play(id);
  }
});
if (isExtension)
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (
      sender.id !== chrome.runtime.id ||
      message?.channel !== "music-library-player"
    )
      return false;
    const act = async () => {
      if (message.action === "toggle") await player.toggle();
      if (message.action === "next") await player.advance(1);
      if (message.action === "previous") await player.advance(-1);
      if (message.action === "play") {
        player.setQueue(library.tracks);
        await player.play(message.id);
      }
      return { state: popupState() };
    };
    act().then(respond, (error) => respond({ error: error.message }));
    return true;
  });
window.addEventListener("pagehide", () => {
  clearTimeout(volumeTimer);
  if (player.objectUrl) URL.revokeObjectURL(player.objectUrl);
});
