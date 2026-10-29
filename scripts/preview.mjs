// A development-only static preview. The extension itself needs no server.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve(import.meta.dirname, "..");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".otf": "font/otf",
};
const wav = Buffer.alloc(44 + 8000 * 2 * 90);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24);
wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(wav.length - 44, 40);
http
  .createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, "http://localhost").pathname;
      res.setHeader("Cache-Control", "no-store");
      if (pathname === "/__test/audio.wav") {
        res.setHeader("Content-Type", "audio/wav");
        return res.end(wav);
      }
      if (pathname === "/__test/seed") {
        res.setHeader("Content-Type", "text/html");
        return res.end(
          '<!doctype html><script src="/__test/seed.js"></script>',
        );
      }
      if (pathname === "/__test/seed.js") {
        const examples = [
          ["Weightless", "Marconi Union", "Ambient Transmissions"],
          ["Open Eye Signal", "Jon Hopkins", "Immunity"],
          ["A Walk", "Tycho", "Dive"],
          ["Kerala", "Bonobo", "Migration"],
          ["Intro", "The xx", "xx"],
          ["Dayvan Cowboy", "Boards of Canada", "The Campfire Headphase"],
        ];
        const library = {
          version: 2,
          settings: {
            theme: "dark",
            volume: 0.7,
            shuffle: false,
            repeat: "off",
          },
          tracks: examples.map(([title, artist, album], i) => ({
            id: `test-${i}`,
            url: `http://localhost:4173/__test/audio.wav?track=${i}`,
            title,
            artist,
            album,
            duration: 90,
            addedAt: Date.now() - i * 86400000,
            favorite: i === 1 || i === 3,
            metadataState: "ready",
            cover: null,
          })),
        };
        res.setHeader("Content-Type", "text/javascript");
        return res.end(
          `localStorage.setItem('music_library_v2', ${JSON.stringify(JSON.stringify(library))}); location.replace('/index.html');`,
        );
      }
      const file = resolve(
        root,
        "." + decodeURIComponent(pathname === "/" ? "/index.html" : pathname),
      );
      if (
        !file.startsWith(root + sep) ||
        /(?:^|[\\/])\./.test(file.slice(root.length + 1))
      ) {
        res.writeHead(403);
        return res.end();
      }
      res.setHeader(
        "Content-Type",
        types[extname(file)] || "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(4173, "127.0.0.1", () =>
    console.log("Static preview: http://localhost:4173 (Ctrl+C to stop)"),
  );
