import { makeTrack, validUrl } from "./model.js";

// A plain, versioned document: no browser IDs, device paths or temporary Blob URLs.
export function exportLibrary(library) {
  const tracks = library.tracks
    .filter((track) => validUrl(track.url))
    .map((track) => ({
      url: track.url,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      addedAt: track.addedAt,
      favorite: track.favorite,
    }));
  return {
    format: "music-library",
    version: 2,
    exportedAt: new Date().toISOString(),
    tracks,
  };
}

export function importLibrary(text) {
  if (text.length > 20 * 1024 * 1024)
    throw new Error("Choose a library file smaller than 20 MB.");
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error("This is not a valid JSON library file.");
  }
  // Also accept v1's URL array, so existing exports can be brought forward.
  const entries = Array.isArray(document)
    ? document.map((url) => ({ url }))
    : document?.format === "music-library" && document.version === 2
      ? document.tracks
      : null;
  if (!Array.isArray(entries))
    throw new Error(
      "Choose a Music Library JSON export or an array of audio URLs.",
    );
  if (entries.length > 10000)
    throw new Error("A library file can contain up to 10,000 tracks.");
  const seen = new Set();
  const tracks = [];
  for (const entry of entries) {
    if (!validUrl(entry?.url))
      throw new Error(
        "The file contains an invalid link. Only http:// and https:// audio links are supported.",
      );
    // Omit IDs, covers, internal paths and metadata flags supplied by the file.
    const track = makeTrack({
      url: entry.url,
      title: typeof entry.title === "string" ? entry.title : undefined,
      artist: typeof entry.artist === "string" ? entry.artist : "",
      album: typeof entry.album === "string" ? entry.album : "",
      duration: entry.duration,
      addedAt: entry.addedAt,
      favorite: entry.favorite,
      metadataState:
        typeof entry.title === "string" && entry.title.trim()
          ? "ready"
          : "pending",
    });
    if (!seen.has(track.url)) {
      tracks.push(track);
      seen.add(track.url);
    }
  }
  return tracks;
}
