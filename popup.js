import { dispatch, subscribe, isExtension } from "./js/store.js";
import { normalizeLibrary, selectTracks, formatTime } from "./js/model.js";
import { icon, hydrateIcons } from "./js/icons.js";

const $ = (selector) => document.querySelector(selector);
let library = normalizeLibrary(null),
  state = null;
hydrateIcons();
function message(text) {
  $("#popup-message").textContent = text;
}
async function openLibrary(hash = "") {
  if (isExtension)
    await chrome.tabs.create({
      url: chrome.runtime.getURL(`index.html${hash}`),
    });
  else window.open(`index.html${hash}`, "_blank", "noopener");
}
function render() {
  document.documentElement.dataset.theme = library.settings.theme;
  $("#popup-theme").innerHTML = icon(
    library.settings.theme === "dark" ? "sun" : "moon",
  );
  $("#popup-count").textContent = library.tracks.length;
  const tracks = selectTracks(library.tracks, {
    query: $("#popup-search").value,
  });
  $("#popup-empty").hidden = !!tracks.length;
  $("#popup-empty").textContent = library.tracks.length
    ? "No tracks found. Try another title or artist."
    : "Your soundtrack starts here. Add your first tracks in the library.";
  const fragment = document.createDocumentFragment();
  for (const track of tracks) {
    const item = document.createElement("div");
    item.setAttribute("role", "listitem");
    const button = document.createElement("button");
    button.className = "popup-track";
    button.classList.toggle("current", track.id === state?.trackId);
    button.setAttribute("aria-label", `Play ${track.title}`);
    button.innerHTML = `<span>${icon("play")}</span><span><strong></strong><small></small></span><time></time>`;
    button.querySelector("strong").textContent = track.title;
    button.querySelector("small").textContent =
      track.artist || "Unknown artist";
    button.querySelector("time").textContent = track.duration
      ? formatTime(track.duration)
      : "—";
    if (track.cover) {
      const image = new Image();
      image.src = track.cover;
      image.alt = "";
      button.firstElementChild.replaceChildren(image);
    }
    button.addEventListener("click", () => control("play", track.id));
    item.append(button);
    fragment.append(item);
  }
  $("#popup-tracks").replaceChildren(fragment);
  renderPlayer();
}
function renderPlayer() {
  const track = library.tracks.find((track) => track.id === state?.trackId);
  $("#popup-player-label").textContent = track
    ? state.playing
      ? "NOW PLAYING"
      : "READY WHEN YOU ARE"
    : "YOUR NEXT LISTEN";
  $("#popup-title").textContent = track?.title || "Find your frequency.";
  $("#popup-artist").textContent = track
    ? track.artist || "Unknown artist"
    : "Your collection is one click away.";
  $("#popup-play").innerHTML = icon(state?.playing ? "pause" : "play");
  $("#popup-play").setAttribute(
    "aria-label",
    state?.playing ? "Pause" : "Play",
  );
  $("#popup-previous").disabled = $("#popup-next").disabled = !state;
  $("#popup-play").disabled = !library.tracks.length;
  if (track?.cover) {
    const image = new Image();
    image.src = track.cover;
    image.alt = "";
    $("#popup-cover").replaceChildren(image);
  } else $("#popup-cover").innerHTML = icon("music");
}
async function control(action, id) {
  try {
    const response = isExtension
      ? await chrome.runtime.sendMessage({
          channel: "music-library-control",
          action,
          id,
        })
      : { state: null };
    if (response.error) throw new Error(response.error);
    state = response.state;
    if (!state && action !== "state") {
      await openLibrary(id ? `#play=${encodeURIComponent(id)}` : "#play");
      return;
    }
    render();
  } catch (error) {
    message(error.message || "Open your library to start listening.");
  }
}
$("#popup-search").addEventListener("input", render);
$("#popup-open").addEventListener("click", () => openLibrary());
$("#popup-brand").addEventListener("click", (event) => {
  event.preventDefault();
  openLibrary();
});
$("#popup-add").addEventListener("click", () => openLibrary("#add"));
$("#popup-play").addEventListener("click", () => control("toggle"));
$("#popup-previous").addEventListener("click", () => control("previous"));
$("#popup-next").addEventListener("click", () => control("next"));
$("#popup-theme").addEventListener("click", async () => {
  try {
    library = await dispatch({
      type: "settings",
      settings: { theme: library.settings.theme === "dark" ? "light" : "dark" },
    });
    render();
  } catch (error) {
    message(error.message);
  }
});
subscribe((updated) => {
  library = updated;
  render();
});
if (isExtension)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "session" && changes.player) {
      state = changes.player.newValue?.state || null;
      render();
    }
  });
try {
  library = await dispatch();
  render();
  await control("state");
} catch (error) {
  message(error.message);
}
