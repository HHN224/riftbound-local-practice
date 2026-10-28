import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, "../..");
const exe = path.join(root, "dist/riftbound-local-practice-win-x64.exe");
const home = path.join(root, "dist", "smoke-" + Date.now());
const port = process.env.FUXUAN_PORT || "4181";
const env = {
  ...process.env,
  PATH: path.join(process.env.WINDIR, "System32"),
  FUXUAN_PORT: port,
  FUXUAN_DESKTOP_HOME: home,
};
const run = () =>
  new Promise((resolve, reject) => {
    const p = spawn(exe, ["--no-browser"], {
      env,
      windowsHide: true,
      stdio: "ignore",
    });
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error("Launcher exit " + code)),
    );
  });
await run();
const status = await (
  await fetch("http://127.0.0.1:" + port + "/local-api/status")
).json();
assert.equal(status.source, "Fuxuan APK local Hermes engine");
const image = await fetch(
  "http://127.0.0.1:" +
    port +
    "/card-images/" +
    encodeURIComponent("SFD·197-221.webp"),
);
assert.equal(
  image.status,
  200,
  "Unicode card-image paths must be bundled, not skipped by Git quoting",
);
assert.equal(
  Buffer.from(await image.arrayBuffer())
    .subarray(0, 4)
    .toString(),
  "RIFF",
);
const releases = await fs.readdir(path.join(home, "releases"));
assert.equal(releases.length, 1);
const cache = path.join(home, "releases", releases[0]);
const marker = await fs.stat(path.join(cache, ".complete"));
await run();
assert.equal(
  (await fs.stat(path.join(cache, ".complete"))).mtimeMs,
  marker.mtimeMs,
);
assert.equal((await fs.stat(path.join(cache, "node.exe"))).isFile(), true);
assert.equal(
  await fs
    .readFile(path.join(cache, "community/generated/rules.hbc"))
    .then((x) => x.length > 0),
  true,
);
await fs.writeFile(
  path.join(root, "dist/desktop-smoke.json"),
  JSON.stringify(
    { home, cache, port, nodeInstalledInPath: false, repeatLaunch: true },
    null,
    2,
  ),
);
console.log(
  "PASS: single EXE extracts and starts without Node on PATH; repeated launch reuses cache/server. Port " +
    port,
);
