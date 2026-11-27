import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("manifest instala a PWA no subpath e referencia ícones existentes", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.lang, "pt-BR");
  for (const icon of manifest.icons) {
    const file = fs.readFileSync(path.join(root, icon.src));
    assert.equal(file.readUInt32BE(16), Number(icon.sizes.split("x")[0]));
    assert.equal(file.readUInt32BE(20), Number(icon.sizes.split("x")[1]));
  }
  assert.ok(read("index.html").includes('href="manifest.webmanifest"'));
  assert.ok(read("index.html").includes('src="assets/js/pwa.js"'));
});

test("service worker guarda somente o shell público e ignora dados privados", () => {
  const source = read("sw.js");
  const shellSource = source.slice(source.indexOf("const SHELL"), source.indexOf("].map(asset)"));
  const files = [...shellSource.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(files.includes("index.html"));
  assert.ok(files.includes("backend/src/services/finance.js"));
  assert.ok(files.includes("assets/js/xlsx.js"));
  assert.ok(files.includes("assets/js/attachments.js"));
  for (const file of files) {
    assert.equal(file.startsWith("/"), false);
    assert.equal(file.includes(".env"), false);
    assert.ok(fs.existsSync(path.join(root, file === "./" ? "index.html" : file)), `Arquivo ausente no shell: ${file}`);
  }
  assert.ok(source.includes('path.includes("/api/")'));
  assert.ok(source.includes('path.includes("/backup")'));
  assert.ok(source.includes("attachments\\/(?:content|upload)"));
  assert.ok(source.includes('request.method !== "GET"'));
  assert.ok(source.includes('request.mode === "navigate"'));
});
