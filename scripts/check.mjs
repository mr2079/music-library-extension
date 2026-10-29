import { readFile, readdir, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
const assets = new Set();
const files = [
  "script.js",
  "content.js",
  "popup.js",
  ...(await readdir("js"))
    .filter((file) => file.endsWith(".js"))
    .map((file) => `js/${file}`),
];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr);
  const source = await readFile(file, "utf8");
  for (const [, dependency] of source.matchAll(/\bfrom\s+["'](\.[^"']+)["']/g))
    assets.add(resolve(dirname(file), dependency));
}
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const project = JSON.parse(await readFile("package.json", "utf8"));
if (manifest.manifest_version !== 3 || manifest.version !== project.version)
  throw new Error("The Manifest V3 extension and package versions must match.");
for (const [page, script] of [
  ["index.html", "script.js"],
  ["popup.html", "popup.js"],
]) {
  const html = await readFile(page, "utf8");
  if (/<[^>]+\son\w+\s*=|<script(?![^>]*\bsrc=)[^>]*>/i.test(html))
    throw new Error(
      `Inline JavaScript in ${page} is blocked by extension CSP.`,
    );
  for (const [, asset] of html.matchAll(/(?:src|href)="([^"#]+)"/g))
    assets.add(asset);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  if (ids.length !== new Set(ids).size)
    throw new Error(`Duplicate IDs in ${page}.`);
  const app = await readFile(script, "utf8");
  for (const [, , id] of app.matchAll(/\$\((["'])#([\w-]+)\1\)/g))
    if (!ids.includes(id))
      throw new Error(`Missing UI element #${id} in ${page}.`);
}
for (const file of [
  manifest.background.service_worker,
  ...manifest.content_scripts.flatMap((script) => script.js),
  manifest.action.default_popup,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon),
])
  assets.add(file);
for (const file of ["style.css", "popup.css"]) {
  const source = await readFile(file, "utf8");
  for (const [, asset] of source.matchAll(/url\(["']?([^"')]+)["']?\)/g))
    assets.add(resolve(dirname(file), asset));
}
await Promise.all([...assets].map((file) => access(file)));
console.log(
  `Checked ${files.length} JavaScript files, extension manifest, ${assets.size} asset references, CSP compatibility, and UI bindings.`,
);
