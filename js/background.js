import {
  LIBRARY_KEY,
  LEGACY_KEY,
  normalizeLibrary,
  reduceLibrary,
  validUrl,
} from "./model.js";
let queue = Promise.resolve();
const ownPage = (sender, page) =>
  sender.url?.split(/[?#]/)[0] === chrome.runtime.getURL(page);

async function playerMessage(message, sender) {
  if (message.channel === "music-library-status") {
    if (!ownPage(sender, "index.html") || !sender.tab?.id)
      return { error: "Invalid player." };
    const saved = await chrome.storage.session.get("player");
    if (
      message.state?.trackId ||
      !saved.player ||
      saved.player.tabId === sender.tab.id
    )
      await chrome.storage.session.set({
        player: { tabId: sender.tab.id, state: message.state },
      });
    return { saved: true };
  }
  if (!ownPage(sender, "popup.html")) return { error: "Invalid control." };
  const { player } = await chrome.storage.session.get("player");
  if (!player) return { state: null };
  try {
    return await chrome.tabs.sendMessage(player.tabId, {
      channel: "music-library-player",
      action: message.action || "state",
      id: message.id,
    });
  } catch {
    await chrome.storage.session.remove("player");
    return { state: null };
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (
    ["music-library-status", "music-library-control"].includes(message?.channel)
  ) {
    playerMessage(message, sender).then(respond, (error) =>
      respond({ error: error.message }),
    );
    return true;
  }
  if (message?.channel !== "music-library") return false;
  const fromLibrary =
    ownPage(sender, "index.html") || ownPage(sender, "popup.html");
  if (
    !fromLibrary &&
    (message.action?.type !== "add" ||
      !Array.isArray(message.action.tracks) ||
      message.action.tracks.length > 500)
  ) {
    respond({ error: "This action is only available in your library." });
    return false;
  }
  queue = queue
    .catch(() => {})
    .then(async () => {
      const saved = await chrome.storage.local.get([LIBRARY_KEY, LEGACY_KEY]);
      let library = normalizeLibrary(saved[LIBRARY_KEY], saved[LEGACY_KEY]);
      if (message.action) {
        const action = fromLibrary
          ? message.action
          : {
              type: "add",
              tracks: message.action.tracks
                .filter((track) => validUrl(track?.url))
                .map((track) => ({ url: track.url })),
            };
        library = reduceLibrary(library, action);
      }
      if (message.action || !saved[LIBRARY_KEY])
        await chrome.storage.local.set({ [LIBRARY_KEY]: library });
      return library;
    });
  queue.then(
    (library) => respond(fromLibrary ? { library } : { saved: true }),
    (error) =>
      respond({ error: error.message || "Could not save the library." }),
  );
  return true;
});
